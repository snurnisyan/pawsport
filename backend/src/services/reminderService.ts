import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import {
  EventModel,
  REMINDER_OFFSETS,
  type EventType,
  type IEvent,
  type ReminderOffset
} from "../models/Event";
import { PetModel, type IPet } from "../models/Pet";
import {
  REMINDER_CHANNELS,
  REMINDER_STATUSES,
  ReminderModel,
  type IReminder,
  type ReminderChannel,
  type ReminderStatus
} from "../models/Reminder";

export interface CreateReminderInput {
  petId?: unknown;
  eventId?: unknown;
  channel?: unknown;
  dueAt?: unknown;
  sendAt?: unknown;
  offset?: unknown;
}

export interface UpdateReminderInput {
  dueAt?: unknown;
  sendAt?: unknown;
  offset?: unknown;
  status?: unknown;
}

export interface ReminderListQuery {
  activeOnly?: unknown;
}

interface ReminderListFilters {
  activeOnly: boolean;
}

export interface MarkRemindersReadInput {
  ids?: unknown;
}

export interface SerializedReminderEvent {
  id: string;
  type: EventType;
  title: string;
  eventDate: string;
}

export interface SerializedReminderPet {
  id: string;
  name: string;
}

export interface SerializedReminder {
  id: string;
  ownerId: string;
  petId: string;
  eventId: string;
  channel: ReminderChannel;
  dueAt: string;
  sendAt: string;
  offset: ReminderOffset;
  status: ReminderStatus;
  readAt: string | null;
  lastError?: string;
  event?: SerializedReminderEvent;
  pet?: SerializedReminderPet;
  createdAt: string;
  updatedAt: string;
}

type ReminderRecord = Pick<
  IReminder,
  | "_id"
  | "ownerId"
  | "petId"
  | "eventId"
  | "channel"
  | "dueAt"
  | "sendAt"
  | "offset"
  | "status"
  | "readAt"
  | "lastError"
  | "createdAt"
  | "updatedAt"
> & {
  event?: Pick<IEvent, "_id" | "type" | "title" | "eventDate">;
  pet?: Pick<IPet, "_id" | "name">;
};

type ReminderReadRecord = Pick<IReminder, "_id" | "readAt">;

type ReminderEventRecord = Pick<IEvent, "_id" | "petId">;

interface NormalizedCreateReminderInput {
  petId: Types.ObjectId;
  eventId: Types.ObjectId;
  channel: ReminderChannel;
  dueAt: Date;
  sendAt: Date;
  offset: ReminderOffset;
}

interface CreateReminderPersistInput extends NormalizedCreateReminderInput {
  ownerId: Types.ObjectId;
  status: ReminderStatus;
}

export interface ReminderUpdates {
  set: Record<string, unknown>;
  unset: string[];
}

