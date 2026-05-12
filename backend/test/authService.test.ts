import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { AppError } from "../src/middleware/errorHandler";
import { confirmEmail, hashToken, registerUser } from "../src/services/authService";

const userId = "507f1f77bcf86cd799439011";

test("registerUser creates an active user with bcrypt password hash, token hash, and JWT", async () => {
  let createdUserInput:
    | {
        email: string;
        passwordHash: string;
        status: "active";
        emailVerified: boolean;
        verificationTokenHash: string;
        verificationTokenExpiresAt: Date;
        consentAcceptedAt: Date;
      }
    | undefined;
  let sentConfirmationUrl = "";

  const result = await registerUser(
    {
      email: "  USER@Example.COM ",
      password: "Password1",
      personalDataConsent: true
    },
    {
      findUserByEmail: async (email) => {
        assert.equal(email, "user@example.com");
        return null;
      },
      createUser: async (input) => {
        createdUserInput = input;

        return {
          _id: { toString: () => userId } as never,
          email: input.email,
          emailVerified: input.emailVerified
        };
      },
      generateToken: () => "raw-confirmation-token",
      sendConfirmationEmail: async ({ confirmationUrl }) => {
        sentConfirmationUrl = confirmationUrl;
      },
      awaitConfirmationEmail: true,
      now: () => new Date("2026-05-12T00:00:00.000Z")
    }
  );

  assert.equal(result.user.id, userId);
  assert.equal(result.user.email, "user@example.com");
  assert.equal(result.user.emailVerified, false);
  assert.equal(result.nextStep, "onboarding");
  assert.equal(typeof result.accessToken, "string");

  const decodedJwt = jwt.decode(result.accessToken);
  assert.equal(typeof decodedJwt, "object");
  assert.equal(decodedJwt?.sub, userId);
  assert.equal(decodedJwt?.email, "user@example.com");

  assert.ok(createdUserInput);
  assert.equal(createdUserInput.email, "user@example.com");
  assert.equal(createdUserInput.status, "active");
  assert.equal(createdUserInput.emailVerified, false);
  assert.notEqual(createdUserInput.passwordHash, "Password1");
  assert.equal(await bcrypt.compare("Password1", createdUserInput.passwordHash), true);
  assert.equal(createdUserInput.verificationTokenHash, hashToken("raw-confirmation-token"));
  assert.notEqual(createdUserInput.verificationTokenHash, "raw-confirmation-token");
  assert.equal(createdUserInput.verificationTokenExpiresAt.toISOString(), "2026-05-13T00:00:00.000Z");
  assert.equal(createdUserInput.consentAcceptedAt.toISOString(), "2026-05-12T00:00:00.000Z");
  assert.match(sentConfirmationUrl, /\/api\/auth\/confirm\?token=raw-confirmation-token$/);
});

test("registerUser rejects duplicate normalized email", async () => {
  await assert.rejects(
    () =>
      registerUser(
        {
          email: "User@Example.COM",
          password: "Password1",
          personalDataConsent: true
        },
        {
          findUserByEmail: async (email) => {
            assert.equal(email, "user@example.com");
            return { email };
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "EMAIL_ALREADY_EXISTS");
      return true;
    }
  );
});

test("registerUser rejects invalid input", async () => {
  const cases = [
    {
      input: { email: "not-email", password: "Password1", personalDataConsent: true },
      code: "INVALID_EMAIL"
    },
    {
      input: { email: "user@example.com", password: "short1", personalDataConsent: true },
      code: "INVALID_PASSWORD"
    },
    {
      input: { email: "user@example.com", password: "Password1", personalDataConsent: false },
      code: "PERSONAL_DATA_CONSENT_REQUIRED"
    }
  ];

  for (const item of cases) {
    await assert.rejects(
      () => registerUser(item.input),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, item.code);
        return true;
      }
    );
  }
});

test("confirmEmail marks a valid token as verified and clears stored token fields", async () => {
  let saved = false;
  const user = {
    emailVerified: false,
    verificationTokenHash: hashToken("valid-token"),
    verificationTokenExpiresAt: new Date("2026-05-13T00:00:00.000Z"),
    save: async () => {
      saved = true;
      return user;
    }
  };

  const status = await confirmEmail("valid-token", {
    findUserByVerificationTokenHash: async (tokenHash) => {
      assert.equal(tokenHash, hashToken("valid-token"));
      return user as never;
    },
    now: () => new Date("2026-05-12T00:00:00.000Z")
  });

  assert.equal(status, "success");
  assert.equal(saved, true);
  assert.equal(user.emailVerified, true);
  assert.equal(user.verificationTokenHash, undefined);
  assert.equal(user.verificationTokenExpiresAt, undefined);
});

test("confirmEmail returns invalid_or_expired for missing, unknown, or expired tokens", async () => {
  assert.equal(await confirmEmail(""), "invalid_or_expired");

  assert.equal(
    await confirmEmail("unknown-token", {
      findUserByVerificationTokenHash: async () => null
    }),
    "invalid_or_expired"
  );

  assert.equal(
    await confirmEmail("expired-token", {
      findUserByVerificationTokenHash: async () =>
        ({
          emailVerified: false,
          verificationTokenHash: hashToken("expired-token"),
          verificationTokenExpiresAt: new Date("2026-05-11T00:00:00.000Z"),
          save: async () => undefined
        }) as never,
      now: () => new Date("2026-05-12T00:00:00.000Z")
    }),
    "invalid_or_expired"
  );
});
