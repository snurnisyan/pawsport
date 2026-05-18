import { z } from "zod";

import { env } from "../../config/env";
import { registerJobHandler } from "../backgroundJobService";
import type { BackgroundJobHandler } from "../types";
import { BackgroundJobModel } from "../../models/BackgroundJob";
import { ExportModel } from "../../models/Export";
import { ExportArtifactModel, type IExportArtifact } from "../../models/ExportArtifact";
import { isMissingObjectError, s3Storage, type FileStorage } from "../../storage/s3Storage";

export const EXPORT_ARTIFACT_CLEANUP_JOB_TYPE = "export-artifact-cleanup";

type ExpiredArtifactRecord = Pick<
  IExportArtifact,
  "_id" | "ownerId" | "petId" | "fileKey" | "status" | "expiresAt" | "generation"
>;

export interface ExportArtifactCleanupResult {
  scanned: number;
  deleted: number;
}

export interface ExportArtifactCleanupDependencies {
  now?: () => Date;
  batchSize?: number;
  storage?: FileStorage;
  listExpiredArtifacts?: (now: Date, limit: number) => Promise<ExpiredArtifactRecord[]>;
  hasActiveArtifactJob?: (
    artifactId: IExportArtifact["_id"],
    generation: number
  ) => Promise<boolean>;
  deleteArtifactMetadata?: (artifactId: IExportArtifact["_id"]) => Promise<void>;
}

const payloadSchema = z.object({
  now: z.string().datetime().optional()
});

const defaultListExpiredArtifacts = async (
  now: Date,
  limit: number
): Promise<ExpiredArtifactRecord[]> =>
  ExportArtifactModel.find({ expiresAt: { $lte: now } })
    .sort({ expiresAt: 1 })
    .limit(limit)
    .exec() as unknown as ExpiredArtifactRecord[];

const defaultDeleteArtifactMetadata = async (
  artifactId: IExportArtifact["_id"]
): Promise<void> => {
  await ExportModel.deleteMany({ artifactId }).exec();
  await ExportArtifactModel.deleteOne({ _id: artifactId }).exec();
};

const defaultHasActiveArtifactJob = async (
  artifactId: IExportArtifact["_id"],
  generation: number
): Promise<boolean> => {
  const activeJob = await BackgroundJobModel.exists({
    idempotencyKey: `pet-export-artifact:${artifactId.toString()}:${generation}`,
    status: { $in: ["queued", "processing"] }
  }).exec();
  return Boolean(activeJob);
};

const isExportArtifactKey = (key: string): boolean =>
  /\/exports\/[a-f0-9]{64}\.pdf$/.test(key);

export const cleanupExpiredExportArtifacts = async (
  dependencies: ExportArtifactCleanupDependencies = {}
): Promise<ExportArtifactCleanupResult> => {
  const {
    now = () => new Date(),
    batchSize = env.EXPORT_CLEANUP_BATCH_SIZE,
    storage = s3Storage,
    listExpiredArtifacts = defaultListExpiredArtifacts,
    hasActiveArtifactJob = defaultHasActiveArtifactJob,
    deleteArtifactMetadata = defaultDeleteArtifactMetadata
  } = dependencies;

  const expiredAt = now();
  const artifacts = await listExpiredArtifacts(expiredAt, batchSize);
  let deleted = 0;

  for (const artifact of artifacts) {
    if (
      artifact.status === "pending" &&
      (await hasActiveArtifactJob(artifact._id, artifact.generation))
    ) {
      continue;
    }

    if (artifact.status === "ready" && artifact.fileKey) {
      if (!isExportArtifactKey(artifact.fileKey)) {
        continue;
      }

      try {
        await storage.deleteObject({ key: artifact.fileKey });
      } catch (error) {
        if (!isMissingObjectError(error)) {
          throw error;
        }
      }
    }

    await deleteArtifactMetadata(artifact._id);
    deleted += 1;
  }

  return {
    scanned: artifacts.length,
    deleted
  };
};

export const createExportArtifactCleanupJobHandler = (
  dependencies: ExportArtifactCleanupDependencies = {}
): BackgroundJobHandler => {
  return async (job) => {
    const parsed = payloadSchema.safeParse(job.payload);
    if (!parsed.success) {
      job.logger.error("invalid export-artifact-cleanup job payload", {
        cause: parsed.error.message
      });
      return;
    }

    const now = parsed.data.now ? new Date(parsed.data.now) : undefined;
    const result = await cleanupExpiredExportArtifacts({
      ...dependencies,
      ...(now ? { now: () => now } : {})
    });

    job.logger.info("expired export artifacts cleaned", {
      scanned: result.scanned,
      deleted: result.deleted
    });
  };
};

export const registerExportArtifactCleanupJobHandler = (): void => {
  registerJobHandler(
    EXPORT_ARTIFACT_CLEANUP_JOB_TYPE,
    createExportArtifactCleanupJobHandler()
  );
};
