import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  deleteAllFilesForOwner,
  deleteAllFilesForPet,
  deleteFile,
  deleteFilesForEvent,
  detachEventFromFiles,
  downloadFile,
  cleanupExpiredTemporaryFile,
  listPetFiles,
  serializeFile,
  TEMPORARY_EVENT_FILE_CLEANUP_JOB_TYPE,
  TEMPORARY_EVENT_FILE_TTL_MS,
  uploadPetFile,
  uploadPetPhoto,
  attachFilesToEvent,
  validateFileIdsForPet,
  type PetPhotoPetRecord,
  type UploadedFileInput
} from "../src/services/fileService";
import type { FileStorage } from "../src/storage/s3Storage";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
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
    { file: makeUpload() },
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
      createFileRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makeFileRecord({
          _id: input._id,
          ownerId: input.ownerId,
          petId: input.petId,
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
  assert.equal(captured.eventId, undefined);
  assert.equal(captured.originalName, "vet report.pdf");
  assert.equal(captured.mimeType, "application/pdf");
  assert.equal(captured.sizeBytes, 11);

  assert.equal(result.ownerId, ownerId);
  assert.equal(result.petId, petId);
  assert.equal(result.eventId, undefined);
  assert.equal(result.originalName, "vet report.pdf");
  assert.equal(result.uploadedAt, uploadedAt.toISOString());
});

test("uploadPetFile marks event-creation files temporary and schedules cleanup", async () => {
  let captured: Record<string, unknown> | undefined;
  let cleanupJob:
    | {
        type: string;
        payload: Record<string, unknown>;
        runAt?: Date;
        idempotencyKey?: string;
      }
    | undefined;

  await uploadPetFile(
    ownerId,
    petId,
    { file: makeUpload(), temporaryForEvent: "true" },
    {
      storage: makeStorage(),
      findPetByIdForOwner: petFound,
      createFileRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makeFileRecord({
          _id: input._id,
          ownerId: input.ownerId,
          petId: input.petId,
          tempExpiresAt: input.tempExpiresAt,
          originalName: input.originalName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          uploadedAt: input.uploadedAt
        });
      },
      enqueueTemporaryFileCleanup: async (input) => {
        cleanupJob = {
          type: input.type,
          payload: input.payload,
          runAt: input.runAt,
          idempotencyKey: input.idempotencyKey
        };
      },
      now: () => uploadedAt
    }
  );

  assert.ok(captured?.tempExpiresAt instanceof Date);
  assert.equal(
    (captured.tempExpiresAt as Date).toISOString(),
    new Date(uploadedAt.getTime() + TEMPORARY_EVENT_FILE_TTL_MS).toISOString()
  );
  assert.equal(cleanupJob?.type, TEMPORARY_EVENT_FILE_CLEANUP_JOB_TYPE);
  assert.equal(cleanupJob?.payload.ownerId, ownerId);
  assert.equal(cleanupJob?.payload.fileId, (captured._id as Types.ObjectId).toString());
  assert.equal(cleanupJob?.runAt?.toISOString(), (captured.tempExpiresAt as Date).toISOString());
  assert.equal(
    cleanupJob?.idempotencyKey,
    `${TEMPORARY_EVENT_FILE_CLEANUP_JOB_TYPE}:${(captured._id as Types.ObjectId).toString()}`
  );
});

