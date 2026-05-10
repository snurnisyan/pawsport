import { Router } from "express";

import { createPetEvent, deleteEvent, getEvent, listPetEvents, updateEvent } from "../controllers/eventController";
import { authMiddleware } from "../middleware/authMiddleware";

export const petEventRoutes = Router({ mergeParams: true });
export const eventRoutes = Router();

petEventRoutes.get("/", authMiddleware, listPetEvents);
petEventRoutes.post("/", authMiddleware, createPetEvent);

eventRoutes.get("/:id", authMiddleware, getEvent);
eventRoutes.patch("/:id", authMiddleware, updateEvent);
eventRoutes.delete("/:id", authMiddleware, deleteEvent);
