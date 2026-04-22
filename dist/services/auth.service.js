import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { userRepository } from "../repositories/user.repository.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
export const authService = {
    signToken(user) {
        return jwt.sign({ sub: user.id, email: user.email, name: user.name }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    },
    async register(input) {
        const existing = await userRepository.findByEmail(input.email);
        if (existing)
            throw new AppError("Email already exists", 409);
        const passwordHash = await bcrypt.hash(input.password, 10);
        const user = await userRepository.create({
            email: input.email,
            name: input.name || input.email.split("@")[0] || "User",
            passwordHash
        });
        return user;
    },
    async login(input) {
        const user = await userRepository.findByEmail(input.email);
        if (!user)
            throw new AppError("Invalid credentials", 401);
        const ok = await bcrypt.compare(input.password, user.passwordHash);
        if (!ok)
            throw new AppError("Invalid credentials", 401);
        const token = this.signToken(user);
        return { user, token };
    },
    async registerOrGetDemoUser(email, name) {
        const existing = await userRepository.findByEmail(email);
        if (existing)
            return existing;
        const randomPw = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(randomPw, 10);
        return userRepository.create({
            email,
            name: name || email.split("@")[0] || "User",
            passwordHash
        });
    },
    async requestReset(email) {
        const user = await userRepository.findByEmail(email);
        if (!user)
            return { accepted: true };
        const token = crypto.randomUUID();
        const exp = new Date(Date.now() + 1000 * 60 * 30);
        await userRepository.updateReset(email, token, exp);
        return { accepted: true, token }; // In production send via email provider.
    },
    async resetPassword(token, password) {
        const hash = await bcrypt.hash(password, 10);
        const updated = await userRepository.resetPassword(token, hash);
        if (!updated)
            throw new AppError("Invalid reset token", 400);
        return updated;
    }
};
