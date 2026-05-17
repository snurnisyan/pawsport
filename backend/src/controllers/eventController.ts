import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import * as eventService from "../services/eventService";
import * as fileService from "../services/fileService";

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

export const parseEventFieldsFromMultipart = (raw: unknown): Record<string, unknown> => {
  if (raw === undefined || raw === null || raw === "") {
    return {};
  }
  if (typeof raw !== "string") {
    throw new AppError(400, "INVALID_EVENT_PAYLOAD", "event field must be a JSON string");
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new AppError(400, "INVALID_EVENT_PAYLOAD", "event field must encode a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "INVALID_EVENT_PAYLOAD", "event field is not valid JSON");
  }
};

const uploadedFilesFromRequest = (req: AuthenticatedRequest): Express.Multer.File[] => {
  if (!req.files) return [];
  return Array.isArray(req.files)
    ? req.files
    : Object.values(req.files).flat();
};

const isMultipartRequest = (req: AuthenticatedRequest): boolean =>
  (req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/form-data");

export interface CreatePetEventHandlerDependencies {
  createPetEvent?: typeof eventService.createPetEvent;
  updateEvent?: typeof eventService.updateEvent;
  deleteEvent?: typeof eventService.deleteEvent;
  uploadPetFile?: typeof fileService.uploadPetFile;
  deleteFile?: typeof fileService.deleteFile;
}

export const createPetEventHandler = (dependencies: CreatePetEventHandlerDependencies = {}) => {
  const {
    createPetEvent: createPetEventFn = eventService.createPetEvent,
    updateEvent: updateEventFn = eventService.updateEvent,
    deleteEvent: deleteEventFn = eventService.deleteEvent,
    uploadPetFile = fileService.uploadPetFile,
    deleteFile = fileService.deleteFile
  } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req);
    const files = uploadedFilesFromRequest(req);
    const eventInput = isMultipartRequest(req)
      ? parseEventFieldsFromMultipart((req.body as Record<string, unknown> | undefined)?.event)
      : (req.body ?? {});

    if (eventInput.fileIds !== undefined && eventInput.fileIds !== null) {
      throw new AppError(
        400,
        "FILE_IDS_CONFLICT",
        "Pass event files via multipart/form-data instead of fileIds"
      );
    }

    const createdEvent = await createPetEventFn(userId, req.params.id, eventInput);

    if (files.length === 0) {
      res.status(201).json({ event: createdEvent });
      return;
    }

    const uploadedFileIds: string[] = [];

    try {
      for (const file of files) {
        const uploaded = await uploadPetFile(userId, req.params.id, {
          file,
          eventId: createdEvent.id
        });
        uploadedFileIds.push(uploaded.id);
      }

      const event = await updateEventFn(userId, createdEvent.id, {
        fileIds: uploadedFileIds
      });
      res.status(201).json({ event });
    } catch (error) {
      for (const fileId of uploadedFileIds) {
        try {
          await deleteFile(userId, fileId);
        } catch {
          // Best effort: surface the original upload/update failure to the caller.
        }
      }
      try {
        await deleteEventFn(userId, createdEvent.id);
      } catch {
        // Best effort: surface the original upload/update failure to the caller.
      }
      throw error;
    }
  });
};

export const createPetEvent = createPetEventHandler();

export const getEvent = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const event = await eventService.getEvent(requireUserId(req), req.params.id);
  res.status(200).json({ event });
});

export interface UpdateEventHandlerDependencies {
  getEvent?: typeof eventService.getEvent;
  updateEvent?: typeof eventService.updateEvent;
  uploadPetFile?: typeof fileService.uploadPetFile;
  deleteFile?: typeof fileService.deleteFile;
}

export const updateEventHandler = (dependencies: UpdateEventHandlerDependencies = {}) => {
  const {
    getEvent: getEventFn = eventService.getEvent,
    updateEvent: updateEventFn = eventService.updateEvent,
    uploadPetFile = fileService.uploadPetFile,
    deleteFile = fileService.deleteFile
  } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req);
    const files = uploadedFilesFromRequest(req);
    const eventInput = isMultipartRequest(req)
      ? parseEventFieldsFromMultipart((req.body as Record<string, unknown> | undefined)?.event)
      : (req.body ?? {});

    if (eventInput.fileIds !== undefined && eventInput.fileIds !== null) {
      throw new AppError(
        400,
        "FILE_IDS_CONFLICT",
        "Pass event files via multipart/form-data instead of fileIds"
      );
    }

    if (files.length === 0) {
      const event = await updateEventFn(userId, req.params.id, eventInput);
      res.status(200).json({ event });
      return;
    }

    const existingEvent = await getEventFn(userId, req.params.id);
    const uploadedFileIds: string[] = [];

    try {
      for (const file of files) {
        const uploaded = await uploadPetFile(userId, existingEvent.petId, {
          file,
          eventId: existingEvent.id
        });
        uploadedFileIds.push(uploaded.id);
      }

      const event = await updateEventFn(userId, req.params.id, {
        ...eventInput,
        fileIds: [
          ...existingEvent.files.map((file) => file.fileId),
          ...uploadedFileIds
        ]
      });
      res.status(200).json({ event });
    } catch (error) {
      for (const fileId of uploadedFileIds) {
        try {
          await deleteFile(userId, fileId);
        } catch {
          // Best effort: surface the original upload/update failure to the caller.
        }
      }
      throw error;
    }
  });
};

export const updateEvent = updateEventHandler();

export const deleteEvent = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await eventService.deleteEvent(requireUserId(req), req.params.id);
  res.status(204).send();
});
