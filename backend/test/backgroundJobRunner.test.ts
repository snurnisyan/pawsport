import assert from "node:assert/strict";
import test from "node:test";

import {
  clearJobHandlersForTests,
  registerJobHandler
} from "../src/jobs/backgroundJobService";
import {
  createBackgroundJobRunnerState,
  sanitizeJobDiagnostic,
  startBackgroundJobRunner,
  stopBackgroundJobRunner,
  tickOnce,
  type BackgroundJobRunnerDependencies,
  type ClaimJobInput,
  type ReleaseJobInput
} from "../src/jobs/backgroundJobRunner";
import type { BackgroundJobLogger, BackgroundJobRecord } from "../src/jobs/types";

const baseNow = new Date("2026-05-15T10:00:00.000Z");

const makeJob = (overrides: Partial<BackgroundJobRecord> = {}): BackgroundJobRecord => ({
  id: overrides.id ?? `job-${Math.random().toString(16).slice(2)}`,
  type: "demo",
  payload: {},
  status: "queued",
  runAt: baseNow,
  attempts: 0,
  maxAttempts: 5,
  ...overrides
});

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const makeLogger = () => {
  const warnings: Array<{ message: string; fields?: Record<string, unknown> }> = [];
  const errors: Array<{ message: string; fields?: Record<string, unknown> }> = [];
  const logger: BackgroundJobLogger = {
    info: () => {},
    warn: (message, fields) => {
      warnings.push({ message, fields });
    },
    error: (message, fields) => {
      errors.push({ message, fields });
    }
  };

  return { logger, warnings, errors };
};

const makeStore = (jobs: BackgroundJobRecord[]) => {
  const sortedDueJobs = (now: Date, ignoredJobIds: string[]) =>
    jobs
      .filter(
        (job) =>
          job.status === "queued" &&
          job.runAt.getTime() <= now.getTime() &&
          !ignoredJobIds.includes(job.id)
      )
      .sort((left, right) => left.runAt.getTime() - right.runAt.getTime());

  const claimJob = async ({
    now,
    runnerId,
    lockExpiresAt,
    ignoredJobIds
  }: ClaimJobInput): Promise<BackgroundJobRecord | null> => {
    const job = sortedDueJobs(now, ignoredJobIds)[0];
    if (!job) {
      return null;
    }

    job.status = "processing";
    job.lockedBy = runnerId;
    job.lockedAt = now;
    job.lockExpiresAt = lockExpiresAt;
    return { ...job, payload: { ...job.payload } };
  };

  const releaseJob = async ({
    job,
    runnerId,
    outcome,
    now,
    attempts,
    runAt,
    lastError
  }: ReleaseJobInput): Promise<void> => {
    const stored = jobs.find((candidate) => candidate.id === job.id);
    if (!stored || stored.status !== "processing" || stored.lockedBy !== runnerId) {
      return;
    }

    stored.lockedBy = undefined;
    stored.lockedAt = undefined;
    stored.lockExpiresAt = undefined;

    if (outcome === "completed") {
      stored.status = "completed";
      stored.completedAt = now;
      stored.lastError = undefined;
      return;
    }

    if (outcome === "unhandled") {
      stored.status = "queued";
      return;
    }

    stored.attempts = attempts ?? stored.attempts;
    stored.lastError = lastError;

    if (outcome === "retry") {
      stored.status = "queued";
      stored.runAt = runAt ?? stored.runAt;
      return;
    }

    stored.status = "failed";
    stored.failedAt = now;
  };

  const reclaimExpired = async (now: Date): Promise<number> => {
    let count = 0;
    for (const job of jobs) {
      if (
        job.status === "processing" &&
        job.lockExpiresAt &&
        job.lockExpiresAt.getTime() < now.getTime()
      ) {
        job.status = "queued";
        job.lockedBy = undefined;
        job.lockedAt = undefined;
        job.lockExpiresAt = undefined;
        count += 1;
      }
    }

    return count;
  };

  return { claimJob, releaseJob, reclaimExpired };
};

