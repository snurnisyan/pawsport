import { z } from "zod";

import { registerJobHandler } from "../backgroundJobService";
import type { BackgroundJobHandler } from "../types";
import {
  cleanupExpiredTemporaryFile,
  TEMPORARY_EVENT_FILE_CLEANUP_JOB_TYPE
} from "../../services/fileService";

export interface TemporaryEventFileCleanupDependencies {
  cleanupExpiredTemporaryFile?: typeof cleanupExpiredTemporaryFile;
}

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/);

const payloadSchema = z.object({
  fileId: objectIdSchema,
  ownerId: objectIdSchema
});

export const createTemporaryEventFileCleanupJobHandler = (
  dependencies: TemporaryEventFileCleanupDependencies = {}
): BackgroundJobHandler => {
  const { cleanupExpiredTemporaryFile: cleanup = cleanupExpiredTemporaryFile } = dependencies;

  return async (job) => {
    const parsed = payloadSchema.safeParse(job.payload);
    if (!parsed.success) {
      job.logger.error("invalid temporary-event-file-cleanup job payload", {
        cause: parsed.error.message
      });
      return;
    }

    await cleanup(parsed.data.ownerId, parsed.data.fileId);
  };
};

export const registerTemporaryEventFileCleanupJobHandler = (): void => {
  registerJobHandler(
    TEMPORARY_EVENT_FILE_CLEANUP_JOB_TYPE,
    createTemporaryEventFileCleanupJobHandler()
  );
};
