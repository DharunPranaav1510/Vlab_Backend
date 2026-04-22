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
  if (!booking) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Booking not found" } });
  if (booking.userId !== req.user!.sub) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Forbidden" } });
  await prisma.booking.update({ where: { id }, data: { status: "CANCELLED" } });
  res.json({ success: true });
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const input = bookingSchema.parse(req.body);
  const start = new Date(input.start);
  const end = new Date(input.end);

  if (start.getTime() < Date.now()) throw new AppError("Cannot book in past", 400);
  if (start.getTime() > Date.now() + 3 * 24 * 60 * 60 * 1000) throw new AppError("Max 3 days advance booking", 400);
  if (input.duration > 3) throw new AppError("Max 3 consecutive slots", 400);

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

  const booking = await prisma.$transaction(async (tx) => {
    const overlapInsideTx = await tx.booking.findFirst({
      where: {
        AND: [
          { start: { lt: end } },
          { end: { gt: start } },
          { status: { not: "CANCELLED" } }
        ]
      }
    });
    if (overlapInsideTx) throw new AppError("Slot overlaps", 409);
    return tx.booking.create({
      data: {
        title: input.title,
        labName: input.labName,
        start,
        end,
        duration: input.duration,
        userId: req.user!.sub
      }
    });
  });

  // Prototype: attempt to create MeshCentral RDP link immediately via meshctrl.
  // This does not block booking creation; failures are tolerated and returned for visibility.
  const hw = await prisma.hardware.findFirst({ where: { name: booking.labName } });
  const nodeId = hw?.meshNodeId || env.DEFAULT_MESH_NODE_ID || "";
  const startIsoLocal = booking.start.toISOString().slice(0, 19); // "YYYY-MM-DDTHH:mm:ss"

  const mesh = nodeId
    ? await runMeshctrlDeviceshare({
        nodeId,
        startIsoLocal,
        durationMinutes: env.MESH_RDP_DURATION_MINUTES
      })
    : {
        command: env.MESHCTRL_PATH,
        args: [],
        stdout: "",
        stderr: "No mesh node id configured (hardware.meshNodeId or DEFAULT_MESH_NODE_ID).",
        exitCode: 1,
        rdpLink: null
      };

  // Print command output so you can see it in the backend terminal.
  // eslint-disable-next-line no-console
  console.log("[meshctrl]", mesh.command, mesh.args.join(" "));
  if (mesh.stdout) console.log("[meshctrl][stdout]\n" + mesh.stdout);
  if (mesh.stderr) console.error("[meshctrl][stderr]\n" + mesh.stderr);

  // Store extracted RDP link if present (even if meshctrl exited non-zero).
  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: { rdpLink: mesh.rdpLink ?? undefined }
  });

  // Still enqueue a connector task for real connector-based workflows.
  await prisma.connectorTask.create({
    data: {
      type: "BOOKING_CREATE",
      payload: {
        bookingId: updatedBooking.id,
        userId: updatedBooking.userId,
        labName: updatedBooking.labName,
        start: updatedBooking.start.toISOString(),
        end: updatedBooking.end.toISOString(),
        meshNodeId: nodeId
      }
    }
  });

  addTask({
    bookingId: updatedBooking.id,
    userId: updatedBooking.userId,
    userEmail: req.user?.email || updatedBooking.userId,
    labName: updatedBooking.labName,
    start: updatedBooking.start.toISOString(),
    end: updatedBooking.end.toISOString(),
    meshNodeId: nodeId,
    durationMinutes: env.MESH_RDP_DURATION_MINUTES
  });

  res.status(201).json({
    booking: updatedBooking,
    meshctrl: {
      command: mesh.command,
      args: mesh.args,
      exitCode: mesh.exitCode,
      stdout: mesh.stdout,
      stderr: mesh.stderr,
      rdpLink: mesh.rdpLink
    }
  });
});

export default router;
