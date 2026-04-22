import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
const router = Router();
const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
const serialBuffer = [];
const pushSerial = (line) => {
    serialBuffer.push(line);
    if (serialBuffer.length > 500)
        serialBuffer.shift();
};
router.get("/rented_serial", async (_req, res) => {
    try {
        const dbLogs = await prisma.log.findMany({
            orderBy: { createdAt: "desc" },
            take: 50
        });
        const dbLines = dbLogs.reverse().map((l) => l.message);
        const merged = [...serialBuffer, ...dbLines].slice(-200);
        return res.json({ data: merged.join("\n") });
    }
    catch {
        return res.json({ data: "" });
    }
});
router.post("/upload_project", upload.single("code_file"), async (req, res) => {
    const projectName = String(req.body.project_name ?? "");
    const sensors = req.body.sensors ? String(req.body.sensors) : null;
    const controlsRaw = req.body.controls;
    const controls = Array.isArray(controlsRaw)
        ? controlsRaw.map(String)
        : controlsRaw
            ? [String(controlsRaw)]
            : [];
    try {
        const project = await prisma.project.create({
            data: {
                projectName: projectName || "Unnamed Project",
                sensors,
                controls
            }
        });
        if (req.file) {
            await prisma.projectFile.create({
                data: {
                    projectId: project.id,
                    originalName: req.file.originalname,
                    storagePath: req.file.path,
                    contentType: req.file.mimetype,
                    sizeBytes: req.file.size
                }
            });
        }
        pushSerial(`Uploaded project: ${projectName || "Unnamed Project"}`);
        return res.json({ project: projectName || "Unnamed Project" });
    }
    catch {
        // Keep exact frontend contract even on errors.
        return res.json({ project: projectName || "Unnamed Project" });
    }
});
router.post("/trigger_control", async (req, res) => {
    const command = String(req.body?.control ?? "reset");
    const state = String(req.body?.state ?? "high");
    pushSerial(`Control ${command} => ${state}`);
    await prisma.log.create({
        data: {
            level: "info",
            source: "control",
            message: `Control command: ${command} (${state})`
        }
    }).catch(() => undefined);
    // Exact shape expected by frontend.
    return res.json({
        status: "success",
        command,
        response: "ok"
    });
});
// Tiny 1x1 JPEG (base64) used as frame source.
const jpegFrame = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCABkAGQDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAXEAEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAXEQEBAQEAAAAAAAAAAAAAAAABABEh/9oADAMBAAIRAxEAPwC2AAf/2Q==", "base64");
router.get("/video_feed", (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=frame");
    const interval = setInterval(() => {
        res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegFrame.length}\r\n\r\n`);
        res.write(jpegFrame);
        res.write("\r\n");
    }, 500);
    req.on("close", () => clearInterval(interval));
});
export default router;
