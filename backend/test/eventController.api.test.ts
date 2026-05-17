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
  listPetEventsHandler,
  type ListPetEventsHandlerDependencies
} from "../src/controllers/eventController";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { errorHandler } from "../src/middleware/errorHandler";

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

const fakeEvent = () => ({
  id: EVENT_ID,
  ownerId: USER_ID,
  petId: PET_ID,
  type: "vaccine" as const,
  title: "Rabies booster",
  eventDate: "2026-05-12T10:00:00.000Z",
  fileIds: [],
  createdAt: "2026-05-12T00:00:00.000Z",
  updatedAt: "2026-05-12T00:00:00.000Z"
});

const authHeader = (): HeadersInit => ({ Authorization: `Bearer ${token}` });

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

test("GET /pets/:id/events forwards optional type filter", async () => {
  let receivedQuery: Record<string, unknown> | undefined;

  await withServer(
    {
      listPetEvents: async (_ownerId, _petId, query) => {
        receivedQuery = query as Record<string, unknown>;
        return [fakeEvent()];
      }
    },
    async (baseUrl) => {
      const params = new URLSearchParams([["type", "lab"]]);

      const res = await fetch(`${baseUrl}/pets/${PET_ID}/events?${params.toString()}`, {
        headers: authHeader()
      });

      assert.equal(res.status, 200);
    }
  );

  assert.deepEqual(receivedQuery, { type: "lab" });
});
