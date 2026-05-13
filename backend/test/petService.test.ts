import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import { createPet, listPets, serializePet } from "../src/services/petService";

const ownerId = "507f1f77bcf86cd799439011";
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

test("createPet persists normalized input and returns serialized pet", async () => {
  let captured: Record<string, unknown> | undefined;

  const result = await createPet(
    ownerId,
    {
      name: "  Купер  ",
      species: "dog",
      breed: "Golden Retriever",
      birthDate: "2021-05-12",
      sex: "male",
      weight: 32.5,
      microchipNumber: "982000344211123",
      tags: ["cute", " dog "],
      notes: ["allergy: chicken"],
      vetContact: { name: "Юлия", phone: "+7", email: "VET@example.com" }
    },
    {
      createPetRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makePetRecord({
          name: input.name,
          species: input.species,
          breed: input.breed,
          birthDate: input.birthDate,
          sex: input.sex,
          weight: input.weight,
          microchipNumber: input.microchipNumber,
          tags: input.tags,
          notes: input.notes,
          vetContact: input.vetContact
        });
      }
    }
  );

  assert.ok(captured);
  assert.equal(captured.name, "Купер");
  assert.equal(captured.species, "dog");
  assert.equal(captured.breed, "Golden Retriever");
  assert.equal((captured.birthDate as Date).toISOString(), "2021-05-12T00:00:00.000Z");
  assert.equal(captured.sex, "male");
  assert.equal(captured.weight, 32.5);
  assert.equal(captured.microchipNumber, "982000344211123");
  assert.deepEqual(captured.tags, ["cute", "dog"]);
  assert.deepEqual(captured.notes, ["allergy: chicken"]);
  assert.deepEqual(captured.vetContact, {
    name: "Юлия",
    phone: "+7",
    email: "vet@example.com"
  });
  assert.equal((captured.ownerId as Types.ObjectId).toString(), ownerId);

  assert.equal(result.id, petId);
  assert.equal(result.ownerId, ownerId);
  assert.equal(result.name, "Купер");
  assert.equal(result.birthDate, "2021-05-12");
  assert.equal(result.weight, 32.5);
});

test("createPet defaults sex to unknown and empty arrays when omitted", async () => {
  let captured: Record<string, unknown> | undefined;

  await createPet(
    ownerId,
    { name: "Бублик", species: "cat" },
    {
      createPetRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makePetRecord({
          name: input.name,
          species: input.species,
          sex: input.sex,
          tags: input.tags,
          notes: input.notes
        });
      }
    }
  );

  assert.equal(captured?.sex, "unknown");
  assert.deepEqual(captured?.tags, []);
  assert.deepEqual(captured?.notes, []);
});

test("createPet rejects invalid input", async () => {
  const failingCreate = async () => {
    throw new Error("should not be called");
  };

  const cases: Array<{ input: Record<string, unknown>; code: string }> = [
    { input: { species: "dog" }, code: "INVALID_NAME" },
    { input: { name: "Купер" }, code: "INVALID_SPECIES" },
    { input: { name: "Купер", species: "dog", sex: "alien" }, code: "INVALID_SEX" },
    { input: { name: "Купер", species: "dog", weight: -1 }, code: "INVALID_WEIGHT" },
    { input: { name: "Купер", species: "dog", microchipNumber: "12345" }, code: "INVALID_MICROCHIP" },
    { input: { name: "Купер", species: "dog", birthDate: "not-a-date" }, code: "INVALID_BIRTH_DATE" }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () => createPet(ownerId, input, { createPetRecord: failingCreate }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, code);
        return true;
      }
    );
  }
});

test("createPet rejects invalid owner id with UNAUTHORIZED", async () => {
  await assert.rejects(
    () => createPet("not-an-id", { name: "Купер", species: "dog" }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("listPets returns serialized pets for owner", async () => {
  const result = await listPets(ownerId, {
    listPetsForOwner: async (id) => {
      assert.equal(id.toString(), ownerId);
      return [makePetRecord(), makePetRecord({ _id: new Types.ObjectId(), name: "Бублик", species: "cat" })];
    }
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].name, "Купер");
  assert.equal(result[1].name, "Бублик");
});

test("serializePet hides optional fields when absent", () => {
  const serialized = serializePet(makePetRecord());
  assert.equal("breed" in serialized, false);
  assert.equal("birthDate" in serialized, false);
  assert.equal("weight" in serialized, false);
  assert.equal("microchipNumber" in serialized, false);
  assert.equal("vetContact" in serialized, false);
});
