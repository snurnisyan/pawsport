import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const USER_STATUSES = ["pending", "active"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  status: UserStatus;
  emailVerified: boolean;
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  consentAcceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "active",
      required: true
    },
    emailVerified: {
      type: Boolean,
      default: false,
      required: true
    },
    verificationTokenHash: {
      type: String
    },
    verificationTokenExpiresAt: {
      type: Date
    },
    resetTokenHash: {
      type: String
    },
    resetTokenExpiresAt: {
      type: Date
    },
    consentAcceptedAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    collection: "users"
  }
);

export const UserModel = model<IUser>("User", userSchema);
