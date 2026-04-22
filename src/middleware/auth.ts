import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthedRequest extends Request {
  user?: any;
}

export const requireAuth = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const optionalAuth = (req: any, _res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      req.user = decoded;
    }
  } catch (err) {
    // ignore errors → optional
  }
  next();
};

export const requireConnectorAuth = (req: any, res: any, next: any) => {
  const key = req.headers["x-connector-key"];
  if (!key || key !== process.env.CONNECTOR_KEY) {
    return res.status(401).json({ message: "Unauthorized connector" });
  }
  next();
};