const makeDependencies = (
  jobs: BackgroundJobRecord[],
  overrides: Partial<BackgroundJobRunnerDependencies> = {}
): BackgroundJobRunnerDependencies => {
  const store = makeStore(jobs);

  return {
    now: () => baseNow,
    randomToken: () => "00",
    visibilityTimeoutMs: 60000,
    logger: makeLogger().logger,
    ...store,
    ...overrides
  };
};

test("tickOnce runs a registered handler once and completes the job", async () => {
  clearJobHandlersForTests();
  const jobs = [makeJob({ id: "success" })];
  const state = createBackgroundJobRunnerState({ runnerId: "runner-a" });
  let calls = 0;

  registerJobHandler("demo", async (job) => {
    calls += 1;
    assert.equal(job.id, "success");
  });

  await tickOnce(makeDependencies(jobs), state);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, state);

  assert.equal(calls, 1);
  assert.equal(jobs[0].status, "completed");
  assert.ok(jobs[0].completedAt);
});

test("tickOnce does not pick future jobs until their runAt is due", async () => {
  clearJobHandlersForTests();
  const current = { value: baseNow };
  const future = new Date(baseNow.getTime() + 10000);
  const jobs = [makeJob({ id: "future", runAt: future })];
  const state = createBackgroundJobRunnerState({ runnerId: "runner-a" });
  let calls = 0;

  registerJobHandler("demo", async () => {
    calls += 1;
  });

  await tickOnce(makeDependencies(jobs, { now: () => current.value }), state);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, state);
  assert.equal(calls, 0);
  assert.equal(jobs[0].status, "queued");

  current.value = future;
  await tickOnce(makeDependencies(jobs, { now: () => current.value }), state);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, state);

  assert.equal(calls, 1);
  assert.equal(jobs[0].status, "completed");
});

test("unknown job types stay queued without consuming an attempt", async () => {
  clearJobHandlersForTests();
  const jobs = [makeJob({ id: "unknown", type: "later" })];
  const state = createBackgroundJobRunnerState({ runnerId: "runner-a" });
  const { logger, warnings } = makeLogger();

  await tickOnce(makeDependencies(jobs, { logger }), state);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, state);

  assert.equal(jobs[0].status, "queued");
  assert.equal(jobs[0].attempts, 0);
  assert.equal(warnings.length, 1);

  let calls = 0;
  registerJobHandler("later", async () => {
    calls += 1;
  });

  await tickOnce(makeDependencies(jobs, { logger }), state);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, state);

  assert.equal(calls, 1);
  assert.equal(jobs[0].status, "completed");
});

test("failing handlers retry with backoff and then mark the job failed", async () => {
  clearJobHandlersForTests();
  const current = { value: baseNow };
  const jobs = [makeJob({ id: "fail", maxAttempts: 2 })];
  const state = createBackgroundJobRunnerState({ runnerId: "runner-a" });
  const { logger, errors } = makeLogger();

  registerJobHandler("demo", async () => {
    throw new Error("failed with password=secret and https://example.com/presigned?token=abc");
  });

  await tickOnce(makeDependencies(jobs, { now: () => current.value, logger }), state);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, state);

  assert.equal(jobs[0].status, "queued");
  assert.equal(jobs[0].attempts, 1);
  assert.ok(jobs[0].runAt.getTime() > baseNow.getTime());
  assert.equal(jobs[0].lastError?.includes("secret"), false);
  assert.equal(jobs[0].lastError?.includes("https://example.com"), false);

  current.value = jobs[0].runAt;
  await tickOnce(makeDependencies(jobs, { now: () => current.value, logger }), state);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, state);

  assert.equal(jobs[0].status, "failed");
  assert.equal(jobs[0].attempts, 2);
  assert.ok(jobs[0].failedAt);
  assert.equal(errors.length, 2);
});

