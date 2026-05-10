import { Router } from "express";

import { deleteMe, getMe } from "../controllers/userController";
import { authMiddleware } from "../middleware/authMiddleware";

export const userRoutes = Router();

userRoutes.get("/me", authMiddleware, getMe);
userRoutes.delete("/me/delete", authMiddleware, deleteMe);
