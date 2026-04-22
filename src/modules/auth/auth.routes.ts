import { Router } from "express";
import { authController } from "../../controllers/auth.controller.js";
import { optionalAuth } from "../../middleware/auth.js";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/frontend-login", authController.frontendCompatLogin);
router.post("/logout", authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", optionalAuth, authController.me);

export default router;