test("uploadPetFile decodes latin1-mojibake UTF-8 original names", async () => {
  const readableName = "2026-04-13 1.22.02\u202fPM.jpg";
  const mojibakeName = Buffer.from(readableName, "utf8").toString("latin1");
  let capturedOriginalName: string | undefined;
  let storedKey: string | undefined;

  const result = await uploadPetFile(
    ownerId,
    petId,
    {
      file: makeUpload({
        originalname: mojibakeName,
        mimetype: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
      })
    },
    {
      storage: makeStorage({
        putObject: async ({ key }) => {
          storedKey = key;
        }
      }),
      findPetByIdForOwner: petFound,
      createFileRecord: async (input) => {
        capturedOriginalName = input.originalName;
        return makeFileRecord({
          _id: input._id,
          ownerId: input.ownerId,
          petId: input.petId,
          originalName: input.originalName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          uploadedAt: input.uploadedAt
        });
      }
    }
  );

  assert.equal(capturedOriginalName, readableName);
  assert.equal(result.originalName, readableName);
  assert.match(storedKey ?? "", /2026-04-13 1\.22\.02_PM\.jpg$/);
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

test("listPetFiles excludes the current pet photo file", async () => {
  const photoFileId = new Types.ObjectId();
  const photoFile = makeFileRecord({ _id: photoFileId, originalName: "profile.jpg" });
  const documentFile = makeFileRecord({ _id: new Types.ObjectId(), originalName: "vet report.pdf" });

  const result = await listPetFiles(ownerId, petId, {
    findPetByIdForOwner: async () => ({
      _id: new Types.ObjectId(petId),
      photoFileId
    }),
    listFilesForPet: async () => [photoFile, documentFile]
  });

  assert.deepEqual(
    result.map((file) => file.originalName),
    ["vet report.pdf"]
  );
});

test("listPetFiles excludes temporary event-creation files", async () => {
  const visible = makeFileRecord({ _id: new Types.ObjectId(), originalName: "visible.pdf" });
  const temporary = makeFileRecord({
    _id: new Types.ObjectId(),
    originalName: "draft.pdf",
    tempExpiresAt: new Date("2026-05-13T10:00:00.000Z")
  });

  const result = await listPetFiles(ownerId, petId, {
    findPetByIdForOwner: petFound,
    listFilesForPet: async () => [temporary, visible]
  });

  assert.deepEqual(
    result.map((file) => file.originalName),
    ["visible.pdf"]
  );
});

test("listPetFiles passes an optional from/to uploadedAt range to the repository", async () => {
  let observedRange: { from?: Date; to?: Date } | undefined;

  const result = await listPetFiles(
    ownerId,
    petId,
    { from: "2026-05-12", to: "2026-05-13" },
    {
      findPetByIdForOwner: petFound,
      listFilesForPet: async (_owner, _pet, range) => {
        observedRange = range;
        return [];
      }
    }
  );

  assert.deepEqual(result, []);
  assert.equal(observedRange?.from?.toISOString(), "2026-05-12T00:00:00.000Z");
  assert.equal(observedRange?.to?.toISOString(), "2026-05-13T23:59:59.999Z");
});

test("listPetFiles leaves missing date bounds unrestricted", async () => {
  let observedRange: { from?: Date; to?: Date } | undefined;

  await listPetFiles(
    ownerId,
    petId,
    { to: "2026-05-13" },
    {
      findPetByIdForOwner: petFound,
      listFilesForPet: async (_owner, _pet, range) => {
        observedRange = range;
        return [];
      }
    }
  );

  assert.equal(observedRange?.from, undefined);
  assert.equal(observedRange?.to?.toISOString(), "2026-05-13T23:59:59.999Z");
});

test("listPetFiles rejects malformed date bounds", async () => {
  await assert.rejects(
    () =>
      listPetFiles(
        ownerId,
        petId,
        { from: "05/12/2026" },
        {
          findPetByIdForOwner: petFound,
          listFilesForPet: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    assertAppError(400, "INVALID_FROM")
  );
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

test("deleteFilesForEvent removes event files from storage and metadata", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const eventObjectId = new Types.ObjectId(eventId);
  const fileA = { _id: new Types.ObjectId(fileId), storageKey: "users/o/pets/p/files/a/a.pdf" };
  const fileB = { _id: new Types.ObjectId(), storageKey: "users/o/pets/p/files/b/b.pdf" };
  const deletedKeys: string[] = [];
  let metadataDeletedFor:
    | {
        owner: string;
        event: string;
        fileIds: string[];
      }
    | undefined;

  await deleteFilesForEvent(ownerObjectId, eventObjectId, [fileA._id, fileA._id], {
    storage: makeStorage({
      deleteObject: async ({ key }) => {
        deletedKeys.push(key);
      }
    }),
    listEventFiles: async (owner, event, fileIds) => {
      assert.equal(owner.toString(), ownerId);
      assert.equal(event.toString(), eventId);
      assert.deepEqual(fileIds.map((id) => id.toString()), [fileId, fileId]);
      return [fileA, fileB];
    },
    deleteEventFileRecords: async (owner, event, fileIds) => {
      metadataDeletedFor = {
        owner: owner.toString(),
        event: event.toString(),
        fileIds: fileIds.map((id) => id.toString())
      };
    }
  });

  assert.deepEqual(deletedKeys, [fileA.storageKey, fileB.storageKey]);
  assert.deepEqual(metadataDeletedFor, {
    owner: ownerId,
    event: eventId,
    fileIds: [fileId, fileId]
  });
});

test("deleteFilesForEvent tolerates already-missing storage objects", async () => {
  const missing = Object.assign(new Error("missing"), { name: "NoSuchKey" });
  let metadataDeleted = false;

  await deleteFilesForEvent(new Types.ObjectId(ownerId), new Types.ObjectId(eventId), [], {
    storage: makeStorage({
      deleteObject: async () => {
        throw missing;
      }
    }),
    listEventFiles: async () => [
      { _id: new Types.ObjectId(fileId), storageKey: "users/o/p/f/a.pdf" }
    ],
    deleteEventFileRecords: async () => {
      metadataDeleted = true;
    }
  });

  assert.equal(metadataDeleted, true);
});

test("attachFilesToEvent sets eventId and clears temporary expiry", async () => {
  const fileIds = [new Types.ObjectId(fileId), new Types.ObjectId(fileId)];
  let observed:
    | {
        owner: string;
        pet: string;
        event: string;
        ids: string[];
      }
    | undefined;

  await attachFilesToEvent(
    new Types.ObjectId(ownerId),
    new Types.ObjectId(petId),
    new Types.ObjectId(eventId),
    fileIds,
    {
      attachFileRecordsToEvent: async (owner, pet, event, ids) => {
        observed = {
          owner: owner.toString(),
          pet: pet.toString(),
          event: event.toString(),
          ids: ids.map((id) => id.toString())
        };
      }
    }
  );

  assert.deepEqual(observed, {
    owner: ownerId,
    pet: petId,
    event: eventId,
    ids: [fileId]
  });
});

test("cleanupExpiredTemporaryFile deletes expired unattached temporary file", async () => {
  const deletedKeys: string[] = [];
  let metadataDeleted = false;
  const tempExpiresAt = new Date("2026-05-12T09:00:00.000Z");

  await cleanupExpiredTemporaryFile(ownerId, fileId, {
    storage: makeStorage({
      deleteObject: async ({ key }) => {
        deletedKeys.push(key);
      }
    }),
    findTemporaryFileByIdForOwner: async (id, owner) => {
      assert.equal(id.toString(), fileId);
      assert.equal(owner.toString(), ownerId);
      return makeFileRecord({ tempExpiresAt });
    },
    deleteTemporaryFileRecord: async (id, owner) => {
      assert.equal(id.toString(), fileId);
      assert.equal(owner.toString(), ownerId);
      metadataDeleted = true;
      return makeFileRecord({ tempExpiresAt });
    },
    now: () => uploadedAt
  });

  assert.deepEqual(deletedKeys, [makeFileRecord().storageKey]);
  assert.equal(metadataDeleted, true);
});

test("cleanupExpiredTemporaryFile keeps files that are attached or not expired", async () => {
  let storageCalled = false;

  await cleanupExpiredTemporaryFile(ownerId, fileId, {
    storage: makeStorage({
      deleteObject: async () => {
        storageCalled = true;
      }
    }),
    findTemporaryFileByIdForOwner: async () =>
      makeFileRecord({
        eventId: new Types.ObjectId(eventId),
        tempExpiresAt: new Date("2026-05-12T09:00:00.000Z")
      }),
    now: () => uploadedAt
  });

  await cleanupExpiredTemporaryFile(ownerId, fileId, {
    storage: makeStorage({
      deleteObject: async () => {
        storageCalled = true;
      }
    }),
    findTemporaryFileByIdForOwner: async () =>
      makeFileRecord({
        tempExpiresAt: new Date("2026-05-12T11:00:00.000Z")
      }),
    now: () => uploadedAt
  });

  assert.equal(storageCalled, false);
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

const makePetWithPhoto = (
  overrides: Partial<PetPhotoPetRecord> = {}
): PetPhotoPetRecord => ({
  _id: new Types.ObjectId(petId),
  ownerId: new Types.ObjectId(ownerId),
  name: "Cooper",
  species: "dog",
  sex: "male",
  tags: [],
  notes: [],
  createdAt,
  updatedAt,
  ...overrides
});

const makePhotoUpload = (overrides: Partial<UploadedFileInput> = {}): UploadedFileInput => ({
  originalname: "cooper.jpg",
  mimetype: "image/jpeg",
  size: 1234,
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  ...overrides
});

test("uploadPetPhoto uploads to storage, creates file record, and sets pet.photoFileId", async () => {
  let stored: { key: string; body: Buffer; contentType: string } | undefined;
  let setPhotoCall: { petId: string; ownerId: string; photoFileId: string } | undefined;

  const result = await uploadPetPhoto(
    ownerId,
    petId,
    { file: makePhotoUpload() },
    {
      storage: makeStorage({
        putObject: async (input) => {
          stored = input;
        }
      }),
      findPetWithPhotoForOwner: async (id, owner) => {
        assert.equal(id.toString(), petId);
        assert.equal(owner.toString(), ownerId);
        return makePetWithPhoto();
      },
      createFileRecord: async (input) =>
        makeFileRecord({
          _id: input._id,
          ownerId: input.ownerId,
          petId: input.petId,
          originalName: input.originalName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          uploadedAt: input.uploadedAt
        }),
      setPetPhoto: async (id, owner, photoFileId) => {
        setPhotoCall = {
          petId: id.toString(),
          ownerId: owner.toString(),
          photoFileId: photoFileId.toString()
        };
        return makePetWithPhoto({ photoFileId });
      },
      findFileByIdForOwner: async () => {
        throw new Error("should not look up previous photo when none exists");
      },
      deleteFileRecord: async () => {
        throw new Error("should not delete a previous photo when none exists");
      },
      now: () => uploadedAt
    }
  );

  assert.ok(stored);
  assert.equal(stored.contentType, "image/jpeg");
  assert.match(stored.key, new RegExp(`^users/${ownerId}/pets/${petId}/files/[a-f0-9]{24}/cooper\\.jpg$`));

  assert.ok(setPhotoCall);
  assert.equal(setPhotoCall.petId, petId);
  assert.equal(setPhotoCall.ownerId, ownerId);
  assert.equal(setPhotoCall.photoFileId, result.file.id);

  assert.equal(result.file.mimeType, "image/jpeg");
  assert.equal(result.file.originalName, "cooper.jpg");
  assert.equal(result.pet.photoFileId?.toString(), result.file.id);
});

test("uploadPetPhoto rejects non-image MIME types with UNSUPPORTED_PHOTO_TYPE", async () => {
  await assert.rejects(
    () =>
      uploadPetPhoto(ownerId, petId, { file: makePhotoUpload({ mimetype: "application/pdf" }) }),
    assertAppError(400, "UNSUPPORTED_PHOTO_TYPE")
  );
});

test("uploadPetPhoto rejects missing file with FILE_REQUIRED", async () => {
  await assert.rejects(
    () => uploadPetPhoto(ownerId, petId, {}),
    assertAppError(400, "FILE_REQUIRED")
  );
});

test("uploadPetPhoto rejects invalid pet id with INVALID_PET_ID", async () => {
  await assert.rejects(
    () => uploadPetPhoto(ownerId, "not-an-id", { file: makePhotoUpload() }),
    assertAppError(400, "INVALID_PET_ID")
  );
});

test("uploadPetPhoto returns 404 for a pet outside the owner scope", async () => {
  await assert.rejects(
    () =>
      uploadPetPhoto(
        ownerId,
        petId,
        { file: makePhotoUpload() },
        {
          findPetWithPhotoForOwner: async () => null,
          createFileRecord: async () => {
            throw new Error("should not create metadata");
          }
        }
      ),
    assertAppError(404, "PET_NOT_FOUND")
  );
});

test("uploadPetPhoto deletes the previous photo storage object and metadata when replacing", async () => {
  const previousFileId = new Types.ObjectId();
  const previousStorageKey = `users/${ownerId}/pets/${petId}/files/${previousFileId.toString()}/old.jpg`;
  const deletedStorageKeys: string[] = [];
  const deletedFileIds: string[] = [];

  await uploadPetPhoto(
    ownerId,
    petId,
    { file: makePhotoUpload() },
    {
      storage: makeStorage({
        deleteObject: async ({ key }) => {
          deletedStorageKeys.push(key);
        }
      }),
      findPetWithPhotoForOwner: async () =>
        makePetWithPhoto({ photoFileId: previousFileId }),
      createFileRecord: async (input) => makeFileRecord({ _id: input._id, storageKey: input.storageKey }),
      setPetPhoto: async (_id, _owner, photoFileId) =>
        makePetWithPhoto({ photoFileId }),
      findFileByIdForOwner: async (id, owner) => {
        assert.equal(id.toString(), previousFileId.toString());
        assert.equal(owner.toString(), ownerId);
        return makeFileRecord({ _id: previousFileId, storageKey: previousStorageKey });
      },
      deleteFileRecord: async (id) => {
        deletedFileIds.push(id.toString());
        return makeFileRecord({ _id: id });
      }
    }
  );

  assert.deepEqual(deletedStorageKeys, [previousStorageKey]);
  assert.deepEqual(deletedFileIds, [previousFileId.toString()]);
});

test("uploadPetPhoto tolerates the previous photo already being missing from storage", async () => {
  const previousFileId = new Types.ObjectId();
  const missing = Object.assign(new Error("missing"), { name: "NoSuchKey" });
  let metadataDeleted = false;

  await uploadPetPhoto(
    ownerId,
    petId,
    { file: makePhotoUpload() },
    {
      storage: makeStorage({
        deleteObject: async () => {
          throw missing;
        }
      }),
      findPetWithPhotoForOwner: async () =>
        makePetWithPhoto({ photoFileId: previousFileId }),
      createFileRecord: async (input) => makeFileRecord({ _id: input._id, storageKey: input.storageKey }),
      setPetPhoto: async (_id, _owner, photoFileId) =>
        makePetWithPhoto({ photoFileId }),
      findFileByIdForOwner: async () =>
        makeFileRecord({ _id: previousFileId, storageKey: "old/key" }),
      deleteFileRecord: async () => {
        metadataDeleted = true;
        return makeFileRecord({ _id: previousFileId });
      }
    }
  );

  assert.equal(metadataDeleted, true);
});

test("uploadPetPhoto rolls back the new file when the pet disappears between read and write", async () => {
  const deletedStorageKeys: string[] = [];
  const deletedFileIds: string[] = [];

  await assert.rejects(
    () =>
      uploadPetPhoto(
        ownerId,
        petId,
        { file: makePhotoUpload() },
        {
          storage: makeStorage({
            deleteObject: async ({ key }) => {
              deletedStorageKeys.push(key);
            }
          }),
          findPetWithPhotoForOwner: async () => makePetWithPhoto(),
          createFileRecord: async (input) =>
            makeFileRecord({ _id: input._id, storageKey: input.storageKey }),
          setPetPhoto: async () => null,
          deleteFileRecord: async (id) => {
            deletedFileIds.push(id.toString());
            return makeFileRecord({ _id: id });
          },
          findFileByIdForOwner: async () => {
            throw new Error("should not query previous photo on rollback");
          }
        }
      ),
    assertAppError(404, "PET_NOT_FOUND")
  );

  assert.equal(deletedStorageKeys.length, 1);
  assert.equal(deletedFileIds.length, 1);
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
