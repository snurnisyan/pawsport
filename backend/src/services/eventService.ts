import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import {
  EVENT_TYPES,
  EventModel,
  RECURRENCE_FREQUENCIES,
  REMINDER_OFFSETS,
  type EventType,
  type IEvent,
  type IRecurrence,
  type RecurrenceFrequency,
  type ReminderOffset
} from "../models/Event";
import { PetModel, type IPet } from "../models/Pet";

export interface CreateEventInput {
  type?: unknown;
  title?: unknown;
  eventDate?: unknown;
  nextDate?: unknown;
  clinicName?: unknown;
  comment?: unknown;
  recurrence?: unknown;
  reminderOffset?: unknown;
  fileIds?: unknown;
}

export interface SerializedRecurrence {
  frequency: RecurrenceFrequency;
  interval?: number;
}

export interface SerializedEvent {
  id: string;
  ownerId: string;
  petId: string;
  type: EventType;
  title: string;
  eventDate: string;
  nextDate?: string;
  clinicName?: string;
  comment?: string;
  recurrence?: SerializedRecurrence;
  reminderOffset?: ReminderOffset;
  fileIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type EventRecord = Pick<
  IEvent,
  | "_id"
  | "ownerId"
  | "petId"
  | "type"
  | "title"
  | "eventDate"
  | "nextDate"
  | "clinicName"
  | "comment"
  | "recurrence"
  | "reminderOffset"
  | "fileIds"
  | "createdAt"
  | "updatedAt"
>;

interface NormalizedCreateEventInput {
  type: EventType;
  title: string;
  eventDate: Date;
  nextDate?: Date;
  clinicName?: string;
  comment?: string;
  recurrence?: IRecurrence;
  reminderOffset?: ReminderOffset;
  fileIds: Types.ObjectId[];
}

interface CreateEventPersistInput extends NormalizedCreateEventInput {
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
}

export interface EventServiceDependencies {
  createEventRecord?: (input: CreateEventPersistInput) => Promise<EventRecord>;
  listEventsForOwnerPet?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<EventRecord[]>;
  findPetByIdForOwner?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<Pick<IPet, "_id"> | null>;
}

const requireString = (value: unknown, code: string, message: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(400, code, message);
  }
  return value.trim();
};

const optionalString = (value: unknown, code: string, message: string): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(400, code, message);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseDate = (value: unknown, code: string, message: string): Date => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(400, code, message);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, code, message);
  }
  return date;
};

const optionalDate = (value: unknown, code: string, message: string): Date | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return parseDate(value, code, message);
};

const parseType = (value: unknown): EventType => {
  if (typeof value !== "string" || !(EVENT_TYPES as readonly string[]).includes(value)) {
    throw new AppError(400, "INVALID_TYPE", `type must be one of: ${EVENT_TYPES.join(", ")}`);
  }
  return value as EventType;
};

const parseReminderOffset = (value: unknown): ReminderOffset | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !(REMINDER_OFFSETS as readonly string[]).includes(value)) {
    throw new AppError(
      400,
      "INVALID_REMINDER_OFFSET",
      `reminderOffset must be one of: ${REMINDER_OFFSETS.join(", ")}`
    );
  }
  return value as ReminderOffset;
};

const parseRecurrence = (value: unknown): IRecurrence | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "INVALID_RECURRENCE", "recurrence must be an object");
  }
  const raw = value as Record<string, unknown>;
  const frequencyValue = raw.frequency ?? "none";
  if (
    typeof frequencyValue !== "string" ||
    !(RECURRENCE_FREQUENCIES as readonly string[]).includes(frequencyValue)
  ) {
    throw new AppError(
      400,
      "INVALID_RECURRENCE",
      `recurrence.frequency must be one of: ${RECURRENCE_FREQUENCIES.join(", ")}`
    );
  }
  const result: IRecurrence = { frequency: frequencyValue as RecurrenceFrequency };
  if (raw.interval !== undefined && raw.interval !== null) {
    if (
      typeof raw.interval !== "number" ||
      !Number.isInteger(raw.interval) ||
      raw.interval < 1
    ) {
      throw new AppError(
        400,
        "INVALID_RECURRENCE",
        "recurrence.interval must be a positive integer"
      );
    }
    result.interval = raw.interval;
  }
  return result;
};

