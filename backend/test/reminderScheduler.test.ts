import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import {
  pollPendingReminders,
  startReminderScheduler,
  stopReminderScheduler,
  type ReminderDeliveryRecord,
  type ReminderSchedulerDependencies,
  type ReminderSchedulerState
} from "../src/scheduler/reminderScheduler";

const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
const petId = new Types.ObjectId("60a7c1aa9e1d4f1234567890");
const eventId = new Types.ObjectId("60a7c1aa9e1d4f12345678ab");
const reminderId = new Types.ObjectId("60a7c1aa9e1d4f1234567899");
const now = new Date("2026-05-15T10:00:00.000Z");

const makeReminder = (overrides: Partial<ReminderDeliveryRecord> = {}): ReminderDeliveryRecord => ({
  _id: reminderId,
  ownerId,
  petId,
  eventId,
  channel: "email",
  dueAt: new Date("2026-05-20T10:00:00.000Z"),
  sendAt: new Date("2026-05-15T09:59:00.000Z"),
  offset: "day",
  status: "pending",
  ...overrides
});

const makeContext = (
  overrides: Partial<Awaited<ReturnType<NonNullable<ReminderSchedulerDependencies["loadReminderContext"]>>>> = {}
) => ({
  owner: {
    _id: ownerId,
    email: "owner@example.com",
    emailVerified: true
  },
  pet: {
    _id: petId,
    name: "Miso"
  },
  event: {
    _id: eventId,
    title: "Vaccination",
    eventDate: new Date("2026-05-20T10:00:00.000Z"),
    type: "vaccine" as const
  },
  ...overrides
});

const baseDependencies = (
  reminder: ReminderDeliveryRecord | null,
  overrides: ReminderSchedulerDependencies = {}
): ReminderSchedulerDependencies => {
  let claimed = false;

  return {
    now: () => now,
    randomToken: () => "lock-token",
    maxBatchSize: 5,
    claimPendingReminder: async () => {
      if (claimed || !reminder) {
        return null;
      }
      claimed = true;
      return reminder;
    },
    loadReminderContext: async () => makeContext(),
    sendEmail: async () => {},
    markReminderSent: async () => {},
    markReminderFailed: async () => {},
    logger: {
      warn: () => {},
      error: () => {}
    },
    ...overrides
  };
};

test("pollPendingReminders sends due pending reminders and marks them sent", async () => {
  const reminder = makeReminder();
  let sentPayload:
    | Parameters<NonNullable<ReminderSchedulerDependencies["sendEmail"]>>[0]
    | undefined;
  let markedSent:
    | Parameters<NonNullable<ReminderSchedulerDependencies["markReminderSent"]>>[0]
    | undefined;

  const result = await pollPendingReminders(
    baseDependencies(reminder, {
      sendEmail: async (payload) => {
        sentPayload = payload;
      },
      markReminderSent: async (input) => {
        markedSent = input;
      }
    })
  );

  assert.deepEqual(result, { claimed: 1, sent: 1, failed: 0, skipped: 0 });
  assert.equal(sentPayload?.to, "owner@example.com");
  assert.equal(sentPayload?.petName, "Miso");
  assert.equal(sentPayload?.eventTitle, "Vaccination");
  assert.equal(sentPayload?.eventType, "vaccine");
  assert.equal(markedSent?.reminder._id.toString(), reminderId.toString());
  assert.equal(markedSent?.lockToken, "lock-token");
});

test("pollPendingReminders returns without side effects when no due reminders are claimed", async () => {
  let emails = 0;
  let sentUpdates = 0;

  const result = await pollPendingReminders(
    baseDependencies(null, {
      sendEmail: async () => {
        emails += 1;
      },
      markReminderSent: async () => {
        sentUpdates += 1;
      }
    })
  );

  assert.deepEqual(result, { claimed: 0, sent: 0, failed: 0, skipped: 0 });
  assert.equal(emails, 0);
  assert.equal(sentUpdates, 0);
});

test("pollPendingReminders does not email unverified users and marks reminder failed", async () => {
  let emails = 0;
  let failed:
    | Parameters<NonNullable<ReminderSchedulerDependencies["markReminderFailed"]>>[0]
    | undefined;

  const result = await pollPendingReminders(
    baseDependencies(makeReminder(), {
      loadReminderContext: async () => makeContext({ owner: { _id: ownerId, email: "owner@example.com", emailVerified: false } }),
      sendEmail: async () => {
        emails += 1;
      },
      markReminderFailed: async (input) => {
        failed = input;
      }
    })
  );

  assert.deepEqual(result, { claimed: 1, sent: 0, failed: 1, skipped: 0 });
  assert.equal(emails, 0);
  assert.match(failed?.lastError ?? "", /not verified/);
});

