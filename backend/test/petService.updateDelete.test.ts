import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import { deletePet, updatePet, type PetUpdates } from "../src/services/petService";

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

test("updatePet applies partial set and returns serialized pet", async () => {
  let captured: PetUpdates | undefined;

  const result = await updatePet(
    ownerId,
    petId,
    { weight: 33.4 },
    {
      updatePetRecord: async (id, owner, updates) => {
        assert.equal(id.toString(), petId);
        assert.equal(owner.toString(), ownerId);
        captured = updates;
        return makePetRecord({ weight: 33.4 });
      }
    }
  );

  assert.ok(captured);
  assert.deepEqual(captured.set, { weight: 33.4 });
  assert.deepEqual(captured.unset, []);
  assert.equal(result.weight, 33.4);
});

test("updatePet trims and validates string fields", async () => {
  let captured: PetUpdates | undefined;

  await updatePet(
    ownerId,
    petId,
    { name: "  Бублик  " },
    {
      updatePetRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makePetRecord({ name: "Бублик" });
      }
    }
  );

  assert.deepEqual(captured?.set, { name: "Бублик" });
});

test("updatePet unsets optional field when null is supplied", async () => {
  let captured: PetUpdates | undefined;

  await updatePet(
    ownerId,
    petId,
    { breed: null, weight: null },
    {
      updatePetRecord: async (_id, _owner, updates) => {
        captured = updates;
        return makePetRecord();
      }
    }
  );

  assert.deepEqual(captured?.set, {});
  assert.deepEqual(captured?.unset.sort(), ["breed", "weight"]);
});

test("updatePet ignores unknown fields in body", async () => {
  let updateCalled = false;
  const result = await updatePet(
    ownerId,
    petId,
    { somethingExtra: "yes", anotherUnknown: 1 } as Record<string, unknown>,
    {
      findPetByIdForOwner: async () => makePetRecord({ name: "Existing" }),
      updatePetRecord: async () => {
        updateCalled = true;
        throw new Error("should not be called");
      }
    }
  );

  assert.equal(updateCalled, false);
  assert.equal(result.name, "Existing");
});

test("updatePet returns current pet when body is empty", async () => {
  const result = await updatePet(
    ownerId,
    petId,
    {},
    {
      findPetByIdForOwner: async () => makePetRecord({ name: "Купер" }),
      updatePetRecord: async () => {
        throw new Error("should not be called");
      }
    }
  );

  assert.equal(result.name, "Купер");
});

