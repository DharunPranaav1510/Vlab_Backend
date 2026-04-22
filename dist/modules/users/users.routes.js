import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
const router = Router();
router.get("/me", requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { id: true, email: true, name: true, createdAt: true }
    });
    res.json({ user });
});
export default router;
