import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Types } from "mongoose";

import { createPetExportJobHandler } from "../src/jobs/handlers/petExportHandler";
import { GotenbergRequestError, GotenbergUnavailableError } from "../src/services/gotenbergClient";
import { renderPetExportTemplate } from "../src/services/petExportTemplate";
import type { BackgroundJobContext } from "../src/jobs/types";
import type { ExportSection } from "../src/models/Export";

const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
const petId = new Types.ObjectId("507f1f77bcf86cd799439022");
const exportId = new Types.ObjectId("507f1f77bcf86cd799439033");
const now = new Date("2026-05-14T10:00:00.000Z");

const makePet = () => ({
  _id: petId,
  ownerId,
  name: "Miso",
  species: "cat",
  breed: "Siberian",
  birthDate: new Date("2020-01-02T00:00:00.000Z"),
  sex: "female" as const,
  weight: 4.2,
  microchipNumber: "123456789012345",
  tags: ["indoor"],
  notes: ["likes travel"],
  vetContact: { name: "Dr. Smith", email: "vet@example.com" },
  createdAt: now,
  updatedAt: now
});

const makeRecord = (
  overrides: Partial<{
    fileKey: string;
    fileToken: string;
    status: "pending" | "ready" | "failed";
    emailSentAt: Date;
    sections: ExportSection[];
  }> = {}
) => ({
  _id: exportId,
  ownerId,
  petId,
  period: { from: new Date("2026-05-01T00:00:00.000Z"), to: new Date("2026-05-31T00:00:00.000Z") },
  sections: ["profile"] as ExportSection[],
  fileToken: "token",
  status: "pending" as const,
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const makeJob = (overrides: Partial<BackgroundJobContext> = {}): BackgroundJobContext => ({
  id: "job-1",
  type: "pet-export",
  payload: {
    exportId: exportId.toString(),
    ownerId: ownerId.toString(),
    petId: petId.toString(),
    period: { from: "2026-05-01", to: "2026-05-31" },
    sections: ["profile"],
    notificationEmail: "owner@example.com"
  },
  attempts: 0,
  maxAttempts: 5,
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  },
  ...overrides
});

test("pet-export handler renders, uploads, marks ready, and sends one email", async () => {
  let record = makeRecord();
  const updates: unknown[] = [];
  let uploaded:
    | {
        key: string;
        body: Buffer;
        contentType: string;
      }
    | undefined;
  let emailAttachment: Buffer | undefined;

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      updates.push(update);
      record = { ...record, ...update.set };
      return record;
    },
    findPet: async () => makePet(),
    findOwnerEmail: async () => "owner@example.com",
    buildReport: async (input) => ({
      exportId: input.exportId.toString(),
      ownerId: input.ownerId.toString(),
      petId: input.petId.toString(),
      generatedAt: input.generatedAt.toISOString(),
      period: { from: "2026-05-01", to: "2026-05-31" },
      sections: input.sections,
      profile: {
        id: input.pet._id.toString(),
        name: input.pet.name,
        species: input.pet.species,
        sex: input.pet.sex,
        tags: [],
        notes: []
      }
    }),
    renderTemplate: async (report) => ({
      html: `<html>${report.profile?.name}</html>`,
      assets: [{ path: "assets/logo.svg", content: Buffer.from("<svg />") }]
    }),
    renderPdf: async ({ html, assets }) => {
      assert.match(html, /Miso/);
      assert.equal(assets?.[0]?.path, "assets/logo.svg");
      return Buffer.from("%PDF-rendered");
    },
    storage: {
      putObject: async (input) => {
        uploaded = input;
      },
      getObject: async () => {
        throw new Error("not used");
      },
      deleteObject: async () => {}
    },
    sendExportReadyEmail: async (payload) => {
      emailAttachment = payload.attachment.content;
      assert.equal(payload.to, "owner@example.com");
      assert.equal(payload.downloadUrl, `https://storage.example/${record.fileKey}`);
    },
    getPublicUrl: (key) => `https://storage.example/${key}`,
    now: () => now
  });

  await handler(makeJob());

  assert.ok(uploaded);
  assert.equal(
    uploaded.key,
    `users/${ownerId.toString()}/pets/${petId.toString()}/exports/${exportId.toString()}-token.pdf`
  );
  assert.equal(uploaded.contentType, "application/pdf");
  assert.equal(uploaded.body.toString("utf8"), "%PDF-rendered");
  assert.equal(emailAttachment?.toString("utf8"), "%PDF-rendered");
  assert.equal(record.status, "ready");
  assert.equal(record.emailSentAt?.toISOString(), now.toISOString());
  assert.equal(updates.length, 2);
});

