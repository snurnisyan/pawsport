/**
 * HTTP-level tests for pet event routes.
 *
 * Keeps auth, Express query parsing, async handling and error formatting in
 * the loop while stubbing the domain service.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

import { env } from "../src/config/env";
import {
  createPetEventHandler,
  type CreatePetEventHandlerDependencies,
  listPetEventsHandler,
  type ListPetEventsHandlerDependencies,
  updateEventHandler,
  type UpdateEventHandlerDependencies
} from "../src/controllers/eventController";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { errorHandler } from "../src/middleware/errorHandler";
import { multipartOnly } from "../src/middleware/multipartOnly";
import { upload } from "../src/middleware/uploadMiddleware";

const USER_ID = "507f1f77bcf86cd799439011";
const PET_ID = "60a7c1aa9e1d4f1234567890";
const EVENT_ID = "60a7c1aa9e1d4f12345678ab";

const token = jwt.sign({ sub: USER_ID, email: "user@example.com" }, env.JWT_SECRET);

const buildApp = (overrides: ListPetEventsHandlerDependencies = {}): express.Express => {
  const app = express();
  app.get("/pets/:id/events", authMiddleware, listPetEventsHandler(overrides));
  app.use(errorHandler);
  return app;
};

const buildCreateApp = (
  overrides: CreatePetEventHandlerDependencies = {}
): express.Express => {
  const app = express();
  app.use(express.json());
  app.post(
    "/pets/:id/events",
    authMiddleware,
    multipartOnly(upload.array("files")),
    createPetEventHandler(overrides)
  );
  app.use(errorHandler);
  return app;
};

const buildUpdateApp = (
  overrides: UpdateEventHandlerDependencies = {}
): express.Express => {
  const app = express();
  app.use(express.json());
  app.patch(
    "/events/:id",
    authMiddleware,
    multipartOnly(upload.array("files")),
    updateEventHandler(overrides)
  );
  app.use(errorHandler);
  return app;
};

const withServer = async <T>(
  overrides: ListPetEventsHandlerDependencies,
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

const withCreateServer = async <T>(
  overrides: CreatePetEventHandlerDependencies,
  fn: (baseUrl: string) => Promise<T>
): Promise<T> => {
  const server = http.createServer(buildCreateApp(overrides));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const withUpdateServer = async <T>(
  overrides: UpdateEventHandlerDependencies,
  fn: (baseUrl: string) => Promise<T>
): Promise<T> => {
  const server = http.createServer(buildUpdateApp(overrides));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const fakeEvent = () => ({
  id: EVENT_ID,
  ownerId: USER_ID,
  petId: PET_ID,
  type: "vaccine" as const,
  title: "Rabies booster",
  eventDate: "2026-05-12T10:00:00.000Z",
  files: [],
  createdAt: "2026-05-12T00:00:00.000Z",
  updatedAt: "2026-05-12T00:00:00.000Z"
});

const fakeEventWithFiles = () => ({
  ...fakeEvent(),
  files: [{ fileId: "60a7c1aa9e1d4f12345678aa", originalName: "old.pdf" }]
});

const authHeader = (): HeadersInit => ({ Authorization: `Bearer ${token}` });

const validEventPayload = () => ({
  type: "vaccine",
  subtype: "rabies",
  title: "Rabies booster",
  eventDate: "2026-05-12T10:00:00.000Z"
});

test("GET /pets/:id/events forwards optional from/to filters", async () => {
  let receivedOwnerId: string | undefined;
  let receivedPetId: string | undefined;
  let receivedQuery: Record<string, unknown> | undefined;

  await withServer(
    {
      listPetEvents: async (ownerId, petId, query) => {
        receivedOwnerId = ownerId;
        receivedPetId = petId;
        receivedQuery = query as Record<string, unknown>;
        return [fakeEvent()];
      }
    },
    async (baseUrl) => {
      const params = new URLSearchParams([
        ["from", "2026-05-01"],
        ["to", "2026-05-31"]
      ]);

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/events?${params.toString()}`, {
        headers: authHeader()
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as { items: Array<{ id: string }> };
      assert.equal(body.items[0].id, EVENT_ID);
    }
  );

  assert.equal(receivedOwnerId, USER_ID);
  assert.equal(receivedPetId, PET_ID);
  assert.deepEqual(receivedQuery, { from: "2026-05-01", to: "2026-05-31" });
});

test("GET /pets/:id/events forwards optional nextDateFrom filter", async () => {
  let receivedQuery: Record<string, unknown> | undefined;

  await withServer(
    {
      listPetEvents: async (_ownerId, _petId, query) => {
        receivedQuery = query as Record<string, unknown>;
        return [fakeEvent()];
      }
    },
    async (baseUrl) => {
      const params = new URLSearchParams([
        ["nextDateFrom", "2026-05-17T10:30:00.000Z"]
      ]);

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/events?${params.toString()}`, {
        headers: authHeader()
      });

      assert.equal(res.status, 200);
    }
  );

  assert.deepEqual(receivedQuery, { nextDateFrom: "2026-05-17T10:30:00.000Z" });
});

test("GET /pets/:id/events forwards optional eventTypes filters", async () => {
  let receivedQuery: Record<string, unknown> | undefined;

  await withServer(
    {
      listPetEvents: async (_ownerId, _petId, query) => {
        receivedQuery = query as Record<string, unknown>;
        return [fakeEvent()];
      }
    },
    async (baseUrl) => {
      const params = new URLSearchParams([
        ["eventTypes", "vaccine"],
        ["eventTypes", "lab"],
        ["eventTypes", "other"]
      ]);

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/events?${params.toString()}`, {
        headers: authHeader()
      });

      assert.equal(res.status, 200);
    }
  );

  assert.deepEqual(receivedQuery, { eventTypes: ["vaccine", "lab", "other"] });
});

test("POST /pets/:id/events (multipart) parses event JSON, uploads files, and attaches them", async () => {
  const fileIds = [
    "60a7c1aa9e1d4f12345678cd",
    "60a7c1aa9e1d4f12345678ce"
  ];
  let receivedEventInput: Record<string, unknown> | undefined;
  const uploaded: Array<{
    originalName?: string;
    mimeType?: string;
    eventId?: unknown;
  }> = [];
  let receivedUpdate: Record<string, unknown> | undefined;

  await withCreateServer(
    {
      createPetEvent: async (ownerId, petId, input) => {
        assert.equal(ownerId, USER_ID);
        assert.equal(petId, PET_ID);
        receivedEventInput = input as Record<string, unknown>;
        return fakeEvent();
      },
      uploadPetFile: async (ownerId, petId, input) => {
        assert.equal(ownerId, USER_ID);
        assert.equal(petId, PET_ID);
        uploaded.push({
          originalName: input.file?.originalname,
          mimeType: input.file?.mimetype,
          eventId: input.eventId
        });
        const id = fileIds[uploaded.length - 1];
        return {
          id,
          ownerId: USER_ID,
          petId: PET_ID,
          eventId: EVENT_ID,
          originalName: input.file?.originalname ?? "file",
          mimeType: input.file?.mimetype as "application/pdf" | "image/png" | "image/jpeg",
          sizeBytes: input.file?.size ?? 0,
          uploadedAt: "2026-05-12T00:00:00.000Z",
          createdAt: "2026-05-12T00:00:00.000Z",
          updatedAt: "2026-05-12T00:00:00.000Z"
        };
      },
      updateEvent: async (ownerId, eventId, input) => {
        assert.equal(ownerId, USER_ID);
        assert.equal(eventId, EVENT_ID);
        receivedUpdate = input as Record<string, unknown>;
        return {
          ...fakeEvent(),
          files: [
            { fileId: fileIds[0], originalName: "rabies.pdf" },
            { fileId: fileIds[1], originalName: "result.png" }
          ]
        };
      }
    },
    async (baseUrl) => {
      const formData = new FormData();
      formData.append("event", JSON.stringify(validEventPayload()));
      formData.append("files", new Blob(["pdf"], { type: "application/pdf" }), "rabies.pdf");
      formData.append("files", new Blob(["png"], { type: "image/png" }), "result.png");

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/events`, {
        method: "POST",
        headers: authHeader(),
        body: formData
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as { event: { files: Array<{ fileId: string }> } };
      assert.deepEqual(body.event.files.map((file) => file.fileId), fileIds);
    }
  );

  assert.deepEqual(receivedEventInput, validEventPayload());
  assert.deepEqual(uploaded, [
    { originalName: "rabies.pdf", mimeType: "application/pdf", eventId: EVENT_ID },
    { originalName: "result.png", mimeType: "image/png", eventId: EVENT_ID }
  ]);
  assert.deepEqual(receivedUpdate, { fileIds });
});

test("POST /pets/:id/events (multipart) returns 400 when event field is not valid JSON", async () => {
  let createCalled = false;

  await withCreateServer(
    {
      createPetEvent: async () => {
        createCalled = true;
        return fakeEvent();
      }
    },
    async (baseUrl) => {
      const formData = new FormData();
      formData.append("event", "{not json");
      formData.append("files", new Blob(["pdf"], { type: "application/pdf" }), "rabies.pdf");

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/events`, {
        method: "POST",
        headers: authHeader(),
        body: formData
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "INVALID_EVENT_PAYLOAD");
    }
  );

  assert.equal(createCalled, false);
});

test("PATCH /events/:id (multipart) parses event JSON, uploads files, and appends them", async () => {
  const existingFileId = "60a7c1aa9e1d4f12345678aa";
  const newFileIds = [
    "60a7c1aa9e1d4f12345678cd",
    "60a7c1aa9e1d4f12345678ce"
  ];
  const uploaded: Array<{
    petId?: string;
    originalName?: string;
    eventId?: unknown;
  }> = [];
  let receivedUpdate: Record<string, unknown> | undefined;

  await withUpdateServer(
    {
      getEvent: async (ownerId, eventId) => {
        assert.equal(ownerId, USER_ID);
        assert.equal(eventId, EVENT_ID);
        return {
          ...fakeEventWithFiles(),
          files: [{ fileId: existingFileId, originalName: "old.pdf" }]
        };
      },
      uploadPetFile: async (ownerId, petId, input) => {
        assert.equal(ownerId, USER_ID);
        uploaded.push({
          petId,
          originalName: input.file?.originalname,
          eventId: input.eventId
        });
        const id = newFileIds[uploaded.length - 1];
        return {
          id,
          ownerId: USER_ID,
          petId,
          eventId: EVENT_ID,
          originalName: input.file?.originalname ?? "file",
          mimeType: input.file?.mimetype as "application/pdf" | "image/png" | "image/jpeg",
          sizeBytes: input.file?.size ?? 0,
          uploadedAt: "2026-05-12T00:00:00.000Z",
          createdAt: "2026-05-12T00:00:00.000Z",
          updatedAt: "2026-05-12T00:00:00.000Z"
        };
      },
      updateEvent: async (ownerId, eventId, input) => {
        assert.equal(ownerId, USER_ID);
        assert.equal(eventId, EVENT_ID);
        receivedUpdate = input as Record<string, unknown>;
        return {
          ...fakeEvent(),
          title: "Updated title",
          files: [
            { fileId: existingFileId, originalName: "old.pdf" },
            { fileId: newFileIds[0], originalName: "rabies.pdf" },
            { fileId: newFileIds[1], originalName: "result.png" }
          ]
        };
      }
    },
    async (baseUrl) => {
      const formData = new FormData();
      formData.append("event", JSON.stringify({ title: "Updated title" }));
      formData.append("files", new Blob(["pdf"], { type: "application/pdf" }), "rabies.pdf");
      formData.append("files", new Blob(["png"], { type: "image/png" }), "result.png");

      const res = await fetch(`${baseUrl}/events/${EVENT_ID}`, {
        method: "PATCH",
        headers: authHeader(),
        body: formData
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as { event: { files: Array<{ fileId: string }> } };
      assert.deepEqual(
        body.event.files.map((file) => file.fileId),
        [existingFileId, ...newFileIds]
      );
    }
  );

  assert.deepEqual(uploaded, [
    { petId: PET_ID, originalName: "rabies.pdf", eventId: EVENT_ID },
    { petId: PET_ID, originalName: "result.png", eventId: EVENT_ID }
  ]);
  assert.deepEqual(receivedUpdate, {
    title: "Updated title",
    fileIds: [existingFileId, ...newFileIds]
  });
});

test("PATCH /events/:id rejects fileIds in JSON payload", async () => {
  let updateCalled = false;

  await withUpdateServer(
    {
      updateEvent: async () => {
        updateCalled = true;
        return fakeEvent();
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/events/${EVENT_ID}`, {
        method: "PATCH",
        headers: {
          ...authHeader(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fileIds: ["60a7c1aa9e1d4f12345678cd"] })
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "FILE_IDS_CONFLICT");
    }
  );

  assert.equal(updateCalled, false);
});
