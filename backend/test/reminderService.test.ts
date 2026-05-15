import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  createReminder,
  listReminders,
  serializeReminder
} from "../src/services/reminderService";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const eventId = "60a7c1aa9e1d4f12345678ab";
const reminderId = "60a7c1aa9e1d4f1234567899";

const validInput = {
  petId,
  eventId,
  dueAt: "2026-06-01T10:00:00.000Z",
  sendAt: "2026-05-25T10:00:00.000Z",
  offset: "week" as const
};

const makeReminderRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(reminderId),
  ownerId: new Types.ObjectId(ownerId),
  petId: new Types.ObjectId(petId),
  eventId: new Types.ObjectId(eventId),
  channel: "email" as const,
  dueAt: new Date("2026-06-01T10:00:00.000Z"),
  sendAt: new Date("2026-05-25T10:00:00.000Z"),
  offset: "week" as const,
  status: "pending" as const,
  createdAt: new Date("2026-05-12T00:00:00.000Z"),
  updatedAt: new Date("2026-05-12T00:00:00.000Z"),
  ...overrides
});

const petFound = async () => ({ _id: new Types.ObjectId(petId) });
const eventFound = async () => ({ _id: new Types.ObjectId(eventId), petId: new Types.ObjectId(petId) });
const failingCreate = async () => {
  throw new Error("should not be called");
};

test("createReminder persists normalized input and returns serialized reminder", async () => {
  let captured: Record<string, unknown> | undefined;

  const result = await createReminder(ownerId, validInput, {
    findPetByIdForOwner: petFound,
    findEventByIdForOwner: eventFound,
    createReminderRecord: async (input) => {
      captured = input as unknown as Record<string, unknown>;
      return makeReminderRecord({
        ownerId: input.ownerId,
        petId: input.petId,
        eventId: input.eventId,
        channel: input.channel,
        dueAt: input.dueAt,
        sendAt: input.sendAt,
        offset: input.offset,
        status: input.status
      });
    }
  });

  assert.ok(captured);
  assert.equal((captured.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((captured.petId as Types.ObjectId).toString(), petId);
  assert.equal((captured.eventId as Types.ObjectId).toString(), eventId);
  assert.equal(captured.channel, "email");
  assert.equal((captured.dueAt as Date).toISOString(), "2026-06-01T10:00:00.000Z");
  assert.equal((captured.sendAt as Date).toISOString(), "2026-05-25T10:00:00.000Z");
  assert.equal(captured.offset, "week");
  assert.equal(captured.status, "pending");

  assert.equal(result.id, reminderId);
  assert.equal(result.ownerId, ownerId);
  assert.equal(result.petId, petId);
  assert.equal(result.eventId, eventId);
  assert.equal(result.channel, "email");
  assert.equal(result.dueAt, "2026-06-01T10:00:00.000Z");
  assert.equal(result.sendAt, "2026-05-25T10:00:00.000Z");
  assert.equal(result.offset, "week");
  assert.equal(result.status, "pending");
});

test("createReminder defaults channel to email when omitted", async () => {
  let captured: Record<string, unknown> | undefined;

  await createReminder(
    ownerId,
    { ...validInput, channel: undefined },
    {
      findPetByIdForOwner: petFound,
      findEventByIdForOwner: eventFound,
      createReminderRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makeReminderRecord({ channel: input.channel });
      }
    }
  );

  assert.equal(captured?.channel, "email");
});

test("createReminder accepts channel=null and defaults to email", async () => {
  let captured: Record<string, unknown> | undefined;

  await createReminder(
    ownerId,
    { ...validInput, channel: null },
    {
      findPetByIdForOwner: petFound,
      findEventByIdForOwner: eventFound,
      createReminderRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makeReminderRecord({ channel: input.channel });
      }
    }
  );

  assert.equal(captured?.channel, "email");
});

test("createReminder validates input before touching the database", async () => {
  let petLookupCalls = 0;

  await assert.rejects(
    () =>
      createReminder(
        ownerId,
        { ...validInput, petId: "not-an-id" },
        {
          findPetByIdForOwner: async () => {
            petLookupCalls += 1;
            return null;
          },
          createReminderRecord: failingCreate
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "INVALID_PET_ID");
      return true;
    }
  );

  assert.equal(petLookupCalls, 0);
});

