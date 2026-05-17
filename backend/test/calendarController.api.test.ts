/**
 * HTTP-level tests for the calendar controller.
 *
 * Mounts a minimal authenticated Express route with a stubbed calendar service
 * so query parsing, JWT auth, async handling and error formatting stay in the loop.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

import { env } from "../src/config/env";
import {
  getCalendarHandler,
  type GetCalendarHandlerDependencies
} from "../src/controllers/calendarController";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { errorHandler } from "../src/middleware/errorHandler";
import type { CalendarResult } from "../src/services/calendarService";

const USER_ID = "507f1f77bcf86cd799439011";
const PET_ID = "60a7c1aa9e1d4f1234567890";
const OTHER_PET_ID = "60a7c1aa9e1d4f1234567891";
const EVENT_ID = "60a7c1aa9e1d4f12345678ab";

const token = jwt.sign({ sub: USER_ID, email: "user@example.com" }, env.JWT_SECRET);

const buildApp = (overrides: GetCalendarHandlerDependencies = {}): express.Express => {
  const app = express();
  app.get("/calendar", authMiddleware, getCalendarHandler(overrides));
  app.use(errorHandler);
  return app;
};

const withServer = async <T>(
  overrides: GetCalendarHandlerDependencies,
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

const fakeCalendarResult = (): CalendarResult => ({
  events: [
    {
      id: EVENT_ID,
      ownerId: USER_ID,
      petId: PET_ID,
      type: "vaccine",
      title: "Rabies booster",
      eventDate: "2026-06-10T10:00:00.000Z",
      fileIds: [],
      createdAt: "2026-05-12T00:00:00.000Z",
      updatedAt: "2026-05-12T00:00:00.000Z"
    }
  ]
});

const authHeader = (): HeadersInit => ({ Authorization: `Bearer ${token}` });

test("GET /calendar forwards from, to, petIds and eventTypes filters", async () => {
  let receivedOwnerId: string | undefined;
  let receivedQuery: Record<string, unknown> | undefined;

  await withServer(
    {
      getCalendar: async (ownerId, query) => {
        receivedOwnerId = ownerId;
        receivedQuery = query as Record<string, unknown>;
        return fakeCalendarResult();
      }
    },
    async (baseUrl) => {
      const params = new URLSearchParams([
        ["from", "2026-06-01"],
        ["to", "2026-06-30"],
        ["petIds", PET_ID],
        ["petIds", OTHER_PET_ID],
        ["eventTypes", "vaccine"],
        ["eventTypes", "lab"],
        ["eventTypes", "other"]
      ]);

      const res = await fetch(`${baseUrl}/calendar?${params.toString()}`, {
        headers: authHeader()
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as CalendarResult;
      assert.equal(body.events[0].id, EVENT_ID);
      assert.equal(Object.hasOwn(body, "reminders"), false);
    }
  );

  assert.equal(receivedOwnerId, USER_ID);
  assert.deepEqual(receivedQuery, {
    from: "2026-06-01",
    to: "2026-06-30",
    petIds: [PET_ID, OTHER_PET_ID],
    eventTypes: ["vaccine", "lab", "other"]
  });
});
