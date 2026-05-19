import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import {
  EVENT_TYPES,
  EventModel,
  RECURRENCE_FREQUENCIES,
  REMINDER_OFFSETS,
  TREATMENT_SUBTYPES,
  VACCINE_SUBTYPES,
  type EventSubtype,
  type EventType,
  type IEvent,
  type IRecurrence,
  type RecurrenceFrequency,
  type ReminderOffset
} from "../models/Event";
import { FileModel, type IStoredFile } from "../models/File";
import { PetModel, type IPet } from "../models/Pet";
import { ReminderModel } from "../models/Reminder";
import {
  attachFilesToEvent as defaultAttachFilesToEvent,
  deleteFilesForEvent as defaultDeleteFilesForEvent,
  validateFileIdsForPet as defaultValidateFileIdsForPet
} from "./fileService";
import {
  parseOptionalDateRange,
  type DateRangeQuery,
  type OptionalDateRange
} from "./dateRange";

export interface EventListQuery extends DateRangeQuery {
  nextDateFrom?: unknown;
  eventTypes?: unknown;
}

export interface EventListFilters extends OptionalDateRange {
  nextDateFrom?: Date;
  eventTypes?: EventType[];
}

export interface CreateEventInput {
  type?: unknown;
  subtype?: unknown;
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

export interface SerializedEventFile {
  originalName: string;
  fileId: string;
}

export interface SerializedEvent {
  id: string;
  ownerId: string;
  petId: string;
  type: EventType;
  subtype?: EventSubtype;
  title: string;
  eventDate: string;
  nextDate?: string;
  clinicName?: string;
  comment?: string;
  recurrence?: SerializedRecurrence;
  reminderOffset?: ReminderOffset;
  files: SerializedEventFile[];
  createdAt: string;
  updatedAt: string;
}

export type EventRecord = Pick<
  IEvent,
  | "_id"
  | "ownerId"
  | "petId"
  | "type"
  | "subtype"
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
  subtype?: EventSubtype;
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
    petId: Types.ObjectId,
    filters: EventListFilters
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
  validateFileIdsForPet?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    fileIds: Types.ObjectId[]
  ) => Promise<void>;
  attachFilesToEvent?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    eventId: Types.ObjectId,
    fileIds: Types.ObjectId[]
  ) => Promise<void>;
  listFilesByIds?: (
    ownerId: Types.ObjectId,
    fileIds: Types.ObjectId[]
  ) => Promise<Pick<IStoredFile, "_id" | "originalName">[]>;
  deleteFilesForEvent?: (
    ownerId: Types.ObjectId,
    eventId: Types.ObjectId,
    fileIds: Types.ObjectId[]
  ) => Promise<void>;
}

const isEventServiceDependencies = (
  value: DateRangeQuery | EventServiceDependencies
): value is EventServiceDependencies => {
  const candidate = value as EventServiceDependencies;
  return (
    typeof candidate.createEventRecord === "function" ||
    typeof candidate.listEventsForOwnerPet === "function" ||
    typeof candidate.findPetByIdForOwner === "function" ||
    typeof candidate.findEventByIdForOwner === "function" ||
    typeof candidate.updateEventRecord === "function" ||
    typeof candidate.deleteEventRecord === "function" ||
    typeof candidate.syncPendingReminderForEvent === "function" ||
    typeof candidate.deleteRemindersForEvent === "function" ||
    typeof candidate.validateFileIdsForPet === "function" ||
    typeof candidate.attachFilesToEvent === "function" ||
    typeof candidate.listFilesByIds === "function" ||
    typeof candidate.deleteFilesForEvent === "function"
  );
};

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

const optionalDateTime = (value: unknown, code: string, message: string): Date | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(400, code, message);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, code, message);
  }
  return date;
};

const parseType = (value: unknown): EventType => {
  if (typeof value !== "string" || !(EVENT_TYPES as readonly string[]).includes(value)) {
    throw new AppError(400, "INVALID_TYPE", `type must be one of: ${EVENT_TYPES.join(", ")}`);
  }
  return value as EventType;
};

const SUBTYPE_OPTIONS_BY_TYPE: Partial<Record<EventType, readonly EventSubtype[]>> = {
  vaccine: VACCINE_SUBTYPES,
  treatment: TREATMENT_SUBTYPES
};

const isSubtypedEventType = (type: EventType): type is "vaccine" | "treatment" =>
  type === "vaccine" || type === "treatment";

