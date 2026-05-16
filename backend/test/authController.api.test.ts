/**
 * HTTP-level tests for the email confirmation controller.
 *
 * Mirrors the petController pattern: mount the route under test on a minimal
 * Express app with a stubbed `confirmEmail` service and exercise it through a
 * real ephemeral HTTP server so JSON body parsing, the async handler and the
 * error handler are all in the loop.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";

import {
  confirmEmailHandler,
  type ConfirmEmailHandlerDependencies
} from "../src/controllers/authController";
import { AppError, errorHandler } from "../src/middleware/errorHandler";
import type { EmailConfirmationResult } from "../src/services/authService";

const USER_ID = "507f1f77bcf86cd799439011";

const buildApp = (overrides: ConfirmEmailHandlerDependencies = {}): express.Express => {
  const app = express();
  app.use(express.json());
  app.post("/auth/confirm", confirmEmailHandler(overrides));
  app.use(errorHandler);
  return app;
};

const withServer = async <T>(
  overrides: ConfirmEmailHandlerDependencies,
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

const fakeAuthResult = (
  overrides: Partial<EmailConfirmationResult> = {}
): EmailConfirmationResult => ({
  accessToken: "fake-jwt-token",
  user: { id: USER_ID, email: "user@example.com", emailVerified: true },
  nextStep: "onboarding",
  ...overrides
});

test("POST /auth/confirm forwards the token and returns 200 with the auth payload", async () => {
  let receivedInput: unknown;

  await withServer(
    {
      confirmEmail: async (input) => {
        receivedInput = input;
        return fakeAuthResult();
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/auth/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "raw-confirmation-token" })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as EmailConfirmationResult;
      assert.equal(body.accessToken, "fake-jwt-token");
      assert.equal(body.user.id, USER_ID);
      assert.equal(body.user.email, "user@example.com");
      assert.equal(body.user.emailVerified, true);
      assert.equal(body.nextStep, "onboarding");
    }
  );

  assert.deepEqual(receivedInput, { token: "raw-confirmation-token" });
});

test("POST /auth/confirm preserves nextStep=null when the service reports the user already has pets", async () => {
  await withServer(
    {
      confirmEmail: async () => fakeAuthResult({ nextStep: null })
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/auth/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "raw-confirmation-token" })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as EmailConfirmationResult;
      assert.equal(body.nextStep, null);
    }
  );
});

test("POST /auth/confirm surfaces INVALID_CONFIRMATION_TOKEN as 400", async () => {
  await withServer(
    {
      confirmEmail: async () => {
        throw new AppError(
          400,
          "INVALID_CONFIRMATION_TOKEN",
          "Email confirmation token is invalid or has expired"
        );
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/auth/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "bad-token" })
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "INVALID_CONFIRMATION_TOKEN");
    }
  );
});

test("POST /auth/confirm passes an empty object to the service when no body is sent", async () => {
  let receivedInput: unknown = "not-called";

  await withServer(
    {
      confirmEmail: async (input) => {
        receivedInput = input;
        throw new AppError(
          400,
          "INVALID_CONFIRMATION_TOKEN",
          "Email confirmation token is invalid or has expired"
        );
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/auth/confirm`, { method: "POST" });

      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "INVALID_CONFIRMATION_TOKEN");
    }
  );

  assert.deepEqual(receivedInput, {});
});
