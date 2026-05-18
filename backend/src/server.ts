import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { createApp } from "./app";
import { startReminderScheduler, stopReminderScheduler } from "./scheduler/reminderScheduler";
import { startExportCleanupScheduler, stopExportCleanupScheduler } from "./scheduler/exportCleanupScheduler";
import { startBackgroundJobRunner, stopBackgroundJobRunner } from "./jobs/backgroundJobRunner";
import { registerExportArtifactCleanupJobHandler } from "./jobs/handlers/exportArtifactCleanupHandler";
import { registerExportEmailJobHandler } from "./jobs/handlers/exportEmailHandler";
import { registerPetExportJobHandler } from "./jobs/handlers/petExportHandler";
import { registerTemporaryEventFileCleanupJobHandler } from "./jobs/handlers/temporaryEventFileCleanupHandler";

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  stopReminderScheduler();
  stopExportCleanupScheduler();
  await stopBackgroundJobRunner();
  await disconnectDatabase();
  process.stdout.write(`Received ${signal}. Backend stopped.\n`);
  process.exit(0);
};

const bootstrap = async (): Promise<void> => {
  await connectDatabase();
  registerPetExportJobHandler();
  registerExportEmailJobHandler();
  registerExportArtifactCleanupJobHandler();
  registerTemporaryEventFileCleanupJobHandler();

  const app = createApp();

  app.listen(env.PORT, () => {
    process.stdout.write(`Pawsport backend is listening on port ${env.PORT}\n`);
  });

  startReminderScheduler();
  startExportCleanupScheduler();
  startBackgroundJobRunner();
};

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  process.stderr.write(`Backend startup failed: ${message}\n`);
  process.exit(1);
});
