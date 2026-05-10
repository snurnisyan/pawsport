import { Router } from "express";

import { createReminder, deleteReminder, listReminders, updateReminder } from "../controllers/reminderController";
import { authMiddleware } from "../middleware/authMiddleware";

export const reminderRoutes = Router();

reminderRoutes.get("/", authMiddleware, listReminders);
reminderRoutes.post("/", authMiddleware, createReminder);
reminderRoutes.patch("/:id", authMiddleware, updateReminder);
reminderRoutes.delete("/:id", authMiddleware, deleteReminder);
