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

export interface GetCalendarHandlerDependencies {
  getCalendar?: typeof calendarService.getCalendar;
}

export const getCalendarHandler = (dependencies: GetCalendarHandlerDependencies = {}) => {
  const { getCalendar: getCalendarFn = calendarService.getCalendar } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await getCalendarFn(requireUserId(req), req.query ?? {});
    res.status(200).json(result);
  });
};

export const getCalendar = getCalendarHandler();
