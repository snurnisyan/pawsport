import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { AppError } from "../src/middleware/errorHandler";
import { loginUser } from "../src/services/authService";

const userId = "507f1f77bcf86cd799439011";

test("loginUser returns JWT and safe user for valid credentials", async () => {
  const passwordHash = await bcrypt.hash("Password1", 10);

  const result = await loginUser(
    { email: "  USER@Example.COM ", password: "Password1" },
    {
      findLoginUserByEmail: async (email) => {
        assert.equal(email, "user@example.com");
        return {
          _id: { toString: () => userId } as never,
          email: "user@example.com",
          emailVerified: true,
          passwordHash
        };
      }
    }
  );

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

test("loginUser rejects unknown user with INVALID_CREDENTIALS", async () => {
  await assert.rejects(
    () =>
      loginUser(
        { email: "ghost@example.com", password: "Password1" },
        { findLoginUserByEmail: async () => null }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "INVALID_CREDENTIALS");
      return true;
    }
  );
});

test("loginUser rejects wrong password with INVALID_CREDENTIALS", async () => {
  const passwordHash = await bcrypt.hash("Password1", 10);

  await assert.rejects(
    () =>
      loginUser(
        { email: "user@example.com", password: "WrongPass1" },
        {
          findLoginUserByEmail: async () => ({
            _id: { toString: () => userId } as never,
            email: "user@example.com",
            emailVerified: true,
            passwordHash
          })
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "INVALID_CREDENTIALS");
      return true;
    }
  );
});

test("loginUser rejects malformed input without leaking detail", async () => {
  const cases = [
    { email: undefined, password: "Password1" },
    { email: "user@example.com", password: undefined },
    { email: "not-an-email", password: "Password1" },
    { email: "user@example.com", password: "" }
  ];

  for (const input of cases) {
    await assert.rejects(
      () =>
        loginUser(input as never, {
          findLoginUserByEmail: async () => {
            throw new Error("should not be called");
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 401);
        assert.equal(error.code, "INVALID_CREDENTIALS");
        return true;
      }
    );
  }
});
