import { Router } from "express";

import { createPetExport } from "../controllers/exportController";
import { authMiddleware } from "../middleware/authMiddleware";

export const exportRoutes = Router({ mergeParams: true });

exportRoutes.post("/", authMiddleware, createPetExport);
