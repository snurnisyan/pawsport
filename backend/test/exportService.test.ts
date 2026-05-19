import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  createPetExport,
  deleteAllExportsForOwner,
  getPetExport
} from "../src/services/exportService";
import type { FileStorage } from "../src/storage/s3Storage";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "507f1f77bcf86cd799439022";
const otherPetId = "507f1f77bcf86cd799439033";
const exportId = "507f1f77bcf86cd799439044";
const artifactId = "507f1f77bcf86cd799439055";
const now = new Date("2026-05-14T10:00:00.000Z");
const expiresAt = new Date("2026-05-21T10:00:00.000Z");
const dataHash = "a".repeat(64);
const artifactKey = `users/${ownerId}/pets/${petId}/exports/${dataHash}.pdf`;

const makeStorage = (overrides: Partial<FileStorage> = {}): FileStorage => ({
  putObject: async () => {},
  getObject: async () => ({
    body: Readable.from(""),
    contentType: "application/pdf",
    contentLength: 0
  }),
  deleteObject: async () => {},
  ...overrides
});

const assertAppError = (statusCode: number, code: string) => (error: unknown): true => {
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.code, code);
  return true;
};

const oid = (value: string): Types.ObjectId => new Types.ObjectId(value);

const makePet = () => ({
  _id: oid(petId),
  ownerId: oid(ownerId),
  name: "Miso",
  species: "cat",
  breed: "Siberian",
  birthDate: new Date("2020-01-02T00:00:00.000Z"),
  sex: "female" as const,
  weight: 4.2,
  microchipNumber: "123456789012345",
  notes: ["likes travel"],
  vetContact: { name: "Dr. Smith", email: "vet@example.com" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z")
});

const makeExportRecord = (input: {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  period?: { from?: Date; to?: Date };
  sections: ("profile" | "events" | "files" | "reminders")[];
  eventTypes?: ("vaccine" | "treatment" | "visit" | "operation" | "lab" | "other")[];
  artifactId?: Types.ObjectId;
  dataHash?: string;
  status: "pending" | "ready" | "failed";
  fileKey?: string;
  expiresAt?: Date;
  cacheHit?: boolean;
}) => ({
  ...input,
  createdAt: now,
  updatedAt: now
});

const makeArtifact = (
  overrides: Partial<{
    _id: Types.ObjectId;
    ownerId: Types.ObjectId;
    petId: Types.ObjectId;
    status: "pending" | "processing" | "ready" | "failed";
    fileKey: string;
    expiresAt: Date;
    generation: number;
  }> = {}
) => ({
  _id: oid(artifactId),
  ownerId: oid(ownerId),
  petId: oid(petId),
  dataHash,
  status: "pending" as const,
  expiresAt,
  lastAccessedAt: now,
  generation: 0,
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const makeFingerprint = () => ({
  dataHash,
  canonicalData: { stable: true }
});

test("createPetExport persists pending export and enqueues a pet-export job", async () => {
  let persisted:
    | {
        _id: Types.ObjectId;
        ownerId: Types.ObjectId;
        petId: Types.ObjectId;
        period?: { from?: Date; to?: Date };
        sections: ("profile" | "events" | "files" | "reminders")[];
        eventTypes?: ("vaccine" | "treatment" | "visit" | "operation" | "lab" | "other")[];
        artifactId?: Types.ObjectId;
        dataHash?: string;
        expiresAt?: Date;
        status: "pending";
      }
    | undefined;
  let artifactInput:
    | {
        dataHash: string;
        exportId: Types.ObjectId;
      }
    | undefined;
  let enqueued:
    | {
        type: string;
        payload: Record<string, unknown>;
        idempotencyKey?: string;
        maxAttempts?: number;
      }
    | undefined;

  const petExport = await createPetExport(
    ownerId,
    petId,
    {
      period: { from: "2026-05-01", to: "2026-05-31" },
      sections: ["profile", "events", "profile"],
      eventTypes: ["vaccine", "lab", "visit", "vaccine"],
      sendEmail: true,
      notificationEmail: "ignored@example.com"
    },
    {
      findPetByIdForOwner: async () => makePet(),
      loadNotificationRecipient: async () => ({
        email: "owner@example.com",
        emailVerified: true
      }),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async (input) => {
        artifactInput = input;
        return makeArtifact({ _id: oid(artifactId), generation: 3 });
      },
      createExportRecord: async (input) => {
        persisted = input;
        return makeExportRecord(input);
      },
      enqueuePetExportJob: async (input) => {
        enqueued = input;
      },
      now: () => now
    }
  );

  assert.ok(persisted);
  assert.equal(persisted.status, "pending");
  assert.equal(persisted.artifactId?.toString(), artifactId);
  assert.equal(persisted.dataHash, dataHash);
  assert.equal(persisted.expiresAt?.toISOString(), expiresAt.toISOString());
  assert.equal(persisted.period?.from?.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(persisted.period?.to?.toISOString(), "2026-05-31T00:00:00.000Z");
  assert.deepEqual(persisted.sections, ["profile", "events"]);
  assert.deepEqual(persisted.eventTypes, ["vaccine", "lab", "visit"]);

  assert.ok(artifactInput);
  assert.equal(artifactInput.dataHash, dataHash);

  assert.ok(enqueued);
  assert.equal(enqueued.type, "pet-export");
  assert.equal(enqueued.idempotencyKey, `pet-export-artifact:${artifactId}:3`);
  assert.equal(enqueued.maxAttempts, 5);
  assert.deepEqual(enqueued.payload, {
    exportId: persisted._id.toString(),
    ownerId,
    petId,
    artifactId,
    dataHash,
    generation: 3,
    period: { from: "2026-05-01", to: "2026-05-31" },
    sections: ["profile", "events"],
    eventTypes: ["vaccine", "lab", "visit"],
    notificationEmail: "owner@example.com"
  });

  assert.equal(petExport.status, "pending");
  assert.equal(petExport.fileKey, undefined);
  assert.equal(petExport.downloadUrl, undefined);
});

test("createPetExport omits notificationEmail when sendEmail is false", async () => {
  let enqueuedPayload: Record<string, unknown> | undefined;

  await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"],
      sendEmail: false,
      notificationEmail: "owner@example.com",
      fallbackNotificationEmail: "fallback@example.com"
    },
    {
      findPetByIdForOwner: async () => makePet(),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () => makeArtifact(),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async (input) => {
        enqueuedPayload = input.payload;
      }
    }
  );

  assert.ok(enqueuedPayload);
  assert.equal("notificationEmail" in enqueuedPayload, false);
});

test("createPetExport reuses an in-progress artifact without resetting generation", async () => {
  let enqueued:
    | {
        idempotencyKey?: string;
        payload: Record<string, unknown>;
      }
    | undefined;

  await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"]
    },
    {
      findPetByIdForOwner: async () => makePet(),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () =>
        makeArtifact({
          status: "processing",
          generation: 2
        }),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async (input) => {
        enqueued = { idempotencyKey: input.idempotencyKey, payload: input.payload };
      }
    }
  );

  assert.ok(enqueued);
  assert.equal(enqueued.idempotencyKey, `pet-export-artifact:${artifactId}:2`);
  assert.equal(enqueued.payload.generation, 2);
});

