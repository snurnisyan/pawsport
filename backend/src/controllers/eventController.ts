import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
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

export const getEvent = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const event = await eventService.getEvent(requireUserId(req), req.params.id);
  res.status(200).json({ event });
});

export const updateEvent = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const event = await eventService.updateEvent(
    requireUserId(req),
    req.params.id,
    req.body ?? {}
  );
  res.status(200).json({ event });
});

export const deleteEvent = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await eventService.deleteEvent(requireUserId(req), req.params.id);
  res.status(204).send();
});