const isValidSubtypeForType = (
  type: EventType,
  subtype: unknown
): subtype is EventSubtype =>
  typeof subtype === "string" &&
  (SUBTYPE_OPTIONS_BY_TYPE[type] ?? []).includes(subtype as EventSubtype);

const parseSubtypeForType = (type: EventType, value: unknown): EventSubtype => {
  const options = SUBTYPE_OPTIONS_BY_TYPE[type] ?? [];
  const label = options.join(", ");

  if (value === undefined || value === null || value === "") {
    throw new AppError(400, "INVALID_EVENT_SUBTYPE", `subtype is required for ${type} events`);
  }
  if (typeof value !== "string" || !options.includes(value as EventSubtype)) {
    throw new AppError(400, "INVALID_EVENT_SUBTYPE", `subtype must be one of: ${label}`);
  }
  return value as EventSubtype;
};

const normalizeCreateSubtype = (type: EventType, value: unknown): EventSubtype | undefined => {
  if (isSubtypedEventType(type)) {
    return parseSubtypeForType(type, value);
  }
  if (value !== undefined) {
    throw new AppError(
      400,
      "INVALID_EVENT_SUBTYPE",
      "subtype is only supported for vaccine and treatment events"
    );
  }
  return undefined;
};

const applySubtypeUpdate = (
  input: CreateEventInput,
  existing: EventRecord,
  updates: EventUpdates
): void => {
  const finalType = (updates.set.type as EventType | undefined) ?? existing.type;
  const subtypeWasProvided = hasField(input, "subtype");

  if (subtypeWasProvided) {
    if (isSubtypedEventType(finalType)) {
      updates.set.subtype = parseSubtypeForType(finalType, input.subtype);
      updates.unset = updates.unset.filter((key) => key !== "subtype");
      return;
    }

    if (input.subtype === undefined || input.subtype === null || input.subtype === "") {
      delete updates.set.subtype;
      if (!updates.unset.includes("subtype")) updates.unset.push("subtype");
      return;
    }

    throw new AppError(
      400,
      "INVALID_EVENT_SUBTYPE",
      "subtype is only supported for vaccine and treatment events"
    );
  }

  if (!isSubtypedEventType(finalType)) {
    delete updates.set.subtype;
    if (!updates.unset.includes("subtype")) updates.unset.push("subtype");
    return;
  }

  if (!isValidSubtypeForType(finalType, existing.subtype)) {
    throw new AppError(
      400,
      "INVALID_EVENT_SUBTYPE",
      `subtype is required for ${finalType} events`
    );
  }
};

const parseOptionalStringList = (
  value: unknown,
  code: string,
  message: string
): string[] | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const values = rawValues.flatMap((item) => {
    if (typeof item !== "string") {
      throw new AppError(400, code, message);
    }
    return item
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  });

  return values.length > 0 ? values : undefined;
};

