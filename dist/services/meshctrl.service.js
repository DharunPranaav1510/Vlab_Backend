import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
const execFileAsync = promisify(execFile);
function extractFirstUrl(text) {
    const match = text.match(/https?:\/\/[^\s"]+/);
    return match ? match[0] : null;
}
export async function runMeshctrlDeviceshare(input) {
    const command = env.MESHCTRL_PATH;
    const args = [
        "deviceshare",
        "--id",
        input.nodeId,
        "--type",
        "desktop",
        "--start",
        input.startIsoLocal,
        "--duration",
        String(input.durationMinutes)
    ];
    try {
        const { stdout, stderr } = await execFileAsync(command, args, {
            timeout: 30_000,
            windowsHide: true
        });
        const out = String(stdout ?? "");
        const err = String(stderr ?? "");
        return {
            command,
            args,
            stdout: out,
            stderr: err,
            exitCode: 0,
            rdpLink: extractFirstUrl(out + "\n" + err)
        };
    }
    catch (e) {
        // For prototyping: never throw; return captured output if available.
        const stdout = String(e?.stdout ?? "");
        const stderr = String(e?.stderr ?? e?.message ?? "");
        const exitCode = typeof e?.code === "number" ? e.code : 1;
        return {
            command,
            args,
            stdout,
            stderr,
            exitCode,
            rdpLink: extractFirstUrl(stdout + "\n" + stderr)
        };
    }
}
