import type { Types } from "mongoose";

export const BACKGROUND_JOB_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled"
] as const;

export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

export type BackgroundJobPayload = Record<string, unknown>;

export interface BackgroundJobRecord {
  id: string;
  type: string;
  payload: BackgroundJobPayload;
  status: BackgroundJobStatus;
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
}

export interface BackgroundJobModelRecord extends Omit<BackgroundJobRecord, "id"> {
  _id: Types.ObjectId;
}

export interface BackgroundJobLogger {
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
}

export interface BackgroundJobContext {
  id: string;
  type: string;
  payload: BackgroundJobPayload;
  attempts: number;
  maxAttempts: number;
  logger: BackgroundJobLogger;
}

export type BackgroundJobHandler = (job: BackgroundJobContext) => Promise<void>;
