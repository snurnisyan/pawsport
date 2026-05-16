/**
 * HTTP-level tests for pet file routes.
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
  listPetFilesHandler,
  type ListPetFilesHandlerDependencies
} from "../src/controllers/fileController";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { errorHandler } from "../src/middleware/errorHandler";

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
