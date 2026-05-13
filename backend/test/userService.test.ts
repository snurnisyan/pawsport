import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../src/middleware/errorHandler";
import { getCurrentUser } from "../src/services/userService";

const userId = "507f1f77bcf86cd799439011";

test("getCurrentUser serializes the user document", async () => {
  const consentAcceptedAt = new Date("2026-05-12T00:00:00.000Z");
  const createdAt = new Date("2026-05-12T00:00:00.000Z");
  const updatedAt = new Date("2026-05-12T01:00:00.000Z");

  const result = await getCurrentUser(userId, {
    findUserById: async (id) => {
      assert.equal(id, userId);
      return {
        _id: { toString: () => userId } as never,
        email: "user@example.com",
        status: "active",
        emailVerified: true,
        consentAcceptedAt,
        createdAt,
        updatedAt
      };
    }
  });

  assert.deepEqual(result, {
    id: userId,
    email: "user@example.com",
    status: "active",
    emailVerified: true,
    consentAcceptedAt: consentAcceptedAt.toISOString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString()
  });
});

test("getCurrentUser throws UNAUTHORIZED for malformed id", async () => {
  await assert.rejects(
    () => getCurrentUser("not-an-objectid"),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("getCurrentUser throws USER_NOT_FOUND when DB returns null", async () => {
  await assert.rejects(
    () => getCurrentUser(userId, { findUserById: async () => null }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "USER_NOT_FOUND");
      return true;
    }
  );
});
