import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import { notImplemented } from "../utils/notImplemented";
import * as reminderService from "../services/reminderService";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

export const listReminders = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const items = await reminderService.listReminders(requireUserId(req));
  res.status(200).json({ items });
});

export const createReminder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const reminder = await reminderService.createReminder(requireUserId(req), req.body ?? {});
  res.status(201).json({ reminder });
});

export const updateReminder = notImplemented("reminders", "updateReminder");
export const deleteReminder = notImplemented("reminders", "deleteReminder");
