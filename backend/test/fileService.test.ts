import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  deleteAllFilesForOwner,
  deleteAllFilesForPet,
  deleteFile,
  detachEventFromFiles,
  downloadFile,
  listPetFiles,
  serializeFile,
  uploadPetFile,
  validateFileIdsForPet,
  type UploadedFileInput
} from "../src/services/fileService";
import type { FileStorage } from "../src/storage/s3Storage";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const otherPetId = "60a7c1aa9e1d4f1234567891";
const eventId = "60a7c1aa9e1d4f12345678ab";
const fileId = "60a7c1aa9e1d4f12345678cd";

const uploadedAt = new Date("2026-05-12T10:00:00.000Z");
const createdAt = new Date("2026-05-12T10:00:01.000Z");
const updatedAt = new Date("2026-05-12T10:00:02.000Z");

const makeUpload = (overrides: Partial<UploadedFileInput> = {}): UploadedFileInput => ({
  originalname: "vet report.pdf",
  mimetype: "application/pdf",
  size: 11,
  buffer: Buffer.from("hello world"),
  ...overrides
});

const makeFileRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(fileId),
  ownerId: new Types.ObjectId(ownerId),
  petId: new Types.ObjectId(petId),
  originalName: "vet report.pdf",
  mimeType: "application/pdf" as const,
  sizeBytes: 11,
  storageKey: `users/${ownerId}/pets/${petId}/files/${fileId}/vet report.pdf`,
  uploadedAt,
  createdAt,
  updatedAt,
  ...overrides
});

const petFound = async () => ({ _id: new Types.ObjectId(petId) });
const eventFound = async () => ({ _id: new Types.ObjectId(eventId), petId: new Types.ObjectId(petId) });

const makeStorage = (overrides: Partial<FileStorage> = {}): FileStorage => ({
  putObject: async () => {},
  getObject: async () => ({ body: Readable.from("hello world"), contentType: "application/pdf", contentLength: 11 }),
  deleteObject: async () => {},
  ...overrides
});

const assertAppError = (statusCode: number, code: string) => (error: unknown): true => {
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.code, code);
  return true;
};

