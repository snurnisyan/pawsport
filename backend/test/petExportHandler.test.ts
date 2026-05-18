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
const artifactId = new Types.ObjectId("507f1f77bcf86cd799439044");
const now = new Date("2026-05-14T10:00:00.000Z");
const expiresAt = new Date("2026-05-21T10:00:00.000Z");
const dataHash = "b".repeat(64);
const artifactKey = `users/${ownerId.toString()}/pets/${petId.toString()}/exports/${dataHash}.pdf`;

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
    status: "pending" | "ready" | "failed";
    emailSentAt: Date;
    sections: ExportSection[];
    artifactId: Types.ObjectId;
    dataHash: string;
    expiresAt: Date;
  }> = {}
) => ({
  _id: exportId,
  ownerId,
  petId,
  period: { from: new Date("2026-05-01T00:00:00.000Z"), to: new Date("2026-05-31T00:00:00.000Z") },
  sections: ["profile"] as ExportSection[],
  status: "pending" as const,
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const makeArtifact = (
  overrides: Partial<{
    fileKey: string;
    status: "pending" | "ready" | "failed";
    generation: number;
  }> = {}
) => ({
  _id: artifactId,
  ownerId,
  petId,
  dataHash,
  status: "pending" as const,
  expiresAt,
  lastAccessedAt: now,
  generation: 0,
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
    eventTypes: ["vaccine", "lab", "visit"]
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

test("pet-export handler renders, uploads, marks ready, and enqueues one email job", async () => {
  let record = makeRecord({ artifactId, dataHash });
  let artifact = makeArtifact();
  const updates: unknown[] = [];
  let uploaded:
    | {
        key: string;
        body: Buffer;
        contentType: string;
      }
    | undefined;
  let emailJob: Record<string, unknown> | undefined;

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      updates.push(update);
      record = { ...record, ...update.set };
      return record;
    },
    findArtifactById: async () => artifact,
    claimArtifactForRender: async (_id, _owner, _generation, _now, claimExpiresAt) => {
      artifact = { ...artifact, status: "processing", renderClaimExpiresAt: claimExpiresAt };
      return artifact;
    },
    updateArtifactRecord: async (_id, _owner, update) => {
      artifact = { ...artifact, ...update.set };
      if (update.unset && "renderClaimExpiresAt" in update.unset) artifact.renderClaimExpiresAt = undefined;
      return artifact;
    },
    markExportsForArtifactReady: async () => {},
    findPet: async () => makePet(),
    buildReport: async (input) => {
      assert.deepEqual(input.eventTypes, ["vaccine", "lab", "visit"]);
      return {
        exportId: input.exportId.toString(),
        ownerId: input.ownerId.toString(),
        petId: input.petId.toString(),
        generatedAt: input.generatedAt.toISOString(),
        period: { from: "2026-05-01", to: "2026-05-31" },
        sections: input.sections,
        eventTypes: input.eventTypes,
        profile: {
          id: input.pet._id.toString(),
          name: input.pet.name,
          species: input.pet.species,
          sex: input.pet.sex,
          tags: [],
          notes: []
        }
      };
    },
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
    enqueueEmailJob: async (input) => {
      emailJob = input.payload;
      assert.equal(input.type, "export-email");
      assert.equal(input.maxAttempts, 3);
      assert.equal(input.idempotencyKey, `export-email:${exportId.toString()}`);
    },
    now: () => now
  });

  await handler(makeJob({ payload: { ...makeJob().payload, notificationEmail: "owner@example.com" } }));

  assert.ok(uploaded);
  assert.equal(uploaded.key, artifactKey);
  assert.equal(uploaded.contentType, "application/pdf");
  assert.equal(uploaded.body.toString("utf8"), "%PDF-rendered");
  assert.equal(emailJob?.notificationEmail, "owner@example.com");
  assert.equal(emailJob?.artifactId, artifactId.toString());
  assert.equal(record.status, "ready");
  assert.equal(record.emailSentAt, undefined);
  assert.equal(updates.length, 1);
});

test("pet-export handler stores artifact-backed PDFs under a deterministic hash key", async () => {
  let record = makeRecord({ artifactId, dataHash });
  let artifact = makeArtifact();
  let uploadedKey: string | undefined;
  let exportsMarkedReady:
    | {
        artifactId: Types.ObjectId;
        fileKey: string;
      }
    | undefined;

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      record = { ...record, ...update.set };
      return record;
    },
    findArtifactById: async () => artifact,
    claimArtifactForRender: async (_id, _owner, _generation, _now, claimExpiresAt) => {
      artifact = { ...artifact, status: "processing", renderClaimExpiresAt: claimExpiresAt };
      return artifact;
    },
    updateArtifactRecord: async (_id, _owner, update) => {
      artifact = { ...artifact, ...update.set };
      if (update.unset && "renderClaimExpiresAt" in update.unset) artifact.renderClaimExpiresAt = undefined;
      return artifact;
    },
    markExportsForArtifactReady: async (id, _owner, updates) => {
      exportsMarkedReady = { artifactId: id, fileKey: updates.fileKey };
    },
    findPet: async () => makePet(),
    buildReport: async (input) => ({
      exportId: input.exportId.toString(),
      ownerId: input.ownerId.toString(),
      petId: input.petId.toString(),
      generatedAt: input.generatedAt.toISOString(),
      sections: input.sections
    }),
    renderTemplate: async () => ({ html: "<html>Miso</html>" }),
    renderPdf: async () => Buffer.from("%PDF-rendered"),
    storage: {
      putObject: async ({ key }) => {
        uploadedKey = key;
      },
      getObject: async () => {
        throw new Error("not used");
      },
      deleteObject: async () => {}
    },
    now: () => now
  });

  await handler(
    makeJob({
      payload: {
        exportId: exportId.toString(),
        ownerId: ownerId.toString(),
        petId: petId.toString(),
        artifactId: artifactId.toString(),
        dataHash,
        generation: 0,
        sections: ["profile"]
      }
    })
  );

  assert.equal(
    uploadedKey,
    artifactKey
  );
  assert.equal(artifact.status, "ready");
  assert.equal(artifact.fileKey, uploadedKey);
  assert.equal(exportsMarkedReady?.artifactId.toString(), artifactId.toString());
  assert.equal(exportsMarkedReady?.fileKey, uploadedKey);
});

