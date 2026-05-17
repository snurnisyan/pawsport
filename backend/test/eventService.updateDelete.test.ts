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

const assertAppError = (statusCode: number, code: string) => (error: unknown): true => {
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.code, code);
  return true;
};

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const eventId = "60a7c1aa9e1d4f12345678ab";
const fileId = "60a7c1aa9e1d4f12345678cd";

const makeEventRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(eventId),
  ownerId: new Types.ObjectId(ownerId),
  petId: new Types.ObjectId(petId),
  type: "vaccine" as const,
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
      },
      syncPendingReminderForEvent: async () => {}
    }
  );

  assert.deepEqual(captured?.set, {});
  assert.deepEqual(captured?.unset.sort(), ["clinicName", "reminderOffset"]);
});

test("updateEvent syncs pending reminder when eventDate changes", async () => {
  let captured: EventUpdates | undefined;
  let reminderSync: Record<string, unknown> | undefined;

  await updateEvent(
    ownerId,
    eventId,
    { eventDate: "2026-09-01T10:00:00.000Z" },
    {
      updateEventRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makeEventRecord({
          eventDate: new Date("2026-09-01T10:00:00.000Z"),
          reminderOffset: "week"
        });
      },
      syncPendingReminderForEvent: async (input) => {
        reminderSync = input as unknown as Record<string, unknown>;
      }
    }
  );

  const setDate = captured?.set.eventDate as Date | undefined;
  assert.ok(setDate instanceof Date);
  assert.equal(setDate.toISOString(), "2026-09-01T10:00:00.000Z");
  assert.ok(reminderSync);
  assert.equal((reminderSync.eventId as Types.ObjectId).toString(), eventId);
  assert.equal((reminderSync.eventDate as Date).toISOString(), "2026-09-01T10:00:00.000Z");
  assert.equal(reminderSync.reminderOffset, "week");
});

test("updateEvent syncs deletion of pending reminder when reminderOffset is cleared", async () => {
  let reminderSync: Record<string, unknown> | undefined;

  await updateEvent(
    ownerId,
    eventId,
    { reminderOffset: null },
    {
      updateEventRecord: async () => makeEventRecord({ reminderOffset: undefined }),
      syncPendingReminderForEvent: async (input) => {
        reminderSync = input as unknown as Record<string, unknown>;
      }
    }
  );

  assert.ok(reminderSync);
  assert.equal((reminderSync.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((reminderSync.petId as Types.ObjectId).toString(), petId);
  assert.equal((reminderSync.eventId as Types.ObjectId).toString(), eventId);
  assert.equal(reminderSync.reminderOffset, undefined);
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

test("updateEvent validates fileIds against the existing event's pet", async () => {
  let validatedIds: Types.ObjectId[] | undefined;

  await updateEvent(
    ownerId,
    eventId,
    { fileIds: [fileId] },
    {
      findEventByIdForOwner: async () => makeEventRecord(),
      validateFileIdsForPet: async (owner, pet, ids) => {
        assert.equal(owner.toString(), ownerId);
        assert.equal(pet.toString(), petId);
        validatedIds = ids;
      },
      updateEventRecord: async () => makeEventRecord({ fileIds: [new Types.ObjectId(fileId)] })
    }
  );

  assert.ok(validatedIds);
  assert.equal(validatedIds.length, 1);
  assert.equal(validatedIds[0].toString(), fileId);
});

test("updateEvent rejects fileIds outside the pet/owner scope with 400", async () => {
  let updateCalled = false;

  await assert.rejects(
    () =>
      updateEvent(
        ownerId,
        eventId,
        { fileIds: [fileId] },
        {
          findEventByIdForOwner: async () => makeEventRecord(),
          validateFileIdsForPet: async () => {
            throw new AppError(400, "INVALID_FILE_IDS", "fileIds must reference files belonging to the same pet");
          },
          updateEventRecord: async () => {
            updateCalled = true;
            throw new Error("should not be called");
          }
        }
      ),
    assertAppError(400, "INVALID_FILE_IDS")
  );

  assert.equal(updateCalled, false);
});

test("updateEvent returns 404 when fileIds present but event missing", async () => {
  await assert.rejects(
    () =>
      updateEvent(
        ownerId,
        eventId,
        { fileIds: [fileId] },
        {
          findEventByIdForOwner: async () => null,
          validateFileIdsForPet: async () => {
            throw new Error("should not be called");
          },
          updateEventRecord: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    assertAppError(404, "EVENT_NOT_FOUND")
  );
});

test("updateEvent allows clearing fileIds to empty array without scope validation", async () => {
  let validationCalled = false;
  let captured: EventUpdates | undefined;

  await updateEvent(
    ownerId,
    eventId,
    { fileIds: [] },
    {
      findEventByIdForOwner: async () => {
        throw new Error("should not be called");
      },
      validateFileIdsForPet: async () => {
        validationCalled = true;
      },
      updateEventRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makeEventRecord({ fileIds: [] });
      }
    }
  );

  assert.equal(validationCalled, false);
  assert.deepEqual(captured?.set, { fileIds: [] });
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

test("deleteEvent removes event, detaches files, and cascades pending reminders", async () => {
  // Event-deletion file policy: files linked to the deleted event are DETACHED
  // (the eventId field is unset) but the file metadata and S3 object remain
  // under the pet. The user can still find them via GET /api/pets/:id/files.
  const seen: string[] = [];

  await deleteEvent(ownerId, eventId, {
    deleteEventRecord: async (id, owner) => {
      assert.equal(id.toString(), eventId);
      assert.equal(owner.toString(), ownerId);
      seen.push("event");
      return makeEventRecord();
    },
    detachFilesFromEvent: async (owner, id) => {
      assert.equal(id.toString(), eventId);
      assert.equal(owner.toString(), ownerId);
      seen.push("detachFiles");
    },
    deleteRemindersForEvent: async (id, owner) => {
      assert.equal(id.toString(), eventId);
      assert.equal(owner.toString(), ownerId);
      seen.push("reminders");
    }
  });

  assert.equal(seen[0], "event");
  assert.ok(seen.includes("detachFiles"));
  assert.ok(seen.includes("reminders"));
});

test("deleteEvent returns 404 when event missing and does not touch files or reminders", async () => {
  let cascadeCalled = false;
  let detachCalled = false;
  await assert.rejects(
    () =>
      deleteEvent(ownerId, eventId, {
        deleteEventRecord: async () => null,
        detachFilesFromEvent: async () => {
          detachCalled = true;
        },
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
  assert.equal(detachCalled, false);
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
