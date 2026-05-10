import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { ALLOWED_FILE_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "../middleware/uploadMiddleware";

export type AllowedFileMimeType = (typeof ALLOWED_FILE_MIME_TYPES)[number];

export interface IStoredFile {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  eventId?: Types.ObjectId;
  originalName: string;
  mimeType: AllowedFileMimeType;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type StoredFileDocument = HydratedDocument<IStoredFile>;

const fileSchema = new Schema<IStoredFile>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    petId: {
      type: Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      index: true
    },
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      enum: ALLOWED_FILE_MIME_TYPES,
      required: true
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_FILE_SIZE_BYTES
    },
    storageKey: {
      type: String,
      required: true,
      unique: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true,
    collection: "files"
  }
);

fileSchema.index({ ownerId: 1, petId: 1, uploadedAt: -1 });
fileSchema.index({ ownerId: 1, originalName: "text" });

export const FileModel = model<IStoredFile>("File", fileSchema);
