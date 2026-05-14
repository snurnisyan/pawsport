import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/middleware/errorHandler";
import { deleteCurrentUser } from "../src/services/userService";

const userId = "507f1f77bcf86cd799439011";

const assertAppError = (statusCode: number, code: string) => (error: unknown): true => {
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.code, code);
  return true;
};

test("deleteCurrentUser cleans storage before domain records and removes the user", async () => {
  const order: string[] = [];

  await deleteCurrentUser(userId, {
    findUserForDeletion: async (id) => {
      assert.equal(id.toString(), userId);
      order.push("find");
      return { _id: id };
    },
    deleteOwnedFiles: async () => {
      order.push("files");
    },
    deleteOwnedExports: async () => {
      order.push("exports");
    },
    deleteEventsForOwner: async () => {
      order.push("events");
    },
    deleteRemindersForOwner: async () => {
      order.push("reminders");
    },
    deletePetsForOwner: async () => {
      order.push("pets");
    },
    deleteUserRecord: async () => {
      order.push("user");
      return true;
    }
  });

  assert.deepEqual(order, [
    "find",
    "files",
    "exports",
    "events",
    "reminders",
    "pets",
    "user"
  ]);
});

test("deleteCurrentUser returns 404 when the user does not exist", async () => {
  let storageCalled = false;

  await assert.rejects(
    () =>
      deleteCurrentUser(userId, {
        findUserForDeletion: async () => null,
        deleteOwnedFiles: async () => {
          storageCalled = true;
        },
        deleteUserRecord: async () => {
          throw new Error("should not be called");
        }
      }),
    assertAppError(404, "USER_NOT_FOUND")
  );

  assert.equal(storageCalled, false);
});

test("deleteCurrentUser returns 401 for an invalid user id", async () => {
  let findCalled = false;

  await assert.rejects(
    () =>
      deleteCurrentUser("not-an-objectid", {
        findUserForDeletion: async () => {
          findCalled = true;
          return null;
        }
      }),
    assertAppError(401, "UNAUTHORIZED")
  );

  assert.equal(findCalled, false);
});

test("deleteCurrentUser propagates file storage failure and keeps domain records", async () => {
  let domainTouched = false;

  await assert.rejects(
    () =>
      deleteCurrentUser(userId, {
        findUserForDeletion: async (id) => ({ _id: id }),
        deleteOwnedFiles: async () => {
          throw new AppError(502, "FILE_STORAGE_DELETE_FAILED", "Could not delete file from storage");
        },
        deleteOwnedExports: async () => {
          domainTouched = true;
        },
        deleteEventsForOwner: async () => {
          domainTouched = true;
        },
        deleteRemindersForOwner: async () => {
          domainTouched = true;
        },
        deletePetsForOwner: async () => {
          domainTouched = true;
        },
        deleteUserRecord: async () => {
          domainTouched = true;
          return true;
        }
      }),
    assertAppError(502, "FILE_STORAGE_DELETE_FAILED")
  );

  assert.equal(domainTouched, false);
});

test("deleteCurrentUser propagates export storage failure and keeps domain records", async () => {
  let domainTouched = false;

  await assert.rejects(
    () =>
      deleteCurrentUser(userId, {
        findUserForDeletion: async (id) => ({ _id: id }),
        deleteOwnedFiles: async () => {},
        deleteOwnedExports: async () => {
          throw new AppError(502, "EXPORT_STORAGE_DELETE_FAILED", "Could not delete export from storage");
        },
        deleteEventsForOwner: async () => {
          domainTouched = true;
        },
        deleteRemindersForOwner: async () => {
          domainTouched = true;
        },
        deletePetsForOwner: async () => {
          domainTouched = true;
        },
        deleteUserRecord: async () => {
          domainTouched = true;
          return true;
        }
      }),
    assertAppError(502, "EXPORT_STORAGE_DELETE_FAILED")
  );

  assert.equal(domainTouched, false);
});

test("deleteCurrentUser succeeds when storage cleanup tolerated missing objects", async () => {
  let userDeleted = false;

  await deleteCurrentUser(userId, {
    findUserForDeletion: async (id) => ({ _id: id }),
    deleteOwnedFiles: async () => {},
    deleteOwnedExports: async () => {},
    deleteEventsForOwner: async () => {},
    deleteRemindersForOwner: async () => {},
    deletePetsForOwner: async () => {},
    deleteUserRecord: async () => {
      userDeleted = true;
      return true;
    }
  });

  assert.equal(userDeleted, true);
});

test("deleteCurrentUser returns 404 if the user vanished during cleanup", async () => {
  await assert.rejects(
    () =>
      deleteCurrentUser(userId, {
        findUserForDeletion: async (id) => ({ _id: id }),
        deleteOwnedFiles: async () => {},
        deleteOwnedExports: async () => {},
        deleteEventsForOwner: async () => {},
        deleteRemindersForOwner: async () => {},
        deletePetsForOwner: async () => {},
        deleteUserRecord: async () => false
      }),
    assertAppError(404, "USER_NOT_FOUND")
  );
});

test("deleteCurrentUser passes the owner id through to every cascade dependency", async () => {
  const seen: Array<{ stage: string; owner: string }> = [];
  const record = (stage: string) => async (owner: Types.ObjectId) => {
    seen.push({ stage, owner: owner.toString() });
  };

  await deleteCurrentUser(userId, {
    findUserForDeletion: async (id) => {
      seen.push({ stage: "find", owner: id.toString() });
      return { _id: id };
    },
    deleteOwnedFiles: record("files"),
    deleteOwnedExports: record("exports"),
    deleteEventsForOwner: record("events"),
    deleteRemindersForOwner: record("reminders"),
    deletePetsForOwner: record("pets"),
    deleteUserRecord: async (owner) => {
      seen.push({ stage: "user", owner: owner.toString() });
      return true;
    }
  });

  for (const entry of seen) {
    assert.equal(entry.owner, userId);
  }
});
