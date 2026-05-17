import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { EVENT_TYPES, EventModel, type EventType } from "../models/Event";
import {
  serializeEventsWithFiles,
  type EventRecord,
  type EventServiceDependencies,
  type SerializedEvent
} from "./eventService";

export interface CalendarQuery {
  from?: unknown;
  to?: unknown;
  petIds?: unknown;
  eventTypes?: unknown;
}

export interface CalendarResult {
  events: SerializedEvent[];
}

export interface CalendarServiceDependencies {
  listEventsInRange?: (params: {
    ownerId: Types.ObjectId;
    from: Date;
    to: Date;
    petIds?: Types.ObjectId[];
    eventTypes?: EventType[];
  }) => Promise<EventRecord[]>;
  listFilesByIds?: EventServiceDependencies["listFilesByIds"];
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

const parseOptionalStringList = (value: unknown, code: string, message: string): string[] | undefined => {
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

const parseOptionalPetIds = (value: unknown): Types.ObjectId[] | undefined => {
  const rawValues = parseOptionalStringList(value, "INVALID_PET_IDS", "petIds must be a list of valid ids");
  if (!rawValues) {
    return undefined;
  }
  return rawValues.map((raw) => {
    if (!isValidObjectId(raw)) {
      throw new AppError(400, "INVALID_PET_IDS", "petIds must be a list of valid ids");
    }
    return new Types.ObjectId(raw);
  });
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

  const allowedTypes = new Set<string>(EVENT_TYPES);
  return rawValues.map((raw) => {
    if (!allowedTypes.has(raw)) {
      throw new AppError(400, "INVALID_EVENT_TYPES", "eventTypes must be a list of valid event types");
    }
    return raw as EventType;
  });
};

export const getCalendar = async (
  ownerId: string,
  query: CalendarQuery,
  dependencies: CalendarServiceDependencies = {}
): Promise<CalendarResult> => {
  const {
    listEventsInRange = async ({ ownerId: owner, from, to, petIds, eventTypes }) => {
      const filter: Record<string, unknown> = {
        ownerId: owner,
        eventDate: { $gte: from, $lte: to }
      };
      if (petIds) filter.petId = { $in: petIds };
      if (eventTypes) filter.type = { $in: eventTypes };
      return EventModel.find(filter).sort({ eventDate: 1 }).exec() as unknown as EventRecord[];
    },
    listFilesByIds,
    now = () => new Date()
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);

  const fromRaw = parseOptionalString(query.from, "INVALID_FROM", "from must be a YYYY-MM-DD date");
  const toRaw = parseOptionalString(query.to, "INVALID_TO", "to must be a YYYY-MM-DD date");
  const petIds = parseOptionalPetIds(query.petIds);
  const eventTypes = parseOptionalEventTypes(query.eventTypes);

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

  const events = await listEventsInRange({ ownerId: ownerObjectId, from, to, petIds, eventTypes });

  return {
    events: await serializeEventsWithFiles(ownerObjectId, events, listFilesByIds)
  };
};
