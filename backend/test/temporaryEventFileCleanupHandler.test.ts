import assert from "node:assert/strict";
import test from "node:test";

import { createTemporaryEventFileCleanupJobHandler } from "../src/jobs/handlers/temporaryEventFileCleanupHandler";
import type { BackgroundJobContext } from "../src/jobs/types";

const ownerId = "507f1f77bcf86cd799439011";
const fileId = "60a7c1aa9e1d4f12345678cd";

const makeJob = (payload: Record<string, unknown>): BackgroundJobContext => ({
  id: "job-1",
  type: "temporary-event-file-cleanup",
  payload,
  attempts: 0,
  maxAttempts: 5,
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  }
});

test("temporary-event-file cleanup handler deletes the expired temp file from payload", async () => {
  let cleaned: { ownerId: string; fileId: string } | undefined;
  const handler = createTemporaryEventFileCleanupJobHandler({
    cleanupExpiredTemporaryFile: async (owner, file) => {
      cleaned = { ownerId: owner, fileId: file };
    }
  });

  await handler(makeJob({ ownerId, fileId }));

  assert.deepEqual(cleaned, { ownerId, fileId });
});

test("temporary-event-file cleanup handler ignores invalid payloads", async () => {
  let cleaned = false;
  let logged = false;
  const handler = createTemporaryEventFileCleanupJobHandler({
    cleanupExpiredTemporaryFile: async () => {
      cleaned = true;
    }
  });

  await handler({
    ...makeJob({ ownerId: "bad", fileId }),
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {
        logged = true;
      }
    }
  });

  assert.equal(cleaned, false);
  assert.equal(logged, true);
});