test("createPetExport omits notificationEmail when sendEmail is omitted", async () => {
  let enqueuedPayload: Record<string, unknown> | undefined;

  await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"],
      notificationEmail: "owner@example.com",
      fallbackNotificationEmail: "fallback@example.com"
    },
    {
      findPetByIdForOwner: async () => makePet(),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () => makeArtifact(),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async (input) => {
        enqueuedPayload = input.payload;
      }
    }
  );

  assert.ok(enqueuedPayload);
  assert.equal("notificationEmail" in enqueuedPayload, false);
});

test("createPetExport defaults to the authenticated user's email when sendEmail is true", async () => {
  let enqueuedPayload: Record<string, unknown> | undefined;

  await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"],
      sendEmail: true,
      fallbackNotificationEmail: "owner@example.com"
    },
    {
      findPetByIdForOwner: async () => makePet(),
      loadNotificationRecipient: async () => ({
        email: "verified-owner@example.com",
        emailVerified: true
      }),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () => makeArtifact(),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async (input) => {
        enqueuedPayload = input.payload;
      }
    }
  );

  assert.equal(enqueuedPayload?.notificationEmail, "verified-owner@example.com");
});

test("createPetExport ignores explicit notificationEmail and uses the confirmed user email", async () => {
  let enqueuedPayload: Record<string, unknown> | undefined;

  await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"],
      sendEmail: true,
      notificationEmail: "explicit@example.com",
      fallbackNotificationEmail: "owner@example.com"
    },
    {
      findPetByIdForOwner: async () => makePet(),
      loadNotificationRecipient: async () => ({
        email: "confirmed@example.com",
        emailVerified: true
      }),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () => makeArtifact(),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async (input) => {
        enqueuedPayload = input.payload;
      }
    }
  );

  assert.equal(enqueuedPayload?.notificationEmail, "confirmed@example.com");
});

