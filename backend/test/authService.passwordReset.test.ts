import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";

import { AppError } from "../src/middleware/errorHandler";
import {
  confirmPasswordReset,
  hashToken,
  requestPasswordReset,
  validatePasswordResetToken
} from "../src/services/authService";

const buildResetUser = (overrides: Record<string, unknown> = {}) => {
  const user = {
    email: "user@example.com",
    resetTokenHash: undefined as string | undefined,
    resetTokenExpiresAt: undefined as Date | undefined,
    saveCalls: 0,
    save: async () => {
      user.saveCalls += 1;
      return user;
    },
    ...overrides
  };

  return user;
};

test("requestPasswordReset stores hashed reset token and sends email for existing user", async () => {
  const storedUser = buildResetUser();
  let sentTo = "";
  let sentResetUrl = "";

  await requestPasswordReset(
    { email: "  USER@Example.COM " },
    {
      findPasswordResetUserByEmail: async (email) => {
        assert.equal(email, "user@example.com");
        return storedUser as never;
      },
      generateToken: () => "raw-reset-token",
      sendPasswordResetEmail: async ({ to, resetUrl }) => {
        sentTo = to;
        sentResetUrl = resetUrl;
      },
      awaitPasswordResetEmail: true,
      now: () => new Date("2026-05-12T00:00:00.000Z")
    }
  );

  assert.equal(storedUser.saveCalls, 1);
  assert.equal(storedUser.resetTokenHash, hashToken("raw-reset-token"));
  assert.notEqual(storedUser.resetTokenHash, "raw-reset-token");
  assert.ok(storedUser.resetTokenExpiresAt);
  assert.equal(storedUser.resetTokenExpiresAt.toISOString(), "2026-05-12T01:00:00.000Z");
  assert.equal(sentTo, "user@example.com");
  assert.match(sentResetUrl, /\/auth\/password-reset\?token=raw-reset-token$/);
});

test("requestPasswordReset returns the same response and sends no email for unknown email", async () => {
  let emailSent = false;
  let savedAny = false;

  await requestPasswordReset(
    { email: "ghost@example.com" },
    {
      findPasswordResetUserByEmail: async () => null,
      generateToken: () => "should-not-leak",
      sendPasswordResetEmail: async () => {
        emailSent = true;
      },
      awaitPasswordResetEmail: true
    }
  );

  assert.equal(emailSent, false);
  assert.equal(savedAny, false);
});

test("requestPasswordReset rejects invalid or missing email with 400", async () => {
  const cases = [undefined, "", "   ", "not-an-email"];

  for (const email of cases) {
    await assert.rejects(
      () =>
        requestPasswordReset(
          { email } as never,
          {
            findPasswordResetUserByEmail: async () => {
              throw new Error("should not be called");
            }
          }
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "INVALID_EMAIL");
        return true;
      }
    );
  }
});

test("validatePasswordResetToken extends a short-lived token to at least 15 minutes ahead", async () => {
  const tokenHash = hashToken("raw-reset-token");
  const user = {
    resetTokenHash: tokenHash as string | undefined,
    resetTokenExpiresAt: new Date("2026-05-12T00:05:00.000Z") as Date | undefined,
    saveCalls: 0,
    save: async () => {
      user.saveCalls += 1;
      return user;
    }
  };

  await validatePasswordResetToken(
    { token: "raw-reset-token" },
    {
      findUserByResetTokenHash: async (hash) => {
        assert.equal(hash, tokenHash);
        return user as never;
      },
      now: () => new Date("2026-05-12T00:00:00.000Z")
    }
  );

  assert.equal(user.saveCalls, 1);
  assert.ok(user.resetTokenExpiresAt);
  assert.equal(user.resetTokenExpiresAt.toISOString(), "2026-05-12T00:15:00.000Z");
});

test("validatePasswordResetToken does not shorten a token that still has more than 15 minutes left", async () => {
  const tokenHash = hashToken("raw-reset-token");
  const originalExpiry = new Date("2026-05-12T00:45:00.000Z");
  const user = {
    resetTokenHash: tokenHash as string | undefined,
    resetTokenExpiresAt: originalExpiry as Date | undefined,
    saveCalls: 0,
    save: async () => {
      user.saveCalls += 1;
      return user;
    }
  };

  await validatePasswordResetToken(
    { token: "raw-reset-token" },
    {
      findUserByResetTokenHash: async () => user as never,
      now: () => new Date("2026-05-12T00:00:00.000Z")
    }
  );

  assert.equal(user.saveCalls, 0);
  assert.equal(user.resetTokenExpiresAt?.toISOString(), originalExpiry.toISOString());
});

