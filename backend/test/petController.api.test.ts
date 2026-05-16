/**
 * HTTP-level tests for the pet creation controller.
 *
 * Pattern (re-use for future controller tests):
 *   - Build a minimal Express app mounting the route under test with stubbed
 *     dependencies. Production wiring (real services + Mongo + S3) is not
 *     touched: dependencies flow in via the controller's factory.
 *   - Start a real ephemeral HTTP server with `http.createServer` so we can
 *     exercise multer, the JSON body parser, the auth middleware and the error
 *     handler exactly the way production does.
 *   - Sign a JWT with `env.JWT_SECRET` to authenticate; no DB user is needed
 *     because authMiddleware only verifies the signature.
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
  createPetHandler,
  getPetHandler,
  type CreatePetHandlerDependencies,
  type GetPetHandlerDependencies
} from "../src/controllers/petController";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { errorHandler } from "../src/middleware/errorHandler";
import { multipartOnly } from "../src/middleware/multipartOnly";
import { upload } from "../src/middleware/uploadMiddleware";
import { AppError } from "../src/middleware/errorHandler";

const USER_ID = "507f1f77bcf86cd799439011";
const PET_ID = "60a7c1aa9e1d4f1234567890";
const FILE_ID = "60a7c1aa9e1d4f12345678cd";

const token = jwt.sign({ sub: USER_ID, email: "user@example.com" }, env.JWT_SECRET);

const buildApp = (overrides: CreatePetHandlerDependencies = {}): express.Express => {
  const app = express();
  app.use(express.json());
  app.post(
    "/pets",
    authMiddleware,
    multipartOnly(upload.single("photo")),
    createPetHandler(overrides)
  );
  app.use(errorHandler);
  return app;
};

const withServer = async <T>(
  overrides: CreatePetHandlerDependencies,
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

const fakeSerializedPet = (overrides: Record<string, unknown> = {}) => ({
  id: PET_ID,
  ownerId: USER_ID,
  name: "Cooper",
  species: "dog",
  sex: "male" as const,
  tags: [],
  notes: [],
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T10:00:00.000Z",
  ...overrides
});

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z",
  "base64"
);

const bufferToBlob = (buffer: Buffer, mimetype: string): Blob => {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return new Blob([bytes], { type: mimetype });
};

const authHeader = (): HeadersInit => ({ Authorization: `Bearer ${token}` });

test("POST /pets (JSON) calls createPet and returns the serialized pet", async () => {
  let createPetCall: { ownerId: string; input: unknown } | undefined;
  let uploadCalled = false;

  await withServer(
    {
      createPet: async (ownerId, input) => {
        createPetCall = { ownerId, input };
        return fakeSerializedPet();
      },
      uploadPetPhoto: async () => {
        uploadCalled = true;
        throw new Error("uploadPetPhoto must not be called on the JSON path");
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/pets`, {
        method: "POST",
        headers: { ...authHeader(), "content-type": "application/json" },
        body: JSON.stringify({ name: "Cooper", species: "dog", sex: "male" })
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as { pet: { id: string; name: string } };
      assert.equal(body.pet.id, PET_ID);
      assert.equal(body.pet.name, "Cooper");
    }
  );

  assert.equal(uploadCalled, false);
  assert.deepEqual(createPetCall?.input, { name: "Cooper", species: "dog", sex: "male" });
  assert.equal(createPetCall?.ownerId, USER_ID);
});

test("POST /pets (multipart) parses pet JSON, uploads photo, returns serialized pet", async () => {
  const calls: string[] = [];
  let parsedInput: unknown;
  let uploadCall: { ownerId: string; petId: string; file?: { mimetype: string } } | undefined;

  await withServer(
    {
      createPet: async (_ownerId, input) => {
        parsedInput = input;
        calls.push("createPet");
        return fakeSerializedPet();
      },
      uploadPetPhoto: async (ownerId, petId, input) => {
        uploadCall = { ownerId, petId, file: input.file ? { mimetype: input.file.mimetype } : undefined };
        calls.push("uploadPetPhoto");
        return {
          file: {
            id: FILE_ID,
            ownerId,
            petId,
            originalName: "cooper.jpg",
            mimeType: "image/jpeg",
            sizeBytes: TINY_JPEG.length,
            uploadedAt: "2026-05-12T10:00:00.000Z",
            createdAt: "2026-05-12T10:00:00.000Z",
            updatedAt: "2026-05-12T10:00:00.000Z"
          },
          // Cast through unknown — the controller passes this straight to serializePet,
          // which we also stub to avoid pulling a Pet document type into the test.
          pet: { __stub: "pet-record" } as unknown as Parameters<
            NonNullable<CreatePetHandlerDependencies["serializePet"]>
          >[0]
        };
      },
      serializePet: () => {
        calls.push("serializePet");
        return fakeSerializedPet({ photoFileId: FILE_ID });
      },
      deletePet: async () => {
        calls.push("deletePet");
        throw new Error("deletePet must not be called on success");
      }
    },
    async (baseUrl) => {
      const form = new FormData();
      form.append("pet", JSON.stringify({ name: "Cooper", species: "dog", sex: "male" }));
      form.append("photo", bufferToBlob(TINY_JPEG, "image/jpeg"), "cooper.jpg");

      const res = await fetch(`${baseUrl}/pets`, {
        method: "POST",
        headers: authHeader(),
        body: form
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as { pet: { id: string; photoFileId?: string } };
      assert.equal(body.pet.id, PET_ID);
      assert.equal(body.pet.photoFileId, FILE_ID);
    }
  );

  assert.deepEqual(calls, ["createPet", "uploadPetPhoto", "serializePet"]);
  assert.deepEqual(parsedInput, { name: "Cooper", species: "dog", sex: "male" });
  assert.equal(uploadCall?.ownerId, USER_ID);
  assert.equal(uploadCall?.petId, PET_ID);
  assert.equal(uploadCall?.file?.mimetype, "image/jpeg");
});

test("POST /pets (multipart) returns 400 when pet JSON also contains photoFileId", async () => {
  let createPetCalled = false;
  let uploadCalled = false;

  await withServer(
    {
      createPet: async () => {
        createPetCalled = true;
        return fakeSerializedPet();
      },
      uploadPetPhoto: async () => {
        uploadCalled = true;
        throw new Error("uploadPetPhoto must not be called when the conflict fires");
      }
    },
    async (baseUrl) => {
      const form = new FormData();
      form.append(
        "pet",
        JSON.stringify({ name: "Cooper", species: "dog", photoFileId: FILE_ID })
      );
      form.append("photo", bufferToBlob(TINY_JPEG, "image/jpeg"), "cooper.jpg");

      const res = await fetch(`${baseUrl}/pets`, {
        method: "POST",
        headers: authHeader(),
        body: form
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "PHOTO_FILE_ID_CONFLICT");
    }
  );

  assert.equal(createPetCalled, false);
  assert.equal(uploadCalled, false);
});

test("POST /pets (multipart) returns 400 when pet field is not valid JSON", async () => {
  let createPetCalled = false;

  await withServer(
    {
      createPet: async () => {
        createPetCalled = true;
        return fakeSerializedPet();
      }
    },
    async (baseUrl) => {
      const form = new FormData();
      form.append("pet", "{not json");
      form.append("photo", bufferToBlob(TINY_JPEG, "image/jpeg"), "cooper.jpg");

      const res = await fetch(`${baseUrl}/pets`, {
        method: "POST",
        headers: authHeader(),
        body: form
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "INVALID_PET_PAYLOAD");
    }
  );

  assert.equal(createPetCalled, false);
});

test("POST /pets (multipart) rolls the pet back when photo upload fails", async () => {
  const calls: string[] = [];
  let deletePetCall: { ownerId: string; petId: string } | undefined;

  await withServer(
    {
      createPet: async () => {
        calls.push("createPet");
        return fakeSerializedPet();
      },
      uploadPetPhoto: async () => {
        calls.push("uploadPetPhoto");
        throw new AppError(502, "FILE_STORAGE_PUT_FAILED", "S3 unreachable");
      },
      deletePet: async (ownerId, petId) => {
        deletePetCall = { ownerId, petId };
        calls.push("deletePet");
      }
    },
    async (baseUrl) => {
      const form = new FormData();
      form.append("pet", JSON.stringify({ name: "Cooper", species: "dog" }));
      form.append("photo", bufferToBlob(TINY_JPEG, "image/jpeg"), "cooper.jpg");

      const res = await fetch(`${baseUrl}/pets`, {
        method: "POST",
        headers: authHeader(),
        body: form
      });
      assert.equal(res.status, 502);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "FILE_STORAGE_PUT_FAILED");
    }
  );

  assert.deepEqual(calls, ["createPet", "uploadPetPhoto", "deletePet"]);
  assert.equal(deletePetCall?.ownerId, USER_ID);
  assert.equal(deletePetCall?.petId, PET_ID);
});

test("POST /pets (multipart) still fails 502 even if rollback throws", async () => {
  await withServer(
    {
      createPet: async () => fakeSerializedPet(),
      uploadPetPhoto: async () => {
        throw new AppError(502, "FILE_STORAGE_PUT_FAILED", "S3 unreachable");
      },
      deletePet: async () => {
        throw new Error("rollback also exploded");
      }
    },
    async (baseUrl) => {
      const form = new FormData();
      form.append("pet", JSON.stringify({ name: "Cooper", species: "dog" }));
      form.append("photo", bufferToBlob(TINY_JPEG, "image/jpeg"), "cooper.jpg");

      const res = await fetch(`${baseUrl}/pets`, {
        method: "POST",
        headers: authHeader(),
        body: form
      });
      assert.equal(res.status, 502);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "FILE_STORAGE_PUT_FAILED");
    }
  );
});

test("POST /pets returns 401 when Authorization header is missing", async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/pets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Cooper", species: "dog" })
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "UNAUTHORIZED");
  });
});

const buildGetApp = (overrides: GetPetHandlerDependencies = {}): express.Express => {
  const app = express();
  app.get("/pets/:id", authMiddleware, getPetHandler(overrides));
  app.use(errorHandler);
  return app;
};

const withGetServer = async <T>(
  overrides: GetPetHandlerDependencies,
  fn: (baseUrl: string) => Promise<T>
): Promise<T> => {
  const server = http.createServer(buildGetApp(overrides));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

test("GET /pets/:id returns serialized pet without photoUrl when pet has no photo", async () => {
  let resolveCalled = false;

  await withGetServer(
    {
      getPet: async (ownerId, petId) => {
        assert.equal(ownerId, USER_ID);
        assert.equal(petId, PET_ID);
        return fakeSerializedPet();
      },
      resolvePetPhotoUrl: async () => {
        resolveCalled = true;
        throw new Error("resolvePetPhotoUrl must not be called when pet has no photo");
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/pets/${PET_ID}`, { headers: authHeader() });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        pet: { id: string; photoFileId?: string; photoUrl?: string };
      };
      assert.equal(body.pet.id, PET_ID);
      assert.equal(body.pet.photoFileId, undefined);
      assert.equal(body.pet.photoUrl, undefined);
    }
  );

  assert.equal(resolveCalled, false);
});

test("GET /pets/:id replaces photoFileId with signed photoUrl when pet has a photo", async () => {
  const signedUrl = "https://s3.example.com/pawsport/users/u/pets/p/files/f/cooper.jpg?X-Amz-Signature=abc";
  let resolveCall: { ownerId: string; photoFileId: string; expires: number } | undefined;

  await withGetServer(
    {
      getPet: async () => fakeSerializedPet({ photoFileId: FILE_ID }),
      resolvePetPhotoUrl: async (ownerId, photoFileId, expiresInSeconds) => {
        resolveCall = { ownerId, photoFileId, expires: expiresInSeconds };
        return signedUrl;
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/pets/${PET_ID}`, { headers: authHeader() });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        pet: { id: string; photoFileId?: string; photoUrl?: string };
      };
      assert.equal(body.pet.id, PET_ID);
      assert.equal(body.pet.photoFileId, undefined);
      assert.equal(body.pet.photoUrl, signedUrl);
    }
  );

  assert.equal(resolveCall?.ownerId, USER_ID);
  assert.equal(resolveCall?.photoFileId, FILE_ID);
  // 7 days in seconds — the contract this controller commits to.
  assert.equal(resolveCall?.expires, 7 * 24 * 60 * 60);
});

test("GET /pets/:id omits photoUrl when the photo file record is missing", async () => {
  await withGetServer(
    {
      getPet: async () => fakeSerializedPet({ photoFileId: FILE_ID }),
      resolvePetPhotoUrl: async () => null
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/pets/${PET_ID}`, { headers: authHeader() });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        pet: { id: string; photoFileId?: string; photoUrl?: string };
      };
      assert.equal(body.pet.id, PET_ID);
      assert.equal(body.pet.photoFileId, undefined);
      assert.equal(body.pet.photoUrl, undefined);
    }
  );
});

test("GET /pets/:id surfaces service 404 unchanged", async () => {
  await withGetServer(
    {
      getPet: async () => {
        throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
      },
      resolvePetPhotoUrl: async () => {
        throw new Error("resolvePetPhotoUrl must not be called when pet lookup fails");
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/pets/${PET_ID}`, { headers: authHeader() });
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "PET_NOT_FOUND");
    }
  );
});

test("GET /pets/:id returns 401 when Authorization header is missing", async () => {
  await withGetServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/pets/${PET_ID}`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "UNAUTHORIZED");
  });
});

test("POST /pets rejects non-image uploads at the multer fileFilter (before controller runs)", async () => {
  let createPetCalled = false;

  await withServer(
    {
      createPet: async () => {
        createPetCalled = true;
        return fakeSerializedPet();
      }
    },
    async (baseUrl) => {
      const form = new FormData();
      form.append("pet", JSON.stringify({ name: "Cooper", species: "dog" }));
      form.append(
        "photo",
        bufferToBlob(Buffer.from("garbage"), "application/octet-stream"),
        "x.bin"
      );

      const res = await fetch(`${baseUrl}/pets`, {
        method: "POST",
        headers: authHeader(),
        body: form
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "UNSUPPORTED_FILE_TYPE");
    }
  );

  assert.equal(createPetCalled, false);
});
