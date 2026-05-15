import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { env } from "../config/env";
import { BACKGROUND_JOB_STATUSES, type BackgroundJobPayload, type BackgroundJobStatus } from "../jobs/types";

export interface IBackgroundJob {
  _id: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

export type BackgroundJobDocument = HydratedDocument<IBackgroundJob>;

const backgroundJobSchema = new Schema<IBackgroundJob>(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    status: {
      type: String,
      enum: BACKGROUND_JOB_STATUSES,
      default: "queued",
      required: true
    },
    runAt: {
      type: Date,
      required: true,
      default: () => new Date()
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    maxAttempts: {
      type: Number,
      required: true,
      default: () => env.BACKGROUND_JOB_DEFAULT_MAX_ATTEMPTS,
      min: 1
    },
    lastError: {
      type: String
    },
    lockedBy: {
      type: String
    },
    lockedAt: {
      type: Date
    },
    lockExpiresAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    failedAt: {
      type: Date
    },
    idempotencyKey: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    collection: "background_jobs"
  }
);

backgroundJobSchema.index({ status: 1, runAt: 1 });
backgroundJobSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const BackgroundJobModel = model<IBackgroundJob>("BackgroundJob", backgroundJobSchema);

