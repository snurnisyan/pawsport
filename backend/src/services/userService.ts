import { isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { UserModel, type IUser } from "../models/User";

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
