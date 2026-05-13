import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import * as calendarService from "../services/calendarService";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

export const getCalendar = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const result = await calendarService.getCalendar(requireUserId(req), req.query ?? {});
  res.status(200).json(result);
});
