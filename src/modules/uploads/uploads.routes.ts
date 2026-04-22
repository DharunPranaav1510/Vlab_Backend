import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { requireAuth, AuthedRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
import { z } from "zod";

const router = Router();
const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

router.post("/", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  const projectId = z.string().min(1).parse(req.body.projectId);
  if (!req.file) return res.status(400).json({ error: { code: "FILE_REQUIRED", message: "file is required" } });

  const file = await prisma.projectFile.create({
    data: {
      projectId,
      originalName: req.file.originalname,
      storagePath: req.file.path,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size
    }
  });

  await prisma.connectorTask.create({
    data: {
      type: "FILE_TRANSFER",
      payload: { projectId, fileId: file.id, path: file.storagePath, userId: req.user!.sub }
    }
  });

  res.status(201).json({ file });
});

export default router;