test("uploadPetFile verifies ownership, stores object, creates metadata, and serializes result", async () => {
  let stored: { key: string; body: Buffer; contentType: string } | undefined;
  let captured: Record<string, unknown> | undefined;

  const result = await uploadPetFile(
    ownerId,
    petId,
    { file: makeUpload(), eventId },
    {
      storage: makeStorage({
        putObject: async (input) => {
          stored = input;
        }
      }),
      findPetByIdForOwner: async (id, owner) => {
        assert.equal(id.toString(), petId);
        assert.equal(owner.toString(), ownerId);
        return { _id: id };
      },
      findEventByIdForOwner: async (id, owner) => {
        assert.equal(id.toString(), eventId);
        assert.equal(owner.toString(), ownerId);
        return { _id: id, petId: new Types.ObjectId(petId) };
      },
      createFileRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makeFileRecord({
          _id: input._id,
          ownerId: input.ownerId,
          petId: input.petId,
          eventId: input.eventId,
          originalName: input.originalName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          uploadedAt: input.uploadedAt
        });
      },
      now: () => uploadedAt
    }
  );

  assert.ok(stored);
  assert.equal(stored.contentType, "application/pdf");
  assert.deepEqual(stored.body, Buffer.from("hello world"));
  assert.match(stored.key, new RegExp(`^users/${ownerId}/pets/${petId}/files/[a-f0-9]{24}/vet report\\.pdf$`));

  assert.ok(captured);
  assert.equal((captured.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((captured.petId as Types.ObjectId).toString(), petId);
  assert.equal((captured.eventId as Types.ObjectId).toString(), eventId);
  assert.equal(captured.originalName, "vet report.pdf");
  assert.equal(captured.mimeType, "application/pdf");
  assert.equal(captured.sizeBytes, 11);

  assert.equal(result.ownerId, ownerId);
  assert.equal(result.petId, petId);
  assert.equal(result.eventId, eventId);
  assert.equal(result.originalName, "vet report.pdf");
  assert.equal(result.uploadedAt, uploadedAt.toISOString());
});

test("uploadPetFile rejects missing file with FILE_REQUIRED", async () => {
  await assert.rejects(
    () => uploadPetFile(ownerId, petId, {}, { findPetByIdForOwner: petFound }),
    assertAppError(400, "FILE_REQUIRED")
  );
});

test("uploadPetFile rejects invalid pet id with INVALID_PET_ID", async () => {
  await assert.rejects(
    () => uploadPetFile(ownerId, "not-an-id", { file: makeUpload() }),
    assertAppError(400, "INVALID_PET_ID")
  );
});

test("uploadPetFile returns 404 for a pet outside the owner scope", async () => {
  await assert.rejects(
    () =>
      uploadPetFile(ownerId, petId, { file: makeUpload() }, {
        findPetByIdForOwner: async () => null,
        createFileRecord: async () => {
          throw new Error("should not create metadata");
        }
      }),
    assertAppError(404, "PET_NOT_FOUND")
  );
});

test("uploadPetFile rejects unsupported MIME type", async () => {
  await assert.rejects(
    () => uploadPetFile(ownerId, petId, { file: makeUpload({ mimetype: "text/plain" }) }),
    assertAppError(400, "UNSUPPORTED_FILE_TYPE")
  );
});

test("uploadPetFile returns 404 for an event outside the owner scope", async () => {
  await assert.rejects(
    () =>
      uploadPetFile(ownerId, petId, { file: makeUpload(), eventId }, {
        findPetByIdForOwner: petFound,
        findEventByIdForOwner: async () => null,
        createFileRecord: async () => {
          throw new Error("should not create metadata");
        }
      }),
    assertAppError(404, "EVENT_NOT_FOUND")
  );
});

test("uploadPetFile returns 404 when event belongs to another pet", async () => {
  await assert.rejects(
    () =>
      uploadPetFile(ownerId, petId, { file: makeUpload(), eventId }, {
        findPetByIdForOwner: petFound,
        findEventByIdForOwner: async () => ({ _id: new Types.ObjectId(eventId), petId: new Types.ObjectId(otherPetId) }),
        createFileRecord: async () => {
          throw new Error("should not create metadata");
        }
      }),
    assertAppError(404, "EVENT_NOT_FOUND")
  );
});

test("uploadPetFile returns storage error and does not create metadata when put fails", async () => {
  let created = false;

  await assert.rejects(
    () =>
      uploadPetFile(ownerId, petId, { file: makeUpload() }, {
        storage: makeStorage({
          putObject: async () => {
            throw new Error("network down");
          }
        }),
        findPetByIdForOwner: petFound,
        createFileRecord: async () => {
          created = true;
          throw new Error("should not create metadata");
        }
      }),
    assertAppError(502, "FILE_STORAGE_PUT_FAILED")
  );

  assert.equal(created, false);
});

test("listPetFiles returns files for owner and pet in uploadedAt desc order", async () => {
  const later = makeFileRecord({ _id: new Types.ObjectId(), uploadedAt: new Date("2026-05-13T00:00:00.000Z") });
  const earlier = makeFileRecord({ _id: new Types.ObjectId(), uploadedAt: new Date("2026-05-12T00:00:00.000Z") });

  const result = await listPetFiles(ownerId, petId, {
    findPetByIdForOwner: petFound,
    listFilesForPet: async (owner, pet) => {
      assert.equal(owner.toString(), ownerId);
      assert.equal(pet.toString(), petId);
      return [later, earlier];
    }
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].uploadedAt, "2026-05-13T00:00:00.000Z");
  assert.equal(result[1].uploadedAt, "2026-05-12T00:00:00.000Z");
});

test("listPetFiles returns 404 for a pet outside the owner scope", async () => {
  await assert.rejects(
    () =>
      listPetFiles(otherOwnerId, petId, {
        findPetByIdForOwner: async () => null,
        listFilesForPet: async () => {
          throw new Error("should not list files");
        }
      }),
    assertAppError(404, "PET_NOT_FOUND")
  );
});

test("listPetFiles rejects invalid pet id with INVALID_PET_ID", async () => {
  await assert.rejects(
    () => listPetFiles(ownerId, "not-an-id", { findPetByIdForOwner: petFound }),
    assertAppError(400, "INVALID_PET_ID")
  );
});

test("downloadFile returns storage stream and metadata", async () => {
  const result = await downloadFile(ownerId, fileId, {
    storage: makeStorage(),
    findFileByIdForOwner: async (id, owner) => {
      assert.equal(id.toString(), fileId);
      assert.equal(owner.toString(), ownerId);
      return makeFileRecord();
    }
  });

  assert.equal(result.originalName, "vet report.pdf");
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.sizeBytes, 11);
  assert.ok(result.body instanceof Readable);
});

