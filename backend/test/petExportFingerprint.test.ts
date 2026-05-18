import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { buildPetExportFingerprint } from "../src/services/petExportFingerprint";
import type { BuildPetExportReportDependencies, PetRecord } from "../src/services/petExportReport";
import type { ExportSection } from "../src/models/Export";
import type { EventType } from "../src/models/Event";

const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
const petId = new Types.ObjectId("507f1f77bcf86cd799439022");
const eventId = new Types.ObjectId("507f1f77bcf86cd799439033");
const fileId = new Types.ObjectId("507f1f77bcf86cd799439044");
const reminderId = new Types.ObjectId("507f1f77bcf86cd799439055");
const now = new Date("2026-05-14T10:00:00.000Z");

const makePet = (overrides: Partial<PetRecord> = {}): PetRecord => ({
  _id: petId,
  ownerId,
  name: "Miso",
  species: "cat",
  breed: "Siberian",
  birthDate: new Date("2020-01-02T00:00:00.000Z"),
  sex: "female",
  weight: 4.2,
  microchipNumber: "123456789012345",
  tags: ["indoor"],
  notes: ["likes travel"],
  vetContact: { name: "Dr. Smith", email: "vet@example.com" },
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const makeDependencies = (
  overrides: {
    eventTitle?: string;
    fileName?: string;
    reminderStatus?: "pending" | "sent" | "failed" | "cancelled";
    reverseOrder?: boolean;
  } = {}
): BuildPetExportReportDependencies => {
  const event = {
    _id: eventId,
    ownerId,
    petId,
    type: "vaccine" as const,
    title: overrides.eventTitle ?? "Rabies booster",
    eventDate: new Date("2026-01-10T00:00:00.000Z"),
    fileIds: [fileId],
    createdAt: now,
    updatedAt: now
  };
  const laterEvent = {
    ...event,
    _id: new Types.ObjectId("507f1f77bcf86cd799439066"),
    title: "Annual check",
    eventDate: new Date("2026-02-10T00:00:00.000Z"),
    fileIds: []
  };
  const file = {
    _id: fileId,
    ownerId,
    petId,
    eventId,
    originalName: overrides.fileName ?? "rabies-certificate.pdf",
    mimeType: "application/pdf" as const,
    sizeBytes: 840_000,
    storageKey: "users/o/p/files/rabies-certificate.pdf",
    uploadedAt: new Date("2026-01-11T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now
  };
  const laterFile = {
    ...file,
    _id: new Types.ObjectId("507f1f77bcf86cd799439077"),
    originalName: "visit-notes.pdf",
    storageKey: "users/o/p/files/visit-notes.pdf",
    uploadedAt: new Date("2026-02-11T00:00:00.000Z")
  };
  const reminder = {
    _id: reminderId,
    ownerId,
    petId,
    eventId,
    channel: "email" as const,
    dueAt: new Date("2026-01-10T00:00:00.000Z"),
    sendAt: new Date("2026-01-03T00:00:00.000Z"),
    offset: "week" as const,
    status: overrides.reminderStatus ?? ("pending" as const),
    createdAt: now,
    updatedAt: now
  };

  return {
    listEventsForPet: async () => (overrides.reverseOrder ? [laterEvent, event] : [event, laterEvent]),
    listFileMetadataForPet: async () => (overrides.reverseOrder ? [laterFile, file] : [file, laterFile]),
    listRemindersForPet: async () => [reminder]
  };
};

const hashFor = async (
  options: {
    pet?: PetRecord;
    sections?: ExportSection[];
    eventTypes?: EventType[];
    dependencies?: BuildPetExportReportDependencies;
  } = {}
) =>
  buildPetExportFingerprint(
    {
      ownerId,
      petId,
      pet: options.pet ?? makePet(),
      period: {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-05-31T00:00:00.000Z")
      },
      sections: options.sections ?? ["profile", "events", "files", "reminders"],
      eventTypes: options.eventTypes ?? ["vaccine"]
    },
    options.dependencies ?? makeDependencies()
  );

test("pet export fingerprint is deterministic and excludes transient delivery fields", async () => {
  const first = await hashFor();
  const sameDataDifferentOrder = await hashFor({ dependencies: makeDependencies({ reverseOrder: true }) });

  assert.equal(first.dataHash, sameDataDifferentOrder.dataHash);
  assert.doesNotMatch(JSON.stringify(first.canonicalData), /downloadUrl|generatedAt|exportId/);
});

test("pet export fingerprint treats filter order as canonical", async () => {
  const first = await hashFor({
    sections: ["profile", "events", "files", "reminders"],
    eventTypes: ["vaccine", "lab"]
  });
  const reordered = await hashFor({
    sections: ["reminders", "files", "events", "profile"],
    eventTypes: ["lab", "vaccine"]
  });

  assert.equal(first.dataHash, reordered.dataHash);
});

test("pet export fingerprint changes with PDF-relevant data and filters", async () => {
  const base = await hashFor();

  const changedPet = await hashFor({ pet: makePet({ name: "Miso Jr." }) });
  const changedEvent = await hashFor({ dependencies: makeDependencies({ eventTitle: "Updated rabies" }) });
  const changedFile = await hashFor({ dependencies: makeDependencies({ fileName: "updated.pdf" }) });
  const changedReminder = await hashFor({
    dependencies: makeDependencies({ reminderStatus: "sent" })
  });
  const changedSections = await hashFor({ sections: ["profile", "events"] });
  const changedEventTypes = await hashFor({ eventTypes: ["vaccine", "lab"] });

  assert.notEqual(changedPet.dataHash, base.dataHash);
  assert.notEqual(changedEvent.dataHash, base.dataHash);
  assert.notEqual(changedFile.dataHash, base.dataHash);
  assert.notEqual(changedReminder.dataHash, base.dataHash);
  assert.notEqual(changedSections.dataHash, base.dataHash);
  assert.notEqual(changedEventTypes.dataHash, base.dataHash);
});
