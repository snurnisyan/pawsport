import { env } from "../config/env";
import { enqueueJob, type EnqueueJobInput } from "../jobs/backgroundJobService";
import { EXPORT_ARTIFACT_CLEANUP_JOB_TYPE } from "../jobs/handlers/exportArtifactCleanupHandler";

export interface ExportCleanupSchedulerDependencies {
  now?: () => Date;
  enqueueCleanupJob?: (input: EnqueueJobInput) => Promise<unknown>;
  intervalHours?: number;
}

export interface ExportCleanupSchedulerState {
  timer?: NodeJS.Timeout;
}

const defaultSchedulerState: ExportCleanupSchedulerState = {};

const bucketFor = (date: Date, intervalHours: number): string => {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs).toISOString();
};

export const enqueueExportArtifactCleanup = async (
  dependencies: ExportCleanupSchedulerDependencies = {}
): Promise<void> => {
  const {
    now = () => new Date(),
    enqueueCleanupJob = enqueueJob,
    intervalHours = env.EXPORT_CLEANUP_INTERVAL_HOURS
  } = dependencies;
  const requestedAt = now();

  await enqueueCleanupJob({
    type: EXPORT_ARTIFACT_CLEANUP_JOB_TYPE,
    payload: { now: requestedAt.toISOString() },
    idempotencyKey: `export-artifact-cleanup:${bucketFor(requestedAt, intervalHours)}`,
    maxAttempts: 3
  });
};

export const startExportCleanupScheduler = (
  dependencies: ExportCleanupSchedulerDependencies = {},
  state: ExportCleanupSchedulerState = defaultSchedulerState
): void => {
  if (!env.BACKGROUND_JOB_RUNNER_ENABLED || state.timer) {
    return;
  }

  void enqueueExportArtifactCleanup(dependencies);

  state.timer = setInterval(() => {
    void enqueueExportArtifactCleanup(dependencies);
  }, (dependencies.intervalHours ?? env.EXPORT_CLEANUP_INTERVAL_HOURS) * 60 * 60 * 1000);

  state.timer.unref();
};

export const stopExportCleanupScheduler = (
  state: ExportCleanupSchedulerState = defaultSchedulerState
): void => {
  if (!state.timer) {
    return;
  }

  clearInterval(state.timer);
  state.timer = undefined;
};