test("downloadFile returns 404 for another owner's file", async () => {
  await assert.rejects(
    () =>
      downloadFile(otherOwnerId, fileId, {
        findFileByIdForOwner: async () => null
      }),
    assertAppError(404, "FILE_NOT_FOUND")
  );
});

test("downloadFile rejects invalid file id with INVALID_FILE_ID", async () => {
  await assert.rejects(
    () => downloadFile(ownerId, "not-an-id"),
    assertAppError(400, "INVALID_FILE_ID")
  );
});

test("downloadFile maps missing storage object to 404", async () => {
  const missing = Object.assign(new Error("missing"), { name: "NoSuchKey" });

  await assert.rejects(
    () =>
      downloadFile(ownerId, fileId, {
        storage: makeStorage({
          getObject: async () => {
            throw missing;
          }
        }),
        findFileByIdForOwner: async () => makeFileRecord()
      }),
    assertAppError(404, "FILE_NOT_FOUND")
  );
});

test("downloadFile maps storage network errors to 502", async () => {
  await assert.rejects(
    () =>
      downloadFile(ownerId, fileId, {
        storage: makeStorage({
          getObject: async () => {
            throw new Error("network down");
          }
        }),
        findFileByIdForOwner: async () => makeFileRecord()
      }),
    assertAppError(502, "FILE_STORAGE_GET_FAILED")
  );
});

test("deleteFile deletes storage object, then metadata, then pulls the id from event fileIds", async () => {
  const calls: string[] = [];

  await deleteFile(ownerId, fileId, {
    storage: makeStorage({
      deleteObject: async ({ key }) => {
        calls.push(`storage:${key}`);
      }
    }),
    findFileByIdForOwner: async () => makeFileRecord(),
    deleteFileRecord: async () => {
      calls.push("metadata");
      return makeFileRecord();
    },
    removeFileIdFromEvents: async (id, owner) => {
      assert.equal(id.toString(), fileId);
      assert.equal(owner.toString(), ownerId);
      calls.push("events");
    }
  });

  assert.deepEqual(calls, [`storage:${makeFileRecord().storageKey}`, "metadata", "events"]);
});

test("deleteFile does not pull from events when file is not found", async () => {
  let pullCalled = false;

  await assert.rejects(
    () =>
      deleteFile(ownerId, fileId, {
        findFileByIdForOwner: async () => null,
        removeFileIdFromEvents: async () => {
          pullCalled = true;
        }
      }),
    assertAppError(404, "FILE_NOT_FOUND")
  );

  assert.equal(pullCalled, false);
});

test("deleteFile returns 404 for repeated delete or another owner's file", async () => {
  await assert.rejects(
    () => deleteFile(ownerId, fileId, { findFileByIdForOwner: async () => null }),
    assertAppError(404, "FILE_NOT_FOUND")
  );
});

test("deleteFile deletes metadata when storage object is already missing", async () => {
  const missing = Object.assign(new Error("missing"), { name: "NoSuchKey" });
  let metadataDeleted = false;
  let pullCalled = false;

  await deleteFile(ownerId, fileId, {
    storage: makeStorage({
      deleteObject: async () => {
        throw missing;
      }
    }),
    findFileByIdForOwner: async () => makeFileRecord(),
    deleteFileRecord: async () => {
      metadataDeleted = true;
      return makeFileRecord();
    },
    removeFileIdFromEvents: async () => {
      pullCalled = true;
    }
  });

  assert.equal(metadataDeleted, true);
  assert.equal(pullCalled, true);
});

