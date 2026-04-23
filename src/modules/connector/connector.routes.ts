import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireConnectorAuth } from "../../middleware/auth.js";

const router = Router();

// --- ADD: In-memory task queue ---
let taskQueue: any[] = [];

// --- ADD: Exported addTask function ---
export const addTask = (task: any) => {
  taskQueue.push(task);
};

// --- EXISTING ROUTES (protected by old auth) ---
router.get("/tasks", requireConnectorAuth, async (req, res) => {
  const connectorId = String(req.query.connectorId ?? "default-connector");
  const tasks = await prisma.connectorTask.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 20
  });

  if (tasks.length > 0) {
    await prisma.connectorTask.updateMany({
      where: { id: { in: tasks.map((t) => t.id) }, status: "PENDING" },
      data: { status: "IN_PROGRESS", assignedTo: connectorId }
    });
  }

  res.json({ tasks });
});

router.post("/task-complete", requireConnectorAuth, async (req, res) => {
  const input = z.object({
    taskId: z.string(),
    success: z.boolean(),
    result: z.any().optional()
  }).parse(req.body);

  const task = await prisma.connectorTask.update({
    where: { id: input.taskId },
    data: {
      status: input.success ? "COMPLETED" : "FAILED",
      result: input.result,
      completedAt: new Date()
    }
  });

  res.json({ task });
});

router.post("/status-update", requireConnectorAuth, async (req, res) => {
  const input = z.object({
    vmId: z.string(),
    state: z.string(),
    hardwareId: z.string().optional(),
    bookingId: z.string().optional(),
    metadata: z.any().optional()
  }).parse(req.body);

  const vm = await prisma.vmStatus.create({
    data: {
      vmId: input.vmId,
      state: input.state,
      hardwareId: input.hardwareId,
      bookingId: input.bookingId,
      metadata: input.metadata
    }
  });

  res.json({ success: true, vm });
});

router.post("/rdp-link", requireConnectorAuth, async (req, res) => {
  const input = z.object({
    bookingId: z.string(),
    rdpLink: z.string().url(),
    vmId: z.string().optional()
  }).parse(req.body);

  await prisma.booking.update({
    where: { id: input.bookingId },
    data: { rdpLink: input.rdpLink }
  });

  if (input.vmId) {
    await prisma.vmStatus.create({
      data: {
        vmId: input.vmId,
        bookingId: input.bookingId,
        state: "RDP_READY",
        rdpLink: input.rdpLink
      }
    });
  }

  res.json({ success: true });
});

// --- NEW POLLING ROUTES (Bearer auth) ---

router.get("/task", (req, res) => {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${process.env.SECRET_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (taskQueue.length === 0) {
    return res.json(null);
  }

  const task = taskQueue.shift();
  res.json(task);
});

router.post("/callback", (req, res) => {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${process.env.SECRET_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = req.body;
  console.log("Connector result:", result);

  // TODO: update DB with result

  res.json({ success: true });
});

// ================= COMPAT ROUTES FOR PYTHON CONNECTOR =================

// 🔥 /connector/poll (matches Python)
router.get("/poll", (req, res) => {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${process.env.SECRET_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (taskQueue.length === 0) {
    return res.json(null);
  }

  const task = taskQueue.shift();
  return res.json(task);
});

// 🔥 /connector/result (matches Python)
router.post("/result", async (req, res) => {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${process.env.SECRET_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { bookingId, rdpLink, success } = req.body;

  try {
    console.log("Connector result:", req.body);

    if (success && bookingId && rdpLink) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { rdpLink }
      });
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("Connector result error:", err);
    return res.status(500).json({ error: "Failed to update" });
  }
});

export default router;
