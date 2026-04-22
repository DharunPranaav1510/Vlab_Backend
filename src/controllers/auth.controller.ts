import { Request, Response } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional()
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authController = {
  async register(req: Request, res: Response) {
    const input = registerSchema.parse(req.body as any);
    const user = await authService.register(input);
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } });
  },
  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body as any);
    const { user, token } = await authService.login(input);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: false });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  },
  async frontendCompatLogin(req: Request, res: Response) {
    const { email, name } = req.body as any;
    const user = await authService.registerOrGetDemoUser(email, name || email.split("@")[0]);
    const token = authService.signToken(user);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: false });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  },
  async me(req: Request & { user?: { sub: string; email: string; name: string } }, res: Response) {
    if (!req.user) return res.status(200).json({ user: null });
    return res.json({ user: { id: req.user.sub, email: req.user.email, name: req.user.name } });
  },
  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body as any;
    const result = await authService.requestReset(email);
    res.json({ success: true, ...(process.env.NODE_ENV !== "production" ? { resetToken: result.token } : {}) });
  },
  async resetPassword(req: Request, res: Response) {
    const { token, password } = req.body as any;
    await authService.resetPassword(token, password);
    res.json({ success: true });
  },
  logout(_req: Request, res: Response) {
    res.clearCookie("token");
    res.json({ success: true });
  }
};
