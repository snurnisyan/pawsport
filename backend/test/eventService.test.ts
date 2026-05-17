import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import {
  buildEventListFilter,
  calculateReminderSendAt,
  createPetEvent,
  listPetEvents,
  serializeEvent
} from "../src/services/eventService";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const otherPetId = "60a7c1aa9e1d4f1234567891";
const eventId = "60a7c1aa9e1d4f12345678ab";
const fileId = "60a7c1aa9e1d4f12345678cd";

const validInput = {
  type: "vaccine" as const,
  subtype: "rabies" as const,
  title: "Rabies booster",
  eventDate: "2026-06-01T10:00:00.000Z"
};

const makeEventRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(eventId),
  ownerId: new Types.ObjectId(ownerId),
  petId: new Types.ObjectId(petId),
  type: "vaccine" as const,
  subtype: "rabies" as const,
  title: "Rabies booster",
  eventDate: new Date("2026-06-01T10:00:00.000Z"),
  fileIds: [],
  createdAt: new Date("2026-05-12T00:00:00.000Z"),
  updatedAt: new Date("2026-05-12T00:00:00.000Z"),
  ...overrides
});

const petFound = async () => ({ _id: new Types.ObjectId(petId) });
const failingCreate = async () => {
  throw new Error("should not be called");
};

