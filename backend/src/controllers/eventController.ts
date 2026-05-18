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

export interface ListPetEventsHandlerDependencies {
  listPetEvents?: typeof eventService.listPetEvents;
}

export const listPetEventsHandler = (dependencies: ListPetEventsHandlerDependencies = {}) => {
  const { listPetEvents: listPetEventsFn = eventService.listPetEvents } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const items = await listPetEventsFn(requireUserId(req), req.params.id, req.query ?? {});
    res.status(200).json({ items });
  });
};

export const listPetEvents = listPetEventsHandler();

export interface CreatePetEventHandlerDependencies {
  createPetEvent?: typeof eventService.createPetEvent;
}

export const createPetEventHandler = (dependencies: CreatePetEventHandlerDependencies = {}) => {
  const { createPetEvent: createPetEventFn = eventService.createPetEvent } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const event = await createPetEventFn(
      requireUserId(req),
      req.params.id,
      req.body ?? {}
    );
    res.status(201).json({ event });
  });
};

export const createPetEvent = createPetEventHandler();

export const getEvent = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const event = await eventService.getEvent(requireUserId(req), req.params.id);
  res.status(200).json({ event });
});

export interface UpdateEventHandlerDependencies {
  updateEvent?: typeof eventService.updateEvent;
}

export const updateEventHandler = (dependencies: UpdateEventHandlerDependencies = {}) => {
  const { updateEvent: updateEventFn = eventService.updateEvent } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const event = await updateEventFn(
      requireUserId(req),
      req.params.id,
      req.body ?? {}
    );
    res.status(200).json({ event });
  });
};

export const updateEvent = updateEventHandler();

export const deleteEvent = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await eventService.deleteEvent(requireUserId(req), req.params.id);
  res.status(204).send();
});
