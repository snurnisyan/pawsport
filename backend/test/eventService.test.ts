import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  calculateReminderSendAt,
  createPetEvent,
  listPetEvents,
  serializeEvent
} from "../src/services/eventService";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const otherPetId = "60a7c1aa9e1d4f1234567891";
const eventId = "60a7c1aa9e1d4f12345678ab";
const fileId = "60a7c1aa9e1d4f12345678cd";

const validInput = {
  type: "vaccination" as const,
  title: "Rabies booster",
  eventDate: "2026-06-01T10:00:00.000Z"
};

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

const petFound = async () => ({ _id: new Types.ObjectId(petId) });
const failingCreate = async () => {
  throw new Error("should not be called");
};

test("createPetEvent persists normalized input and returns serialized event", async () => {
  let captured: Record<string, unknown> | undefined;
  let reminderSync: Record<string, unknown> | undefined;

  const result = await createPetEvent(
    ownerId,
    petId,
    {
      type: "vaccination",
      title: "  Rabies booster  ",
      eventDate: "2026-06-01T10:00:00.000Z",
      nextDate: "2027-06-01T10:00:00.000Z",
      clinicName: "VetClinic №1",
      comment: "Annual shot",
      recurrence: { frequency: "yearly", interval: 1 },
      reminderOffset: "week",
      fileIds: [fileId]
    },
    {
      findPetByIdForOwner: petFound,
      createEventRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makeEventRecord({
          ownerId: input.ownerId,
          petId: input.petId,
          type: input.type,
          title: input.title,
          eventDate: input.eventDate,
          nextDate: input.nextDate,
          clinicName: input.clinicName,
          comment: input.comment,
          recurrence: input.recurrence,
          reminderOffset: input.reminderOffset,
          fileIds: input.fileIds
        });
      },
      syncPendingReminderForEvent: async (input) => {
        reminderSync = input as unknown as Record<string, unknown>;
      }
    }
  );

  assert.ok(captured);
  assert.equal((captured.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((captured.petId as Types.ObjectId).toString(), petId);
  assert.equal(captured.type, "vaccination");
  assert.equal(captured.title, "Rabies booster");
  assert.equal((captured.eventDate as Date).toISOString(), "2026-06-01T10:00:00.000Z");
  assert.equal((captured.nextDate as Date).toISOString(), "2027-06-01T10:00:00.000Z");
  assert.equal(captured.clinicName, "VetClinic №1");
  assert.equal(captured.comment, "Annual shot");
  assert.deepEqual(captured.recurrence, { frequency: "yearly", interval: 1 });
  assert.equal(captured.reminderOffset, "week");
  assert.equal((captured.fileIds as Types.ObjectId[]).length, 1);
  assert.equal((captured.fileIds as Types.ObjectId[])[0].toString(), fileId);

  assert.equal(result.id, eventId);
  assert.equal(result.ownerId, ownerId);
  assert.equal(result.petId, petId);
  assert.equal(result.type, "vaccination");
  assert.equal(result.title, "Rabies booster");
  assert.equal(result.eventDate, "2026-06-01T10:00:00.000Z");
  assert.equal(result.nextDate, "2027-06-01T10:00:00.000Z");
  assert.equal(result.clinicName, "VetClinic №1");
  assert.equal(result.comment, "Annual shot");
  assert.deepEqual(result.recurrence, { frequency: "yearly", interval: 1 });
  assert.equal(result.reminderOffset, "week");
  assert.deepEqual(result.fileIds, [fileId]);

  assert.ok(reminderSync);
  assert.equal((reminderSync.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((reminderSync.petId as Types.ObjectId).toString(), petId);
  assert.equal((reminderSync.eventId as Types.ObjectId).toString(), eventId);
  assert.equal((reminderSync.eventDate as Date).toISOString(), "2026-06-01T10:00:00.000Z");
  assert.equal(reminderSync.reminderOffset, "week");
});

test("createPetEvent defaults fileIds to empty array when omitted", async () => {
  let captured: Record<string, unknown> | undefined;

  await createPetEvent(ownerId, petId, validInput, {
    findPetByIdForOwner: petFound,
    createEventRecord: async (input) => {
      captured = input as unknown as Record<string, unknown>;
      return makeEventRecord({ fileIds: input.fileIds });
    }
  });

  assert.deepEqual(captured?.fileIds, []);
});

test("createPetEvent does not sync reminders when reminderOffset is omitted", async () => {
  let syncCalled = false;

  await createPetEvent(ownerId, petId, validInput, {
    findPetByIdForOwner: petFound,
    createEventRecord: async (input) => makeEventRecord({ ...input, reminderOffset: undefined }),
    syncPendingReminderForEvent: async () => {
      syncCalled = true;
    }
  });

  assert.equal(syncCalled, false);
});

test("calculateReminderSendAt subtracts the selected reminder offset", () => {
  const eventDate = new Date("2026-06-01T10:00:00.000Z");

  assert.equal(calculateReminderSendAt(eventDate, "day").toISOString(), "2026-05-31T10:00:00.000Z");
  assert.equal(calculateReminderSendAt(eventDate, "week").toISOString(), "2026-05-25T10:00:00.000Z");
  assert.equal(calculateReminderSendAt(eventDate, "month").toISOString(), "2026-05-02T10:00:00.000Z");
});

test("createPetEvent rejects invalid input", async () => {
  const cases: Array<{ input: Record<string, unknown>; code: string }> = [
    { input: { ...validInput, type: undefined }, code: "INVALID_TYPE" },
    { input: { ...validInput, type: "wedding" }, code: "INVALID_TYPE" },
    { input: { ...validInput, title: undefined }, code: "INVALID_TITLE" },
    { input: { ...validInput, title: "   " }, code: "INVALID_TITLE" },
    { input: { ...validInput, eventDate: undefined }, code: "INVALID_EVENT_DATE" },
    { input: { ...validInput, eventDate: "not-a-date" }, code: "INVALID_EVENT_DATE" },
    { input: { ...validInput, nextDate: "broken" }, code: "INVALID_NEXT_DATE" },
    { input: { ...validInput, reminderOffset: "century" }, code: "INVALID_REMINDER_OFFSET" },
    { input: { ...validInput, recurrence: "weekly" }, code: "INVALID_RECURRENCE" },
    { input: { ...validInput, recurrence: { frequency: "hourly" } }, code: "INVALID_RECURRENCE" },
    { input: { ...validInput, recurrence: { frequency: "weekly", interval: 0 } }, code: "INVALID_RECURRENCE" },
    { input: { ...validInput, fileIds: ["not-an-id"] }, code: "INVALID_FILE_IDS" },
    { input: { ...validInput, fileIds: "not-an-array" }, code: "INVALID_FILE_IDS" }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () =>
        createPetEvent(ownerId, petId, input, {
          findPetByIdForOwner: petFound,
          createEventRecord: failingCreate
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, code);
        return true;
      }
    );
  }
});

test("createPetEvent rejects invalid petId in path with 400", async () => {
  await assert.rejects(
    () =>
      createPetEvent(ownerId, "not-an-id", validInput, {
        findPetByIdForOwner: async () => {
          throw new Error("should not be called");
        },
        createEventRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_PET_ID");
      return true;
    }
  );
});

test("createPetEvent rejects invalid owner id with UNAUTHORIZED", async () => {
  await assert.rejects(
    () =>
      createPetEvent("not-an-id", petId, validInput, {
        findPetByIdForOwner: petFound,
        createEventRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("createPetEvent returns 404 when pet does not belong to owner", async () => {
  await assert.rejects(
    () =>
      createPetEvent(ownerId, petId, validInput, {
        findPetByIdForOwner: async () => null,
        createEventRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );
});

test("createPetEvent returns 404 for someone else's pet (ownership isolation)", async () => {
  let observedOwner: string | undefined;

  await assert.rejects(
    () =>
      createPetEvent(otherOwnerId, petId, validInput, {
        findPetByIdForOwner: async (_id, owner) => {
          observedOwner = owner.toString();
          return null;
        },
        createEventRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );

  assert.equal(observedOwner, otherOwnerId);
});

test("listPetEvents filters by owner+pet and returns serialized events sorted desc", async () => {
  let observed: { owner: string; pet: string } | undefined;
  const earlier = new Date("2026-05-01T00:00:00.000Z");
  const later = new Date("2026-07-01T00:00:00.000Z");

  const result = await listPetEvents(ownerId, petId, {
    findPetByIdForOwner: petFound,
    listEventsForOwnerPet: async (owner, pet) => {
      observed = { owner: owner.toString(), pet: pet.toString() };
      return [
        makeEventRecord({ _id: new Types.ObjectId(), eventDate: later, title: "later" }),
        makeEventRecord({ _id: new Types.ObjectId(), eventDate: earlier, title: "earlier" })
      ];
    }
  });

  assert.deepEqual(observed, { owner: ownerId, pet: petId });
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "later");
  assert.equal(result[1].title, "earlier");
  assert.equal(result[0].eventDate, "2026-07-01T00:00:00.000Z");
});

test("listPetEvents returns 404 when pet does not belong to owner", async () => {
  await assert.rejects(
    () =>
      listPetEvents(ownerId, otherPetId, {
        findPetByIdForOwner: async () => null,
        listEventsForOwnerPet: async () => {
          throw new Error("should not be called");
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );
});

test("listPetEvents rejects invalid petId with 400", async () => {
  await assert.rejects(
    () =>
      listPetEvents(ownerId, "not-an-id", {
        findPetByIdForOwner: petFound,
        listEventsForOwnerPet: async () => {
          throw new Error("should not be called");
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_PET_ID");
      return true;
    }
  );
});

test("serializeEvent hides optional fields when absent", () => {
  const serialized = serializeEvent(makeEventRecord());
  assert.equal("nextDate" in serialized, false);
  assert.equal("clinicName" in serialized, false);
  assert.equal("comment" in serialized, false);
  assert.equal("recurrence" in serialized, false);
  assert.equal("reminderOffset" in serialized, false);
  assert.deepEqual(serialized.fileIds, []);
});

test("serializeEvent includes recurrence without interval when interval is omitted", () => {
  const serialized = serializeEvent(makeEventRecord({ recurrence: { frequency: "weekly" } }));
  assert.deepEqual(serialized.recurrence, { frequency: "weekly" });
});