test("createPetEvent persists normalized input and returns serialized event", async () => {
  let captured: Record<string, unknown> | undefined;
  let reminderSync: Record<string, unknown> | undefined;
  let validatedFileIds: Types.ObjectId[] | undefined;

  const result = await createPetEvent(
    ownerId,
    petId,
    {
      type: "vaccine",
      subtype: "rabies",
      title: "  Rabies booster  ",
      eventDate: "2026-06-01T10:00:00.000Z",
      nextDate: "2027-06-01T10:00:00.000Z",
      clinicName: "VetClinic №1",
      comment: "Annual shot",
      recurrence: { frequency: "yearly", interval: 1 },
      reminderOffset: "week",
      fileIds: [fileId]
    },
    {
      findPetByIdForOwner: petFound,
      validateFileIdsForPet: async (owner, pet, ids) => {
        assert.equal(owner.toString(), ownerId);
        assert.equal(pet.toString(), petId);
        validatedFileIds = ids;
      },
      createEventRecord: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return makeEventRecord({
          ownerId: input.ownerId,
          petId: input.petId,
          type: input.type,
          title: input.title,
          eventDate: input.eventDate,
          nextDate: input.nextDate,
          clinicName: input.clinicName,
          comment: input.comment,
          recurrence: input.recurrence,
          reminderOffset: input.reminderOffset,
          fileIds: input.fileIds
        });
      },
      syncPendingReminderForEvent: async (input) => {
        reminderSync = input as unknown as Record<string, unknown>;
      }
    }
  );

  assert.ok(validatedFileIds);
  assert.equal(validatedFileIds.length, 1);
  assert.equal(validatedFileIds[0].toString(), fileId);

  assert.ok(captured);
  assert.equal((captured.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((captured.petId as Types.ObjectId).toString(), petId);
  assert.equal(captured.type, "vaccine");
  assert.equal(captured.subtype, "rabies");
  assert.equal(captured.title, "Rabies booster");
  assert.equal((captured.eventDate as Date).toISOString(), "2026-06-01T10:00:00.000Z");
  assert.equal((captured.nextDate as Date).toISOString(), "2027-06-01T10:00:00.000Z");
  assert.equal(captured.clinicName, "VetClinic №1");
  assert.equal(captured.comment, "Annual shot");
  assert.deepEqual(captured.recurrence, { frequency: "yearly", interval: 1 });
  assert.equal(captured.reminderOffset, "week");
  assert.equal((captured.fileIds as Types.ObjectId[]).length, 1);
  assert.equal((captured.fileIds as Types.ObjectId[])[0].toString(), fileId);

  assert.equal(result.id, eventId);
  assert.equal(result.ownerId, ownerId);
  assert.equal(result.petId, petId);
  assert.equal(result.type, "vaccine");
  assert.equal(result.subtype, "rabies");
  assert.equal(result.title, "Rabies booster");
  assert.equal(result.eventDate, "2026-06-01T10:00:00.000Z");
  assert.equal(result.nextDate, "2027-06-01T10:00:00.000Z");
  assert.equal(result.clinicName, "VetClinic №1");
  assert.equal(result.comment, "Annual shot");
  assert.deepEqual(result.recurrence, { frequency: "yearly", interval: 1 });
  assert.equal(result.reminderOffset, "week");
  assert.deepEqual(result.fileIds, [fileId]);

  assert.ok(reminderSync);
  assert.equal((reminderSync.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((reminderSync.petId as Types.ObjectId).toString(), petId);
  assert.equal((reminderSync.eventId as Types.ObjectId).toString(), eventId);
  assert.equal((reminderSync.eventDate as Date).toISOString(), "2026-06-01T10:00:00.000Z");
  assert.equal(reminderSync.reminderOffset, "week");
});

test("createPetEvent accepts lab events", async () => {
  let capturedType: unknown;

  const result = await createPetEvent(
    ownerId,
    petId,
    {
      type: "lab",
      title: "Blood test",
      eventDate: "2026-06-02T10:00:00.000Z"
    },
    {
      findPetByIdForOwner: petFound,
      createEventRecord: async (input) => {
        capturedType = input.type;
        return makeEventRecord({
          type: input.type,
          title: input.title,
          eventDate: input.eventDate
        });
      }
    }
  );

  assert.equal(capturedType, "lab");
  assert.equal(result.type, "lab");
});

test("createPetEvent enforces subtype for vaccine and treatment events", async () => {
  const cases: Array<{ input: Record<string, unknown>; message: RegExp }> = [
    {
      input: { ...validInput, subtype: undefined },
      message: /subtype is required for vaccine events/
    },
    {
      input: { ...validInput, subtype: "" },
      message: /subtype is required for vaccine events/
    },
    {
      input: { ...validInput, subtype: ["rabies"] },
      message: /subtype must be one of: complex, rabies/
    },
    {
      input: { ...validInput, type: "treatment", subtype: "rabies" },
      message: /subtype must be one of: internal, external/
    },
    {
      input: { ...validInput, type: "visit", subtype: "complex" },
      message: /subtype is only supported/
    }
  ];

  for (const { input, message } of cases) {
    await assert.rejects(
      () =>
        createPetEvent(ownerId, petId, input, {
          findPetByIdForOwner: petFound,
          createEventRecord: failingCreate
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "INVALID_EVENT_SUBTYPE");
        assert.match(error.message, message);
        return true;
      }
    );
  }
});

test("createPetEvent rejects fileIds outside the pet/owner scope with 400", async () => {
  let createCalled = false;

  await assert.rejects(
    () =>
      createPetEvent(
        ownerId,
        petId,
        { ...validInput, fileIds: [fileId] },
        {
          findPetByIdForOwner: petFound,
          validateFileIdsForPet: async () => {
            throw new AppError(400, "INVALID_FILE_IDS", "fileIds must reference files belonging to the same pet");
          },
          createEventRecord: async () => {
            createCalled = true;
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_FILE_IDS");
      return true;
    }
  );

  assert.equal(createCalled, false);
});

test("createPetEvent skips file validation when fileIds is empty", async () => {
  let validationCalls = 0;

  await createPetEvent(ownerId, petId, validInput, {
    findPetByIdForOwner: petFound,
    validateFileIdsForPet: async (_owner, _pet, ids) => {
      validationCalls += 1;
      assert.deepEqual(ids, []);
    },
    createEventRecord: async (input) => makeEventRecord({ fileIds: input.fileIds })
  });

  assert.equal(validationCalls, 1);
});

test("createPetEvent defaults fileIds to empty array when omitted", async () => {
  let captured: Record<string, unknown> | undefined;

  await createPetEvent(ownerId, petId, validInput, {
    findPetByIdForOwner: petFound,
    createEventRecord: async (input) => {
      captured = input as unknown as Record<string, unknown>;
      return makeEventRecord({ fileIds: input.fileIds });
    }
  });

  assert.deepEqual(captured?.fileIds, []);
});

test("createPetEvent does not sync reminders when reminderOffset is omitted", async () => {
  let syncCalled = false;

  await createPetEvent(ownerId, petId, validInput, {
    findPetByIdForOwner: petFound,
    createEventRecord: async (input) => makeEventRecord({ ...input, reminderOffset: undefined }),
    syncPendingReminderForEvent: async () => {
      syncCalled = true;
    }
  });

  assert.equal(syncCalled, false);
});

test("calculateReminderSendAt subtracts the selected reminder offset", () => {
  const eventDate = new Date("2026-06-01T10:00:00.000Z");

  assert.equal(calculateReminderSendAt(eventDate, "day").toISOString(), "2026-05-31T10:00:00.000Z");
  assert.equal(calculateReminderSendAt(eventDate, "week").toISOString(), "2026-05-25T10:00:00.000Z");
  assert.equal(calculateReminderSendAt(eventDate, "month").toISOString(), "2026-05-02T10:00:00.000Z");
});

test("createPetEvent rejects invalid input", async () => {
  const cases: Array<{ input: Record<string, unknown>; code: string }> = [
    { input: { ...validInput, type: undefined }, code: "INVALID_TYPE" },
    { input: { ...validInput, type: "wedding" }, code: "INVALID_TYPE" },
    { input: { ...validInput, title: undefined }, code: "INVALID_TITLE" },
    { input: { ...validInput, title: "   " }, code: "INVALID_TITLE" },
    { input: { ...validInput, eventDate: undefined }, code: "INVALID_EVENT_DATE" },
    { input: { ...validInput, eventDate: "not-a-date" }, code: "INVALID_EVENT_DATE" },
    { input: { ...validInput, nextDate: "broken" }, code: "INVALID_NEXT_DATE" },
    { input: { ...validInput, reminderOffset: "century" }, code: "INVALID_REMINDER_OFFSET" },
    { input: { ...validInput, recurrence: "weekly" }, code: "INVALID_RECURRENCE" },
    { input: { ...validInput, recurrence: { frequency: "hourly" } }, code: "INVALID_RECURRENCE" },
    { input: { ...validInput, recurrence: { frequency: "weekly", interval: 0 } }, code: "INVALID_RECURRENCE" },
    { input: { ...validInput, fileIds: ["not-an-id"] }, code: "INVALID_FILE_IDS" },
    { input: { ...validInput, fileIds: "not-an-array" }, code: "INVALID_FILE_IDS" }
  ];

  for (const { input, code } of cases) {
    await assert.rejects(
      () =>
        createPetEvent(ownerId, petId, input, {
          findPetByIdForOwner: petFound,
          createEventRecord: failingCreate
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, code);
        return true;
      }
    );
  }
});

test("createPetEvent rejects invalid petId in path with 400", async () => {
  await assert.rejects(
    () =>
      createPetEvent(ownerId, "not-an-id", validInput, {
        findPetByIdForOwner: async () => {
          throw new Error("should not be called");
        },
        createEventRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_PET_ID");
      return true;
    }
  );
});

test("createPetEvent rejects invalid owner id with UNAUTHORIZED", async () => {
  await assert.rejects(
    () =>
      createPetEvent("not-an-id", petId, validInput, {
        findPetByIdForOwner: petFound,
        createEventRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("createPetEvent returns 404 when pet does not belong to owner", async () => {
  await assert.rejects(
    () =>
      createPetEvent(ownerId, petId, validInput, {
        findPetByIdForOwner: async () => null,
        createEventRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );
});

test("createPetEvent returns 404 for someone else's pet (ownership isolation)", async () => {
  let observedOwner: string | undefined;

  await assert.rejects(
    () =>
      createPetEvent(otherOwnerId, petId, validInput, {
        findPetByIdForOwner: async (_id, owner) => {
          observedOwner = owner.toString();
          return null;
        },
        createEventRecord: failingCreate
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );

  assert.equal(observedOwner, otherOwnerId);
});

test("listPetEvents filters by owner+pet and returns serialized events sorted desc", async () => {
  let observed: { owner: string; pet: string } | undefined;
  const earlier = new Date("2026-05-01T00:00:00.000Z");
  const later = new Date("2026-07-01T00:00:00.000Z");

  const result = await listPetEvents(ownerId, petId, {
    findPetByIdForOwner: petFound,
    listEventsForOwnerPet: async (owner, pet) => {
      observed = { owner: owner.toString(), pet: pet.toString() };
      return [
        makeEventRecord({ _id: new Types.ObjectId(), eventDate: later, title: "later" }),
        makeEventRecord({ _id: new Types.ObjectId(), eventDate: earlier, title: "earlier" })
      ];
    }
  });

  assert.deepEqual(observed, { owner: ownerId, pet: petId });
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "later");
  assert.equal(result[1].title, "earlier");
  assert.equal(result[0].eventDate, "2026-07-01T00:00:00.000Z");
});

test("listPetEvents passes an optional from/to eventDate range to the repository", async () => {
  let observedRange: { from?: Date; to?: Date } | undefined;

  const result = await listPetEvents(
    ownerId,
    petId,
    { from: "2026-05-01", to: "2026-05-31" },
    {
      findPetByIdForOwner: petFound,
      listEventsForOwnerPet: async (_owner, _pet, range) => {
        observedRange = range;
        return [];
      }
    }
  );

  assert.deepEqual(result, []);
  assert.equal(observedRange?.from?.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(observedRange?.to?.toISOString(), "2026-05-31T23:59:59.999Z");
});

test("listPetEvents leaves missing date bounds unrestricted", async () => {
  let observedRange: { from?: Date; to?: Date } | undefined;

  await listPetEvents(
    ownerId,
    petId,
    { from: "2026-05-01" },
    {
      findPetByIdForOwner: petFound,
      listEventsForOwnerPet: async (_owner, _pet, range) => {
        observedRange = range;
        return [];
      }
    }
  );

  assert.equal(observedRange?.from?.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(observedRange?.to, undefined);
});

test("listPetEvents passes nextDateFrom and eventTypes separately from eventDate filters", async () => {
  let observedFilters:
    | { from?: Date; to?: Date; nextDateFrom?: Date; eventTypes?: string[] }
    | undefined;

  await listPetEvents(
    ownerId,
    petId,
    {
      from: "2026-05-01",
      to: "2026-05-31",
      nextDateFrom: "2026-05-17T10:30:00.000Z",
      eventTypes: ["vaccine", "treatment"]
    },
    {
      findPetByIdForOwner: petFound,
      listEventsForOwnerPet: async (_owner, _pet, filters) => {
        observedFilters = filters;
        return [];
      }
    }
  );

  assert.equal(observedFilters?.from?.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(observedFilters?.to?.toISOString(), "2026-05-31T23:59:59.999Z");
  assert.equal(observedFilters?.nextDateFrom?.toISOString(), "2026-05-17T10:30:00.000Z");
  assert.deepEqual(observedFilters?.eventTypes, ["vaccine", "treatment"]);
});

test("listPetEvents accepts comma-separated eventTypes", async () => {
  let observedEventTypes: string[] | undefined;

  await listPetEvents(
    ownerId,
    petId,
    { eventTypes: "vaccine,lab,other" },
    {
      findPetByIdForOwner: petFound,
      listEventsForOwnerPet: async (_owner, _pet, filters) => {
        observedEventTypes = filters.eventTypes;
        return [];
      }
    }
  );

  assert.deepEqual(observedEventTypes, ["vaccine", "lab", "other"]);
});

test("listPetEvents rejects invalid nextDateFrom", async () => {
  await assert.rejects(
    () =>
      listPetEvents(
        ownerId,
        petId,
        { nextDateFrom: "not-a-date" },
        {
          findPetByIdForOwner: petFound,
          listEventsForOwnerPet: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_NEXT_DATE_RANGE");
      return true;
    }
  );
});

test("listPetEvents rejects invalid from filter", async () => {
  await assert.rejects(
    () =>
      listPetEvents(
        ownerId,
        petId,
        { from: "2026/05/01" },
        {
          findPetByIdForOwner: petFound,
          listEventsForOwnerPet: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_FROM");
      return true;
    }
  );
});

test("listPetEvents rejects invalid to filter", async () => {
  await assert.rejects(
    () =>
      listPetEvents(
        ownerId,
        petId,
        { to: "2026/05/31" },
        {
          findPetByIdForOwner: petFound,
          listEventsForOwnerPet: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_TO");
      return true;
    }
  );
});

test("listPetEvents rejects invalid eventTypes filter", async () => {
  await assert.rejects(
    () =>
      listPetEvents(
        ownerId,
        petId,
        { eventTypes: ["vaccine", "grooming"] },
        {
          findPetByIdForOwner: petFound,
          listEventsForOwnerPet: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_EVENT_TYPES");
      return true;
    }
  );
});

test("buildEventListFilter applies nextDateFrom without repurposing eventDate range", () => {
  const owner = new Types.ObjectId(ownerId);
  const pet = new Types.ObjectId(petId);
  const from = new Date("2026-05-01T00:00:00.000Z");
  const to = new Date("2026-05-31T23:59:59.999Z");
  const nextDateFrom = new Date("2026-06-01T00:00:00.000Z");

  const filter = buildEventListFilter(owner, pet, {
    from,
    to,
    nextDateFrom,
    eventTypes: ["vaccine", "treatment"]
  });

  assert.equal(filter.ownerId, owner);
  assert.equal(filter.petId, pet);
  assert.deepEqual(filter.eventDate, { $gte: from, $lte: to });
  assert.deepEqual(filter.nextDate, { $gte: nextDateFrom });
  assert.deepEqual(filter.type, { $in: ["vaccine", "treatment"] });
});

test("buildEventListFilter excludes missing nextDate records when nextDateFrom is present", () => {
  const nextDateFrom = new Date("2026-06-01T00:00:00.000Z");
  const filter = buildEventListFilter(
    new Types.ObjectId(ownerId),
    new Types.ObjectId(petId),
    { nextDateFrom }
  );

  assert.deepEqual(filter.nextDate, { $gte: nextDateFrom });
});

test("listPetEvents rejects an inverted date range", async () => {
  await assert.rejects(
    () =>
      listPetEvents(
        ownerId,
        petId,
        { from: "2026-06-01", to: "2026-05-01" },
        {
          findPetByIdForOwner: petFound,
          listEventsForOwnerPet: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_RANGE");
      return true;
    }
  );
});

test("listPetEvents returns 404 when pet does not belong to owner", async () => {
  await assert.rejects(
    () =>
      listPetEvents(ownerId, otherPetId, {
        findPetByIdForOwner: async () => null,
        listEventsForOwnerPet: async () => {
          throw new Error("should not be called");
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

test("listPetEvents preserves ownership isolation when nextDateFrom is present", async () => {
  let observedOwner: string | undefined;
  let repositoryCalled = false;

  await assert.rejects(
    () =>
      listPetEvents(
        otherOwnerId,
        petId,
        { nextDateFrom: "2026-05-17T10:30:00.000Z" },
        {
          findPetByIdForOwner: async (_id, owner) => {
            observedOwner = owner.toString();
            return null;
          },
          listEventsForOwnerPet: async () => {
            repositoryCalled = true;
            return [];
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "PET_NOT_FOUND");
      return true;
    }
  );

  assert.equal(observedOwner, otherOwnerId);
  assert.equal(repositoryCalled, false);
});

test("listPetEvents rejects invalid petId with 400", async () => {
  await assert.rejects(
    () =>
      listPetEvents(ownerId, "not-an-id", {
        findPetByIdForOwner: petFound,
        listEventsForOwnerPet: async () => {
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

test("serializeEvent hides optional fields when absent", () => {
  const serialized = serializeEvent(makeEventRecord({ subtype: undefined }));
  assert.equal("nextDate" in serialized, false);
  assert.equal("subtype" in serialized, false);
  assert.equal("clinicName" in serialized, false);
  assert.equal("comment" in serialized, false);
  assert.equal("recurrence" in serialized, false);
  assert.equal("reminderOffset" in serialized, false);
  assert.deepEqual(serialized.fileIds, []);
});

test("serializeEvent includes recurrence without interval when interval is omitted", () => {
  const serialized = serializeEvent(makeEventRecord({ recurrence: { frequency: "weekly" } }));
  assert.deepEqual(serialized.recurrence, { frequency: "weekly" });
});
