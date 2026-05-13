import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import { notImplemented } from "../utils/notImplemented";
import * as eventService from "../services/eventService";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

export const listPetEvents = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const items = await eventService.listPetEvents(requireUserId(req), req.params.id);
  res.status(200).json({ items });
});

export const createPetEvent = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const event = await eventService.createPetEvent(
    requireUserId(req),
    req.params.id,
    req.body ?? {}
  );
  res.status(201).json({ event });
});

export const getEvent = notImplemented("events", "getEvent");
export const updateEvent = notImplemented("events", "updateEvent");
export const deleteEvent = notImplemented("events", "deleteEvent");
