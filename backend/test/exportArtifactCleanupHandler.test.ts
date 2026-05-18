import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import {
  cleanupExpiredExportArtifacts,
  createExportArtifactCleanupJobHandler
} from "../src/jobs/handlers/exportArtifactCleanupHandler";
import type { BackgroundJobContext } from "../src/jobs/types";
import type { FileStorage } from "../src/storage/s3Storage";

const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
const petId = new Types.ObjectId("507f1f77bcf86cd799439022");
const artifactId = new Types.ObjectId("507f1f77bcf86cd799439033");
const now = new Date("2026-05-14T10:00:00.000Z");
const dataHash = "c".repeat(64);
const artifactKey = `users/${ownerId.toString()}/pets/${petId.toString()}/exports/${dataHash}.pdf`;

const makeStorage = (overrides: Partial<FileStorage> = {}): FileStorage => ({
  putObject: async () => {},
  getObject: async () => {
    throw new Error("not used");
  },
  deleteObject: async () => {},
  ...overrides
});

const makeJob = (payload: Record<string, unknown> = {}): BackgroundJobContext => ({
  id: "job-1",
  type: "export-artifact-cleanup",
  payload,
  attempts: 0,
  maxAttempts: 3,
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  }
});

test("cleanupExpiredExportArtifacts deletes expired ready artifact objects and metadata", async () => {
  const deletedKeys: string[] = [];
  const metadataDeleted: string[] = [];

  const result = await cleanupExpiredExportArtifacts({
    now: () => now,
    storage: makeStorage({
      deleteObject: async ({ key }) => {
        deletedKeys.push(key);
      }
    }),
    listExpiredArtifacts: async (cutoff, limit) => {
      assert.equal(cutoff.toISOString(), now.toISOString());
      assert.equal(limit, 100);
      return [
        {
          _id: artifactId,
          ownerId,
          petId,
          status: "ready",
          fileKey: artifactKey,
          expiresAt: now,
          generation: 0
        }
      ];
    },
    deleteArtifactMetadata: async (id) => {
      metadataDeleted.push(id.toString());
    }
  });

  assert.deepEqual(deletedKeys, [artifactKey]);
  assert.deepEqual(metadataDeleted, [artifactId.toString()]);
  assert.deepEqual(result, { scanned: 1, deleted: 1 });
});

test("cleanupExpiredExportArtifacts tolerates already-missing S3 objects", async () => {
  let metadataDeleted = false;
  const missing = Object.assign(new Error("missing"), { name: "NoSuchKey" });

  await cleanupExpiredExportArtifacts({
    storage: makeStorage({
      deleteObject: async () => {
        throw missing;
      }
    }),
    listExpiredArtifacts: async () => [
      {
        _id: artifactId,
        ownerId,
        petId,
        status: "ready",
        fileKey: artifactKey,
        expiresAt: now,
        generation: 0
      }
    ],
    deleteArtifactMetadata: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(metadataDeleted, true);
});

test("cleanupExpiredExportArtifacts leaves metadata intact when storage deletion fails", async () => {
  let metadataDeleted = false;

  await assert.rejects(
    () =>
      cleanupExpiredExportArtifacts({
        storage: makeStorage({
          deleteObject: async () => {
            throw new Error("network down");
          }
        }),
        listExpiredArtifacts: async () => [
          {
            _id: artifactId,
            ownerId,
            petId,
            status: "ready",
            fileKey: artifactKey,
            expiresAt: now,
            generation: 0
          }
        ],
        deleteArtifactMetadata: async () => {
          metadataDeleted = true;
        }
      }),
    /network down/
  );

  assert.equal(metadataDeleted, false);
});

test("cleanupExpiredExportArtifacts does not delete non-cache S3 keys", async () => {
  let storageDeleted = false;
  let metadataDeleted = false;

  const result = await cleanupExpiredExportArtifacts({
    storage: makeStorage({
      deleteObject: async () => {
        storageDeleted = true;
      }
    }),
    listExpiredArtifacts: async () => [
      {
        _id: artifactId,
        ownerId,
        petId,
        status: "ready",
        fileKey: "users/o/p/files/photo.png",
        expiresAt: now,
        generation: 0
      }
    ],
    deleteArtifactMetadata: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(storageDeleted, false);
  assert.equal(metadataDeleted, false);
  assert.deepEqual(result, { scanned: 1, deleted: 0 });
});

test("cleanupExpiredExportArtifacts keeps pending artifacts with active generation jobs", async () => {
  let activeJobChecked = false;
  let metadataDeleted = false;

  const result = await cleanupExpiredExportArtifacts({
    listExpiredArtifacts: async () => [
      {
        _id: artifactId,
        ownerId,
        petId,
        status: "pending",
        expiresAt: now,
        generation: 2
      }
    ],
    hasActiveArtifactJob: async (id, generation) => {
      activeJobChecked = true;
      assert.equal(id.toString(), artifactId.toString());
      assert.equal(generation, 2);
      return true;
    },
    deleteArtifactMetadata: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(activeJobChecked, true);
  assert.equal(metadataDeleted, false);
  assert.deepEqual(result, { scanned: 1, deleted: 0 });
});

test("cleanupExpiredExportArtifacts removes stale pending artifacts without active generation jobs", async () => {
  const metadataDeleted: string[] = [];

  const result = await cleanupExpiredExportArtifacts({
    listExpiredArtifacts: async () => [
      {
        _id: artifactId,
        ownerId,
        petId,
        status: "pending",
        expiresAt: now,
        generation: 2
      }
    ],
    hasActiveArtifactJob: async () => false,
    deleteArtifactMetadata: async (id) => {
      metadataDeleted.push(id.toString());
    }
  });

  assert.deepEqual(metadataDeleted, [artifactId.toString()]);
  assert.deepEqual(result, { scanned: 1, deleted: 1 });
});

test("export artifact cleanup job validates payload and runs cleanup", async () => {
  let cleanupNow: string | undefined;
  const handler = createExportArtifactCleanupJobHandler({
    listExpiredArtifacts: async (cutoff) => {
      cleanupNow = cutoff.toISOString();
      return [];
    }
  });

  await handler(makeJob({ now: now.toISOString() }));

  assert.equal(cleanupNow, now.toISOString());
});
