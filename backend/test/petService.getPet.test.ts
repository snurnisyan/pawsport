import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import { getPet } from "../src/services/petService";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";

const makePetRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(petId),
  ownerId: new Types.ObjectId(ownerId),
  name: "Купер",
  species: "dog",
  sex: "male" as const,
  tags: [],
  notes: [],
  createdAt: new Date("2026-05-12T00:00:00.000Z"),
  updatedAt: new Date("2026-05-12T00:00:00.000Z"),
  ...overrides
});

test("getPet returns serialized pet for owner", async () => {
  const result = await getPet(ownerId, petId, {
    findPetByIdForOwner: async (id, owner) => {
      assert.equal(id.toString(), petId);
      assert.equal(owner.toString(), ownerId);
      return makePetRecord({ breed: "Golden Retriever" });
    }
  });

  assert.equal(result.id, petId);
  assert.equal(result.ownerId, ownerId);
  assert.equal(result.breed, "Golden Retriever");
});

test("getPet rejects invalid petId with 400", async () => {
  await assert.rejects(
    () =>
      getPet(ownerId, "not-an-id", {
        findPetByIdForOwner: async () => {
          throw new Error("should not be called");
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_PET_ID");
      return true;
    }
  );
});

test("getPet returns 404 when pet does not exist", async () => {
  await assert.rejects(
    () =>
      getPet(ownerId, petId, {
        findPetByIdForOwner: async () => null
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );
});

test("getPet returns 404 when pet belongs to another owner", async () => {
  await assert.rejects(
    () =>
      getPet(otherOwnerId, petId, {
        findPetByIdForOwner: async (_id, owner) => {
          assert.equal(owner.toString(), otherOwnerId);
          return null;
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );
});

test("getPet rejects invalid owner id with UNAUTHORIZED", async () => {
  await assert.rejects(
    () =>
      getPet("not-an-id", petId, {
        findPetByIdForOwner: async () => {
          throw new Error("should not be called");
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});