export interface ReminderServiceDependencies {
  createReminderRecord?: (input: CreateReminderPersistInput) => Promise<ReminderRecord>;
  listRemindersForOwner?: (
    ownerId: Types.ObjectId,
    filters: ReminderListFilters
  ) => Promise<ReminderRecord[]>;
  findPetByIdForOwner?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<Pick<IPet, "_id"> | null>;
  findEventByIdForOwner?: (
    eventId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<ReminderEventRecord | null>;
  findReminderByIdForOwner?: (
    reminderId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<ReminderRecord | null>;
  updateReminderRecord?: (
    reminderId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: ReminderUpdates
  ) => Promise<ReminderRecord | null>;
  deleteReminderRecord?: (
    reminderId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<ReminderRecord | null>;
  markRemindersReadRecords?: (
    reminderIds: Types.ObjectId[],
    ownerId: Types.ObjectId,
    readAt: Date
  ) => Promise<ReminderReadRecord[]>;
  now?: () => Date;
}

const parseObjectId = (value: unknown, code: string, message: string): Types.ObjectId => {
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new AppError(400, code, message);
  }
  return new Types.ObjectId(value);
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

const parseChannel = (value: unknown): ReminderChannel => {
  if (value === undefined || value === null) {
    return "email";
  }
  if (typeof value !== "string" || !(REMINDER_CHANNELS as readonly string[]).includes(value)) {
    throw new AppError(
      400,
      "INVALID_CHANNEL",
      `channel must be one of: ${REMINDER_CHANNELS.join(", ")}`
    );
  }
  return value as ReminderChannel;
};

const parseOffset = (value: unknown): ReminderOffset => {
  if (typeof value !== "string" || !(REMINDER_OFFSETS as readonly string[]).includes(value)) {
    throw new AppError(
      400,
      "INVALID_OFFSET",
      `offset must be one of: ${REMINDER_OFFSETS.join(", ")}`
    );
  }
  return value as ReminderOffset;
};

const parseStatus = (value: unknown): ReminderStatus => {
  if (typeof value !== "string" || !(REMINDER_STATUSES as readonly string[]).includes(value)) {
    throw new AppError(
      400,
      "INVALID_STATUS",
      `status must be one of: ${REMINDER_STATUSES.join(", ")}`
    );
  }
  return value as ReminderStatus;
};

const isReminderServiceDependencies = (
  value: ReminderListQuery | ReminderServiceDependencies
): value is ReminderServiceDependencies => {
  const candidate = value as ReminderServiceDependencies;
  return (
    typeof candidate.createReminderRecord === "function" ||
    typeof candidate.listRemindersForOwner === "function" ||
    typeof candidate.findPetByIdForOwner === "function" ||
    typeof candidate.findEventByIdForOwner === "function" ||
    typeof candidate.findReminderByIdForOwner === "function" ||
    typeof candidate.updateReminderRecord === "function" ||
    typeof candidate.deleteReminderRecord === "function" ||
    typeof candidate.markRemindersReadRecords === "function" ||
    typeof candidate.now === "function"
  );
};

const parseActiveOnly = (value: unknown): boolean => {
  if (value === undefined || value === null || value === "" || value === false || value === "false") {
    return false;
  }
  if (value === true || value === "true") {
    return true;
  }
  throw new AppError(400, "INVALID_REMINDER_FILTER", "activeOnly must be true or false");
};

const parseListFilters = (query: ReminderListQuery): ReminderListFilters => ({
  activeOnly: parseActiveOnly(query.activeOnly)
});

const hasField = (input: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(input, key);

const normalizeUpdateInput = (input: UpdateReminderInput): ReminderUpdates => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { set: {}, unset: [] };
  }

  const set: Record<string, unknown> = {};
  const unset: string[] = [];

  if (hasField(input, "dueAt")) {
    set.dueAt = parseDate(input.dueAt, "INVALID_DUE_AT", "dueAt must be a valid ISO date-time string");
    unset.push("readAt");
  }
  if (hasField(input, "sendAt")) {
    set.sendAt = parseDate(input.sendAt, "INVALID_SEND_AT", "sendAt must be a valid ISO date-time string");
    if (!unset.includes("readAt")) unset.push("readAt");
  }
  if (hasField(input, "offset")) {
    set.offset = parseOffset(input.offset);
    if (!unset.includes("readAt")) unset.push("readAt");
  }
  if (hasField(input, "status")) {
    set.status = parseStatus(input.status);
  }

  return { set, unset };
};

const normalizeCreateInput = (input: CreateReminderInput): NormalizedCreateReminderInput => {
  return {
    petId: parseObjectId(input.petId, "INVALID_PET_ID", "petId must be a valid id"),
    eventId: parseObjectId(input.eventId, "INVALID_EVENT_ID", "eventId must be a valid id"),
    channel: parseChannel(input.channel),
    dueAt: parseDate(input.dueAt, "INVALID_DUE_AT", "dueAt must be a valid ISO date-time string"),
    sendAt: parseDate(input.sendAt, "INVALID_SEND_AT", "sendAt must be a valid ISO date-time string"),
    offset: parseOffset(input.offset)
  };
};

export const serializeReminder = (reminder: ReminderRecord): SerializedReminder => {
  const result: SerializedReminder = {
    id: reminder._id.toString(),
    ownerId: reminder.ownerId.toString(),
    petId: reminder.petId.toString(),
    eventId: reminder.eventId.toString(),
    channel: reminder.channel,
    dueAt: reminder.dueAt.toISOString(),
    sendAt: reminder.sendAt.toISOString(),
    offset: reminder.offset,
    status: reminder.status,
    readAt: reminder.readAt ? reminder.readAt.toISOString() : null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString()
  };

  if (reminder.lastError) result.lastError = reminder.lastError;
  if (reminder.event) {
    result.event = {
      id: reminder.event._id.toString(),
      type: reminder.event.type,
      title: reminder.event.title,
      eventDate: reminder.event.eventDate.toISOString()
    };
  }
  if (reminder.pet) {
    result.pet = {
      id: reminder.pet._id.toString(),
      name: reminder.pet.name
    };
  }

  return result;
};

const requireOwnerId = (ownerId: string): Types.ObjectId => {
  if (!isValidObjectId(ownerId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }
  return new Types.ObjectId(ownerId);
};

const DEFAULT_STATUS: ReminderStatus = REMINDER_STATUSES[0];

export const createReminder = async (
  ownerId: string,
  input: CreateReminderInput,
  dependencies: ReminderServiceDependencies = {}
): Promise<SerializedReminder> => {
  const {
    createReminderRecord = async (payload) =>
      ReminderModel.create(payload) as unknown as ReminderRecord,
    findPetByIdForOwner = async (petId, owner) =>
      PetModel.findOne({ _id: petId, ownerId: owner })
        .select({ _id: 1 })
        .exec() as Promise<Pick<IPet, "_id"> | null>,
    findEventByIdForOwner = async (eventId, owner) =>
      EventModel.findOne({ _id: eventId, ownerId: owner })
        .select({ _id: 1, petId: 1 })
        .exec() as Promise<ReminderEventRecord | null>
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const normalized = normalizeCreateInput(input);

  const pet = await findPetByIdForOwner(normalized.petId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const event = await findEventByIdForOwner(normalized.eventId, ownerObjectId);
  if (!event || event.petId.toString() !== normalized.petId.toString()) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
  }

  const reminder = await createReminderRecord({
    ownerId: ownerObjectId,
    status: DEFAULT_STATUS,
    ...normalized
  });

  return serializeReminder(reminder);
};

export const listReminders = async (
  ownerId: string,
  queryOrDependencies: ReminderListQuery | ReminderServiceDependencies = {},
  maybeDependencies?: ReminderServiceDependencies
): Promise<SerializedReminder[]> => {
  const secondArgumentIsDependencies = isReminderServiceDependencies(queryOrDependencies);
  const query = maybeDependencies
    ? (queryOrDependencies as ReminderListQuery)
    : secondArgumentIsDependencies
      ? {}
      : (queryOrDependencies as ReminderListQuery);
  const dependencies = maybeDependencies ?? (secondArgumentIsDependencies ? queryOrDependencies : {});
  const {
    listRemindersForOwner = async (id, filters) => {
      if (!filters.activeOnly) {
        return ReminderModel.find({ ownerId: id })
          .sort({ sendAt: 1 })
          .exec() as unknown as ReminderRecord[];
      }

      const currentTime = now();
      return ReminderModel.aggregate<ReminderRecord>([
        {
          $match: {
            ownerId: id,
            sendAt: { $lte: currentTime },
            dueAt: { $gt: currentTime },
            status: { $ne: "cancelled" }
          }
        },
        {
          $lookup: {
            from: "events",
            let: { eventId: "$eventId", ownerId: "$ownerId", petId: "$petId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$_id", "$$eventId"] },
                      { $eq: ["$ownerId", "$$ownerId"] },
                      { $eq: ["$petId", "$$petId"] }
                    ]
                  }
                }
              },
              { $project: { _id: 1, type: 1, title: 1, eventDate: 1 } }
            ],
            as: "eventDocs"
          }
        },
        {
          $lookup: {
            from: "pets",
            let: { petId: "$petId", ownerId: "$ownerId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$_id", "$$petId"] },
                      { $eq: ["$ownerId", "$$ownerId"] }
                    ]
                  }
                }
              },
              { $project: { _id: 1, name: 1 } }
            ],
            as: "petDocs"
          }
        },
        { $unwind: "$eventDocs" },
        { $unwind: "$petDocs" },
        { $sort: { dueAt: 1 } },
        { $addFields: { event: "$eventDocs", pet: "$petDocs" } },
        { $project: { eventDocs: 0, petDocs: 0 } }
      ]).exec();
    },
    now = () => new Date()
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const filters = parseListFilters(query);
  const reminders = await listRemindersForOwner(ownerObjectId, filters);
  return reminders.map(serializeReminder);
};

