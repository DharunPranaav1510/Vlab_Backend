import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.get("/status", requireAuth, async (_req, res) => {
  const vm = await prisma.vmStatus.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ vm });
});

export default router;
