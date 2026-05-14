import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { EventModel } from "../models/Event";
import { PetModel } from "../models/Pet";
import { ReminderModel } from "../models/Reminder";
import { UserModel, type IUser } from "../models/User";
import { deleteAllExportsForOwner } from "./exportService";
import { deleteAllFilesForOwner } from "./fileService";

type PublicUser = Pick<
  IUser,
  "_id" | "email" | "status" | "emailVerified" | "consentAcceptedAt" | "createdAt" | "updatedAt"
>;

export interface SerializedUser {
  id: string;
  email: string;
  status: IUser["status"];
  emailVerified: boolean;
  consentAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserServiceDependencies {
  findUserById?: (id: string) => Promise<PublicUser | null>;
}

export const serializeUser = (user: PublicUser): SerializedUser => ({
  id: user._id.toString(),
  email: user.email,
  status: user.status,
  emailVerified: user.emailVerified,
  consentAcceptedAt: user.consentAcceptedAt.toISOString(),
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});

export const getCurrentUser = async (
  userId: string,
  dependencies: UserServiceDependencies = {}
): Promise<SerializedUser> => {
  const {
    findUserById = async (id) => UserModel.findById(id).exec() as Promise<PublicUser | null>
  } = dependencies;

  if (!isValidObjectId(userId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }

  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  }

  return serializeUser(user);
};

type UserExistence = Pick<IUser, "_id">;

export interface DeleteUserDependencies {
  findUserForDeletion?: (id: Types.ObjectId) => Promise<UserExistence | null>;
  deleteOwnedFiles?: (ownerId: Types.ObjectId) => Promise<void>;
  deleteOwnedExports?: (ownerId: Types.ObjectId) => Promise<void>;
  deleteEventsForOwner?: (ownerId: Types.ObjectId) => Promise<void>;
  deleteRemindersForOwner?: (ownerId: Types.ObjectId) => Promise<void>;
  deletePetsForOwner?: (ownerId: Types.ObjectId) => Promise<void>;
  deleteUserRecord?: (ownerId: Types.ObjectId) => Promise<boolean>;
}

export const deleteCurrentUser = async (
  userId: string,
  dependencies: DeleteUserDependencies = {}
): Promise<void> => {
  const {
    findUserForDeletion = async (id) =>
      UserModel.findById(id).select({ _id: 1 }).exec() as Promise<UserExistence | null>,
    deleteOwnedFiles = async (owner) => {
      await deleteAllFilesForOwner(owner);
    },
    deleteOwnedExports = async (owner) => {
      await deleteAllExportsForOwner(owner);
    },
    deleteEventsForOwner = async (owner) => {
      await EventModel.deleteMany({ ownerId: owner }).exec();
    },
    deleteRemindersForOwner = async (owner) => {
      await ReminderModel.deleteMany({ ownerId: owner }).exec();
    },
    deletePetsForOwner = async (owner) => {
      await PetModel.deleteMany({ ownerId: owner }).exec();
    },
    deleteUserRecord = async (owner) => {
      const result = await UserModel.deleteOne({ _id: owner }).exec();
      return result.deletedCount === 1;
    }
  } = dependencies;

  if (!isValidObjectId(userId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }

  const userObjectId = new Types.ObjectId(userId);
  const existing = await findUserForDeletion(userObjectId);

  if (!existing) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  }

  // Storage-backed cleanup first so a failure leaves all metadata intact for safe retry.
  await deleteOwnedFiles(userObjectId);
  await deleteOwnedExports(userObjectId);

  await deleteEventsForOwner(userObjectId);
  await deleteRemindersForOwner(userObjectId);
  await deletePetsForOwner(userObjectId);

  const deleted = await deleteUserRecord(userObjectId);
  if (!deleted) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  }
};