const requireReminderId = (reminderId: string): Types.ObjectId => {
  if (!isValidObjectId(reminderId)) {
    throw new AppError(400, "INVALID_REMINDER_ID", "reminderId must be a valid id");
  }
  return new Types.ObjectId(reminderId);
};

const defaultFindReminder: NonNullable<
  ReminderServiceDependencies["findReminderByIdForOwner"]
> = async (id, owner) =>
  ReminderModel.findOne({ _id: id, ownerId: owner }).exec() as unknown as ReminderRecord | null;

export const updateReminder = async (
  ownerId: string,
  reminderId: string,
  input: UpdateReminderInput,
  dependencies: ReminderServiceDependencies = {}
): Promise<SerializedReminder> => {
  const {
    findReminderByIdForOwner = defaultFindReminder,
    updateReminderRecord = async (id, owner, updates) => {
      const op: Record<string, unknown> = {};
      if (Object.keys(updates.set).length > 0) op.$set = updates.set;
      if (updates.unset.length > 0) {
        op.$unset = Object.fromEntries(updates.unset.map((key) => [key, ""]));
      }
      return ReminderModel.findOneAndUpdate({ _id: id, ownerId: owner }, op, {
        new: true
      }).exec() as unknown as ReminderRecord | null;
    }
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const reminderObjectId = requireReminderId(reminderId);
  const updates = normalizeUpdateInput(input);

  const existing = await findReminderByIdForOwner(reminderObjectId, ownerObjectId);
  if (!existing) {
    throw new AppError(404, "REMINDER_NOT_FOUND", "Reminder was not found");
  }

  if (Object.keys(updates.set).length === 0) {
    return serializeReminder(existing);
  }

  if (existing.status === "sent") {
    throw new AppError(409, "REMINDER_SENT_IMMUTABLE", "A sent reminder cannot be modified");
  }

  const updated = await updateReminderRecord(reminderObjectId, ownerObjectId, updates);
  if (!updated) {
    throw new AppError(404, "REMINDER_NOT_FOUND", "Reminder was not found");
  }
  return serializeReminder(updated);
};

export const deleteReminder = async (
  ownerId: string,
  reminderId: string,
  dependencies: ReminderServiceDependencies = {}
): Promise<void> => {
  const {
    deleteReminderRecord = async (id, owner) =>
      ReminderModel.findOneAndDelete({ _id: id, ownerId: owner }).exec() as unknown as ReminderRecord | null
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const reminderObjectId = requireReminderId(reminderId);

  const deleted = await deleteReminderRecord(reminderObjectId, ownerObjectId);
  if (!deleted) {
    throw new AppError(404, "REMINDER_NOT_FOUND", "Reminder was not found");
  }
};

const parseReminderIds = (input: MarkRemindersReadInput): Types.ObjectId[] => {
  if (input === null || typeof input !== "object" || Array.isArray(input) || !Array.isArray(input.ids)) {
    throw new AppError(400, "INVALID_REMINDER_ID", "ids must be an array of reminder ids");
  }

  return input.ids.map((id) => {
    if (typeof id !== "string" || !isValidObjectId(id)) {
      throw new AppError(400, "INVALID_REMINDER_ID", "ids must be an array of reminder ids");
    }
    return new Types.ObjectId(id);
  });
};

export const markRemindersRead = async (
  ownerId: string,
  input: MarkRemindersReadInput,
  dependencies: ReminderServiceDependencies = {}
): Promise<Array<{ id: string; readAt: string }>> => {
  const {
    markRemindersReadRecords = async (ids, owner, readAt) => {
      await ReminderModel.updateMany(
        { _id: { $in: ids }, ownerId: owner },
        { $set: { readAt } }
      ).exec();
      return ReminderModel.find({ _id: { $in: ids }, ownerId: owner })
        .select({ _id: 1, readAt: 1 })
        .exec() as unknown as ReminderReadRecord[];
    },
    now = () => new Date()
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const reminderIds = parseReminderIds(input);
  if (reminderIds.length === 0) {
    return [];
  }

  const readAt = now();
  const updated = await markRemindersReadRecords(reminderIds, ownerObjectId, readAt);
  return updated
    .filter((reminder): reminder is ReminderReadRecord & { readAt: Date } => Boolean(reminder.readAt))
    .map((reminder) => ({
      id: reminder._id.toString(),
      readAt: reminder.readAt.toISOString()
    }));
};
