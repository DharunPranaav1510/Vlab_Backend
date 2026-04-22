import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth, AuthedRequest } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";
import { env } from "../../config/env.js";
import { runMeshctrlDeviceshare } from "../../services/meshctrl.service.js";
import { addTask } from "../connector/connector.routes.js";

const router = Router();

const bookingSchema = z.object({
  title: z.string().min(1),
  labName: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  duration: z.number().int().min(1).max(4)
});

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user!.sub },
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

router.delete("/mine", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.booking.updateMany({
    where: { userId: req.user!.sub, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED" }
  });

  res.json({ success: true });
});

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


// 🔥 FIXED NON-BLOCKING BOOKING ROUTE
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const input = bookingSchema.parse(req.body);

    const start = new Date(input.start);
    const end = new Date(input.end);

    if (start.getTime() < Date.now())
      throw new AppError("Cannot book in past", 400);

    if (start.getTime() > Date.now() + 3 * 24 * 60 * 60 * 1000)
      throw new AppError("Max 3 days advance booking", 400);

    if (input.duration > 3)
      throw new AppError("Max 3 consecutive slots", 400);

    // overlap check
    const overlap = await prisma.booking.findFirst({
      where: {
        AND: [
          { start: { lt: end } },
          { end: { gt: start } },
          { status: { not: "CANCELLED" } }
        ]
      }
    });

    if (overlap) throw new AppError("Slot overlaps", 409);

    // ✅ CREATE BOOKING IMMEDIATELY
    const booking = await prisma.booking.create({
      data: {
        title: input.title,
        labName: input.labName,
        start,
        end,
        duration: input.duration,
        userId: req.user!.sub,
        rdpLink: null // initially empty
      }
    });

    // ✅ RESPOND IMMEDIATELY (NO BLOCKING)
    res.status(201).json({
      success: true,
      booking,
      message: "Booking confirmed (MeshCentral pending)"
    });

    // 🔥 BACKGROUND PROCESS (DO NOT BLOCK)
    (async () => {
      try {
        const hw = await prisma.hardware.findFirst({
          where: { name: booking.labName }
        });

        const nodeId = hw?.meshNodeId || env.DEFAULT_MESH_NODE_ID || "";

        if (!nodeId) {
          console.warn("No mesh node ID configured");
          return;
        }

        const mesh = await runMeshctrlDeviceshare({
          nodeId,
          startIsoLocal: booking.start.toISOString().slice(0, 19),
          durationMinutes: env.MESH_RDP_DURATION_MINUTES
        });

        console.log("[meshctrl async]", mesh);

        // update link if success
        if (mesh.rdpLink) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { rdpLink: mesh.rdpLink }
          });
        }

        // optional: queue task
        await prisma.connectorTask.create({
          data: {
            type: "BOOKING_CREATE",
            payload: {
              bookingId: booking.id,
              userId: booking.userId,
              labName: booking.labName,
              start: booking.start.toISOString(),
              end: booking.end.toISOString(),
              meshNodeId: nodeId
            }
          }
        });

        addTask({
          bookingId: booking.id,
          userId: booking.userId,
          userEmail: req.user?.email || booking.userId,
          labName: booking.labName,
          start: booking.start.toISOString(),
          end: booking.end.toISOString(),
          meshNodeId: nodeId,
          durationMinutes: env.MESH_RDP_DURATION_MINUTES
        });

      } catch (err) {
        console.error("MeshCentral async error:", err);
      }
    })();

  } catch (err) {
    console.error("Booking error:", err);

    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ message: err.message });
    }

    return res.status(500).json({ message: "Booking failed" });
  }
});

export default router;