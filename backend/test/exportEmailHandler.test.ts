import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Types } from "mongoose";

import { createExportEmailJobHandler } from "../src/jobs/handlers/exportEmailHandler";
import type { BackgroundJobContext } from "../src/jobs/types";
import type { FileStorage } from "../src/storage/s3Storage";

const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
const petId = new Types.ObjectId("507f1f77bcf86cd799439022");
const exportId = new Types.ObjectId("507f1f77bcf86cd799439033");
const artifactId = new Types.ObjectId("507f1f77bcf86cd799439044");
const now = new Date("2026-05-14T10:00:00.000Z");
const dataHash = "d".repeat(64);
const artifactKey = `users/${ownerId.toString()}/pets/${petId.toString()}/exports/${dataHash}.pdf`;

const makeJob = (overrides: Partial<BackgroundJobContext> = {}): BackgroundJobContext => ({
  id: "job-1",
  type: "export-email",
  payload: {
    exportId: exportId.toString(),
    ownerId: ownerId.toString(),
    petId: petId.toString(),
    artifactId: artifactId.toString(),
    notificationEmail: "owner@example.com"
  },
  attempts: 0,
  maxAttempts: 3,
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  },
  ...overrides
});

const makeRecord = (
  overrides: Partial<{
    status: "pending" | "ready" | "failed";
    fileKey: string;
    emailSentAt: Date;
  }> = {}
) => ({
  _id: exportId,
  ownerId,
  petId,
  artifactId,
  fileKey: artifactKey,
  status: "ready" as const,
  ...overrides
});

const makeArtifact = () => ({
  _id: artifactId,
  ownerId,
  petId,
  status: "ready" as const,
  fileKey: artifactKey,
  expiresAt: new Date("2026-05-21T10:00:00.000Z")
});

const makePet = () => ({
  _id: petId,
  ownerId,
  name: "Miso",
  species: "cat",
  tags: [],
  notes: [],
  sex: "unknown" as const,
  createdAt: now,
  updatedAt: now
});

const makeStorage = (overrides: Partial<FileStorage> = {}): FileStorage => ({
  putObject: async () => {},
  getObject: async () => ({
    body: Readable.from(Buffer.from("%PDF-existing")),
    contentType: "application/pdf",
    contentLength: 13
  }),
  deleteObject: async () => {},
  ...overrides
});

test("export-email handler sends the ready PDF and marks the export emailSentAt", async () => {
  let emailTo: string | undefined;
  let emailAttachment: Buffer | undefined;
  let emailSentAt: Date | undefined;

  const handler = createExportEmailJobHandler({
    findExportById: async () => makeRecord(),
    findArtifactById: async () => makeArtifact(),
    findPet: async () => makePet(),
    storage: makeStorage(),
    sendExportReadyEmail: async (payload) => {
      emailTo = payload.to;
      emailAttachment = payload.attachment.content;
      assert.equal(payload.downloadUrl, `https://download.example/${artifactKey}`);
    },
    getPublicUrl: (key) => `https://download.example/${key}`,
    updateExportRecord: async (_exportId, _ownerId, updates) => {
      emailSentAt = updates.set?.emailSentAt;
    },
    now: () => now
  });

  await handler(makeJob());

  assert.equal(emailTo, "owner@example.com");
  assert.equal(emailAttachment?.toString("utf8"), "%PDF-existing");
  assert.equal(emailSentAt?.toISOString(), now.toISOString());
});

test("export-email handler retries SMTP failures before the final attempt", async () => {
  const handler = createExportEmailJobHandler({
    findExportById: async () => makeRecord(),
    findArtifactById: async () => makeArtifact(),
    findPet: async () => makePet(),
    storage: makeStorage(),
    sendExportReadyEmail: async () => {
      throw new Error("SMTP unavailable");
    }
  });

  await assert.rejects(
    () => handler(makeJob({ attempts: 1, maxAttempts: 3 })),
    /SMTP unavailable/
  );
});

test("export-email handler completes after the final SMTP failure without marking export failed", async () => {
  let emailSentAt: Date | undefined;
  let warning: Record<string, unknown> | undefined;

  const handler = createExportEmailJobHandler({
    findExportById: async () => makeRecord(),
    findArtifactById: async () => makeArtifact(),
    findPet: async () => makePet(),
    storage: makeStorage(),
    sendExportReadyEmail: async () => {
      throw new Error("SMTP unavailable");
    },
    updateExportRecord: async (_exportId, _ownerId, updates) => {
      emailSentAt = updates.set?.emailSentAt;
    }
  });

  await handler(
    makeJob({
      attempts: 2,
      maxAttempts: 3,
      logger: {
        info: () => {},
        warn: (_message, fields) => {
          warning = fields;
        },
        error: () => {}
      }
    })
  );

  assert.equal(emailSentAt, undefined);
  assert.equal(warning?.exportId, exportId.toString());
});

test("export-email handler skips already emailed exports", async () => {
  let emailCalls = 0;

  const handler = createExportEmailJobHandler({
    findExportById: async () => makeRecord({ emailSentAt: now }),
    sendExportReadyEmail: async () => {
      emailCalls += 1;
    }
  });

  await handler(makeJob());

  assert.equal(emailCalls, 0);
});
