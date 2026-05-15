import crypto from "node:crypto";

import { env } from "../config/env";
import { sanitizeJobDiagnostic } from "../jobs/backgroundJobRunner";
import { type EventType, type ReminderOffset } from "../models/Event";
import { EventModel } from "../models/Event";
import { PetModel } from "../models/Pet";
import { ReminderModel, type IReminder } from "../models/Reminder";
import { UserModel } from "../models/User";
import { sendReminderEmail, type ReminderEmailPayload } from "../services/reminderEmail";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;

export type ReminderDeliveryRecord = Pick<
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
  | "processingToken"
  | "processingStartedAt"
  | "processingExpiresAt"
>;

interface ReminderOwnerRecord {
  _id: IReminder["ownerId"];
  email: string;
  emailVerified: boolean;
}

interface ReminderPetRecord {
  _id: IReminder["petId"];
  name: string;
}

interface ReminderEventRecord {
  _id: IReminder["eventId"];
  title: string;
  eventDate: Date;
  type: EventType;
}

export interface ClaimPendingReminderInput {
  now: Date;
  lockToken: string;
  lockExpiresAt: Date;
}

export interface ReleaseReminderInput {
  reminder: ReminderDeliveryRecord;
  lockToken: string;
}

export interface FailReminderInput extends ReleaseReminderInput {
  lastError: string;
}

export interface ReminderDeliveryContext {
  owner: ReminderOwnerRecord | null;
  pet: ReminderPetRecord | null;
  event: ReminderEventRecord | null;
}

export interface ReminderPollResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

export interface ReminderSchedulerLogger {
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
}

export interface ReminderSchedulerDependencies {
  now?: () => Date;
  randomToken?: () => string;
  maxBatchSize?: number;
  lockTtlMs?: number;
  pollIntervalMs?: number;
  claimPendingReminder?: (input: ClaimPendingReminderInput) => Promise<ReminderDeliveryRecord | null>;
  loadReminderContext?: (reminder: ReminderDeliveryRecord) => Promise<ReminderDeliveryContext>;
  sendEmail?: (payload: ReminderEmailPayload) => Promise<void>;
  markReminderSent?: (input: ReleaseReminderInput) => Promise<void>;
  markReminderFailed?: (input: FailReminderInput) => Promise<void>;
  logger?: ReminderSchedulerLogger;
}

export interface ReminderSchedulerState {
  timer?: NodeJS.Timeout;
}

const defaultSchedulerState: ReminderSchedulerState = {};

const defaultLogger: ReminderSchedulerLogger = {
  warn: (message, fields) => {
    process.stderr.write(`${message} ${JSON.stringify(fields ?? {})}\n`);
  },
  error: (message, fields) => {
    process.stderr.write(`${message} ${JSON.stringify(fields ?? {})}\n`);
  }
};

const defaultClaimPendingReminder = async ({
  now,
  lockToken,
  lockExpiresAt
}: ClaimPendingReminderInput): Promise<ReminderDeliveryRecord | null> => {
  const reminder = await ReminderModel.findOneAndUpdate(
    {
      status: "pending",
      channel: "email",
      sendAt: { $lte: now },
      $or: [
        { processingToken: { $exists: false } },
        { processingExpiresAt: { $exists: false } },
        { processingExpiresAt: { $lte: now } }
      ]
    },
    {
      $set: {
        processingToken: lockToken,
        processingStartedAt: now,
        processingExpiresAt: lockExpiresAt
      }
    },
    {
      new: true,
      sort: { sendAt: 1 }
    }
  ).exec();

  return reminder as unknown as ReminderDeliveryRecord | null;
};

const defaultLoadReminderContext = async (
  reminder: ReminderDeliveryRecord
): Promise<ReminderDeliveryContext> => {
  const [owner, pet, event] = await Promise.all([
    UserModel.findById(reminder.ownerId)
      .select({ email: 1, emailVerified: 1 })
      .exec() as Promise<ReminderOwnerRecord | null>,
    PetModel.findOne({ _id: reminder.petId, ownerId: reminder.ownerId })
      .select({ name: 1 })
      .exec() as Promise<ReminderPetRecord | null>,
    EventModel.findOne({
      _id: reminder.eventId,
      ownerId: reminder.ownerId,
      petId: reminder.petId
    })
      .select({ title: 1, eventDate: 1, type: 1 })
      .exec() as Promise<ReminderEventRecord | null>
  ]);

  return { owner, pet, event };
};

const unsetLock = {
  processingToken: "",
  processingStartedAt: "",
  processingExpiresAt: ""
};

const defaultMarkReminderSent = async ({
  reminder,
  lockToken
}: ReleaseReminderInput): Promise<void> => {
  await ReminderModel.updateOne(
    { _id: reminder._id, status: "pending", processingToken: lockToken },
    {
      $set: { status: "sent" },
      $unset: { ...unsetLock, lastError: "" }
    }
  ).exec();
};

