import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth, AuthedRequest } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";
import { env } from "../../config/env.js";
import { addTask } from "../connector/connector.routes.js";

const router = Router();

const bookingSchema = z.object({
  title: z.string().min(1),
  labName: z.string().min(1),
  start: z.string().datetime(),
  duration: z.number().int().min(1).max(4)
});

// ================= GET USER BOOKINGS =================
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: {
      userId: req.user!.sub,
      status: { not: "CANCELLED" }
    },
    include: { user: { select: { email: true } } },
    orderBy: { start: "asc" }
  });

  res.json({
    bookings: bookings.map((b) => ({
      ...b,
      userId: b.user?.email || b.userId
    }))
  });
});

// ================= GET ALL BOOKINGS =================
router.get("/all", requireAuth, async (_req: AuthedRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { status: { not: "CANCELLED" } },
    include: { user: { select: { email: true } } },
    orderBy: { start: "asc" }
  });

  res.json({
    bookings: bookings.map((b) => ({
      ...b,
      userId: b.user?.email || b.userId
    }))
  });
});

// ================= DELETE MY BOOKINGS =================
router.delete("/mine", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;

  await prisma.booking.updateMany({
    where: {
      userId,
      status: { not: "CANCELLED" },
      start: { gt: new Date() } // 🔥 only future bookings
    },
    data: { status: "CANCELLED" }
  });

  res.json({ success: true });
});

// ================= DELETE SINGLE =================
router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);

  const booking = await prisma.booking.findUnique({ where: { id } });

  if (!booking) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "Booking not found" }
    });
  }

  if (booking.userId !== req.user!.sub) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Forbidden" }
    });
  }

  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" }
  });

  res.json({ success: true });
});

// ================= CREATE BOOKING =================
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const input = bookingSchema.parse(req.body);

    const start = new Date(input.start);

    if (isNaN(start.getTime())) {
      throw new AppError("Invalid start time", 400);
    }

    const end = new Date(start.getTime() + input.duration * 60 * 60 * 1000);

    // ✅ VALIDATIONS
    if (start.getTime() < Date.now())
      throw new AppError("Cannot book in past", 400);

    if (start.getTime() > Date.now() + 3 * 24 * 60 * 60 * 1000)
      throw new AppError("Max 3 days advance booking", 400);

    // 🔥 TRANSACTION (booking + connector task atomic)
    const result = await prisma.$transaction(async (tx) => {
      const overlap = await tx.booking.findFirst({
        where: {
          labName: input.labName,
          status: { not: "CANCELLED" },
          start: { lt: end },
          end: { gt: start }
        }
      });

      if (overlap) {
        throw new AppError("Slot already booked", 409);
      }

      const booking = await tx.booking.create({
        data: {
          title: input.title,
          labName: input.labName,
          start,
          end,
          duration: input.duration,
          userId: req.user!.sub,
          rdpLink: null
        }
      });

      const hw = await tx.hardware.findFirst({
        where: { name: booking.labName }
      });

      const nodeId = hw?.meshNodeId || env.DEFAULT_MESH_NODE_ID;

      if (!nodeId) {
        throw new AppError("No hardware configured for this lab", 500);
      }

      const taskPayload = {
        bookingId: booking.id,
        userId: booking.userId,
        userEmail: req.user!.email,
        labName: booking.labName,
        start: booking.start.toISOString(),
        end: booking.end.toISOString(),
        meshNodeId: nodeId,
        durationMinutes: input.duration * 60
      };

      await tx.connectorTask.create({
        data: {
          type: "BOOKING_CREATE",
          status: "PENDING",
          payload: taskPayload
        }
      });

      return { booking, taskPayload };
    }, {
      isolationLevel: "Serializable"
    });

    // 🔥 push to connector ONLY after transaction succeeds
    addTask(result.taskPayload);

    return res.status(201).json({
      success: true,
      booking: result.booking,
      message: "Booking confirmed"
    });

  } catch (err) {
    console.error("Booking error:", err);

    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ message: err.message });
    }

    return res.status(500).json({ message: "Booking failed" });
  }
});

export default router;