test("expired processing locks are reclaimed back to queued", async () => {
  clearJobHandlersForTests();
  const future = new Date(baseNow.getTime() + 10000);
  const jobs = [
    makeJob({
      id: "locked",
      status: "processing",
      runAt: future,
      lockedBy: "old-runner",
      lockedAt: new Date(baseNow.getTime() - 120000),
      lockExpiresAt: new Date(baseNow.getTime() - 1000)
    })
  ];
  const state = createBackgroundJobRunnerState({ runnerId: "runner-a" });

  await tickOnce(makeDependencies(jobs), state);

  assert.equal(jobs[0].status, "queued");
  assert.equal(jobs[0].lockedBy, undefined);
  assert.equal(jobs[0].lockExpiresAt, undefined);
});

test("concurrency limit is honored", async () => {
  clearJobHandlersForTests();
  const jobs = [
    makeJob({ id: "one" }),
    makeJob({ id: "two" }),
    makeJob({ id: "three" })
  ];
  const state = createBackgroundJobRunnerState({ runnerId: "runner-a" });
  const blocker = deferred();
  const started: string[] = [];

  registerJobHandler("demo", async (job) => {
    started.push(job.id);
    await blocker.promise;
  });

  await tickOnce(makeDependencies(jobs, { concurrency: 2 }), state);

  assert.deepEqual(started.sort(), ["one", "two"]);
  assert.equal(jobs.filter((job) => job.status === "processing").length, 2);
  assert.equal(jobs.find((job) => job.id === "three")?.status, "queued");

  blocker.resolve();
  await stopBackgroundJobRunner({ timeoutMs: 100 }, state);
});

test("two runner instances sharing one atomic claim primitive do not run the same job twice", async () => {
  clearJobHandlersForTests();
  const jobs = [makeJob({ id: "shared" })];
  const store = makeStore(jobs);
  const stateA = createBackgroundJobRunnerState({ runnerId: "runner-a" });
  const stateB = createBackgroundJobRunnerState({ runnerId: "runner-b" });
  let calls = 0;

  registerJobHandler("demo", async () => {
    calls += 1;
  });

  await Promise.all([
    tickOnce(makeDependencies(jobs, { ...store, runnerId: "runner-a" }), stateA),
    tickOnce(makeDependencies(jobs, { ...store, runnerId: "runner-b" }), stateB)
  ]);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, stateA);
  await stopBackgroundJobRunner({ timeoutMs: 100 }, stateB);

  assert.equal(calls, 1);
  assert.equal(jobs[0].status, "completed");
});

test("startBackgroundJobRunner is disabled unless env enables it", () => {
  const state = createBackgroundJobRunnerState({ runnerId: "runner-a" });

  startBackgroundJobRunner(makeDependencies([]), state);

  assert.equal(state.timer, undefined);
});

test("stopBackgroundJobRunner waits for in-flight handlers before resolving", async () => {
  clearJobHandlersForTests();
  const jobs = [makeJob({ id: "slow" })];
  const state = createBackgroundJobRunnerState({ runnerId: "runner-a" });
  const blocker = deferred();
  let completed = false;

  registerJobHandler("demo", async () => {
    await blocker.promise;
    completed = true;
  });

  await tickOnce(makeDependencies(jobs), state);
  const stopPromise = stopBackgroundJobRunner({ timeoutMs: 1000 }, state);
  await Promise.resolve();

  assert.equal(completed, false);

  blocker.resolve();
  await stopPromise;

  assert.equal(completed, true);
  assert.equal(jobs[0].status, "completed");
});

test("sanitizeJobDiagnostic redacts credentials and long URLs", () => {
  const sanitized = sanitizeJobDiagnostic(
    "smtp failed password=secret token=abc at https://example.com/file?signature=hidden"
  );

  assert.equal(sanitized.includes("secret"), false);
  assert.equal(sanitized.includes("https://example.com"), false);
  assert.equal(sanitized.includes("[redacted-url]"), true);
});

