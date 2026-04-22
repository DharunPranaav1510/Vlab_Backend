import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

type JwtPayload = { sub: string; email: string; name: string };

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : req.cookies?.token;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    req.user = undefined;
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    next();
  });
}

export function requireConnectorAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-connector-key"];
  if (apiKey !== env.CONNECTOR_API_KEY) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid connector key" } });
  }
  next();
}
