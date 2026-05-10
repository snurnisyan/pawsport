import { Router } from "express";

import { confirmEmail, login, register, requestPasswordReset } from "../controllers/authController";

export const authRoutes = Router();

authRoutes.post("/register", register);
authRoutes.get("/confirm", confirmEmail);
authRoutes.post("/login", login);
authRoutes.post("/password-reset", requestPasswordReset);
