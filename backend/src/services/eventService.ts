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
import { ReminderModel } from "../models/Reminder";

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

export interface EventUpdates {
  set: Record<string, unknown>;
  unset: string[];
}

export interface SyncEventReminderInput {
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  eventId: Types.ObjectId;
  eventDate: Date;
  reminderOffset?: ReminderOffset;
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
  findEventByIdForOwner?: (
    eventId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<EventRecord | null>;
  updateEventRecord?: (
    eventId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: EventUpdates
  ) => Promise<EventRecord | null>;
  deleteEventRecord?: (
    eventId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<EventRecord | null>;
  syncPendingReminderForEvent?: (input: SyncEventReminderInput) => Promise<void>;
  deleteRemindersForEvent?: (
    eventId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<void>;
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

const hasField = (input: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(input, key);

const normalizeUpdateInput = (input: CreateEventInput): EventUpdates => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { set: {}, unset: [] };
  }

  const set: Record<string, unknown> = {};
  const unset: string[] = [];

  if (hasField(input, "type")) {
    set.type = parseType(input.type);
  }
  if (hasField(input, "title")) {
    set.title = requireString(input.title, "INVALID_TITLE", "title is required");
  }
  if (hasField(input, "eventDate")) {
    set.eventDate = parseDate(
      input.eventDate,
      "INVALID_EVENT_DATE",
      "eventDate must be a valid ISO date-time string"
    );
  }
  if (hasField(input, "nextDate")) {
    const value = optionalDate(
      input.nextDate,
      "INVALID_NEXT_DATE",
      "nextDate must be a valid ISO date-time string"
    );
    if (value) {
      set.nextDate = value;
    } else {
      unset.push("nextDate");
    }
  }
  if (hasField(input, "clinicName")) {
    const value = optionalString(input.clinicName, "INVALID_CLINIC_NAME", "clinicName must be a string");
    if (value) {
      set.clinicName = value;
    } else {
      unset.push("clinicName");
    }
  }
  if (hasField(input, "comment")) {
    const value = optionalString(input.comment, "INVALID_COMMENT", "comment must be a string");
    if (value) {
      set.comment = value;
    } else {
      unset.push("comment");
    }
  }
  if (hasField(input, "recurrence")) {
    const value = parseRecurrence(input.recurrence);
    if (value) {
      set.recurrence = value;
    } else {
      unset.push("recurrence");
    }
  }
  if (hasField(input, "reminderOffset")) {
    const value = parseReminderOffset(input.reminderOffset);
    if (value) {
      set.reminderOffset = value;
    } else {
      unset.push("reminderOffset");
    }
  }
  if (hasField(input, "fileIds")) {
    set.fileIds = parseFileIds(input.fileIds);
  }

  return { set, unset };
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

const requireEventId = (eventId: string): Types.ObjectId => {
  if (!isValidObjectId(eventId)) {
    throw new AppError(400, "INVALID_EVENT_ID", "eventId must be a valid id");
  }
  return new Types.ObjectId(eventId);
};

const defaultFindEvent: NonNullable<EventServiceDependencies["findEventByIdForOwner"]> = async (
  eventId,
  ownerId
) =>
  EventModel.findOne({ _id: eventId, ownerId }).exec() as unknown as EventRecord | null;

const defaultFindPet: NonNullable<EventServiceDependencies["findPetByIdForOwner"]> = async (
  petId,
  ownerId
) =>
  PetModel.findOne({ _id: petId, ownerId })
    .select({ _id: 1 })
    .exec() as Promise<Pick<IPet, "_id"> | null>;

const REMINDER_OFFSET_DAYS: Record<ReminderOffset, number> = {
  day: 1,
  week: 7,
  month: 30
};

export const calculateReminderSendAt = (eventDate: Date, offset: ReminderOffset): Date =>
  new Date(eventDate.getTime() - REMINDER_OFFSET_DAYS[offset] * 24 * 60 * 60 * 1000);

const defaultSyncPendingReminderForEvent: NonNullable<
  EventServiceDependencies["syncPendingReminderForEvent"]
> = async ({ ownerId, petId, eventId, eventDate, reminderOffset }) => {
  if (!reminderOffset) {
    await ReminderModel.deleteMany({ ownerId, eventId, status: "pending" }).exec();
    return;
  }

  await ReminderModel.findOneAndUpdate(
    { ownerId, eventId, status: "pending" },
    {
      $set: {
        ownerId,
        petId,
        eventId,
        channel: "email",
        dueAt: eventDate,
        sendAt: calculateReminderSendAt(eventDate, reminderOffset),
        offset: reminderOffset,
        status: "pending"
      },
      $unset: {
        lastError: "",
        processingToken: "",
        processingStartedAt: "",
        processingExpiresAt: ""
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();
};

export const createPetEvent = async (
  ownerId: string,
  petId: string,
  input: CreateEventInput,
  dependencies: EventServiceDependencies = {}
): Promise<SerializedEvent> => {
  const {
    createEventRecord = async (payload) => EventModel.create(payload) as unknown as EventRecord,
    findPetByIdForOwner = defaultFindPet,
    syncPendingReminderForEvent = defaultSyncPendingReminderForEvent
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

  if (event.reminderOffset) {
    await syncPendingReminderForEvent({
      ownerId: event.ownerId,
      petId: event.petId,
      eventId: event._id,
      eventDate: event.eventDate,
      reminderOffset: event.reminderOffset
    });
  }

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

export const getEvent = async (
  ownerId: string,
  eventId: string,
  dependencies: EventServiceDependencies = {}
): Promise<SerializedEvent> => {
  const { findEventByIdForOwner = defaultFindEvent } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const eventObjectId = requireEventId(eventId);

  const event = await findEventByIdForOwner(eventObjectId, ownerObjectId);
  if (!event) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
  }
  return serializeEvent(event);
};

export const updateEvent = async (
  ownerId: string,
  eventId: string,
  input: CreateEventInput,
  dependencies: EventServiceDependencies = {}
): Promise<SerializedEvent> => {
  const {
    findEventByIdForOwner = defaultFindEvent,
    syncPendingReminderForEvent = defaultSyncPendingReminderForEvent,
    updateEventRecord = async (id, owner, updates) => {
      const op: Record<string, unknown> = {};
      if (Object.keys(updates.set).length > 0) op.$set = updates.set;
      if (updates.unset.length > 0) {
        op.$unset = Object.fromEntries(updates.unset.map((key) => [key, ""]));
      }
      return EventModel.findOneAndUpdate({ _id: id, ownerId: owner }, op, {
        new: true
      }).exec() as unknown as EventRecord | null;
    }
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const eventObjectId = requireEventId(eventId);
  const updates = normalizeUpdateInput(input);
  const shouldSyncReminder =
    input !== null &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    (hasField(input, "eventDate") || hasField(input, "reminderOffset"));

  if (Object.keys(updates.set).length === 0 && updates.unset.length === 0) {
    const existing = await findEventByIdForOwner(eventObjectId, ownerObjectId);
    if (!existing) {
      throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
    }
    return serializeEvent(existing);
  }

  const updated = await updateEventRecord(eventObjectId, ownerObjectId, updates);
  if (!updated) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
  }

  if (shouldSyncReminder) {
    await syncPendingReminderForEvent({
      ownerId: updated.ownerId,
      petId: updated.petId,
      eventId: updated._id,
      eventDate: updated.eventDate,
      reminderOffset: updated.reminderOffset
    });
  }

  return serializeEvent(updated);
};

export const deleteEvent = async (
  ownerId: string,
  eventId: string,
  dependencies: EventServiceDependencies = {}
): Promise<void> => {
  const {
    deleteEventRecord = async (id, owner) =>
      EventModel.findOneAndDelete({ _id: id, ownerId: owner }).exec() as unknown as EventRecord | null,
    deleteRemindersForEvent = async (id, owner) => {
      await ReminderModel.deleteMany({ eventId: id, ownerId: owner, status: "pending" }).exec();
    }
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const eventObjectId = requireEventId(eventId);

  const deleted = await deleteEventRecord(eventObjectId, ownerObjectId);
  if (!deleted) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
  }

  await deleteRemindersForEvent(eventObjectId, ownerObjectId);
};
