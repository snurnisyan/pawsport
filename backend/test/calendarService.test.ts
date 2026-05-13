import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import { getCalendar } from "../src/services/calendarService";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const otherPetId = "60a7c1aa9e1d4f1234567891";
const eventId = "60a7c1aa9e1d4f12345678ab";
const reminderId = "60a7c1aa9e1d4f1234567899";

const makeEventRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(eventId),
  ownerId: new Types.ObjectId(ownerId),
  petId: new Types.ObjectId(petId),
  type: "vaccination" as const,
  title: "Rabies booster",
  eventDate: new Date("2026-06-10T10:00:00.000Z"),
  fileIds: [],
  createdAt: new Date("2026-05-12T00:00:00.000Z"),
  updatedAt: new Date("2026-05-12T00:00:00.000Z"),
  ...overrides
});

const makeReminderRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(reminderId),
  ownerId: new Types.ObjectId(ownerId),
  petId: new Types.ObjectId(petId),
  eventId: new Types.ObjectId(eventId),
  channel: "email" as const,
  dueAt: new Date("2026-06-10T10:00:00.000Z"),
  sendAt: new Date("2026-06-03T10:00:00.000Z"),
  offset: "week" as const,
  status: "pending" as const,
  createdAt: new Date("2026-05-12T00:00:00.000Z"),
  updatedAt: new Date("2026-05-12T00:00:00.000Z"),
  ...overrides
});

test("getCalendar returns events and reminders in range, both filtered by owner", async () => {
  let eventParams: Record<string, unknown> | undefined;
  let reminderParams: Record<string, unknown> | undefined;

  const result = await getCalendar(
    ownerId,
    { from: "2026-06-01", to: "2026-06-30" },
    {
      listEventsInRange: async (params) => {
        eventParams = params as unknown as Record<string, unknown>;
        return [makeEventRecord()];
      },
      listRemindersInRange: async (params) => {
        reminderParams = params as unknown as Record<string, unknown>;
        return [makeReminderRecord()];
      }
    }
  );

  assert.equal((eventParams?.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((eventParams?.from as Date).toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal((eventParams?.to as Date).toISOString(), "2026-06-30T23:59:59.999Z");
  assert.equal(eventParams?.petId, undefined);

  assert.equal((reminderParams?.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((reminderParams?.from as Date).toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal((reminderParams?.to as Date).toISOString(), "2026-06-30T23:59:59.999Z");

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, eventId);
  assert.equal(result.reminders.length, 1);
  assert.equal(result.reminders[0].id, reminderId);
});

test("getCalendar passes petId filter to both repository calls", async () => {
  let eventParams: Record<string, unknown> | undefined;
  let reminderParams: Record<string, unknown> | undefined;

  await getCalendar(
    ownerId,
    { from: "2026-06-01", to: "2026-06-30", petId },
    {
      listEventsInRange: async (params) => {
        eventParams = params as unknown as Record<string, unknown>;
        return [];
      },
      listRemindersInRange: async (params) => {
        reminderParams = params as unknown as Record<string, unknown>;
        return [];
      }
    }
  );

  assert.equal((eventParams?.petId as Types.ObjectId | undefined)?.toString(), petId);
  assert.equal((reminderParams?.petId as Types.ObjectId | undefined)?.toString(), petId);
});

test("getCalendar returns empty result when nothing matches", async () => {
  const result = await getCalendar(
    ownerId,
    { from: "2027-01-01", to: "2027-01-31" },
    {
      listEventsInRange: async () => [],
      listRemindersInRange: async () => []
    }
  );

  assert.deepEqual(result, { events: [], reminders: [] });
});

test("getCalendar defaults to current month when from/to are absent", async () => {
  let eventParams: Record<string, unknown> | undefined;

  await getCalendar(
    ownerId,
    {},
    {
      now: () => new Date("2026-05-13T12:00:00.000Z"),
      listEventsInRange: async (params) => {
        eventParams = params as unknown as Record<string, unknown>;
        return [];
      },
      listRemindersInRange: async () => []
    }
  );

  assert.equal((eventParams?.from as Date).toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal((eventParams?.to as Date).toISOString(), "2026-05-31T23:59:59.999Z");
});

test("getCalendar rejects malformed from with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "06/01/2026", to: "2026-06-30" },
        {
          listEventsInRange: async () => {
            throw new Error("should not be called");
          },
          listRemindersInRange: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_FROM");
      return true;
    }
  );
});

test("getCalendar rejects malformed to with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "2026-06-01", to: "not-a-date" },
        {
          listEventsInRange: async () => {
            throw new Error("should not be called");
          },
          listRemindersInRange: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_TO");
      return true;
    }
  );
});

test("getCalendar rejects invalid petId with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "2026-06-01", to: "2026-06-30", petId: "not-an-id" },
        {
          listEventsInRange: async () => {
            throw new Error("should not be called");
          },
          listRemindersInRange: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_PET_ID");
      return true;
    }
  );
});

test("getCalendar rejects from > to with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "2026-07-01", to: "2026-06-01" },
        {
          listEventsInRange: async () => {
            throw new Error("should not be called");
          },
          listRemindersInRange: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_RANGE");
      return true;
    }
  );
});

test("getCalendar isolates by owner — other owner sees empty result", async () => {
  let eventOwner: string | undefined;
  let reminderOwner: string | undefined;

  const result = await getCalendar(
    otherOwnerId,
    { from: "2026-06-01", to: "2026-06-30" },
    {
      listEventsInRange: async (params) => {
        eventOwner = params.ownerId.toString();
        return [];
      },
      listRemindersInRange: async (params) => {
        reminderOwner = params.ownerId.toString();
        return [];
      }
    }
  );

  assert.equal(eventOwner, otherOwnerId);
  assert.equal(reminderOwner, otherOwnerId);
  assert.deepEqual(result, { events: [], reminders: [] });
});

test("getCalendar rejects invalid owner id with UNAUTHORIZED", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        "not-an-id",
        { from: "2026-06-01", to: "2026-06-30" },
        {
          listEventsInRange: async () => {
            throw new Error("should not be called");
          },
          listRemindersInRange: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("getCalendar petId filter excludes events for other pets via repository contract", async () => {
  const result = await getCalendar(
    ownerId,
    { from: "2026-06-01", to: "2026-06-30", petId },
    {
      listEventsInRange: async (params) => {
        assert.equal(params.petId?.toString(), petId);
        return [makeEventRecord({ petId: new Types.ObjectId(petId) })];
      },
      listRemindersInRange: async (params) => {
        assert.equal(params.petId?.toString(), petId);
        return [];
      }
    }
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].petId, petId);
  assert.notEqual(result.events[0].petId, otherPetId);
});
