import { Router } from "express";

import { authRoutes } from "./authRoutes";
import { calendarRoutes } from "./calendarRoutes";
import { eventRoutes, petEventRoutes } from "./eventRoutes";
import { exportRoutes, petExportRoutes } from "./exportRoutes";
import { fileRoutes, petFileRoutes, petPhotoRoutes } from "./fileRoutes";
import { petRoutes } from "./petRoutes";
import { reminderRoutes } from "./reminderRoutes";
import { userRoutes } from "./userRoutes";

export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/pets/:id/events", petEventRoutes);
apiRouter.use("/pets/:id/files", petFileRoutes);
apiRouter.use("/pets/:id/photo", petPhotoRoutes);
apiRouter.use("/pets/:id/export", petExportRoutes);
apiRouter.use("/pets", petRoutes);
apiRouter.use("/events", eventRoutes);
apiRouter.use("/files", fileRoutes);
apiRouter.use("/exports", exportRoutes);
apiRouter.use("/reminders", reminderRoutes);
apiRouter.use("/calendar", calendarRoutes);
