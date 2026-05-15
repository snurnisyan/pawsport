import crypto from "node:crypto";
import os from "node:os";

import { env } from "../config/env";
import { getJobHandler } from "./backgroundJobService";
import { BackgroundJobModel } from "../models/BackgroundJob";
import type { BackgroundJobContext, BackgroundJobLogger, BackgroundJobRecord } from "./types";

const DEFAULT_STOP_TIMEOUT_MS = 30000;
const MAX_ERROR_LENGTH = 500;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export interface ClaimJobInput {
  now: Date;
  runnerId: string;
  lockExpiresAt: Date;
  ignoredJobIds: string[];
}

export type ReleaseJobOutcome = "completed" | "retry" | "failed" | "unhandled";

export interface ReleaseJobInput {
  job: BackgroundJobRecord;
  runnerId: string;
  outcome: ReleaseJobOutcome;
  now: Date;
  attempts?: number;
  runAt?: Date;
  lastError?: string;
}

export interface BackgroundJobRunnerDependencies {
  now?: () => Date;
  randomToken?: () => string;
  runnerId?: string;
  pollIntervalMs?: number;
  concurrency?: number;
  visibilityTimeoutMs?: number;
  logger?: BackgroundJobLogger;
  claimJob?: (input: ClaimJobInput) => Promise<BackgroundJobRecord | null>;
  releaseJob?: (input: ReleaseJobInput) => Promise<void>;
  reclaimExpired?: (now: Date) => Promise<number>;
  loadDueJobs?: () => Promise<BackgroundJobRecord[]>;
}

export interface BackgroundJobRunnerState {
  timer?: NodeJS.Timeout;
  inFlight: Set<Promise<void>>;
  runnerId: string;
  tickInProgress?: Promise<void>;
}

const makeDefaultRunnerId = (): string =>
  `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString("hex")}`;

const defaultRunnerState: BackgroundJobRunnerState = {
  inFlight: new Set(),
  runnerId: makeDefaultRunnerId()
};

const serializeClaimedJob = (job: {
  _id: { toString: () => string };
  type: string;
  payload: Record<string, unknown>;
  status: BackgroundJobRecord["status"];
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  lockedBy?: string;
  lockedAt?: Date;
  lockExpiresAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  idempotencyKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
}): BackgroundJobRecord => ({
  id: job._id.toString(),
  type: job.type,
  payload: job.payload,
  status: job.status,
  runAt: job.runAt,
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  lastError: job.lastError,
  lockedBy: job.lockedBy,
  lockedAt: job.lockedAt,
  lockExpiresAt: job.lockExpiresAt,
  completedAt: job.completedAt,
  failedAt: job.failedAt,
  idempotencyKey: job.idempotencyKey,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt
});

export const sanitizeJobDiagnostic = (value: unknown): string => {
  const raw = value instanceof Error ? value.message : String(value);

  return raw
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(
      /\b(password|secret|token|credential|authorization|jwt|access[_-]?key)\b\s*[:=]\s*\S+/gi,
      "$1=[redacted]"
    )
    .slice(0, MAX_ERROR_LENGTH);
};

const sanitizeLogFields = (fields: Record<string, unknown> = {}): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }

      if (typeof value === "string") {
        return [key, sanitizeJobDiagnostic(value)];
      }

      if (typeof value === "number" || typeof value === "boolean" || value === null) {
        return [key, value];
      }

      return [key, "[redacted]"];
    })
  );

const defaultLogger: BackgroundJobLogger = {
  info: (message, fields) => {
    process.stdout.write(`${message} ${JSON.stringify(sanitizeLogFields(fields))}\n`);
  },
  warn: (message, fields) => {
    process.stderr.write(`${message} ${JSON.stringify(sanitizeLogFields(fields))}\n`);
  },
  error: (message, fields) => {
    process.stderr.write(`${message} ${JSON.stringify(sanitizeLogFields(fields))}\n`);
  }
};

