import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  deleteEvent,
  getEvent,
  updateEvent,
  type EventUpdates
} from "../src/services/eventService";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const eventId = "60a7c1aa9e1d4f12345678ab";

const makeEventRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(eventId),
  ownerId: new Types.ObjectId(ownerId),
  petId: new Types.ObjectId(petId),
  type: "vaccination" as const,
  title: "Rabies booster",
  eventDate: new Date("2026-06-01T10:00:00.000Z"),
  fileIds: [],
  createdAt: new Date("2026-05-12T00:00:00.000Z"),
  updatedAt: new Date("2026-05-12T00:00:00.000Z"),
  ...overrides
});

test("getEvent returns serialized event for owner", async () => {
  const result = await getEvent(ownerId, eventId, {
    findEventByIdForOwner: async (id, owner) => {
      assert.equal(id.toString(), eventId);
      assert.equal(owner.toString(), ownerId);
      return makeEventRecord({ title: "Annual shot" });
    }
  });

  assert.equal(result.id, eventId);
  assert.equal(result.title, "Annual shot");
});

test("getEvent returns 404 when event missing or owned by another user", async () => {
  await assert.rejects(
    () =>
      getEvent(otherOwnerId, eventId, {
        findEventByIdForOwner: async (_id, owner) => {
          assert.equal(owner.toString(), otherOwnerId);
          return null;
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "EVENT_NOT_FOUND");
      return true;
    }
  );
});

test("getEvent rejects invalid eventId with 400", async () => {
  await assert.rejects(
    () => getEvent(ownerId, "not-an-id"),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_EVENT_ID");
      return true;
    }
  );
});

test("updateEvent applies partial set and trims title", async () => {
  let captured: EventUpdates | undefined;

  const result = await updateEvent(
    ownerId,
    eventId,
    { title: "  New title  " },
    {
      updateEventRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makeEventRecord({ title: "New title" });
      }
    }
  );

  assert.deepEqual(captured?.set, { title: "New title" });
  assert.deepEqual(captured?.unset, []);
  assert.equal(result.title, "New title");
});

test("updateEvent unsets optional fields when null", async () => {
  let captured: EventUpdates | undefined;

  await updateEvent(
    ownerId,
    eventId,
    { clinicName: null, reminderOffset: "" },
    {
      updateEventRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makeEventRecord();
      }
    }
  );

  assert.deepEqual(captured?.set, {});
  assert.deepEqual(captured?.unset.sort(), ["clinicName", "reminderOffset"]);
});

test("updateEvent does not touch reminders when eventDate changes", async () => {
  let captured: EventUpdates | undefined;

  await updateEvent(
    ownerId,
    eventId,
    { eventDate: "2026-09-01T10:00:00.000Z" },
    {
      updateEventRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makeEventRecord({ eventDate: new Date("2026-09-01T10:00:00.000Z") });
      }
    }
  );

  const setDate = captured?.set.eventDate as Date | undefined;
  assert.ok(setDate instanceof Date);
  assert.equal(setDate.toISOString(), "2026-09-01T10:00:00.000Z");
});

test("updateEvent returns current event when body is empty", async () => {
  const result = await updateEvent(
    ownerId,
    eventId,
    {},
    {
      findEventByIdForOwner: async () => makeEventRecord({ title: "Stays the same" }),
      updateEventRecord: async () => {
        throw new Error("should not be called");
      }
    }
  );

  assert.equal(result.title, "Stays the same");
});

test("updateEvent returns 404 when event not found or other owner", async () => {
  await assert.rejects(
    () =>
      updateEvent(
        otherOwnerId,
        eventId,
        { title: "X" },
        {
          updateEventRecord: async () => null
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "EVENT_NOT_FOUND");
      return true;
    }
  );
});

test("updateEvent rejects invalid input", async () => {
  const cases: Array<{ input: Record<string, unknown>; code: string }> = [
    { input: { title: "" }, code: "INVALID_TITLE" },
    { input: { title: null }, code: "INVALID_TITLE" },
    { input: { type: "wedding" }, code: "INVALID_TYPE" },
    { input: { eventDate: "not-a-date" }, code: "INVALID_EVENT_DATE" },
    { input: { nextDate: "broken" }, code: "INVALID_NEXT_DATE" },
    { input: { reminderOffset: "century" }, code: "INVALID_REMINDER_OFFSET" },
    { input: { recurrence: { frequency: "hourly" } }, code: "INVALID_RECURRENCE" },
    { input: { fileIds: "not-an-array" }, code: "INVALID_FILE_IDS" }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () => updateEvent(ownerId, eventId, input),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, code);
        return true;
      }
    );
  }
});

test("updateEvent rejects invalid eventId with 400", async () => {
  await assert.rejects(
    () => updateEvent(ownerId, "not-an-id", { title: "X" }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_EVENT_ID");
      return true;
    }
  );
});

test("deleteEvent removes event and cascades reminders", async () => {
  const seen: string[] = [];

  await deleteEvent(ownerId, eventId, {
    deleteEventRecord: async (id, owner) => {
      assert.equal(id.toString(), eventId);
      assert.equal(owner.toString(), ownerId);
      seen.push("event");
      return makeEventRecord();
    },
    deleteRemindersForEvent: async (id, owner) => {
      assert.equal(id.toString(), eventId);
      assert.equal(owner.toString(), ownerId);
      seen.push("reminders");
    }
  });

  assert.deepEqual(seen, ["event", "reminders"]);
});

test("deleteEvent returns 404 when event missing", async () => {
  let cascadeCalled = false;
  await assert.rejects(
    () =>
      deleteEvent(ownerId, eventId, {
        deleteEventRecord: async () => null,
        deleteRemindersForEvent: async () => {
          cascadeCalled = true;
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "EVENT_NOT_FOUND");
      return true;
    }
  );

  assert.equal(cascadeCalled, false);
});

test("deleteEvent rejects invalid id with 400", async () => {
  await assert.rejects(
    () => deleteEvent(ownerId, "not-an-id"),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_EVENT_ID");
      return true;
    }
  );
});

test("deleteEvent rejects invalid owner with UNAUTHORIZED", async () => {
  await assert.rejects(
    () => deleteEvent("not-an-id", eventId),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});
