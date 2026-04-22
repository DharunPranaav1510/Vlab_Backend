import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export function optionalAuth(req, _res, next) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : req.cookies?.token;
    if (!token)
        return next();
    try {
        req.user = jwt.verify(token, env.JWT_SECRET);
    }
    catch {
        req.user = undefined;
    }
    next();
}
export function requireAuth(req, res, next) {
    optionalAuth(req, res, () => {
        if (!req.user)
            return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
        next();
    });
}
export function requireConnectorAuth(req, res, next) {
    const apiKey = req.headers["x-connector-key"];
    if (apiKey !== env.CONNECTOR_API_KEY) {
        return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid connector key" } });
    }
    next();
}