const parseOptionalEventTypes = (value: unknown): EventType[] | undefined => {
  const rawValues = parseOptionalStringList(
    value,
    "INVALID_EVENT_TYPES",
    "eventTypes must be a list of valid event types"
  );
  if (!rawValues) {
    return undefined;
  }

  return rawValues.map((raw) => {
    if (!(EVENT_TYPES as readonly string[]).includes(raw)) {
      throw new AppError(400, "INVALID_EVENT_TYPES", "eventTypes must be a list of valid event types");
    }
    return raw as EventType;
  });
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
  const type = parseType(input.type);
  return {
    type,
    subtype: normalizeCreateSubtype(type, input.subtype),
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

export const serializeEvent = (
  event: EventRecord,
  filesById: Map<string, Pick<IStoredFile, "_id" | "originalName">> = new Map()
): SerializedEvent => {
  const result: SerializedEvent = {
    id: event._id.toString(),
    ownerId: event.ownerId.toString(),
    petId: event.petId.toString(),
    type: event.type,
    title: event.title,
    eventDate: event.eventDate.toISOString(),
    files: (event.fileIds ?? []).flatMap((id) => {
      const fileId = id.toString();
      const file = filesById.get(fileId);
      return file ? [{ originalName: file.originalName, fileId }] : [];
    }),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  };

  if (event.nextDate) result.nextDate = event.nextDate.toISOString();
  if (event.subtype) result.subtype = event.subtype;
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

const uniqueFileIdsForEvents = (events: EventRecord[]): Types.ObjectId[] =>
  Array.from(
    new Map(
      events
        .flatMap((event) => event.fileIds ?? [])
        .map((id) => [id.toString(), id] as const)
    ).values()
  );

const defaultListFilesByIds: NonNullable<EventServiceDependencies["listFilesByIds"]> = async (
  ownerId,
  fileIds
) =>
  FileModel.find({ _id: { $in: fileIds }, ownerId })
    .select({ _id: 1, originalName: 1 })
    .exec() as unknown as Pick<IStoredFile, "_id" | "originalName">[];

export const serializeEventsWithFiles = async (
  ownerId: Types.ObjectId,
  events: EventRecord[],
  listFilesByIds: NonNullable<EventServiceDependencies["listFilesByIds"]> = defaultListFilesByIds
): Promise<SerializedEvent[]> => {
  const fileIds = uniqueFileIdsForEvents(events);
  if (fileIds.length === 0) {
    return events.map((event) => serializeEvent(event));
  }

  const files = await listFilesByIds(ownerId, fileIds);
  const filesById = new Map(files.map((file) => [file._id.toString(), file]));
  return events.map((event) => serializeEvent(event, filesById));
};

const serializeEventWithFiles = async (
  ownerId: Types.ObjectId,
  event: EventRecord,
  listFilesByIds: NonNullable<EventServiceDependencies["listFilesByIds"]>
): Promise<SerializedEvent> => {
  const [serialized] = await serializeEventsWithFiles(ownerId, [event], listFilesByIds);
  return serialized;
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

const parseEventListFilters = (query: EventListQuery): EventListFilters => {
  const range = parseOptionalDateRange(query);
  const nextDateFrom = optionalDateTime(
    query.nextDateFrom,
    "INVALID_NEXT_DATE_RANGE",
    "nextDateFrom must be a valid ISO date-time string"
  );
  const eventTypes = parseOptionalEventTypes(query.eventTypes);

  return { ...range, nextDateFrom, eventTypes };
};

export const buildEventListFilter = (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  filters: EventListFilters
): Record<string, unknown> => {
  const filter: Record<string, unknown> = { ownerId, petId };
  const eventDate: Record<string, Date> = {};
  if (filters.from) eventDate.$gte = filters.from;
  if (filters.to) eventDate.$lte = filters.to;
  if (Object.keys(eventDate).length > 0) filter.eventDate = eventDate;
  if (filters.nextDateFrom) filter.nextDate = { $gte: filters.nextDateFrom };
  if (filters.eventTypes) filter.type = { $in: filters.eventTypes };
  return filter;
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

  const dueAt = eventDate;
  const sendAt = calculateReminderSendAt(eventDate, reminderOffset);
  const existing = await ReminderModel.findOne({ ownerId, eventId, status: "pending" })
    .select({ dueAt: 1, sendAt: 1, offset: 1 })
    .exec();
  const shouldResetReadAt =
    !existing ||
    existing.dueAt.getTime() !== dueAt.getTime() ||
    existing.sendAt.getTime() !== sendAt.getTime() ||
    existing.offset !== reminderOffset;

  await ReminderModel.findOneAndUpdate(
    { ownerId, eventId, status: "pending" },
    {
      $set: {
        ownerId,
        petId,
        eventId,
        channel: "email",
        dueAt,
        sendAt,
        offset: reminderOffset,
        status: "pending"
      },
      $unset: {
        ...(shouldResetReadAt && { readAt: "" }),
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
    syncPendingReminderForEvent = defaultSyncPendingReminderForEvent,
    validateFileIdsForPet = (owner, pet, ids) => defaultValidateFileIdsForPet(owner, pet, ids),
    attachFilesToEvent = (owner, pet, eventId, ids) =>
      defaultAttachFilesToEvent(owner, pet, eventId, ids),
    listFilesByIds = defaultListFilesByIds
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetId(petId);
  const normalized = normalizeCreateInput(input);

  const pet = await findPetByIdForOwner(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  await validateFileIdsForPet(ownerObjectId, petObjectId, normalized.fileIds);

  const event = await createEventRecord({
    ownerId: ownerObjectId,
    petId: petObjectId,
    ...normalized
  });

  await attachFilesToEvent(ownerObjectId, petObjectId, event._id, normalized.fileIds);

  if (event.reminderOffset) {
    await syncPendingReminderForEvent({
      ownerId: event.ownerId,
      petId: event.petId,
      eventId: event._id,
      eventDate: event.eventDate,
      reminderOffset: event.reminderOffset
    });
  }

  return serializeEventWithFiles(ownerObjectId, event, listFilesByIds);
};

export const listPetEvents = async (
  ownerId: string,
  petId: string,
  queryOrDependencies: EventListQuery | EventServiceDependencies = {},
  maybeDependencies?: EventServiceDependencies
): Promise<SerializedEvent[]> => {
  const thirdArgumentIsDependencies = isEventServiceDependencies(queryOrDependencies);
  const query = maybeDependencies
    ? (queryOrDependencies as EventListQuery)
    : thirdArgumentIsDependencies
      ? {}
      : (queryOrDependencies as EventListQuery);
  const dependencies = maybeDependencies ?? (thirdArgumentIsDependencies ? queryOrDependencies : {});
  const {
    listEventsForOwnerPet = async (owner, pet, filters) => {
      const filter = buildEventListFilter(owner, pet, filters);
      return EventModel.find(filter)
        .sort({ eventDate: -1 })
        .exec() as unknown as EventRecord[];
    },
    findPetByIdForOwner = defaultFindPet,
    listFilesByIds = defaultListFilesByIds
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetId(petId);
  const filters = parseEventListFilters(query);

  const pet = await findPetByIdForOwner(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const events = await listEventsForOwnerPet(ownerObjectId, petObjectId, filters);
  return serializeEventsWithFiles(ownerObjectId, events, listFilesByIds);
};

export const getEvent = async (
  ownerId: string,
  eventId: string,
  dependencies: EventServiceDependencies = {}
): Promise<SerializedEvent> => {
  const {
    findEventByIdForOwner = defaultFindEvent,
    listFilesByIds = defaultListFilesByIds
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const eventObjectId = requireEventId(eventId);

  const event = await findEventByIdForOwner(eventObjectId, ownerObjectId);
  if (!event) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
  }
  return serializeEventWithFiles(ownerObjectId, event, listFilesByIds);
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
    validateFileIdsForPet = (owner, pet, ids) => defaultValidateFileIdsForPet(owner, pet, ids),
    attachFilesToEvent = (owner, pet, eventId, ids) =>
      defaultAttachFilesToEvent(owner, pet, eventId, ids),
    listFilesByIds = defaultListFilesByIds,
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
  const isObjectInput =
    input !== null && typeof input === "object" && !Array.isArray(input);
  const typeOrSubtypeInUpdate =
    isObjectInput && (hasField(input, "type") || hasField(input, "subtype"));
  const shouldSyncReminder =
    isObjectInput && (hasField(input, "eventDate") || hasField(input, "reminderOffset"));
  const fileIdsInUpdate = isObjectInput && hasField(input, "fileIds");
  let existingEvent: EventRecord | null | undefined;

  const getExistingEvent = async (): Promise<EventRecord> => {
    existingEvent ??= await findEventByIdForOwner(eventObjectId, ownerObjectId);
    if (!existingEvent) {
      throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
    }
    return existingEvent;
  };

  if (typeOrSubtypeInUpdate) {
    applySubtypeUpdate(input, await getExistingEvent(), updates);
  }

  if (Object.keys(updates.set).length === 0 && updates.unset.length === 0) {
    return serializeEventWithFiles(ownerObjectId, await getExistingEvent(), listFilesByIds);
  }

  if (fileIdsInUpdate) {
    const requestedFileIds = (updates.set.fileIds as Types.ObjectId[] | undefined) ?? [];
    if (requestedFileIds.length > 0) {
      const existing = await getExistingEvent();
      await validateFileIdsForPet(ownerObjectId, existing.petId, requestedFileIds);
    }
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

  if (fileIdsInUpdate) {
    const requestedFileIds = (updates.set.fileIds as Types.ObjectId[] | undefined) ?? [];
    await attachFilesToEvent(ownerObjectId, updated.petId, updated._id, requestedFileIds);
  }

  return serializeEventWithFiles(ownerObjectId, updated, listFilesByIds);
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
    },
    deleteFilesForEvent = (owner, id, fileIds) => defaultDeleteFilesForEvent(owner, id, fileIds)
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const eventObjectId = requireEventId(eventId);

  const deleted = await deleteEventRecord(eventObjectId, ownerObjectId);
  if (!deleted) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
  }

  await deleteFilesForEvent(ownerObjectId, eventObjectId, deleted.fileIds ?? []);
  await deleteRemindersForEvent(eventObjectId, ownerObjectId);
};