test("createReminder rejects invalid input", async () => {
  const cases: Array<{ input: Record<string, unknown>; code: string }> = [
    { input: { ...validInput, petId: undefined }, code: "INVALID_PET_ID" },
    { input: { ...validInput, petId: "not-an-id" }, code: "INVALID_PET_ID" },
    { input: { ...validInput, eventId: undefined }, code: "INVALID_EVENT_ID" },
    { input: { ...validInput, eventId: "broken" }, code: "INVALID_EVENT_ID" },
    { input: { ...validInput, dueAt: undefined }, code: "INVALID_DUE_AT" },
    { input: { ...validInput, dueAt: "not-a-date" }, code: "INVALID_DUE_AT" },
    { input: { ...validInput, sendAt: undefined }, code: "INVALID_SEND_AT" },
    { input: { ...validInput, sendAt: "not-a-date" }, code: "INVALID_SEND_AT" },
    { input: { ...validInput, offset: undefined }, code: "INVALID_OFFSET" },
    { input: { ...validInput, offset: "century" }, code: "INVALID_OFFSET" },
    { input: { ...validInput, channel: "sms" }, code: "INVALID_CHANNEL" }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () =>
        createReminder(ownerId, input, {
          findPetByIdForOwner: petFound,
          findEventByIdForOwner: eventFound,
          createReminderRecord: failingCreate
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

test("createReminder returns 404 when pet does not belong to owner", async () => {
  await assert.rejects(
    () =>
      createReminder(ownerId, validInput, {
        findPetByIdForOwner: async () => null,
        findEventByIdForOwner: eventFound,
        createReminderRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );
});

test("createReminder rejects invalid owner id with UNAUTHORIZED", async () => {
  await assert.rejects(
    () =>
      createReminder("not-an-id", validInput, {
        findPetByIdForOwner: petFound,
        findEventByIdForOwner: eventFound,
        createReminderRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("createReminder returns 404 when event is missing or owned by another user", async () => {
  await assert.rejects(
    () =>
      createReminder(ownerId, validInput, {
        findPetByIdForOwner: petFound,
        findEventByIdForOwner: async () => null,
        createReminderRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "EVENT_NOT_FOUND");
      return true;
    }
  );
});

test("createReminder returns 404 when event belongs to another pet", async () => {
  await assert.rejects(
    () =>
      createReminder(ownerId, validInput, {
        findPetByIdForOwner: petFound,
        findEventByIdForOwner: async () => ({
          _id: new Types.ObjectId(eventId),
          petId: new Types.ObjectId("60a7c1aa9e1d4f1234567891")
        }),
        createReminderRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "EVENT_NOT_FOUND");
      return true;
    }
  );
});

test("listReminders filters by owner and returns serialized reminders", async () => {
  const result = await listReminders(ownerId, {
    listRemindersForOwner: async (id) => {
      assert.equal(id.toString(), ownerId);
      return [
        makeReminderRecord(),
        makeReminderRecord({
          _id: new Types.ObjectId(),
          offset: "day",
          sendAt: new Date("2026-05-31T10:00:00.000Z")
        })
      ];
    }
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].offset, "week");
  assert.equal(result[1].offset, "day");
  assert.equal(result[0].ownerId, ownerId);
});

test("listReminders returns empty array when other owner has nothing", async () => {
  const result = await listReminders(otherOwnerId, {
    listRemindersForOwner: async (id) => {
      assert.equal(id.toString(), otherOwnerId);
      return [];
    }
  });

  assert.deepEqual(result, []);
});

test("serializeReminder hides lastError when absent", () => {
  const serialized = serializeReminder(makeReminderRecord());
  assert.equal("lastError" in serialized, false);
});

test("serializeReminder includes lastError when present", () => {
  const serialized = serializeReminder(makeReminderRecord({ lastError: "SMTP failed" }));
  assert.equal(serialized.lastError, "SMTP failed");
});