test("pollPendingReminders fails safely when related records are missing", async () => {
  const cases = [
    { name: "owner", context: makeContext({ owner: null }), cause: /owner was not found/ },
    { name: "pet", context: makeContext({ pet: null }), cause: /pet was not found/ },
    { name: "event", context: makeContext({ event: null }), cause: /event was not found/ }
  ];

  for (const { context, cause } of cases) {
    let emails = 0;
    let failed:
      | Parameters<NonNullable<ReminderSchedulerDependencies["markReminderFailed"]>>[0]
      | undefined;

    const result = await pollPendingReminders(
      baseDependencies(makeReminder(), {
        loadReminderContext: async () => context,
        sendEmail: async () => {
          emails += 1;
        },
        markReminderFailed: async (input) => {
          failed = input;
        }
      })
    );

    assert.deepEqual(result, { claimed: 1, sent: 0, failed: 1, skipped: 0 });
    assert.equal(emails, 0);
    assert.match(failed?.lastError ?? "", cause);
  }
});

test("pollPendingReminders marks SMTP failures as failed with sanitized lastError", async () => {
  let failed:
    | Parameters<NonNullable<ReminderSchedulerDependencies["markReminderFailed"]>>[0]
    | undefined;

  const result = await pollPendingReminders(
    baseDependencies(makeReminder(), {
      sendEmail: async () => {
        throw new Error("SMTP failed with password=secret and https://example.com/token");
      },
      markReminderFailed: async (input) => {
        failed = input;
      }
    })
  );

  assert.deepEqual(result, { claimed: 1, sent: 0, failed: 1, skipped: 0 });
  assert.match(failed?.lastError ?? "", /SMTP failed/);
  assert.equal(failed?.lastError.includes("secret"), false);
  assert.equal(failed?.lastError.includes("https://example.com"), false);
});

test("pollPendingReminders never sends already sent or cancelled reminders when claim excludes them", async () => {
  const records = [
    makeReminder({ status: "sent" }),
    makeReminder({ status: "cancelled" })
  ];
  let emails = 0;

  const result = await pollPendingReminders({
    ...baseDependencies(null),
    claimPendingReminder: async () => {
      const due = records.find((record) => record.status === "pending");
      return due ?? null;
    },
    sendEmail: async () => {
      emails += 1;
    }
  });

  assert.deepEqual(result, { claimed: 0, sent: 0, failed: 0, skipped: 0 });
  assert.equal(emails, 0);
});

test("concurrent polling does not send the same reminder twice with atomic claim semantics", async () => {
  const reminders = [makeReminder()];
  let emails = 0;
  let sentUpdates = 0;

  const dependencies = baseDependencies(null, {
    claimPendingReminder: async ({ lockToken, lockExpiresAt }) => {
      const next = reminders.find((reminder) => reminder.status === "pending" && !reminder.processingToken);
      if (!next) {
        return null;
      }
      next.processingToken = lockToken;
      next.processingStartedAt = now;
      next.processingExpiresAt = lockExpiresAt;
      return next;
    },
    sendEmail: async () => {
      emails += 1;
    },
    markReminderSent: async ({ reminder, lockToken }) => {
      if (reminder.processingToken !== lockToken) {
        return;
      }
      reminder.status = "sent";
      reminder.processingToken = undefined;
      sentUpdates += 1;
    }
  });

  const [first, second] = await Promise.all([
    pollPendingReminders(dependencies),
    pollPendingReminders(dependencies)
  ]);

  assert.equal(first.claimed + second.claimed, 1);
  assert.equal(first.sent + second.sent, 1);
  assert.equal(emails, 1);
  assert.equal(sentUpdates, 1);
  assert.equal(reminders[0].status, "sent");
});

test("startReminderScheduler is disabled unless env enables it", () => {
  const state: ReminderSchedulerState = {};

  startReminderScheduler(baseDependencies(null), state);
  stopReminderScheduler(state);

  assert.equal(state.timer, undefined);
});