test("createPetExport omits notificationEmail when user has not verified email", async () => {
  let enqueuedPayload: Record<string, unknown> | undefined;

  await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"],
      sendEmail: true,
      notificationEmail: "ignored@example.com"
    },
    {
      findPetByIdForOwner: async () => makePet(),
      loadNotificationRecipient: async () => ({
        email: "owner@example.com",
        emailVerified: false
      }),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () => makeArtifact(),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async (input) => {
        enqueuedPayload = input.payload;
      }
    }
  );

  assert.ok(enqueuedPayload);
  assert.equal("notificationEmail" in enqueuedPayload, false);
});

test("createPetExport returns a ready cached export without enqueueing render work", async () => {
  let enqueued = false;

  const result = await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"],
      sendEmail: false
    },
    {
      findPetByIdForOwner: async () => makePet(),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () =>
        makeArtifact({
          status: "ready",
          fileKey: artifactKey
        }),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async () => {
        enqueued = true;
      },
      getPublicUrl: (key) => `https://download.example/${key}`
    }
  );

  assert.equal(result.status, "ready");
  assert.equal(result.fileKey, artifactKey);
  assert.equal(
    result.downloadUrl,
    `https://download.example/${artifactKey}`
  );
  assert.equal(result.expiresAt, expiresAt.toISOString());
  assert.equal(enqueued, false);
});

test("createPetExport enqueues email-only work for a ready cache hit when email is requested", async () => {
  let enqueued:
    | {
        idempotencyKey?: string;
        payload: Record<string, unknown>;
      }
    | undefined;

  await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"],
      sendEmail: true,
      notificationEmail: "ignored@example.com"
    },
    {
      findPetByIdForOwner: async () => makePet(),
      loadNotificationRecipient: async () => ({
        email: "owner@example.com",
        emailVerified: true
      }),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () =>
        makeArtifact({
          status: "ready",
          fileKey: artifactKey
        }),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async (input) => {
        enqueued = { idempotencyKey: input.idempotencyKey, payload: input.payload };
      }
    }
  );

  assert.ok(enqueued);
  assert.equal(enqueued.idempotencyKey, `export-email:${enqueued.payload.exportId}`);
  assert.equal(enqueued.payload.notificationEmail, "owner@example.com");
  assert.equal(enqueued.payload.artifactId, artifactId);
});

test("createPetExport does not enqueue email-only work for cache hit with unverified email", async () => {
  let enqueued = false;

  await createPetExport(
    ownerId,
    petId,
    {
      sections: ["profile"],
      sendEmail: true
    },
    {
      findPetByIdForOwner: async () => makePet(),
      loadNotificationRecipient: async () => ({
        email: "owner@example.com",
        emailVerified: false
      }),
      buildFingerprint: async () => makeFingerprint(),
      createOrReuseArtifact: async () =>
        makeArtifact({
          status: "ready",
          fileKey: artifactKey
        }),
      createExportRecord: async (input) => makeExportRecord(input),
      enqueuePetExportJob: async () => {
        enqueued = true;
      }
    }
  );

  assert.equal(enqueued, false);
});

test("createPetExport hides pets owned by another user before creating an export", async () => {
  let exportCreated = false;
  let jobEnqueued = false;

  await assert.rejects(
    () =>
      createPetExport(ownerId, otherPetId, {}, {
        findPetByIdForOwner: async () => null,
        createExportRecord: async (input) => {
          exportCreated = true;
          return makeExportRecord(input);
        },
        enqueuePetExportJob: async () => {
          jobEnqueued = true;
        }
      }),
    assertAppError(404, "PET_NOT_FOUND")
  );

  assert.equal(exportCreated, false);
  assert.equal(jobEnqueued, false);
});

test("createPetExport rejects invalid period and invalid sections", async () => {
  await assert.rejects(
    () => createPetExport(ownerId, petId, { period: { from: "2026-06-01", to: "2026-05-01" } }),
    assertAppError(400, "INVALID_EXPORT_PERIOD")
  );

  await assert.rejects(
    () => createPetExport(ownerId, petId, { sections: ["profile", "payments"] }),
    assertAppError(400, "INVALID_EXPORT_SECTIONS")
  );

  await assert.rejects(
    () => createPetExport(ownerId, petId, { eventTypes: ["vaccine", "legacy"] }),
    assertAppError(400, "INVALID_EXPORT_EVENT_TYPES")
  );
});

