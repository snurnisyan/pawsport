import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  deleteReminder,
  updateReminder,
  type ReminderUpdates
} from "../src/services/reminderService";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const eventId = "60a7c1aa9e1d4f12345678ab";
const reminderId = "60a7c1aa9e1d4f1234567899";

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

test("updateReminder applies dueAt and sendAt updates", async () => {
  let captured: ReminderUpdates | undefined;

  const result = await updateReminder(
    ownerId,
    reminderId,
    {
      dueAt: "2026-07-01T10:00:00.000Z",
      sendAt: "2026-06-24T10:00:00.000Z"
    },
    {
      findReminderByIdForOwner: async () => makeReminderRecord(),
      updateReminderRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makeReminderRecord({
          dueAt: new Date("2026-07-01T10:00:00.000Z"),
          sendAt: new Date("2026-06-24T10:00:00.000Z")
        });
      }
    }
  );

  assert.ok(captured);
  assert.equal((captured.set.dueAt as Date).toISOString(), "2026-07-01T10:00:00.000Z");
  assert.equal((captured.set.sendAt as Date).toISOString(), "2026-06-24T10:00:00.000Z");
  assert.deepEqual(captured.unset, ["readAt"]);
  assert.equal(result.dueAt, "2026-07-01T10:00:00.000Z");
  assert.equal(result.sendAt, "2026-06-24T10:00:00.000Z");
});

test("updateReminder allows transitioning status to cancelled", async () => {
  let captured: ReminderUpdates | undefined;

  const result = await updateReminder(
    ownerId,
    reminderId,
    { status: "cancelled" },
    {
      findReminderByIdForOwner: async () => makeReminderRecord({ status: "pending" }),
      updateReminderRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makeReminderRecord({ status: "cancelled" });
      }
    }
  );

  assert.equal(captured?.set.status, "cancelled");
  assert.equal(result.status, "cancelled");
});

test("updateReminder resets readAt when offset changes", async () => {
  let captured: ReminderUpdates | undefined;

  await updateReminder(
    ownerId,
    reminderId,
    { offset: "day" },
    {
      findReminderByIdForOwner: async () =>
        makeReminderRecord({ readAt: new Date("2026-05-17T10:00:00.000Z") }),
      updateReminderRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makeReminderRecord({ offset: "day" });
      }
    }
  );

  assert.equal(captured?.set.offset, "day");
  assert.deepEqual(captured?.unset, ["readAt"]);
});

test("updateReminder returns current reminder when body is empty", async () => {
  const result = await updateReminder(
    ownerId,
    reminderId,
    {},
    {
      findReminderByIdForOwner: async () => makeReminderRecord({ offset: "day" }),
      updateReminderRecord: async () => {
        throw new Error("should not be called");
      }
    }
  );

  assert.equal(result.offset, "day");
});

test("updateReminder ignores unknown fields", async () => {
  let updateCalled = false;
  const result = await updateReminder(
    ownerId,
    reminderId,
    { channel: "sms", petId: "abc" } as Record<string, unknown>,
    {
      findReminderByIdForOwner: async () => makeReminderRecord({ channel: "email" }),
      updateReminderRecord: async () => {
        updateCalled = true;
        throw new Error("should not be called");
      }
    }
  );

  assert.equal(updateCalled, false);
  assert.equal(result.channel, "email");
});

test("updateReminder rejects modification of a sent reminder with 409", async () => {
  await assert.rejects(
    () =>
      updateReminder(
        ownerId,
        reminderId,
        { offset: "day" },
        {
          findReminderByIdForOwner: async () => makeReminderRecord({ status: "sent" }),
          updateReminderRecord: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "REMINDER_SENT_IMMUTABLE");
      return true;
    }
  );
});

test("updateReminder allows empty body on a sent reminder (no-op)", async () => {
  const result = await updateReminder(ownerId, reminderId, {}, {
    findReminderByIdForOwner: async () => makeReminderRecord({ status: "sent" }),
    updateReminderRecord: async () => {
      throw new Error("should not be called");
    }
  });

  assert.equal(result.status, "sent");
});

test("updateReminder returns 404 when reminder missing or owned by another user", async () => {
  await assert.rejects(
    () =>
      updateReminder(
        otherOwnerId,
        reminderId,
        { offset: "day" },
        {
          findReminderByIdForOwner: async (_id, owner) => {
            assert.equal(owner.toString(), otherOwnerId);
            return null;
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "REMINDER_NOT_FOUND");
      return true;
    }
  );
});

test("updateReminder rejects invalid input", async () => {
  const cases: Array<{ input: Record<string, unknown>; code: string }> = [
    { input: { dueAt: "not-a-date" }, code: "INVALID_DUE_AT" },
    { input: { sendAt: "not-a-date" }, code: "INVALID_SEND_AT" },
    { input: { offset: "century" }, code: "INVALID_OFFSET" },
    { input: { status: "delivered" }, code: "INVALID_STATUS" }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () => updateReminder(ownerId, reminderId, input),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, code);
        return true;
      }
    );
  }
});

test("updateReminder rejects invalid reminderId with 400", async () => {
  await assert.rejects(
    () => updateReminder(ownerId, "not-an-id", { offset: "day" }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_REMINDER_ID");
      return true;
    }
  );
});

test("deleteReminder returns void when reminder exists", async () => {
  let called = false;
  await deleteReminder(ownerId, reminderId, {
    deleteReminderRecord: async (id, owner) => {
      assert.equal(id.toString(), reminderId);
      assert.equal(owner.toString(), ownerId);
      called = true;
      return makeReminderRecord();
    }
  });
  assert.equal(called, true);
});

test("deleteReminder returns 404 when reminder missing or other owner", async () => {
  await assert.rejects(
    () =>
      deleteReminder(ownerId, reminderId, {
        deleteReminderRecord: async () => null
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "REMINDER_NOT_FOUND");
      return true;
    }
  );
});

test("deleteReminder rejects invalid id with 400", async () => {
  await assert.rejects(
    () => deleteReminder(ownerId, "not-an-id"),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_REMINDER_ID");
      return true;
    }
  );
});

test("deleteReminder rejects invalid owner with UNAUTHORIZED", async () => {
  await assert.rejects(
    () => deleteReminder("not-an-id", reminderId),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});