test("deleteFile keeps metadata and does not pull from events when storage delete has a network error", async () => {
  let metadataDeleted = false;
  let pullCalled = false;

  await assert.rejects(
    () =>
      deleteFile(ownerId, fileId, {
        storage: makeStorage({
          deleteObject: async () => {
            throw new Error("network down");
          }
        }),
        findFileByIdForOwner: async () => makeFileRecord(),
        deleteFileRecord: async () => {
          metadataDeleted = true;
          return makeFileRecord();
        },
        removeFileIdFromEvents: async () => {
          pullCalled = true;
        }
      }),
    assertAppError(502, "FILE_STORAGE_DELETE_FAILED")
  );

  assert.equal(metadataDeleted, false);
  assert.equal(pullCalled, false);
});

test("serializeFile hides storage key", () => {
  const result = serializeFile(makeFileRecord());
  assert.equal("storageKey" in result, false);
});

test("deleteAllFilesForOwner removes every owned object and metadata", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const fileA = { _id: new Types.ObjectId(), storageKey: "users/o/pets/p/files/a/a.pdf" };
  const fileB = { _id: new Types.ObjectId(), storageKey: "users/o/pets/p/files/b/b.pdf" };
  const deletedKeys: string[] = [];
  let metadataDeletedFor: Types.ObjectId | undefined;

  await deleteAllFilesForOwner(ownerObjectId, {
    storage: makeStorage({
      deleteObject: async ({ key }) => {
        deletedKeys.push(key);
      }
    }),
    listOwnerFiles: async (owner) => {
      assert.equal(owner.toString(), ownerId);
      return [fileA, fileB];
    },
    deleteOwnerFiles: async (owner) => {
      metadataDeletedFor = owner;
    }
  });

  assert.deepEqual(deletedKeys, [fileA.storageKey, fileB.storageKey]);
  assert.equal(metadataDeletedFor?.toString(), ownerId);
});

test("deleteAllFilesForOwner tolerates already-missing storage objects", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const missing = Object.assign(new Error("missing"), { name: "NoSuchKey" });
  let metadataDeleted = false;

  await deleteAllFilesForOwner(ownerObjectId, {
    storage: makeStorage({
      deleteObject: async () => {
        throw missing;
      }
    }),
    listOwnerFiles: async () => [
      { _id: new Types.ObjectId(), storageKey: "users/o/p/f/a.pdf" }
    ],
    deleteOwnerFiles: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(metadataDeleted, true);
});

test("deleteAllFilesForOwner throws on hard storage failure and keeps metadata", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  let metadataDeleted = false;

  await assert.rejects(
    () =>
      deleteAllFilesForOwner(ownerObjectId, {
        storage: makeStorage({
          deleteObject: async () => {
            throw new Error("network down");
          }
        }),
        listOwnerFiles: async () => [
          { _id: new Types.ObjectId(), storageKey: "users/o/p/f/a.pdf" }
        ],
        deleteOwnerFiles: async () => {
          metadataDeleted = true;
        }
      }),
    assertAppError(502, "FILE_STORAGE_DELETE_FAILED")
  );

  assert.equal(metadataDeleted, false);
});

test("deleteAllFilesForOwner skips storage when owner has no files", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  let storageCalled = false;
  let metadataDeleted = false;

  await deleteAllFilesForOwner(ownerObjectId, {
    storage: makeStorage({
      deleteObject: async () => {
        storageCalled = true;
      }
    }),
    listOwnerFiles: async () => [],
    deleteOwnerFiles: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(storageCalled, false);
  assert.equal(metadataDeleted, true);
});

test("validateFileIdsForPet accepts when every file belongs to owner and pet", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const petObjectId = new Types.ObjectId(petId);
  const ids = [new Types.ObjectId(fileId), new Types.ObjectId()];
  let observed: { owner: string; pet: string; ids: string[] } | undefined;

  await validateFileIdsForPet(ownerObjectId, petObjectId, ids, {
    countFilesForPet: async (owner, pet, queried) => {
      observed = {
        owner: owner.toString(),
        pet: pet.toString(),
        ids: queried.map((id) => id.toString())
      };
      return queried.length;
    }
  });

  assert.ok(observed);
  assert.equal(observed.owner, ownerId);
  assert.equal(observed.pet, petId);
  assert.deepEqual(observed.ids, ids.map((id) => id.toString()));
});