test("pet-export handler reuses a ready artifact for email without rendering", async () => {
  let record = makeRecord({ artifactId, dataHash });
  let renders = 0;
  let uploads = 0;
  let emailJobs = 0;

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      record = { ...record, ...update.set };
      return record;
    },
    findArtifactById: async () =>
      makeArtifact({
        status: "ready",
        fileKey: artifactKey
      }),
    updateArtifactRecord: async (_id, _owner, update) => ({
      ...makeArtifact({
        status: "ready",
        fileKey: artifactKey
      }),
      ...update.set
    }),
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
      getObject: async () => {
        throw new Error("not used");
      },
      deleteObject: async () => {}
    },
    enqueueEmailJob: async (input) => {
      emailJobs += 1;
      assert.equal(input.type, "export-email");
      assert.equal(input.payload.notificationEmail, "owner@example.com");
    },
    now: () => now
  });

  await handler(
    makeJob({
      payload: {
        exportId: exportId.toString(),
        ownerId: ownerId.toString(),
        petId: petId.toString(),
        artifactId: artifactId.toString(),
        dataHash,
        generation: 0,
        sections: ["profile"],
        notificationEmail: "owner@example.com"
      }
    })
  );

  assert.equal(renders, 0);
  assert.equal(uploads, 0);
  assert.equal(emailJobs, 1);
  assert.equal(record.status, "ready");
});

test("pet-export handler skips email when the job payload has no notificationEmail", async () => {
  let record = makeRecord({ artifactId, dataHash });
  let artifact = makeArtifact();
  let emailJobs = 0;

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      record = { ...record, ...update.set };
      return record;
    },
    findArtifactById: async () => artifact,
    claimArtifactForRender: async (_id, _owner, _generation, _now, claimExpiresAt) => {
      artifact = { ...artifact, status: "processing", renderClaimExpiresAt: claimExpiresAt };
      return artifact;
    },
    updateArtifactRecord: async (_id, _owner, update) => {
      artifact = { ...artifact, ...update.set };
      if (update.unset && "renderClaimExpiresAt" in update.unset) artifact.renderClaimExpiresAt = undefined;
      return artifact;
    },
    markExportsForArtifactReady: async () => {},
    findPet: async () => makePet(),
    buildReport: async (input) => ({
      exportId: input.exportId.toString(),
      ownerId: input.ownerId.toString(),
      petId: input.petId.toString(),
      generatedAt: input.generatedAt.toISOString(),
      sections: input.sections
    }),
    renderTemplate: async () => ({ html: "<html>Miso</html>" }),
    renderPdf: async () => Buffer.from("%PDF-rendered"),
    storage: {
      putObject: async () => {},
      getObject: async () => {
        throw new Error("not used");
      },
      deleteObject: async () => {}
    },
    enqueueEmailJob: async () => {
      emailJobs += 1;
    },
    now: () => now
  });

  await handler(
    makeJob({
      payload: {
        exportId: exportId.toString(),
        ownerId: ownerId.toString(),
        petId: petId.toString(),
        artifactId: artifactId.toString(),
        dataHash,
        generation: 0,
        period: { from: "2026-05-01", to: "2026-05-31" },
        sections: ["profile"]
      }
    })
  );

  assert.equal(record.status, "ready");
  assert.equal(record.emailSentAt, undefined);
  assert.equal(emailJobs, 0);
});