const defaultMarkReminderFailed = async ({
  reminder,
  lockToken,
  lastError
}: FailReminderInput): Promise<void> => {
  await ReminderModel.updateOne(
    { _id: reminder._id, status: "pending", processingToken: lockToken },
    {
      $set: {
        status: "failed",
        lastError
      },
      $unset: unsetLock
    }
  ).exec();
};

const missingContextError = (context: ReminderDeliveryContext): string | undefined => {
  if (!context.owner) {
    return "Reminder owner was not found";
  }
  if (!context.owner.emailVerified) {
    return "Reminder owner email is not verified";
  }
  if (!context.pet) {
    return "Reminder pet was not found";
  }
  if (!context.event) {
    return "Reminder event was not found";
  }
  return undefined;
};

const buildEmailPayload = (
  reminder: ReminderDeliveryRecord,
  context: {
    owner: ReminderOwnerRecord;
    pet: ReminderPetRecord;
    event: ReminderEventRecord;
  }
): ReminderEmailPayload => ({
  to: context.owner.email,
  petName: context.pet.name,
  eventTitle: context.event.title,
  eventDate: context.event.eventDate,
  eventType: context.event.type,
  dueAt: reminder.dueAt,
  offset: reminder.offset as ReminderOffset
});

const safeFields = (fields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : typeof value === "string" ? sanitizeJobDiagnostic(value) : value
    ])
  );

const failReminder = async (
  reminder: ReminderDeliveryRecord,
  lockToken: string,
  error: unknown,
  dependencies: Required<Pick<ReminderSchedulerDependencies, "markReminderFailed" | "logger">>
): Promise<void> => {
  const lastError = sanitizeJobDiagnostic(error);
  await dependencies.markReminderFailed({ reminder, lockToken, lastError });
  dependencies.logger.warn("reminder delivery failed", safeFields({
    reminderId: reminder._id.toString(),
    cause: lastError
  }));
};

const deliverClaimedReminder = async (
  reminder: ReminderDeliveryRecord,
  lockToken: string,
  dependencies: Required<
    Pick<
      ReminderSchedulerDependencies,
      "loadReminderContext" | "sendEmail" | "markReminderSent" | "markReminderFailed" | "logger"
    >
  >
): Promise<"sent" | "failed" | "skipped"> => {
  const context = await dependencies.loadReminderContext(reminder);
  const contextError = missingContextError(context);
  if (contextError) {
    await failReminder(reminder, lockToken, contextError, dependencies);
    return "failed";
  }

  const { owner, pet, event } = context;
  if (!owner || !pet || !event) {
    return "skipped";
  }

  try {
    await dependencies.sendEmail(buildEmailPayload(reminder, { owner, pet, event }));
    await dependencies.markReminderSent({ reminder, lockToken });
    return "sent";
  } catch (error) {
    await failReminder(reminder, lockToken, error, dependencies);
    return "failed";
  }
};

export const pollPendingReminders = async (
  dependencies: ReminderSchedulerDependencies = {}
): Promise<ReminderPollResult> => {
  const now = dependencies.now ?? (() => new Date());
  const randomToken = dependencies.randomToken ?? (() => crypto.randomBytes(16).toString("hex"));
  const claimPendingReminder = dependencies.claimPendingReminder ?? defaultClaimPendingReminder;
  const loadReminderContext = dependencies.loadReminderContext ?? defaultLoadReminderContext;
  const sendEmail = dependencies.sendEmail ?? sendReminderEmail;
  const markReminderSent = dependencies.markReminderSent ?? defaultMarkReminderSent;
  const markReminderFailed = dependencies.markReminderFailed ?? defaultMarkReminderFailed;
  const logger = dependencies.logger ?? defaultLogger;
  const maxBatchSize = dependencies.maxBatchSize ?? DEFAULT_BATCH_SIZE;
  const lockTtlMs = dependencies.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  const result: ReminderPollResult = { claimed: 0, sent: 0, failed: 0, skipped: 0 };

  for (let index = 0; index < maxBatchSize; index += 1) {
    const claimedAt = now();
    const lockToken = randomToken();
    const reminder = await claimPendingReminder({
      now: claimedAt,
      lockToken,
      lockExpiresAt: new Date(claimedAt.getTime() + lockTtlMs)
    });

    if (!reminder) {
      break;
    }

    result.claimed += 1;
    const outcome = await deliverClaimedReminder(reminder, lockToken, {
      loadReminderContext,
      sendEmail,
      markReminderSent,
      markReminderFailed,
      logger
    });
    result[outcome] += 1;
  }

  return result;
};

export const startReminderScheduler = (
  dependencies: ReminderSchedulerDependencies = {},
  state: ReminderSchedulerState = defaultSchedulerState
): void => {
  if (!env.REMINDER_SCHEDULER_ENABLED || state.timer) {
    return;
  }

  state.timer = setInterval(() => {
    void pollPendingReminders(dependencies);
  }, dependencies.pollIntervalMs ?? env.REMINDER_POLL_INTERVAL_MS);

  state.timer.unref();
};

export const stopReminderScheduler = (
  state: ReminderSchedulerState = defaultSchedulerState
): void => {
  if (!state.timer) {
    return;
  }

  clearInterval(state.timer);
  state.timer = undefined;
};