test("validateFileIdsForPet skips the count query for an empty list", async () => {
  let queried = false;
  await validateFileIdsForPet(new Types.ObjectId(ownerId), new Types.ObjectId(petId), [], {
    countFilesForPet: async () => {
      queried = true;
      return 0;
    }
  });
  assert.equal(queried, false);
});

test("validateFileIdsForPet deduplicates ids before counting", async () => {
  let queriedIds: string[] | undefined;
  const sameId = new Types.ObjectId(fileId);
  await validateFileIdsForPet(
    new Types.ObjectId(ownerId),
    new Types.ObjectId(petId),
    [sameId, sameId],
    {
      countFilesForPet: async (_owner, _pet, ids) => {
        queriedIds = ids.map((id) => id.toString());
        return ids.length;
      }
    }
  );
  assert.deepEqual(queriedIds, [fileId]);
});

test("validateFileIdsForPet rejects when any file is missing or out of scope", async () => {
  await assert.rejects(
    () =>
      validateFileIdsForPet(
        new Types.ObjectId(ownerId),
        new Types.ObjectId(petId),
        [new Types.ObjectId(fileId), new Types.ObjectId()],
        {
          countFilesForPet: async (_owner, _pet, ids) => ids.length - 1
        }
      ),
    assertAppError(400, "INVALID_FILE_IDS")
  );
});

test("detachEventFromFiles unsets eventId on matching files for the owner", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const eventObjectId = new Types.ObjectId(eventId);
  let observed: { owner: string; event: string } | undefined;

  await detachEventFromFiles(ownerObjectId, eventObjectId, {
    detachEventFromFileRecords: async (owner, event) => {
      observed = { owner: owner.toString(), event: event.toString() };
    }
  });

  assert.deepEqual(observed, { owner: ownerId, event: eventId });
});

test("deleteAllFilesForPet removes pet files from storage and metadata", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const petObjectId = new Types.ObjectId(petId);
  const fileA = { _id: new Types.ObjectId(), storageKey: "users/o/pets/p/files/a/a.pdf" };
  const fileB = { _id: new Types.ObjectId(), storageKey: "users/o/pets/p/files/b/b.pdf" };
  const deletedKeys: string[] = [];
  let metadataDeletedFor: { owner: string; pet: string } | undefined;

  await deleteAllFilesForPet(ownerObjectId, petObjectId, {
    storage: makeStorage({
      deleteObject: async ({ key }) => {
        deletedKeys.push(key);
      }
    }),
    listPetFiles: async (owner, pet) => {
      assert.equal(owner.toString(), ownerId);
      assert.equal(pet.toString(), petId);
      return [fileA, fileB];
    },
    deletePetFileRecords: async (owner, pet) => {
      metadataDeletedFor = { owner: owner.toString(), pet: pet.toString() };
    }
  });

  assert.deepEqual(deletedKeys, [fileA.storageKey, fileB.storageKey]);
  assert.deepEqual(metadataDeletedFor, { owner: ownerId, pet: petId });
});

test("deleteAllFilesForPet tolerates already-missing storage objects", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const petObjectId = new Types.ObjectId(petId);
  const missing = Object.assign(new Error("missing"), { name: "NoSuchKey" });
  let metadataDeleted = false;

  await deleteAllFilesForPet(ownerObjectId, petObjectId, {
    storage: makeStorage({
      deleteObject: async () => {
        throw missing;
      }
    }),
    listPetFiles: async () => [
      { _id: new Types.ObjectId(), storageKey: "users/o/p/f/a.pdf" }
    ],
    deletePetFileRecords: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(metadataDeleted, true);
});

test("deleteAllFilesForPet throws on hard storage failure and keeps metadata", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const petObjectId = new Types.ObjectId(petId);
  let metadataDeleted = false;

  await assert.rejects(
    () =>
      deleteAllFilesForPet(ownerObjectId, petObjectId, {
        storage: makeStorage({
          deleteObject: async () => {
            throw new Error("network down");
          }
        }),
        listPetFiles: async () => [
          { _id: new Types.ObjectId(), storageKey: "users/o/p/f/a.pdf" }
        ],
        deletePetFileRecords: async () => {
          metadataDeleted = true;
        }
      }),
    assertAppError(502, "FILE_STORAGE_DELETE_FAILED")
  );

  assert.equal(metadataDeleted, false);
});
