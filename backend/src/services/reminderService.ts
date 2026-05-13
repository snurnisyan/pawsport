import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { REMINDER_OFFSETS, type ReminderOffset } from "../models/Event";
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
  lastError?: string;
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
  | "lastError"
  | "createdAt"
  | "updatedAt"
>;

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

export interface ReminderServiceDependencies {
  createReminderRecord?: (input: CreateReminderPersistInput) => Promise<ReminderRecord>;
  listRemindersForOwner?: (ownerId: Types.ObjectId) => Promise<ReminderRecord[]>;
  findPetByIdForOwner?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<Pick<IPet, "_id"> | null>;
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
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString()
  };

  if (reminder.lastError) result.lastError = reminder.lastError;

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
        .exec() as Promise<Pick<IPet, "_id"> | null>
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const normalized = normalizeCreateInput(input);

  const pet = await findPetByIdForOwner(normalized.petId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
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
  dependencies: ReminderServiceDependencies = {}
): Promise<SerializedReminder[]> => {
  const {
    listRemindersForOwner = async (id) =>
      ReminderModel.find({ ownerId: id })
        .sort({ sendAt: 1 })
        .exec() as unknown as ReminderRecord[]
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const reminders = await listRemindersForOwner(ownerObjectId);
  return reminders.map(serializeReminder);
};