test("pet-export handler retries retryable Gotenberg failures and marks export failed on final attempt", async () => {
  let record = makeRecord();

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      record = { ...record, ...update.set };
      return record;
    },
    findPet: async () => makePet(),
    buildReport: async (input) => ({
      exportId: input.exportId.toString(),
      ownerId: input.ownerId.toString(),
      petId: input.petId.toString(),
      generatedAt: input.generatedAt.toISOString(),
      sections: input.sections
    }),
    renderTemplate: async () => ({ html: "<html></html>", assets: [] }),
    renderPdf: async () => {
      throw new GotenbergUnavailableError("service unavailable");
    }
  });

  await assert.rejects(() => handler(makeJob({ attempts: 4, maxAttempts: 5 })), GotenbergUnavailableError);
  assert.equal(record.status, "failed");
  assert.match(record.lastError ?? "", /service unavailable/);
});

test("pet-export handler fail-fast marks export failed for non-retryable Gotenberg errors", async () => {
  let record = makeRecord();
  let uploaded = false;

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      record = { ...record, ...update.set };
      return record;
    },
    findPet: async () => makePet(),
    buildReport: async (input) => ({
      exportId: input.exportId.toString(),
      ownerId: input.ownerId.toString(),
      petId: input.petId.toString(),
      generatedAt: input.generatedAt.toISOString(),
      sections: input.sections
    }),
    renderTemplate: async () => ({ html: "<html></html>", assets: [] }),
    renderPdf: async () => {
      throw new GotenbergRequestError("bad html");
    },
    storage: {
      putObject: async () => {
        uploaded = true;
      },
      getObject: async () => ({ body: Readable.from("") }),
      deleteObject: async () => {}
    }
  });

  await handler(makeJob());

  assert.equal(record.status, "failed");
  assert.match(record.lastError ?? "", /bad html/);
  assert.equal(uploaded, false);
});

test("pet-export handler retries email only after a ready export and gates with emailSentAt", async () => {
  let record = makeRecord({
    status: "ready",
    fileKey: "users/o/p/exports/e-token.pdf"
  });
  let renders = 0;
  let uploads = 0;
  let emails = 0;

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      record = { ...record, ...update.set };
      return record;
    },
    findPet: async () => makePet(),
    buildReport: async (input) => {
      renders += 1;
      return {
        exportId: input.exportId.toString(),
        ownerId: input.ownerId.toString(),
        petId: input.petId.toString(),
        generatedAt: input.generatedAt.toISOString(),
        sections: input.sections
      };
    },
    storage: {
      putObject: async () => {
        uploads += 1;
      },
      getObject: async ({ key }) => {
        assert.equal(key, "users/o/p/exports/e-token.pdf");
        return { body: Readable.from(Buffer.from("%PDF-existing")) };
      },
      deleteObject: async () => {}
    },
    sendExportReadyEmail: async (payload) => {
      emails += 1;
      assert.equal(payload.attachment.content.toString("utf8"), "%PDF-existing");
    },
    getPublicUrl: (key) => `https://storage.example/${key}`,
    now: () => now
  });

  await handler(makeJob());
  await handler(makeJob());

  assert.equal(renders, 0);
  assert.equal(uploads, 0);
  assert.equal(emails, 1);
  assert.equal(record.emailSentAt?.toISOString(), now.toISOString());
});

test("pet export template HTML-escapes user-controlled pet fields", async () => {
  const { html } = await renderPetExportTemplate({
    exportId: exportId.toString(),
    ownerId: ownerId.toString(),
    petId: petId.toString(),
    generatedAt: now.toISOString(),
    sections: ["profile"],
    profile: {
      id: petId.toString(),
      name: '<script>alert("x")</script>',
      species: "cat",
      sex: "unknown",
      tags: ['tag"quoted'],
      notes: ["<b>note</b>"]
    }
  });

  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /tag&quot;quoted/);
  assert.match(html, /&lt;b&gt;note&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("pet export template renders base64 profile photos without escaping the data URI", async () => {
  const { html, assets } = await renderPetExportTemplate({
    exportId: exportId.toString(),
    ownerId: ownerId.toString(),
    petId: petId.toString(),
    generatedAt: now.toISOString(),
    sections: ["profile"],
    profile: {
      id: petId.toString(),
      name: "Miso",
      species: "cat",
      sex: "unknown",
      tags: [],
      notes: [],
      photo: {
        src: "data:image/png;base64,cG5nLWRhdGE=",
        originalName: "miso.png",
        mimeType: "image/png",
        sizeBytes: 8
      }
    }
  });

  assert.match(html, /<img src="data:image\/png;base64,cG5nLWRhdGE=" alt="Miso"/);
  assert.deepEqual(assets, []);
});
