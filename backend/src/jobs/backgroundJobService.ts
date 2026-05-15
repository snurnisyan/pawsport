import { AppError } from "../middleware/errorHandler";
import { BackgroundJobModel, type BackgroundJobDocument, type IBackgroundJob } from "../models/BackgroundJob";
import { env } from "../config/env";
import type {
  BackgroundJobHandler,
  BackgroundJobPayload,
  BackgroundJobRecord,
  BackgroundJobStatus
} from "./types";

const TERMINAL_STATUSES = new Set<BackgroundJobStatus>(["completed", "failed", "cancelled"]);
const handlers = new Map<string, BackgroundJobHandler>();

export interface EnqueueJobInput {
  type: string;
  payload: BackgroundJobPayload;
  runAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string;
}

export interface CreateBackgroundJobInput {
  type: string;
  payload: BackgroundJobPayload;
  status: "queued";
  runAt: Date;
  attempts: 0;
  maxAttempts: number;
  idempotencyKey?: string;
}

export interface EnqueueJobDependencies {
  now?: () => Date;
  defaultMaxAttempts?: number;
  findNonTerminalJobByIdempotencyKey?: (idempotencyKey: string) => Promise<BackgroundJobRecord | null>;
  findJobByIdempotencyKey?: (idempotencyKey: string) => Promise<BackgroundJobRecord | null>;
  createJob?: (input: CreateBackgroundJobInput) => Promise<BackgroundJobRecord>;
}

type MaybeMongoDuplicateKeyError = {
  code?: number;
};

const isRecord = (value: unknown): value is BackgroundJobPayload =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as MaybeMongoDuplicateKeyError).code === 11000;

export const isTerminalBackgroundJobStatus = (status: BackgroundJobStatus): boolean =>
  TERMINAL_STATUSES.has(status);

export const serializeBackgroundJob = (
  job: BackgroundJobDocument | IBackgroundJob
): BackgroundJobRecord => ({
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

const findNonTerminalJobByIdempotencyKey = async (
  idempotencyKey: string
): Promise<BackgroundJobRecord | null> => {
  const job = await BackgroundJobModel.findOne({
    idempotencyKey,
    status: { $nin: Array.from(TERMINAL_STATUSES) }
  }).exec();

  return job ? serializeBackgroundJob(job) : null;
};

const findJobByIdempotencyKey = async (
  idempotencyKey: string
): Promise<BackgroundJobRecord | null> => {
  const job = await BackgroundJobModel.findOne({ idempotencyKey }).exec();
  return job ? serializeBackgroundJob(job) : null;
};

const createJob = async (input: CreateBackgroundJobInput): Promise<BackgroundJobRecord> => {
  const job = await BackgroundJobModel.create(input);
  return serializeBackgroundJob(job);
};

export const enqueueJob = async (
  input: EnqueueJobInput,
  dependencies: EnqueueJobDependencies = {}
): Promise<BackgroundJobRecord> => {
  const {
    now = () => new Date(),
    defaultMaxAttempts = env.BACKGROUND_JOB_DEFAULT_MAX_ATTEMPTS,
    findNonTerminalJobByIdempotencyKey: findExistingNonTerminal = findNonTerminalJobByIdempotencyKey,
    findJobByIdempotencyKey: findExistingByKey = findJobByIdempotencyKey,
    createJob: createJobRecord = createJob
  } = dependencies;

  const type = input.type.trim();
  if (!type) {
    throw new AppError(400, "INVALID_BACKGROUND_JOB_TYPE", "background job type is required");
  }

  if (!isRecord(input.payload)) {
    throw new AppError(400, "INVALID_BACKGROUND_JOB_PAYLOAD", "background job payload must be an object");
  }

  const runAt = input.runAt ?? now();
  if (!isValidDate(runAt)) {
    throw new AppError(400, "INVALID_BACKGROUND_JOB_RUN_AT", "background job runAt must be a valid Date");
  }

  const maxAttempts = input.maxAttempts ?? defaultMaxAttempts;
  if (!isPositiveInteger(maxAttempts)) {
    throw new AppError(
      400,
      "INVALID_BACKGROUND_JOB_MAX_ATTEMPTS",
      "background job maxAttempts must be a positive integer"
    );
  }

  const idempotencyKey = input.idempotencyKey?.trim();
  if (input.idempotencyKey !== undefined && !idempotencyKey) {
    throw new AppError(
      400,
      "INVALID_BACKGROUND_JOB_IDEMPOTENCY_KEY",
      "background job idempotencyKey cannot be empty"
    );
  }

  if (idempotencyKey) {
    const existing = await findExistingNonTerminal(idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  try {
    return await createJobRecord({
      type,
      payload: input.payload,
      status: "queued",
      runAt,
      attempts: 0,
      maxAttempts,
      idempotencyKey
    });
  } catch (error) {
    if (!idempotencyKey || !isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await findExistingByKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    throw error;
  }
};

export const registerJobHandler = (type: string, handler: BackgroundJobHandler): void => {
  const normalizedType = type.trim();
  if (!normalizedType) {
    throw new AppError(500, "INVALID_BACKGROUND_JOB_HANDLER_TYPE", "background job handler type is required");
  }

  if (handlers.has(normalizedType)) {
    throw new AppError(
      500,
      "DUPLICATE_BACKGROUND_JOB_HANDLER",
      `background job handler for ${normalizedType} is already registered`
    );
  }

  handlers.set(normalizedType, handler);
};

export const getJobHandler = (type: string): BackgroundJobHandler | undefined => handlers.get(type);

export const clearJobHandlersForTests = (): void => {
  handlers.clear();
};