const parseFileIds = (value: unknown): Types.ObjectId[] => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, "INVALID_FILE_IDS", "fileIds must be an array of ids");
  }
  return value.map((item) => {
    if (typeof item !== "string" || !isValidObjectId(item)) {
      throw new AppError(400, "INVALID_FILE_IDS", "fileIds must be an array of ids");
    }
    return new Types.ObjectId(item);
  });
};

const normalizeCreateInput = (input: CreateEventInput): NormalizedCreateEventInput => {
  return {
    type: parseType(input.type),
    title: requireString(input.title, "INVALID_TITLE", "title is required"),
    eventDate: parseDate(input.eventDate, "INVALID_EVENT_DATE", "eventDate must be a valid ISO date-time string"),
    nextDate: optionalDate(input.nextDate, "INVALID_NEXT_DATE", "nextDate must be a valid ISO date-time string"),
    clinicName: optionalString(input.clinicName, "INVALID_CLINIC_NAME", "clinicName must be a string"),
    comment: optionalString(input.comment, "INVALID_COMMENT", "comment must be a string"),
    recurrence: parseRecurrence(input.recurrence),
    reminderOffset: parseReminderOffset(input.reminderOffset),
    fileIds: parseFileIds(input.fileIds)
  };
};

export const serializeEvent = (event: EventRecord): SerializedEvent => {
  const result: SerializedEvent = {
    id: event._id.toString(),
    ownerId: event.ownerId.toString(),
    petId: event.petId.toString(),
    type: event.type,
    title: event.title,
    eventDate: event.eventDate.toISOString(),
    fileIds: (event.fileIds ?? []).map((id) => id.toString()),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  };

  if (event.nextDate) result.nextDate = event.nextDate.toISOString();
  if (event.clinicName) result.clinicName = event.clinicName;
  if (event.comment) result.comment = event.comment;
  if (event.reminderOffset) result.reminderOffset = event.reminderOffset;
  if (event.recurrence) {
    const recurrence: SerializedRecurrence = { frequency: event.recurrence.frequency };
    if (event.recurrence.interval !== undefined && event.recurrence.interval !== null) {
      recurrence.interval = event.recurrence.interval;
    }
    result.recurrence = recurrence;
  }

  return result;
};

const requireOwnerId = (ownerId: string): Types.ObjectId => {
  if (!isValidObjectId(ownerId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }
  return new Types.ObjectId(ownerId);
};

const requirePetId = (petId: string): Types.ObjectId => {
  if (!isValidObjectId(petId)) {
    throw new AppError(400, "INVALID_PET_ID", "petId must be a valid id");
  }
  return new Types.ObjectId(petId);
};

const defaultFindPet: NonNullable<EventServiceDependencies["findPetByIdForOwner"]> = async (
  petId,
  ownerId
) =>
  PetModel.findOne({ _id: petId, ownerId })
    .select({ _id: 1 })
    .exec() as Promise<Pick<IPet, "_id"> | null>;

export const createPetEvent = async (
  ownerId: string,
  petId: string,
  input: CreateEventInput,
  dependencies: EventServiceDependencies = {}
): Promise<SerializedEvent> => {
  const {
    createEventRecord = async (payload) => EventModel.create(payload) as unknown as EventRecord,
    findPetByIdForOwner = defaultFindPet
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetId(petId);
  const normalized = normalizeCreateInput(input);

  const pet = await findPetByIdForOwner(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const event = await createEventRecord({
    ownerId: ownerObjectId,
    petId: petObjectId,
    ...normalized
  });

  return serializeEvent(event);
};

export const listPetEvents = async (
  ownerId: string,
  petId: string,
  dependencies: EventServiceDependencies = {}
): Promise<SerializedEvent[]> => {
  const {
    listEventsForOwnerPet = async (owner, pet) =>
      EventModel.find({ ownerId: owner, petId: pet })
        .sort({ eventDate: -1 })
        .exec() as unknown as EventRecord[],
    findPetByIdForOwner = defaultFindPet
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetId(petId);

  const pet = await findPetByIdForOwner(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const events = await listEventsForOwnerPet(ownerObjectId, petObjectId);
  return events.map(serializeEvent);
};
