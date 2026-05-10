import { Router } from "express";

import { getCalendar } from "../controllers/calendarController";
import { authMiddleware } from "../middleware/authMiddleware";

export const calendarRoutes = Router();

calendarRoutes.get("/", authMiddleware, getCalendar);