test("getPetExport returns pending, failed, and ready owned exports with the shared serialized shape", async () => {
  const pending = makeExportRecord({
    _id: oid(exportId),
    ownerId: oid(ownerId),
    petId: oid(petId),
    sections: ["profile", "events"],
    status: "pending"
  });
  const failed = makeExportRecord({
    _id: oid(exportId),
    ownerId: oid(ownerId),
    petId: oid(petId),
    period: { from: new Date("2026-05-01T00:00:00.000Z") },
    sections: ["files"],
    status: "failed"
  });
  const ready = makeExportRecord({
    _id: oid(exportId),
    ownerId: oid(ownerId),
    petId: oid(petId),
    sections: ["profile", "reminders"],
    status: "ready",
    fileKey: "users/o/p/exports/report.pdf"
  });

  for (const record of [pending, failed, ready]) {
    const result = await getPetExport(ownerId, exportId, {
      findExportByIdForOwner: async (id, owner) => {
        assert.equal(id.toString(), exportId);
        assert.equal(owner.toString(), ownerId);
        return record;
      },
      getPublicUrl: (key) => `https://download.example/${key}`
    });

    assert.equal(result.id, exportId);
    assert.equal(result.ownerId, ownerId);
    assert.equal(result.petId, petId);
    assert.equal(result.status, record.status);
    assert.deepEqual(result.sections, record.sections);
    assert.deepEqual(result.eventTypes, record.eventTypes);
    assert.equal(result.createdAt, now.toISOString());
    assert.equal(result.updatedAt, now.toISOString());

    if (record.status === "ready") {
      assert.equal(result.fileKey, "users/o/p/exports/report.pdf");
      assert.equal(result.downloadUrl, "https://download.example/users/o/p/exports/report.pdf");
    } else {
      assert.equal(result.fileKey, undefined);
      assert.equal(result.downloadUrl, undefined);
    }
  }
});

test("getPetExport returns 400 for malformed export id", async () => {
  await assert.rejects(
    () => getPetExport(ownerId, "not-an-id"),
    assertAppError(400, "INVALID_EXPORT_ID")
  );
});

test("getPetExport returns 404 for missing or another user's export", async () => {
  let queriedOwnerId: string | undefined;

  await assert.rejects(
    () =>
      getPetExport(ownerId, exportId, {
        findExportByIdForOwner: async (_id, owner) => {
          queriedOwnerId = owner.toString();
          return null;
        }
      }),
    assertAppError(404, "EXPORT_NOT_FOUND")
  );

  assert.equal(queriedOwnerId, ownerId);

  await assert.rejects(
    () =>
      getPetExport(otherOwnerId, exportId, {
        findExportByIdForOwner: async (_id, owner) => {
          assert.equal(owner.toString(), otherOwnerId);
          return null;
        }
      }),
    assertAppError(404, "EXPORT_NOT_FOUND")
  );
});

test("deleteAllExportsForOwner deletes ready exports from storage and clears metadata", async () => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const ready = { _id: new Types.ObjectId(), fileKey: "users/o/exports/a.pdf" };
  const pending = { _id: new Types.ObjectId(), fileKey: undefined };
  const deletedKeys: string[] = [];
  let metadataDeleted = false;

  await deleteAllExportsForOwner(ownerObjectId, {
    storage: makeStorage({
      deleteObject: async ({ key }) => {
        deletedKeys.push(key);
      }
    }),
    listOwnerExportRecords: async (owner) => {
      assert.equal(owner.toString(), ownerId);
      return [ready, pending];
    },
    listOwnerArtifacts: async () => [],
    deleteOwnerExports: async () => {
      metadataDeleted = true;
    },
    deleteOwnerArtifacts: async () => {}
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
    listOwnerExportRecords: async () => [{ _id: new Types.ObjectId(), fileKey: "users/o/exports/a.pdf" }],
    listOwnerArtifacts: async () => [],
    deleteOwnerExports: async () => {
      metadataDeleted = true;
    },
    deleteOwnerArtifacts: async () => {}
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
        listOwnerExportRecords: async () => [
          { _id: new Types.ObjectId(), fileKey: "users/o/exports/a.pdf" }
        ],
        listOwnerArtifacts: async () => [],
        deleteOwnerExports: async () => {
          metadataDeleted = true;
        },
        deleteOwnerArtifacts: async () => {}
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
    listOwnerExportRecords: async () => [],
    listOwnerArtifacts: async () => [],
    deleteOwnerExports: async () => {
      metadataDeleted = true;
    },
    deleteOwnerArtifacts: async () => {}
  });

  assert.equal(storageCalled, false);
  assert.equal(metadataDeleted, true);
});