test("pet-export handler retries retryable Gotenberg failures and marks export failed on final attempt", async () => {
  let record = makeRecord({ artifactId, dataHash });
  let artifact = makeArtifact();

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      record = { ...record, ...update.set };
      return record;
    },
    findArtifactById: async () => artifact,
    claimArtifactForRender: async (_id, _owner, _generation, _now, claimExpiresAt) => {
      artifact = { ...artifact, status: "processing", renderClaimExpiresAt: claimExpiresAt };
      return artifact;
    },
    updateArtifactRecord: async (_id, _owner, update) => {
      artifact = { ...artifact, ...update.set };
      if (update.unset && "renderClaimExpiresAt" in update.unset) {
        artifact.renderClaimExpiresAt = undefined;
      }
      return artifact;
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
  assert.equal(artifact.status, "failed");
  assert.equal(artifact.renderClaimExpiresAt, undefined);
  assert.match(record.lastError ?? "", /service unavailable/);
});

test("pet-export handler fail-fast marks export failed for non-retryable Gotenberg errors", async () => {
  let record = makeRecord({ artifactId, dataHash });
  let artifact = makeArtifact();
  let uploaded = false;

  const handler = createPetExportJobHandler({
    findExportById: async () => record,
    updateExportRecord: async (_id, _owner, update) => {
      record = { ...record, ...update.set };
      return record;
    },
    findArtifactById: async () => artifact,
    claimArtifactForRender: async (_id, _owner, _generation, _now, claimExpiresAt) => {
      artifact = { ...artifact, status: "processing", renderClaimExpiresAt: claimExpiresAt };
      return artifact;
    },
    updateArtifactRecord: async (_id, _owner, update) => {
      artifact = { ...artifact, ...update.set };
      return artifact;
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

test("pet-export handler does not enqueue email when emailSentAt is already set", async () => {
  let record = makeRecord({
    status: "ready",
    fileKey: artifactKey,
    emailSentAt: now
  });
  let renders = 0;
  let uploads = 0;
  let emailJobs = 0;

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
      getObject: async () => {
        throw new Error("not used");
      },
      deleteObject: async () => {}
    },
    enqueueEmailJob: async () => {
      emailJobs += 1;
    },
    now: () => now
  });

  await handler(makeJob({ payload: { ...makeJob().payload, notificationEmail: "owner@example.com" } }));

  assert.equal(renders, 0);
  assert.equal(uploads, 0);
  assert.equal(emailJobs, 0);
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

test("pet export template renders compact timeline cards and clickable file links", async () => {
  const eventId = "607f1f77bcf86cd799439088";
  const fileId = "607f1f77bcf86cd799439099";

  const { html } = await renderPetExportTemplate({
    exportId: exportId.toString(),
    ownerId: ownerId.toString(),
    petId: petId.toString(),
    generatedAt: now.toISOString(),
    sections: ["profile", "events", "files"],
    profile: {
      id: petId.toString(),
      name: "Baron",
      species: "dog",
      breed: "Labrador Retriever",
      birthDate: "2021-04-12",
      sex: "male",
      weight: 28.5,
      microchipNumber: "123456789012345",
      tags: ["active"],
      notes: ["Mild grain allergy."],
      vetContact: { name: "Dr. Anna Volkova", email: "anna@example.test" }
    },
    events: [
      {
        id: eventId,
        type: "vaccine",
        title: "Rabies booster",
        eventDate: "2024-08-15T00:00:00.000Z",
        clinicName: "City Vet Clinic",
        comment: "Annual booster.",
        fileIds: [fileId]
      }
    ],
    files: [
      {
        id: fileId,
        eventId,
        originalName: "rabies-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: 840_000,
        uploadedAt: "2024-08-15T10:00:00.000Z",
        eventTitle: "Rabies booster",
        downloadUrl: "https://download.example/rabies-certificate.pdf"
      }
    ]
  });

  assert.match(html, /Microchip 123456789012345/);
  assert.doesNotMatch(html, /years old/i);
  assert.doesNotMatch(html, /Veterinarian|Dr\. Anna Volkova/);
  assert.match(html, /<article class="tl-event past">/);
  assert.match(html, /break-inside: avoid/);
  assert.match(html, /page-break-inside: avoid/);
  assert.match(html, /<a class="file-chip" href="https:\/\/download\.example\/rabies-certificate\.pdf">/);
  assert.match(html, /<td><a href="https:\/\/download\.example\/rabies-certificate\.pdf">rabies-certificate\.pdf<\/a><\/td>/);
});
