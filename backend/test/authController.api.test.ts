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
import jwt from "jsonwebtoken";

import {
  confirmEmailHandler,
  resendConfirmationEmailHandler,
  type ConfirmEmailHandlerDependencies,
  type ResendConfirmationEmailHandlerDependencies
} from "../src/controllers/authController";
import { env } from "../src/config/env";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { AppError, errorHandler } from "../src/middleware/errorHandler";
import {
  hashToken,
  resendConfirmationEmail as resendConfirmationEmailService,
  type EmailConfirmationResult
} from "../src/services/authService";

const USER_ID = "507f1f77bcf86cd799439011";
const token = jwt.sign({ sub: USER_ID, email: "user@example.com" }, env.JWT_SECRET);
const authHeader = (): HeadersInit => ({ Authorization: `Bearer ${token}` });

type AuthControllerTestDependencies = ConfirmEmailHandlerDependencies &
  ResendConfirmationEmailHandlerDependencies;

const buildApp = (overrides: AuthControllerTestDependencies = {}): express.Express => {
  const app = express();
  app.use(express.json());
  app.post("/auth/confirm", confirmEmailHandler(overrides));
  app.post("/auth/resend", authMiddleware, resendConfirmationEmailHandler(overrides));
  app.use(errorHandler);
  return app;
};

const withServer = async <T>(
  overrides: AuthControllerTestDependencies,
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

test("POST /auth/resend forwards the authenticated user id and returns 202", async () => {
  let receivedUserId: unknown;

  await withServer(
    {
      resendConfirmationEmail: async (userId) => {
        receivedUserId = userId;
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/auth/resend`, {
        method: "POST",
        headers: authHeader()
      });

      assert.equal(res.status, 202);
      const body = (await res.json()) as { message: string };
      assert.equal(
        body.message,
        "If the email belongs to an unverified account, a confirmation link has been sent"
      );
    }
  );

  assert.equal(receivedUserId, USER_ID);
});

test("POST /auth/resend sends a confirmation email to the authenticated user's email", async () => {
  let saved = false;
  const user = {
    email: "user@example.com",
    emailVerified: false,
    verificationTokenHash: hashToken("old-token") as string | undefined,
    verificationTokenExpiresAt: new Date("2026-05-12T12:00:00.000Z") as Date | undefined,
    save: async () => {
      saved = true;
      return user;
    }
  };
  const sentEmails: Array<{ to: string; confirmationUrl: string }> = [];

  await withServer(
    {
      resendConfirmationEmail: async (userId) =>
        resendConfirmationEmailService(userId, {
          findEmailConfirmationResendUserById: async (id) => {
            assert.equal(id.toString(), USER_ID);
            return user as never;
          },
          generateToken: () => "new-confirmation-token",
          sendConfirmationEmail: async (payload) => {
            sentEmails.push(payload);
          },
          awaitConfirmationEmail: true,
          now: () => new Date("2026-05-12T00:00:00.000Z")
        })
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/auth/resend`, {
        method: "POST",
        headers: authHeader()
      });

      assert.equal(res.status, 202);
    }
  );

  assert.equal(saved, true);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0]?.to, "user@example.com");
  assert.match(
    sentEmails[0]?.confirmationUrl ?? "",
    /\/auth\/email-confirmed\?token=new-confirmation-token$/
  );
  assert.equal(user.verificationTokenHash, hashToken("new-confirmation-token"));
  assert.equal(user.verificationTokenExpiresAt?.toISOString(), "2026-05-13T00:00:00.000Z");
});

test("POST /auth/resend requires authentication", async () => {
  await withServer(
    {
      resendConfirmationEmail: async () => {
        assert.fail("service should not be called without JWT");
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/auth/resend`, { method: "POST" });

      assert.equal(res.status, 401);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "UNAUTHORIZED");
    }
  );
});

test("POST /auth/resend surfaces USER_NOT_FOUND as 404", async () => {
  await withServer(
    {
      resendConfirmationEmail: async () => {
        throw new AppError(404, "USER_NOT_FOUND", "User was not found");
      }
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/auth/resend`, {
        method: "POST",
        headers: authHeader()
      });

      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "USER_NOT_FOUND");
    }
  );
});
