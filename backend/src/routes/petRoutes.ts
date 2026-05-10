import { Router } from "express";

import { createPet, deletePet, getPet, listPets, updatePet } from "../controllers/petController";
import { authMiddleware } from "../middleware/authMiddleware";

export const petRoutes = Router();

petRoutes.get("/", authMiddleware, listPets);
petRoutes.post("/", authMiddleware, createPet);
petRoutes.get("/:id", authMiddleware, getPet);
petRoutes.patch("/:id", authMiddleware, updatePet);
petRoutes.delete("/:id", authMiddleware, deletePet);
