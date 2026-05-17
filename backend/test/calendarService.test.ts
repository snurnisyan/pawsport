import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import { getCalendar } from "../src/services/calendarService";

const ownerId = "507f1f77bcf86cd799439011";
const otherOwnerId = "507f1f77bcf86cd799439099";
const petId = "60a7c1aa9e1d4f1234567890";
const otherPetId = "60a7c1aa9e1d4f1234567891";
const eventId = "60a7c1aa9e1d4f12345678ab";

const makeEventRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(eventId),
  ownerId: new Types.ObjectId(ownerId),
  petId: new Types.ObjectId(petId),
  type: "vaccine" as const,
  title: "Rabies booster",
  eventDate: new Date("2026-06-10T10:00:00.000Z"),
  fileIds: [],
  createdAt: new Date("2026-05-12T00:00:00.000Z"),
  updatedAt: new Date("2026-05-12T00:00:00.000Z"),
  ...overrides
});

test("getCalendar returns events in range filtered by owner", async () => {
  let eventParams: Record<string, unknown> | undefined;

  const result = await getCalendar(
    ownerId,
    { from: "2026-06-01", to: "2026-06-30" },
    {
      listEventsInRange: async (params) => {
        eventParams = params as unknown as Record<string, unknown>;
        return [makeEventRecord()];
      }
    }
  );

  assert.equal((eventParams?.ownerId as Types.ObjectId).toString(), ownerId);
  assert.equal((eventParams?.from as Date).toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal((eventParams?.to as Date).toISOString(), "2026-06-30T23:59:59.999Z");
  assert.equal(eventParams?.petIds, undefined);
  assert.equal(eventParams?.eventTypes, undefined);

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, eventId);
});

test("getCalendar passes petIds and eventTypes filters to the event repository", async () => {
  let eventParams: Record<string, unknown> | undefined;

  await getCalendar(
    ownerId,
    { from: "2026-06-01", to: "2026-06-30", petIds: [petId, otherPetId], eventTypes: ["vaccine", "lab", "visit"] },
    {
      listEventsInRange: async (params) => {
        eventParams = params as unknown as Record<string, unknown>;
        return [];
      }
    }
  );

  assert.deepEqual((eventParams?.petIds as Types.ObjectId[] | undefined)?.map((id) => id.toString()), [
    petId,
    otherPetId
  ]);
  assert.deepEqual(eventParams?.eventTypes, ["vaccine", "lab", "visit"]);
});

test("getCalendar returns empty result when nothing matches", async () => {
  const result = await getCalendar(
    ownerId,
    { from: "2027-01-01", to: "2027-01-31" },
    {
      listEventsInRange: async () => []
    }
  );

  assert.deepEqual(result, { events: [] });
});

test("getCalendar defaults to current month when from/to are absent", async () => {
  let eventParams: Record<string, unknown> | undefined;

  await getCalendar(
    ownerId,
    {},
    {
      now: () => new Date("2026-05-13T12:00:00.000Z"),
      listEventsInRange: async (params) => {
        eventParams = params as unknown as Record<string, unknown>;
        return [];
      }
    }
  );

  assert.equal((eventParams?.from as Date).toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal((eventParams?.to as Date).toISOString(), "2026-05-31T23:59:59.999Z");
});

test("getCalendar rejects malformed from with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "06/01/2026", to: "2026-06-30" },
        {
          listEventsInRange: async () => {
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

test("getCalendar rejects malformed to with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "2026-06-01", to: "not-a-date" },
        {
          listEventsInRange: async () => {
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

test("getCalendar treats empty petIds and eventTypes as absent filters", async () => {
  let eventParams: Record<string, unknown> | undefined;

  await getCalendar(
    ownerId,
    { from: "2026-06-01", to: "2026-06-30", petIds: [], eventTypes: "" },
    {
      listEventsInRange: async (params) => {
        eventParams = params as unknown as Record<string, unknown>;
        return [];
      }
    }
  );

  assert.equal(eventParams?.petIds, undefined);
  assert.equal(eventParams?.eventTypes, undefined);
});

test("getCalendar accepts comma-separated petIds and eventTypes", async () => {
  let eventParams: Record<string, unknown> | undefined;

  await getCalendar(
    ownerId,
    {
      from: "2026-06-01",
      to: "2026-06-30",
      petIds: `${petId},${otherPetId}`,
      eventTypes: "vaccine,lab,other"
    },
    {
      listEventsInRange: async (params) => {
        eventParams = params as unknown as Record<string, unknown>;
        return [];
      }
    }
  );

  assert.deepEqual((eventParams?.petIds as Types.ObjectId[] | undefined)?.map((id) => id.toString()), [
    petId,
    otherPetId
  ]);
  assert.deepEqual(eventParams?.eventTypes, ["vaccine", "lab", "other"]);
});

test("getCalendar rejects invalid petIds with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "2026-06-01", to: "2026-06-30", petIds: ["not-an-id"] },
        {
          listEventsInRange: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_PET_IDS");
      return true;
    }
  );
});

test("getCalendar rejects invalid eventTypes with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "2026-06-01", to: "2026-06-30", eventTypes: ["grooming"] },
        {
          listEventsInRange: async () => {
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

test("getCalendar rejects from > to with 400", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        ownerId,
        { from: "2026-07-01", to: "2026-06-01" },
        {
          listEventsInRange: async () => {
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

test("getCalendar isolates by owner — other owner sees empty result", async () => {
  let eventOwner: string | undefined;

  const result = await getCalendar(
    otherOwnerId,
    { from: "2026-06-01", to: "2026-06-30" },
    {
      listEventsInRange: async (params) => {
        eventOwner = params.ownerId.toString();
        return [];
      }
    }
  );

  assert.equal(eventOwner, otherOwnerId);
  assert.deepEqual(result, { events: [] });
});

test("getCalendar rejects invalid owner id with UNAUTHORIZED", async () => {
  await assert.rejects(
    () =>
      getCalendar(
        "not-an-id",
        { from: "2026-06-01", to: "2026-06-30" },
        {
          listEventsInRange: async () => {
            throw new Error("should not be called");
          }
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("getCalendar petIds filter excludes events for other pets via repository contract", async () => {
  const result = await getCalendar(
    ownerId,
    { from: "2026-06-01", to: "2026-06-30", petIds: [petId] },
    {
      listEventsInRange: async (params) => {
        assert.deepEqual(params.petIds?.map((id) => id.toString()), [petId]);
        return [makeEventRecord({ petId: new Types.ObjectId(petId) })];
      }
    }
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].petId, petId);
  assert.notEqual(result.events[0].petId, otherPetId);
});
