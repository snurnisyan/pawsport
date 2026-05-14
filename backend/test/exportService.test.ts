import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import { deleteAllExportsForOwner } from "../src/services/exportService";
import type { FileStorage } from "../src/storage/s3Storage";

const ownerId = "507f1f77bcf86cd799439011";

const makeStorage = (overrides: Partial<FileStorage> = {}): FileStorage => ({
  putObject: async () => {},
  getObject: async () => ({ body: Readable.from(""), contentType: "application/zip", contentLength: 0 }),
  deleteObject: async () => {},
  ...overrides
});

const assertAppError = (statusCode: number, code: string) => (error: unknown): true => {
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.code, code);
  return true;
};

test("deleteAllExportsForOwner deletes ready exports from storage and clears metadata", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const ready = { _id: new Types.ObjectId(), fileKey: "users/o/exports/a.zip" };
  const pending = { _id: new Types.ObjectId(), fileKey: undefined };
  const deletedKeys: string[] = [];
  let metadataDeleted = false;

  await deleteAllExportsForOwner(ownerObjectId, {
    storage: makeStorage({
      deleteObject: async ({ key }) => {
        deletedKeys.push(key);
      }
    }),
    listOwnerExports: async (owner) => {
      assert.equal(owner.toString(), ownerId);
      return [ready, pending];
    },
    deleteOwnerExports: async () => {
      metadataDeleted = true;
    }
  });

  assert.deepEqual(deletedKeys, [ready.fileKey]);
  assert.equal(metadataDeleted, true);
});

test("deleteAllExportsForOwner tolerates missing storage objects", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const missing = Object.assign(new Error("missing"), { name: "NoSuchKey" });
  let metadataDeleted = false;

  await deleteAllExportsForOwner(ownerObjectId, {
    storage: makeStorage({
      deleteObject: async () => {
        throw missing;
      }
    }),
    listOwnerExports: async () => [{ _id: new Types.ObjectId(), fileKey: "users/o/exports/a.zip" }],
    deleteOwnerExports: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(metadataDeleted, true);
});

test("deleteAllExportsForOwner throws on hard storage failure and keeps metadata", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  let metadataDeleted = false;

  await assert.rejects(
    () =>
      deleteAllExportsForOwner(ownerObjectId, {
        storage: makeStorage({
          deleteObject: async () => {
            throw new Error("network down");
          }
        }),
        listOwnerExports: async () => [
          { _id: new Types.ObjectId(), fileKey: "users/o/exports/a.zip" }
        ],
        deleteOwnerExports: async () => {
          metadataDeleted = true;
        }
      }),
    assertAppError(502, "EXPORT_STORAGE_DELETE_FAILED")
  );

  assert.equal(metadataDeleted, false);
});

test("deleteAllExportsForOwner clears metadata when no exports exist", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  let storageCalled = false;
  let metadataDeleted = false;

  await deleteAllExportsForOwner(ownerObjectId, {
    storage: makeStorage({
      deleteObject: async () => {
        storageCalled = true;
      }
    }),
    listOwnerExports: async () => [],
    deleteOwnerExports: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(storageCalled, false);
  assert.equal(metadataDeleted, true);
});