test("validatePasswordResetToken rejects unknown, expired, and missing tokens with INVALID_RESET_TOKEN", async () => {
  const tokenHash = hashToken("expired-token");

  const cases: Array<{
    input: { token?: unknown };
    findUser: () => Promise<unknown>;
  }> = [
    { input: { token: "" }, findUser: async () => null },
    { input: { token: undefined }, findUser: async () => null },
    { input: { token: "unknown" }, findUser: async () => null },
    {
      input: { token: "expired-token" },
      findUser: async () =>
        ({
          resetTokenHash: tokenHash,
          resetTokenExpiresAt: new Date("2026-05-12T00:00:00.000Z"),
          save: async () => undefined
        }) as never
    }
  ];

  for (const item of cases) {
    await assert.rejects(
      () =>
        validatePasswordResetToken(item.input as never, {
          findUserByResetTokenHash: item.findUser as never,
          now: () => new Date("2026-05-12T02:00:00.000Z")
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "INVALID_RESET_TOKEN");
        return true;
      }
    );
  }
});

test("confirmPasswordReset updates password hash and clears reset fields on success", async () => {
  const tokenHash = hashToken("raw-reset-token");
  const user = {
    passwordHash: "old-hash",
    resetTokenHash: tokenHash as string | undefined,
    resetTokenExpiresAt: new Date("2026-05-12T01:00:00.000Z") as Date | undefined,
    saveCalls: 0,
    save: async () => {
      user.saveCalls += 1;
      return user;
    }
  };

  await confirmPasswordReset(
    { token: "raw-reset-token", password: "NewPassword1" },
    {
      findUserByResetTokenHash: async (hash) => {
        assert.equal(hash, tokenHash);
        return user as never;
      },
      now: () => new Date("2026-05-12T00:30:00.000Z")
    }
  );

  assert.equal(user.saveCalls, 1);
  assert.equal(user.resetTokenHash, undefined);
  assert.equal(user.resetTokenExpiresAt, undefined);
  assert.notEqual(user.passwordHash, "old-hash");
  assert.notEqual(user.passwordHash, "NewPassword1");
  assert.equal(await bcrypt.compare("NewPassword1", user.passwordHash), true);
});

test("confirmPasswordReset rejects unknown token with INVALID_RESET_TOKEN", async () => {
  await assert.rejects(
    () =>
      confirmPasswordReset(
        { token: "unknown", password: "NewPassword1" },
        { findUserByResetTokenHash: async () => null }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_RESET_TOKEN");
      return true;
    }
  );
});

test("confirmPasswordReset rejects expired token with INVALID_RESET_TOKEN", async () => {
  const tokenHash = hashToken("expired-token");

  await assert.rejects(
    () =>
      confirmPasswordReset(
        { token: "expired-token", password: "NewPassword1" },
        {
          findUserByResetTokenHash: async () =>
            ({
              passwordHash: "old-hash",
              resetTokenHash: tokenHash,
              resetTokenExpiresAt: new Date("2026-05-12T00:00:00.000Z"),
              save: async () => undefined
            }) as never,
          now: () => new Date("2026-05-12T02:00:00.000Z")
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_RESET_TOKEN");
      return true;
    }
  );
});

test("confirmPasswordReset rejects token reuse after successful reset", async () => {
  const tokenHash = hashToken("raw-reset-token");
  const user = {
    passwordHash: "old-hash",
    resetTokenHash: tokenHash as string | undefined,
    resetTokenExpiresAt: new Date("2026-05-12T01:00:00.000Z") as Date | undefined,
    save: async () => undefined
  };

  const findUserByResetTokenHash = async (hash: string) => {
    if (user.resetTokenHash !== hash) {
      return null;
    }
    return user as never;
  };

  await confirmPasswordReset(
    { token: "raw-reset-token", password: "NewPassword1" },
    {
      findUserByResetTokenHash,
      now: () => new Date("2026-05-12T00:30:00.000Z")
    }
  );

  assert.equal(user.resetTokenHash, undefined);

  await assert.rejects(
    () =>
      confirmPasswordReset(
        { token: "raw-reset-token", password: "AnotherPass2" },
        {
          findUserByResetTokenHash,
          now: () => new Date("2026-05-12T00:35:00.000Z")
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_RESET_TOKEN");
      return true;
    }
  );
});

test("confirmPasswordReset rejects invalid password with INVALID_PASSWORD", async () => {
  const cases: Array<{ token: unknown; password: unknown; code: string }> = [
    { token: "valid-token", password: undefined, code: "INVALID_PASSWORD" },
    { token: "valid-token", password: "short1", code: "INVALID_PASSWORD" },
    { token: "", password: "NewPassword1", code: "INVALID_RESET_TOKEN" },
    { token: undefined, password: "NewPassword1", code: "INVALID_RESET_TOKEN" }
  ];

  for (const item of cases) {
    await assert.rejects(
      () =>
        confirmPasswordReset(item as never, {
          findUserByResetTokenHash: async () => {
            throw new Error("should not be called");
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, item.code);
        return true;
      }
    );
  }
});