const defaultClaimJob = async ({
  now,
  runnerId,
  lockExpiresAt,
  ignoredJobIds
}: ClaimJobInput): Promise<BackgroundJobRecord | null> => {
  const job = await BackgroundJobModel.findOneAndUpdate(
    {
      status: "queued",
      runAt: { $lte: now },
      ...(ignoredJobIds.length > 0 ? { _id: { $nin: ignoredJobIds } } : {})
    },
    {
      $set: {
        status: "processing",
        lockedBy: runnerId,
        lockedAt: now,
        lockExpiresAt
      },
      $unset: {
        completedAt: "",
        failedAt: ""
      }
    },
    {
      new: true,
      sort: { runAt: 1 }
    }
  ).exec();

  return job ? serializeClaimedJob(job) : null;
};

const defaultReleaseJob = async ({
  job,
  runnerId,
  outcome,
  now,
  attempts,
  runAt,
  lastError
}: ReleaseJobInput): Promise<void> => {
  const clearLock = {
    lockedBy: "",
    lockedAt: "",
    lockExpiresAt: ""
  };

  if (outcome === "completed") {
    await BackgroundJobModel.updateOne(
      { _id: job.id, status: "processing", lockedBy: runnerId },
      {
        $set: { status: "completed", completedAt: now },
        $unset: { ...clearLock, lastError: "" }
      }
    ).exec();
    return;
  }

  if (outcome === "unhandled") {
    await BackgroundJobModel.updateOne(
      { _id: job.id, status: "processing", lockedBy: runnerId },
      {
        $set: { status: "queued" },
        $unset: clearLock
      }
    ).exec();
    return;
  }

  if (outcome === "retry") {
    await BackgroundJobModel.updateOne(
      { _id: job.id, status: "processing", lockedBy: runnerId },
      {
        $set: {
          status: "queued",
          attempts,
          runAt,
          lastError
        },
        $unset: clearLock
      }
    ).exec();
    return;
  }

  await BackgroundJobModel.updateOne(
    { _id: job.id, status: "processing", lockedBy: runnerId },
    {
      $set: {
        status: "failed",
        attempts,
        failedAt: now,
        lastError
      },
      $unset: clearLock
    }
  ).exec();
};

const defaultReclaimExpired = async (now: Date): Promise<number> => {
  const result = await BackgroundJobModel.updateMany(
    {
      status: "processing",
      lockExpiresAt: { $lt: now }
    },
    {
      $set: { status: "queued" },
      $unset: {
        lockedBy: "",
        lockedAt: "",
        lockExpiresAt: ""
      }
    }
  ).exec();

  return result.modifiedCount;
};

const calculateBackoffMs = (attempts: number, randomToken: () => string): number => {
  const token = randomToken();
  const jitter = Number.parseInt(token.slice(0, 2), 16);
  const boundedJitter = Number.isNaN(jitter) ? 0 : jitter;

  return Math.min(2 ** attempts * 1000 + boundedJitter, MAX_BACKOFF_MS);
};

const buildContext = (
  job: BackgroundJobRecord,
  logger: BackgroundJobLogger
): BackgroundJobContext => ({
  id: job.id,
  type: job.type,
  payload: job.payload,
  attempts: job.attempts,
  logger
});

const runClaimedJob = async (
  job: BackgroundJobRecord,
  dependencies: Required<
    Pick<BackgroundJobRunnerDependencies, "now" | "randomToken" | "logger" | "releaseJob">
  >,
  runnerId: string
): Promise<void> => {
  const handler = getJobHandler(job.type);
  if (!handler) {
    return;
  }

  try {
    await handler(buildContext(job, dependencies.logger));
    await dependencies.releaseJob({
      job,
      runnerId,
      outcome: "completed",
      now: dependencies.now()
    });
  } catch (error) {
    const attempts = job.attempts + 1;
    const lastError = sanitizeJobDiagnostic(error);
    const failed = attempts >= job.maxAttempts;
    const now = dependencies.now();

    dependencies.logger.error("background job handler failed", {
      id: job.id,
      type: job.type,
      attempts,
      cause: lastError
    });

    await dependencies.releaseJob({
      job,
      runnerId,
      outcome: failed ? "failed" : "retry",
      now,
      attempts,
      runAt: failed
        ? undefined
        : new Date(now.getTime() + calculateBackoffMs(attempts, dependencies.randomToken)),
      lastError
    });
  }
};

