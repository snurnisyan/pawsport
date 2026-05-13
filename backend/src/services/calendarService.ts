import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { EventModel } from "../models/Event";
import { ReminderModel } from "../models/Reminder";
import {
  serializeEvent,
  type EventRecord,
  type SerializedEvent
} from "./eventService";
import {
  serializeReminder,
  type SerializedReminder
} from "./reminderService";
import type { IReminder } from "../models/Reminder";

export interface CalendarQuery {
  from?: unknown;
  to?: unknown;
  petId?: unknown;
}

export interface CalendarResult {
  events: SerializedEvent[];
  reminders: SerializedReminder[];
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

export interface CalendarServiceDependencies {
  listEventsInRange?: (params: {
    ownerId: Types.ObjectId;
    from: Date;
    to: Date;
    petId?: Types.ObjectId;
  }) => Promise<EventRecord[]>;
  listRemindersInRange?: (params: {
    ownerId: Types.ObjectId;
    from: Date;
    to: Date;
    petId?: Types.ObjectId;
  }) => Promise<ReminderRecord[]>;
  now?: () => Date;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDayStart = (value: string, code: string, message: string): Date => {
  if (!DATE_PATTERN.test(value)) {
    throw new AppError(400, code, message);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, code, message);
  }
  return date;
};

const parseDayEnd = (value: string, code: string, message: string): Date => {
  if (!DATE_PATTERN.test(value)) {
    throw new AppError(400, code, message);
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, code, message);
  }
  return date;
};

const startOfMonth = (reference: Date): Date =>
  new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1, 0, 0, 0, 0));

const endOfMonth = (reference: Date): Date =>
  new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );

const requireOwnerId = (ownerId: string): Types.ObjectId => {
  if (!isValidObjectId(ownerId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }
  return new Types.ObjectId(ownerId);
};

const parseOptionalString = (value: unknown, code: string, message: string): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(400, code, message);
  }
  return value;
};

const parseOptionalPetId = (value: unknown): Types.ObjectId | undefined => {
  const raw = parseOptionalString(value, "INVALID_PET_ID", "petId must be a valid id");
  if (raw === undefined) {
    return undefined;
  }
  if (!isValidObjectId(raw)) {
    throw new AppError(400, "INVALID_PET_ID", "petId must be a valid id");
  }
  return new Types.ObjectId(raw);
};

export const getCalendar = async (
  ownerId: string,
  query: CalendarQuery,
  dependencies: CalendarServiceDependencies = {}
): Promise<CalendarResult> => {
  const {
    listEventsInRange = async ({ ownerId: owner, from, to, petId }) => {
      const filter: Record<string, unknown> = {
        ownerId: owner,
        eventDate: { $gte: from, $lte: to }
      };
      if (petId) filter.petId = petId;
      return EventModel.find(filter).sort({ eventDate: 1 }).exec() as unknown as EventRecord[];
    },
    listRemindersInRange = async ({ ownerId: owner, from, to, petId }) => {
      const filter: Record<string, unknown> = {
        ownerId: owner,
        sendAt: { $gte: from, $lte: to }
      };
      if (petId) filter.petId = petId;
      return ReminderModel.find(filter).sort({ sendAt: 1 }).exec() as unknown as ReminderRecord[];
    },
    now = () => new Date()
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);

  const fromRaw = parseOptionalString(query.from, "INVALID_FROM", "from must be a YYYY-MM-DD date");
  const toRaw = parseOptionalString(query.to, "INVALID_TO", "to must be a YYYY-MM-DD date");
  const petObjectId = parseOptionalPetId(query.petId);

  const reference = now();
  const from = fromRaw
    ? parseDayStart(fromRaw, "INVALID_FROM", "from must be a YYYY-MM-DD date")
    : startOfMonth(reference);
  const to = toRaw
    ? parseDayEnd(toRaw, "INVALID_TO", "to must be a YYYY-MM-DD date")
    : endOfMonth(reference);

  if (from.getTime() > to.getTime()) {
    throw new AppError(400, "INVALID_RANGE", "from must be on or before to");
  }

  const [events, reminders] = await Promise.all([
    listEventsInRange({ ownerId: ownerObjectId, from, to, petId: petObjectId }),
    listRemindersInRange({ ownerId: ownerObjectId, from, to, petId: petObjectId })
  ]);

  return {
    events: events.map(serializeEvent),
    reminders: reminders.map(serializeReminder)
  };
};
