import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../src/middleware/errorHandler";
import {
  clearJobHandlersForTests,
  enqueueJob,
  getJobHandler,
  registerJobHandler,
  type CreateBackgroundJobInput
} from "../src/jobs/backgroundJobService";
import type { BackgroundJobRecord } from "../src/jobs/types";

const fixedNow = new Date("2026-05-15T10:00:00.000Z");

const makeJob = (overrides: Partial<BackgroundJobRecord> = {}): BackgroundJobRecord => ({
  id: "job-1",
  type: "demo",
  payload: { ok: true },
  status: "queued",
  runAt: fixedNow,
  attempts: 0,
  maxAttempts: 5,
  ...overrides
});

test("enqueueJob accepts arbitrary job types and persists normalized input", async () => {
  let captured: CreateBackgroundJobInput | undefined;

  const result = await enqueueJob(
    { type: "  demo  ", payload: { foo: 1 } },
    {
      now: () => fixedNow,
      createJob: async (input) => {
        captured = input;
        return makeJob(input);
      }
    }
  );

  assert.equal(captured?.type, "demo");
  assert.deepEqual(captured?.payload, { foo: 1 });
  assert.equal(captured?.status, "queued");
  assert.equal(captured?.attempts, 0);
  assert.equal(captured?.runAt, fixedNow);
  assert.equal(result.type, "demo");
});

test("enqueueJob returns an existing non-terminal job for an idempotency key", async () => {
  let createCalls = 0;
  const existing = makeJob({ id: "existing", idempotencyKey: "same-key" });

  const result = await enqueueJob(
    { type: "demo", payload: {}, idempotencyKey: "same-key" },
    {
      findNonTerminalJobByIdempotencyKey: async () => existing,
      createJob: async () => {
        createCalls += 1;
        return makeJob();
      }
    }
  );

  assert.equal(result.id, "existing");
  assert.equal(createCalls, 0);
});

test("enqueueJob handles idempotency races by returning the persisted job", async () => {
  const existing = makeJob({ id: "raced", idempotencyKey: "same-key" });

  const result = await enqueueJob(
    { type: "demo", payload: {}, idempotencyKey: "same-key" },
    {
      findNonTerminalJobByIdempotencyKey: async () => null,
      findJobByIdempotencyKey: async () => existing,
      createJob: async () => {
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      }
    }
  );

  assert.equal(result.id, "raced");
});

test("enqueueJob validates inputs before creating a job", async () => {
  let createCalls = 0;
  const createJob = async () => {
    createCalls += 1;
    return makeJob();
  };
  const cases = [
    {
      input: { type: " ", payload: {} },
      code: "INVALID_BACKGROUND_JOB_TYPE"
    },
    {
      input: { type: "demo", payload: [] },
      code: "INVALID_BACKGROUND_JOB_PAYLOAD"
    },
    {
      input: { type: "demo", payload: {}, runAt: new Date("broken") },
      code: "INVALID_BACKGROUND_JOB_RUN_AT"
    },
    {
      input: { type: "demo", payload: {}, maxAttempts: 0 },
      code: "INVALID_BACKGROUND_JOB_MAX_ATTEMPTS"
    },
    {
      input: { type: "demo", payload: {}, idempotencyKey: " " },
      code: "INVALID_BACKGROUND_JOB_IDEMPOTENCY_KEY"
    }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () => enqueueJob(input as Parameters<typeof enqueueJob>[0], { createJob }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, code);
        return true;
      }
    );
  }

  assert.equal(createCalls, 0);
});

test("registerJobHandler rejects duplicate handler registration", async () => {
  clearJobHandlersForTests();
  const handler = async () => {};

  registerJobHandler("demo", handler);
  assert.equal(getJobHandler("demo"), handler);

  await assert.rejects(
    async () => registerJobHandler("demo", async () => {}),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "DUPLICATE_BACKGROUND_JOB_HANDLER");
      return true;
    }
  );
});