export const createBackgroundJobRunnerState = (
  dependencies: Pick<BackgroundJobRunnerDependencies, "randomToken" | "runnerId"> = {}
): BackgroundJobRunnerState => ({
  inFlight: new Set(),
  runnerId:
    dependencies.runnerId ??
    `${os.hostname()}:${process.pid}:${dependencies.randomToken?.() ?? crypto.randomBytes(4).toString("hex")}`
});

const doTickOnce = async (
  dependencies: BackgroundJobRunnerDependencies,
  state: BackgroundJobRunnerState
): Promise<void> => {
  const now = dependencies.now ?? (() => new Date());
  const randomToken = dependencies.randomToken ?? (() => crypto.randomBytes(2).toString("hex"));
  const logger = dependencies.logger ?? defaultLogger;
  const claimJob = dependencies.claimJob ?? defaultClaimJob;
  const releaseJob = dependencies.releaseJob ?? defaultReleaseJob;
  const reclaimExpired = dependencies.reclaimExpired ?? defaultReclaimExpired;
  const runnerId = dependencies.runnerId ?? state.runnerId;
  const concurrency = dependencies.concurrency ?? env.BACKGROUND_JOB_CONCURRENCY;
  const visibilityTimeoutMs =
    dependencies.visibilityTimeoutMs ?? env.BACKGROUND_JOB_VISIBILITY_TIMEOUT_MS;
  const ignoredJobIds: string[] = [];
  const availableSlots = concurrency - state.inFlight.size;
  let dispatchedJobs = 0;

  await reclaimExpired(now());

  while (dispatchedJobs < availableSlots) {
    const claimedAt = now();
    const job = await claimJob({
      now: claimedAt,
      runnerId,
      lockExpiresAt: new Date(claimedAt.getTime() + visibilityTimeoutMs),
      ignoredJobIds
    });

    if (!job) {
      return;
    }

    if (!getJobHandler(job.type)) {
      logger.warn("background job has no registered handler", {
        id: job.id,
        type: job.type,
        attempts: job.attempts
      });
      ignoredJobIds.push(job.id);
      await releaseJob({ job, runnerId, outcome: "unhandled", now: now() });
      continue;
    }

    const promise = runClaimedJob(job, { now, randomToken, logger, releaseJob }, runnerId).finally(
      () => {
        state.inFlight.delete(promise);
      }
    );
    state.inFlight.add(promise);
    dispatchedJobs += 1;
  }
};

export const tickOnce = async (
  dependencies: BackgroundJobRunnerDependencies = {},
  state: BackgroundJobRunnerState = defaultRunnerState
): Promise<void> => {
  if (state.tickInProgress) {
    await state.tickInProgress;
    return;
  }

  state.tickInProgress = doTickOnce(dependencies, state).finally(() => {
    state.tickInProgress = undefined;
  });

  await state.tickInProgress;
};

export const startBackgroundJobRunner = (
  dependencies: BackgroundJobRunnerDependencies = {},
  state: BackgroundJobRunnerState = defaultRunnerState
): void => {
  if (!env.BACKGROUND_JOB_RUNNER_ENABLED || state.timer) {
    return;
  }

  state.timer = setInterval(() => {
    void tickOnce(dependencies, state);
  }, dependencies.pollIntervalMs ?? env.BACKGROUND_JOB_POLL_INTERVAL_MS);

  state.timer.unref();
};

const waitForInFlight = async (
  state: BackgroundJobRunnerState,
  timeoutMs: number
): Promise<void> => {
  if (state.inFlight.size === 0) {
    return;
  }

  await Promise.race([
    Promise.allSettled(Array.from(state.inFlight)),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    })
  ]);
};

export const stopBackgroundJobRunner = async (
  options: { timeoutMs?: number } = {},
  state: BackgroundJobRunnerState = defaultRunnerState
): Promise<void> => {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = undefined;
  }

  if (state.tickInProgress) {
    await state.tickInProgress;
  }

  await waitForInFlight(state, options.timeoutMs ?? DEFAULT_STOP_TIMEOUT_MS);
};
