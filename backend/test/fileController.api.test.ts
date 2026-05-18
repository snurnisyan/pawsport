/**
 * HTTP-level tests for pet file routes.
 *
 * Keeps auth, Express query parsing, async handling and error formatting in
 * the loop while stubbing the domain service.
 */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import http from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

import { env } from "../src/config/env";
import {
  listPetFilesHandler,
  uploadPetFileHandler,
  uploadPetPhotoHandler,
  type ListPetFilesHandlerDependencies,
  type UploadPetFileHandlerDependencies,
  type UploadPetPhotoHandlerDependencies
} from "../src/controllers/fileController";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { errorHandler } from "../src/middleware/errorHandler";
import { upload } from "../src/middleware/uploadMiddleware";

const USER_ID = "507f1f77bcf86cd799439011";
const PET_ID = "60a7c1aa9e1d4f1234567890";
const FILE_ID = "60a7c1aa9e1d4f12345678cd";

const token = jwt.sign({ sub: USER_ID, email: "user@example.com" }, env.JWT_SECRET);

const buildApp = (overrides: ListPetFilesHandlerDependencies = {}): express.Express => {
  const app = express();
  app.get("/pets/:id/files", authMiddleware, listPetFilesHandler(overrides));
  app.use(errorHandler);
  return app;
};

const withServer = async <T>(
  overrides: ListPetFilesHandlerDependencies,
  fn: (baseUrl: string) => Promise<T>
): Promise<T> => {
  const server = http.createServer(buildApp(overrides));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const buildUploadApp = (overrides: UploadPetFileHandlerDependencies = {}): express.Express => {
  const app = express();
  app.post("/pets/:id/files", authMiddleware, upload.single("file"), uploadPetFileHandler(overrides));
  app.use(errorHandler);
  return app;
};

const withUploadServer = async <T>(
  overrides: UploadPetFileHandlerDependencies,
  fn: (baseUrl: string) => Promise<T>
): Promise<T> => {
  const server = http.createServer(buildUploadApp(overrides));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const fakeFile = () => ({
  id: FILE_ID,
  ownerId: USER_ID,
  petId: PET_ID,
  originalName: "vet report.pdf",
  mimeType: "application/pdf" as const,
  sizeBytes: 11,
  uploadedAt: "2026-05-12T10:00:00.000Z",
  createdAt: "2026-05-12T00:00:00.000Z",
  updatedAt: "2026-05-12T00:00:00.000Z"
});

const authHeader = (): HeadersInit => ({ Authorization: `Bearer ${token}` });

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z",
  "base64"
);

const bufferToBlob = (buffer: Buffer, mimetype: string): Blob => {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return new Blob([bytes], { type: mimetype });
};

test("GET /pets/:id/files forwards optional from/to filters", async () => {
  let receivedOwnerId: string | undefined;
  let receivedPetId: string | undefined;
  let receivedQuery: Record<string, unknown> | undefined;

  await withServer(
    {
      listPetFiles: async (ownerId, petId, query) => {
        receivedOwnerId = ownerId;
        receivedPetId = petId;
        receivedQuery = query as Record<string, unknown>;
        return [fakeFile()];
      }
    },
    async (baseUrl) => {
      const params = new URLSearchParams([
        ["from", "2026-05-01"],
        ["to", "2026-05-31"]
      ]);

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/files?${params.toString()}`, {
        headers: authHeader()
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as { items: Array<{ id: string }> };
      assert.equal(body.items[0].id, FILE_ID);
    }
  );

  assert.equal(receivedOwnerId, USER_ID);
  assert.equal(receivedPetId, PET_ID);
  assert.deepEqual(receivedQuery, { from: "2026-05-01", to: "2026-05-31" });
});

test("POST /pets/:id/files forwards temporaryForEvent but not eventId", async () => {
  let uploadCall:
    | {
        ownerId: string;
        petId: string;
        temporaryForEvent?: unknown;
        file?: { mimetype: string; originalname: string };
      }
    | undefined;

  await withUploadServer(
    {
      uploadPetFile: async (ownerId, petId, input) => {
        uploadCall = {
          ownerId,
          petId,
          temporaryForEvent: input.temporaryForEvent,
          file: input.file
            ? {
                mimetype: input.file.mimetype,
                originalname: input.file.originalname
              }
            : undefined
        };
        return fakeFile();
      }
    },
    async (baseUrl) => {
      const form = new FormData();
      form.append("file", bufferToBlob(Buffer.from("pdf"), "application/pdf"), "draft.pdf");
      form.append("eventId", "60a7c1aa9e1d4f12345678ab");
      form.append("temporaryForEvent", "true");

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/files`, {
        method: "POST",
        headers: authHeader(),
        body: form
      });

      assert.equal(res.status, 201);
    }
  );

  assert.deepEqual(uploadCall, {
    ownerId: USER_ID,
    petId: PET_ID,
    temporaryForEvent: "true",
    file: { mimetype: "application/pdf", originalname: "draft.pdf" }
  });
});

const buildPhotoApp = (overrides: UploadPetPhotoHandlerDependencies = {}): express.Express => {
  const app = express();
  app.post("/pets/:id/photo", authMiddleware, upload.single("file"), uploadPetPhotoHandler(overrides));
  app.use(errorHandler);
  return app;
};

const withPhotoServer = async <T>(
  overrides: UploadPetPhotoHandlerDependencies,
  fn: (baseUrl: string) => Promise<T>
): Promise<T> => {
  const server = http.createServer(buildPhotoApp(overrides));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

test("POST /pets/:id/photo replaces photoFileId with signed photoUrl", async () => {
  const signedUrl = "https://s3.example.com/pawsport/users/u/pets/p/files/f/cooper.jpg?X-Amz-Signature=abc";
  let uploadCall: { ownerId: string; petId: string; file?: { mimetype: string } } | undefined;

  await withPhotoServer(
    {
      uploadPetPhoto: async (ownerId, petId, input) => {
        uploadCall = {
          ownerId,
          petId,
          file: input.file ? { mimetype: input.file.mimetype } : undefined
        };
        return {
          file: {
            ...fakeFile(),
            originalName: "cooper.jpg",
            mimeType: "image/jpeg",
            sizeBytes: TINY_JPEG.length
          },
          pet: { __stub: "pet-record" } as unknown as Parameters<
            NonNullable<UploadPetPhotoHandlerDependencies["serializePet"]>
          >[0]
        };
      },
      serializePet: () => ({
        id: PET_ID,
        ownerId: USER_ID,
        name: "Cooper",
        species: "dog",
        sex: "male" as const,
        tags: [],
        notes: [],
        photoFileId: FILE_ID,
        createdAt: "2026-05-12T10:00:00.000Z",
        updatedAt: "2026-05-12T10:00:00.000Z"
      }),
      resolvePetPhotoUrl: async () => signedUrl
    },
    async (baseUrl) => {
      const form = new FormData();
      form.append("file", bufferToBlob(TINY_JPEG, "image/jpeg"), "cooper.jpg");

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/photo`, {
        method: "POST",
        headers: authHeader(),
        body: form
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as {
        pet: { id: string; photoFileId?: string; photoUrl?: string };
        file: { id: string };
      };
      assert.equal(body.file.id, FILE_ID);
      assert.equal(body.pet.id, PET_ID);
      assert.equal(body.pet.photoFileId, undefined);
      assert.equal(body.pet.photoUrl, signedUrl);
    }
  );

  assert.equal(uploadCall?.ownerId, USER_ID);
  assert.equal(uploadCall?.petId, PET_ID);
  assert.equal(uploadCall?.file?.mimetype, "image/jpeg");
});
