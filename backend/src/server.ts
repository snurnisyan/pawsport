import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { createApp } from "./app";
import { startReminderScheduler, stopReminderScheduler } from "./scheduler/reminderScheduler";
import { startBackgroundJobRunner, stopBackgroundJobRunner } from "./jobs/backgroundJobRunner";

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  stopReminderScheduler();
  await stopBackgroundJobRunner();
  await disconnectDatabase();
  process.stdout.write(`Received ${signal}. Backend stopped.\n`);
  process.exit(0);
};

const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  const app = createApp();

  app.listen(env.PORT, () => {
    process.stdout.write(`Pawsport backend is listening on port ${env.PORT}\n`);
  });

  startReminderScheduler();
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