test("updatePet returns 404 when pet not found", async () => {
  await assert.rejects(
    () =>
      updatePet(
        ownerId,
        petId,
        { weight: 12 },
        {
          updatePetRecord: async () => null
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );
});

test("updatePet returns 404 when empty body and pet missing or owned by another user", async () => {
  await assert.rejects(
    () =>
      updatePet(otherOwnerId, petId, {}, {
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

test("updatePet rejects invalid petId with 400", async () => {
  await assert.rejects(
    () => updatePet(ownerId, "not-an-id", { name: "X" }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_PET_ID");
      return true;
    }
  );
});

test("updatePet rejects clearing required fields", async () => {
  const cases: Array<{ input: Record<string, unknown>; code: string }> = [
    { input: { name: "" }, code: "INVALID_NAME" },
    { input: { name: null }, code: "INVALID_NAME" },
    { input: { species: "" }, code: "INVALID_SPECIES" },
    { input: { sex: null }, code: "INVALID_SEX" }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () => updatePet(ownerId, petId, input),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, code);
        return true;
      }
    );
  }
});

test("updatePet rejects invalid field formats", async () => {
  const cases: Array<{ input: Record<string, unknown>; code: string }> = [
    { input: { weight: -1 }, code: "INVALID_WEIGHT" },
    { input: { sex: "alien" }, code: "INVALID_SEX" },
    { input: { microchipNumber: "12345" }, code: "INVALID_MICROCHIP" },
    { input: { birthDate: "not-a-date" }, code: "INVALID_BIRTH_DATE" },
    { input: { tags: "not-an-array" }, code: "INVALID_TAGS" }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () => updatePet(ownerId, petId, input),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, code);
        return true;
      }
    );
  }
});

test("deletePet cleans storage before domain records and removes the pet last", async () => {
  const order: string[] = [];

  await deletePet(ownerId, petId, {
    findPetForDeletion: async (id, owner) => {
      assert.equal(id.toString(), petId);
      assert.equal(owner.toString(), ownerId);
      order.push("find");
      return { _id: id };
    },
    deleteFilesForPet: async (id, owner) => {
      assert.equal(id.toString(), petId);
      assert.equal(owner.toString(), ownerId);
      order.push("files");
    },
    deleteExportsForPet: async (id, owner) => {
      assert.equal(id.toString(), petId);
      assert.equal(owner.toString(), ownerId);
      order.push("exports");
    },
    deleteEventsForPet: async (id, owner) => {
      assert.equal(id.toString(), petId);
      assert.equal(owner.toString(), ownerId);
      order.push("events");
    },
    deleteRemindersForPet: async (id, owner) => {
      assert.equal(id.toString(), petId);
      assert.equal(owner.toString(), ownerId);
      order.push("reminders");
    },
    deletePetRecord: async (id, owner) => {
      assert.equal(id.toString(), petId);
      assert.equal(owner.toString(), ownerId);
      order.push("pet");
      return {
        _id: new Types.ObjectId(petId),
        ownerId: new Types.ObjectId(ownerId),
        name: "X",
        species: "dog",
        sex: "unknown",
        tags: [],
        notes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  });

  assert.deepEqual(order, ["find", "files", "exports", "events", "reminders", "pet"]);
});

test("deletePet returns 404 when pet does not exist or belongs to another owner", async () => {
  let cascadeCalled = false;
  let petRemoved = false;

  await assert.rejects(
    () =>
      deletePet(ownerId, petId, {
        findPetForDeletion: async () => null,
        deleteFilesForPet: async () => {
          cascadeCalled = true;
        },
        deleteExportsForPet: async () => {
          cascadeCalled = true;
        },
        deleteEventsForPet: async () => {
          cascadeCalled = true;
        },
        deleteRemindersForPet: async () => {
          cascadeCalled = true;
        },
        deletePetRecord: async () => {
          petRemoved = true;
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

  assert.equal(cascadeCalled, false);
  assert.equal(petRemoved, false);
});

test("deletePet propagates file storage failures and keeps domain records intact", async () => {
  let domainTouched = false;
  let petRemoved = false;

  await assert.rejects(
    () =>
      deletePet(ownerId, petId, {
        findPetForDeletion: async (id) => ({ _id: id }),
        deleteFilesForPet: async () => {
          throw new AppError(502, "FILE_STORAGE_DELETE_FAILED", "Could not delete file from storage");
        },
        deleteExportsForPet: async () => {
          domainTouched = true;
        },
        deleteEventsForPet: async () => {
          domainTouched = true;
        },
        deleteRemindersForPet: async () => {
          domainTouched = true;
        },
        deletePetRecord: async () => {
          petRemoved = true;
          return null;
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "FILE_STORAGE_DELETE_FAILED");
      return true;
    }
  );

  assert.equal(domainTouched, false);
  assert.equal(petRemoved, false);
});

test("deletePet returns 404 if the pet vanished during cleanup", async () => {
  await assert.rejects(
    () =>
      deletePet(ownerId, petId, {
        findPetForDeletion: async (id) => ({ _id: id }),
        deleteFilesForPet: async () => {},
        deleteExportsForPet: async () => {},
        deleteEventsForPet: async () => {},
        deleteRemindersForPet: async () => {},
        deletePetRecord: async () => null
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );
});

test("deletePet rejects invalid petId with 400", async () => {
  await assert.rejects(
    () => deletePet(ownerId, "not-an-id"),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_PET_ID");
      return true;
    }
  );
});

test("deletePet rejects invalid owner with UNAUTHORIZED", async () => {
  await assert.rejects(
    () => deletePet("not-an-id", petId),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});
