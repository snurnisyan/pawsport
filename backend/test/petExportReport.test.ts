import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Types } from "mongoose";

import { buildPetExportReport } from "../src/services/petExportReport";
import type { FileStorage } from "../src/storage/s3Storage";

const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
const petId = new Types.ObjectId("507f1f77bcf86cd799439022");
const exportId = new Types.ObjectId("507f1f77bcf86cd799439033");
const photoFileId = new Types.ObjectId("507f1f77bcf86cd799439044");
const now = new Date("2026-05-14T10:00:00.000Z");

const makePet = () => ({
  _id: petId,
  ownerId,
  name: "Miso",
  species: "cat",
  photoFileId,
  sex: "female" as const,
  tags: [],
  notes: [],
  createdAt: now,
  updatedAt: now
});

const makeStorage = (body: Buffer): FileStorage => ({
  putObject: async () => {},
  getObject: async () => ({
    body: Readable.from(body),
    contentType: "image/png",
    contentLength: body.length
  }),
  deleteObject: async () => {}
});

test("buildPetExportReport inlines profile photo as a base64 data URI", async () => {
  const image = Buffer.from("fake-png");

  const report = await buildPetExportReport(
    {
      exportId,
      ownerId,
      petId,
      pet: makePet(),
      sections: ["profile"],
      generatedAt: now
    },
    {
      findPhotoFileForPet: async (file, owner, pet) => {
        assert.equal(file.toString(), photoFileId.toString());
        assert.equal(owner.toString(), ownerId.toString());
        assert.equal(pet.toString(), petId.toString());
        return {
          _id: photoFileId,
          originalName: "miso.png",
          mimeType: "image/png",
          sizeBytes: image.length,
          storageKey: "users/o/p/files/photo/miso.png"
        };
      },
      storage: makeStorage(image)
    }
  );

  assert.equal(report.profile?.photo?.src, `data:image/png;base64,${image.toString("base64")}`);
  assert.equal(report.profile?.photo?.originalName, "miso.png");
});

test("buildPetExportReport omits profile photo when storage cannot read it", async () => {
  const report = await buildPetExportReport(
    {
      exportId,
      ownerId,
      petId,
      pet: makePet(),
      sections: ["profile"],
      generatedAt: now
    },
    {
      findPhotoFileForPet: async () => ({
        _id: photoFileId,
        originalName: "miso.png",
        mimeType: "image/png",
        sizeBytes: 42,
        storageKey: "users/o/p/files/photo/miso.png"
      }),
      storage: {
        putObject: async () => {},
        getObject: async () => {
          throw new Error("s3 unavailable");
        },
        deleteObject: async () => {}
      }
    }
  );

  assert.equal(report.profile?.photo, undefined);
});

test("buildPetExportReport adds clickable download URLs to file metadata", async () => {
  const fileId = new Types.ObjectId("507f1f77bcf86cd799439055");
  const eventId = new Types.ObjectId("507f1f77bcf86cd799439066");

  const report = await buildPetExportReport(
    {
      exportId,
      ownerId,
      petId,
      pet: makePet(),
      sections: ["events", "files"],
      generatedAt: now
    },
    {
      listEventsForPet: async () => [
        {
          _id: eventId,
          ownerId,
          petId,
          type: "vaccine",
          title: "Rabies booster",
          eventDate: new Date("2026-01-10T00:00:00.000Z"),
          fileIds: [fileId],
          createdAt: now,
          updatedAt: now
        }
      ],
      listFileMetadataForPet: async () => [
        {
          _id: fileId,
          ownerId,
          petId,
          eventId,
          originalName: "rabies-certificate.pdf",
          mimeType: "application/pdf",
          sizeBytes: 840_000,
          storageKey: "users/o/p/files/rabies-certificate.pdf",
          uploadedAt: new Date("2026-01-11T00:00:00.000Z"),
          createdAt: now,
          updatedAt: now
        }
      ],
      getFileDownloadUrl: (key) => `https://download.example/${key}`
    }
  );

  assert.equal(report.files?.[0]?.downloadUrl, "https://download.example/users/o/p/files/rabies-certificate.pdf");
  assert.equal(report.files?.[0]?.eventTitle, "Rabies booster");
});

test("buildPetExportReport excludes the current pet photo from file metadata", async () => {
  const documentFileId = new Types.ObjectId("507f1f77bcf86cd799439077");

  const report = await buildPetExportReport(
    {
      exportId,
      ownerId,
      petId,
      pet: makePet(),
      sections: ["files"],
      generatedAt: now
    },
    {
      listFileMetadataForPet: async () => [
        {
          _id: photoFileId,
          ownerId,
          petId,
          originalName: "miso.png",
          mimeType: "image/png",
          sizeBytes: 42,
          storageKey: "users/o/p/files/photo/miso.png",
          uploadedAt: new Date("2026-01-10T00:00:00.000Z"),
          createdAt: now,
          updatedAt: now
        },
        {
          _id: documentFileId,
          ownerId,
          petId,
          originalName: "vet-report.pdf",
          mimeType: "application/pdf",
          sizeBytes: 840_000,
          storageKey: "users/o/p/files/vet-report.pdf",
          uploadedAt: new Date("2026-01-11T00:00:00.000Z"),
          createdAt: now,
          updatedAt: now
        }
      ],
      getFileDownloadUrl: (key) => `https://download.example/${key}`
    }
  );

  assert.deepEqual(
    report.files?.map((file) => file.originalName),
    ["vet-report.pdf"]
  );
});

test("buildPetExportReport passes selected event types to event listing", async () => {
  let observedEventTypes: unknown;

  const report = await buildPetExportReport(
    {
      exportId,
      ownerId,
      petId,
      pet: makePet(),
      sections: ["events"],
      eventTypes: ["vaccine", "lab", "other"],
      generatedAt: now
    },
    {
      listEventsForPet: async (_owner, _pet, _range, eventTypes) => {
        observedEventTypes = eventTypes;
        return [];
      }
    }
  );

  assert.deepEqual(observedEventTypes, ["vaccine", "lab", "other"]);
  assert.deepEqual(report.eventTypes, ["vaccine", "lab", "other"]);
});
