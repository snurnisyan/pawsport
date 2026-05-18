import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  confirmEmail,
  hashToken,
  registerUser,
  resendConfirmationEmail
} from "../src/services/authService";

const userId = "507f1f77bcf86cd799439011";
const userObjectId = new Types.ObjectId(userId);

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
  assert.match(sentConfirmationUrl, /\/auth\/email-confirmed\?token=raw-confirmation-token$/);
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

test("resendConfirmationEmail refreshes the token and sends a confirmation email", async () => {
  let saved = false;
  let sentConfirmationUrl = "";
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

  await resendConfirmationEmail(
    userId,
    {
      findEmailConfirmationResendUserById: async (id) => {
        assert.equal(id.toString(), userId);
        return user as never;
      },
      generateToken: () => "new-confirmation-token",
      sendConfirmationEmail: async ({ to, confirmationUrl }) => {
        assert.equal(to, "user@example.com");
        sentConfirmationUrl = confirmationUrl;
      },
      awaitConfirmationEmail: true,
      now: () => new Date("2026-05-12T00:00:00.000Z")
    }
  );

  assert.equal(saved, true);
  assert.equal(user.verificationTokenHash, hashToken("new-confirmation-token"));
  assert.equal(user.verificationTokenExpiresAt?.toISOString(), "2026-05-13T00:00:00.000Z");
  assert.match(sentConfirmationUrl, /\/auth\/email-confirmed\?token=new-confirmation-token$/);
});

test("resendConfirmationEmail is a no-op for already verified accounts", async () => {
  let generateCalls = 0;
  let sendCalls = 0;
  let saved = false;

  await resendConfirmationEmail(
    userId,
    {
      findEmailConfirmationResendUserById: async () =>
        ({
          email: "verified@example.com",
          emailVerified: true,
          verificationTokenHash: undefined,
          verificationTokenExpiresAt: undefined,
          save: async () => {
            saved = true;
          }
        }) as never,
      generateToken: () => {
        generateCalls += 1;
        return "unused-token";
      },
      sendConfirmationEmail: async () => {
        sendCalls += 1;
      },
      awaitConfirmationEmail: true
    }
  );

  assert.equal(generateCalls, 0);
  assert.equal(sendCalls, 0);
  assert.equal(saved, false);
});

test("resendConfirmationEmail rejects invalid or missing JWT users", async () => {
  await assert.rejects(
    () => resendConfirmationEmail("not-an-object-id"),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );

  await assert.rejects(
    () =>
      resendConfirmationEmail(userId, {
        findEmailConfirmationResendUserById: async () => null
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "USER_NOT_FOUND");
      return true;
    }
  );
});

const buildConfirmationUser = () => {
  let saved = false;
  const user = {
    _id: userObjectId,
    email: "user@example.com",
    emailVerified: false,
    verificationTokenHash: hashToken("valid-token") as string | undefined,
    verificationTokenExpiresAt: new Date("2026-05-13T00:00:00.000Z") as Date | undefined,
    save: async () => {
      saved = true;
      return user;
    }
  };

  return { user, wasSaved: () => saved };
};

test("confirmEmail marks the user verified and issues a JWT with nextStep=onboarding when no pets exist", async () => {
  const { user, wasSaved } = buildConfirmationUser();

  const result = await confirmEmail(
    { token: "valid-token" },
    {
      findUserByVerificationTokenHash: async (tokenHash) => {
        assert.equal(tokenHash, hashToken("valid-token"));
        return user as never;
      },
      hasPetsForOwner: async (ownerId) => {
        assert.equal(ownerId.toString(), userId);
        return false;
      },
      now: () => new Date("2026-05-12T00:00:00.000Z")
    }
  );

  assert.equal(wasSaved(), true);
  assert.equal(user.emailVerified, true);
  assert.equal(user.verificationTokenHash, undefined);
  assert.equal(user.verificationTokenExpiresAt, undefined);

  assert.equal(result.user.id, userId);
  assert.equal(result.user.email, "user@example.com");
  assert.equal(result.user.emailVerified, true);
  assert.equal(result.nextStep, "onboarding");
  assert.equal(typeof result.accessToken, "string");

  const decoded = jwt.decode(result.accessToken);
  assert.equal(typeof decoded, "object");
  assert.equal(decoded?.sub, userId);
  assert.equal(decoded?.email, "user@example.com");
});

test("confirmEmail returns nextStep=null when the user already has at least one pet", async () => {
  const { user } = buildConfirmationUser();

  const result = await confirmEmail(
    { token: "valid-token" },
    {
      findUserByVerificationTokenHash: async () => user as never,
      hasPetsForOwner: async () => true,
      now: () => new Date("2026-05-12T00:00:00.000Z")
    }
  );

  assert.equal(result.nextStep, null);
});

test("confirmEmail rejects missing, unknown, expired, or already-used tokens", async () => {
  const cases: Array<{
    input: { token?: unknown };
    findUser?: () => Promise<unknown>;
  }> = [
    { input: { token: "" } },
    { input: { token: undefined } },
    { input: { token: "   " } },
    { input: { token: "unknown-token" }, findUser: async () => null },
    {
      input: { token: "expired-token" },
      findUser: async () =>
        ({
          _id: userObjectId,
          email: "user@example.com",
          emailVerified: false,
          verificationTokenHash: hashToken("expired-token"),
          verificationTokenExpiresAt: new Date("2026-05-11T00:00:00.000Z"),
          save: async () => undefined
        }) as never
    },
    {
      input: { token: "already-confirmed" },
      findUser: async () =>
        ({
          _id: userObjectId,
          email: "user@example.com",
          emailVerified: true,
          verificationTokenHash: hashToken("already-confirmed"),
          verificationTokenExpiresAt: new Date("2026-05-13T00:00:00.000Z"),
          save: async () => undefined
        }) as never
    }
  ];

  for (const item of cases) {
    await assert.rejects(
      () =>
        confirmEmail(item.input as never, {
          findUserByVerificationTokenHash: (item.findUser ?? (async () => null)) as never,
          now: () => new Date("2026-05-12T00:00:00.000Z")
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "INVALID_CONFIRMATION_TOKEN");
        return true;
      }
    );
  }
});
