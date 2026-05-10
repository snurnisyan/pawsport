import { Router } from "express";

import { deleteFile, downloadFile, listPetFiles, uploadPetFile } from "../controllers/fileController";
import { authMiddleware } from "../middleware/authMiddleware";
import { upload } from "../middleware/uploadMiddleware";

export const petFileRoutes = Router({ mergeParams: true });
export const fileRoutes = Router();

petFileRoutes.get("/", authMiddleware, listPetFiles);
petFileRoutes.post("/", authMiddleware, upload.single("file"), uploadPetFile);

fileRoutes.get("/:id/download", authMiddleware, downloadFile);
fileRoutes.delete("/:id", authMiddleware, deleteFile);
