/**
 * HTTP-level tests for export routes.
 *
 * Keeps auth, JSON body parsing, controller wiring and response formatting in
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
  createPetExportHandler,
  type CreatePetExportHandlerDependencies
} from "../src/controllers/exportController";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { errorHandler } from "../src/middleware/errorHandler";

const USER_ID = "507f1f77bcf86cd799439011";
const PET_ID = "60a7c1aa9e1d4f1234567890";
const EXPORT_ID = "60a7c1aa9e1d4f12345678ab";

const token = jwt.sign({ sub: USER_ID, email: "user@example.com" }, env.JWT_SECRET);

const buildApp = (overrides: CreatePetExportHandlerDependencies = {}): express.Express => {
  const app = express();
  app.use(express.json());
  app.post("/pets/:id/export", authMiddleware, createPetExportHandler(overrides));
  app.use(errorHandler);
  return app;
};

const withServer = async <T>(
  overrides: CreatePetExportHandlerDependencies,
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

const authHeader = (): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
});

test("POST /pets/:id/export forwards selected eventTypes to export service", async () => {
  let receivedOwnerId: string | undefined;
  let receivedPetId: string | undefined;
  let receivedInput: Record<string, unknown> | undefined;

  await withServer(
    {
      createPetExport: async (ownerId, petId, input) => {
        receivedOwnerId = ownerId;
        receivedPetId = petId;
        receivedInput = input as Record<string, unknown>;
        return {
          id: EXPORT_ID,
          ownerId,
          petId,
          sections: ["profile", "events"],
          status: "pending",
          createdAt: "2026-05-14T10:00:00.000Z",
          updatedAt: "2026-05-14T10:00:00.000Z"
        };
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/pets/${PET_ID}/export`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          period: { from: "2026-05-01", to: "2026-05-31" },
          sections: ["profile", "events"],
          eventTypes: ["vaccine", "treatment", "visit", "operation", "lab", "other"],
          sendEmail: true
        })
      });

      assert.equal(res.status, 202);
      const body = (await res.json()) as { export: { id: string; status: string } };
      assert.equal(body.export.id, EXPORT_ID);
      assert.equal(body.export.status, "pending");
    }
  );

  assert.equal(receivedOwnerId, USER_ID);
  assert.equal(receivedPetId, PET_ID);
  assert.deepEqual(receivedInput, {
    period: { from: "2026-05-01", to: "2026-05-31" },
    sections: ["profile", "events"],
    eventTypes: ["vaccine", "treatment", "visit", "operation", "lab", "other"],
    sendEmail: true
  });
});
