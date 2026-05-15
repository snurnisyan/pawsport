import { basename } from "node:path";
import { Readable } from "node:stream";
import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { ALLOWED_FILE_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "../middleware/uploadMiddleware";
import { EventModel, type IEvent } from "../models/Event";
import { FileModel, type AllowedFileMimeType, type IStoredFile } from "../models/File";
import { PetModel, type IPet } from "../models/Pet";
import { isMissingObjectError, s3Storage, type FileStorage } from "../storage/s3Storage";

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadPetFileInput {
  file?: UploadedFileInput;
  eventId?: unknown;
}

export interface SerializedFile {
  id: string;
  ownerId: string;
  petId: string;
  eventId?: string;
  originalName: string;
  mimeType: AllowedFileMimeType;
  sizeBytes: number;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadedFile {
  body: Readable;
  originalName: string;
  mimeType: AllowedFileMimeType;
  sizeBytes: number;
}

type FileRecord = Pick<
  IStoredFile,
  | "_id"
  | "ownerId"
  | "petId"
  | "eventId"
  | "originalName"
  | "mimeType"
  | "sizeBytes"
  | "storageKey"
  | "uploadedAt"
  | "createdAt"
  | "updatedAt"
>;

type PetRecord = Pick<IPet, "_id">;
type EventRecord = Pick<IEvent, "_id" | "petId">;

interface CreateFilePersistInput {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  eventId?: Types.ObjectId;
  originalName: string;
  mimeType: AllowedFileMimeType;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: Date;
}

export interface FileServiceDependencies {
  storage?: FileStorage;
  findPetByIdForOwner?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<PetRecord | null>;
  findEventByIdForOwner?: (eventId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<EventRecord | null>;
  createFileRecord?: (input: CreateFilePersistInput) => Promise<FileRecord>;
  listFilesForPet?: (ownerId: Types.ObjectId, petId: Types.ObjectId) => Promise<FileRecord[]>;
  findFileByIdForOwner?: (fileId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<FileRecord | null>;
  deleteFileRecord?: (fileId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<FileRecord | null>;
  removeFileIdFromEvents?: (fileId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<void>;
  now?: () => Date;
}

const requireOwnerId = (ownerId: string): Types.ObjectId => {
  if (!isValidObjectId(ownerId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }
  return new Types.ObjectId(ownerId);
};

const requireObjectId = (value: string, message: string): Types.ObjectId => {
  if (!isValidObjectId(value)) {
    throw new AppError(400, "INVALID_ID", message);
  }
  return new Types.ObjectId(value);
};

const parseOptionalEventId = (value: unknown): Types.ObjectId | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new AppError(400, "INVALID_EVENT_ID", "eventId must be a valid id");
  }
  return new Types.ObjectId(value);
};

const defaultFindPet: NonNullable<FileServiceDependencies["findPetByIdForOwner"]> = async (
  petId,
  ownerId
) =>
  PetModel.findOne({ _id: petId, ownerId })
    .select({ _id: 1 })
    .exec() as Promise<PetRecord | null>;

const defaultFindEvent: NonNullable<FileServiceDependencies["findEventByIdForOwner"]> = async (
  eventId,
  ownerId
) =>
  EventModel.findOne({ _id: eventId, ownerId })
    .select({ _id: 1, petId: 1 })
    .exec() as Promise<EventRecord | null>;

const isAllowedMimeType = (mimeType: string): mimeType is AllowedFileMimeType =>
  (ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(mimeType);

const sanitizeOriginalName = (name: string): string => {
  const base = basename(name).replace(/[^\w.\- ]+/g, "_").trim();
  return base.length > 0 ? base.slice(0, 160) : "file";
};

const buildStorageKey = (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  fileId: Types.ObjectId,
  originalName: string
): string =>
  `users/${ownerId.toString()}/pets/${petId.toString()}/files/${fileId.toString()}/${sanitizeOriginalName(originalName)}`;

const toStorageError = (error: unknown, code: string, message: string): AppError => {
  if (isMissingObjectError(error) && code === "FILE_STORAGE_GET_FAILED") {
    return new AppError(404, "FILE_NOT_FOUND", "File was not found");
  }
  return new AppError(502, code, message);
};

export const serializeFile = (file: FileRecord): SerializedFile => {
  const result: SerializedFile = {
    id: file._id.toString(),
    ownerId: file.ownerId.toString(),
    petId: file.petId.toString(),
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    uploadedAt: file.uploadedAt.toISOString(),
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString()
  };

  if (file.eventId) {
    result.eventId = file.eventId.toString();
  }

  return result;
};

export const uploadPetFile = async (
  ownerId: string,
  petId: string,
  input: UploadPetFileInput,
  dependencies: FileServiceDependencies = {}
): Promise<SerializedFile> => {
  const {
    storage = s3Storage,
    findPetByIdForOwner = defaultFindPet,
    findEventByIdForOwner = defaultFindEvent,
    createFileRecord = async (payload) => FileModel.create(payload) as unknown as FileRecord,
    now = () => new Date()
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requireObjectId(petId, "pet id must be a valid id");
  const file = input.file;

  if (!file) {
    throw new AppError(400, "FILE_REQUIRED", "file is required");
  }
  if (!isAllowedMimeType(file.mimetype)) {
    throw new AppError(400, "UNSUPPORTED_FILE_TYPE", "file type is not supported");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError(400, "FILE_TOO_LARGE", "file exceeds the maximum allowed size");
  }
  if (file.size <= 0) {
    throw new AppError(400, "EMPTY_FILE", "file must not be empty");
  }

  const pet = await findPetByIdForOwner(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const eventObjectId = parseOptionalEventId(input.eventId);
  if (eventObjectId) {
    const event = await findEventByIdForOwner(eventObjectId, ownerObjectId);
    if (!event) {
      throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
    }
    if (!event.petId.equals(petObjectId)) {
      throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
    }
  }

  const fileObjectId = new Types.ObjectId();
  const storageKey = buildStorageKey(ownerObjectId, petObjectId, fileObjectId, file.originalname);
  const uploadedAt = now();

  try {
    await storage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype
    });
  } catch (error) {
    throw toStorageError(error, "FILE_STORAGE_PUT_FAILED", "Could not upload file to storage");
  }

  const created = await createFileRecord({
    _id: fileObjectId,
    ownerId: ownerObjectId,
    petId: petObjectId,
    eventId: eventObjectId,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageKey,
    uploadedAt
  });

  return serializeFile(created);
};

export const listPetFiles = async (
  ownerId: string,
  petId: string,
  dependencies: FileServiceDependencies = {}
): Promise<SerializedFile[]> => {
  const {
    findPetByIdForOwner = defaultFindPet,
    listFilesForPet = async (owner, pet) =>
      FileModel.find({ ownerId: owner, petId: pet })
        .sort({ uploadedAt: -1 })
        .exec() as unknown as FileRecord[]
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requireObjectId(petId, "pet id must be a valid id");

  const pet = await findPetByIdForOwner(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const files = await listFilesForPet(ownerObjectId, petObjectId);
  return files.map(serializeFile);
};

export const downloadFile = async (
  ownerId: string,
  fileId: string,
  dependencies: FileServiceDependencies = {}
): Promise<DownloadedFile> => {
  const {
    storage = s3Storage,
    findFileByIdForOwner = async (id, owner) =>
      FileModel.findOne({ _id: id, ownerId: owner }).exec() as unknown as FileRecord | null
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const fileObjectId = requireObjectId(fileId, "file id must be a valid id");

  const file = await findFileByIdForOwner(fileObjectId, ownerObjectId);
  if (!file) {
    throw new AppError(404, "FILE_NOT_FOUND", "File was not found");
  }

  try {
    const object = await storage.getObject({ key: file.storageKey });
    return {
      body: object.body,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes
    };
  } catch (error) {
    throw toStorageError(error, "FILE_STORAGE_GET_FAILED", "Could not download file from storage");
  }
};

export const deleteFile = async (
  ownerId: string,
  fileId: string,
  dependencies: FileServiceDependencies = {}
): Promise<void> => {
  const {
    storage = s3Storage,
    findFileByIdForOwner = async (id, owner) =>
      FileModel.findOne({ _id: id, ownerId: owner }).exec() as unknown as FileRecord | null,
    deleteFileRecord = async (id, owner) =>
      FileModel.findOneAndDelete({ _id: id, ownerId: owner }).exec() as unknown as FileRecord | null,
    removeFileIdFromEvents = async (id, owner) => {
      await EventModel.updateMany(
        { ownerId: owner, fileIds: id },
        { $pull: { fileIds: id } }
      ).exec();
    }
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const fileObjectId = requireObjectId(fileId, "file id must be a valid id");

  const file = await findFileByIdForOwner(fileObjectId, ownerObjectId);
  if (!file) {
    throw new AppError(404, "FILE_NOT_FOUND", "File was not found");
  }

  try {
    await storage.deleteObject({ key: file.storageKey });
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw toStorageError(error, "FILE_STORAGE_DELETE_FAILED", "Could not delete file from storage");
    }
  }

  const deleted = await deleteFileRecord(fileObjectId, ownerObjectId);
  if (!deleted) {
    throw new AppError(404, "FILE_NOT_FOUND", "File was not found");
  }

  await removeFileIdFromEvents(fileObjectId, ownerObjectId);
};

export interface ValidateFileIdsDependencies {
  countFilesForPet?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    fileIds: Types.ObjectId[]
  ) => Promise<number>;
}

export const validateFileIdsForPet = async (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  fileIds: Types.ObjectId[],
  dependencies: ValidateFileIdsDependencies = {}
): Promise<void> => {
  if (fileIds.length === 0) {
    return;
  }

  const {
    countFilesForPet = async (owner, pet, ids) =>
      FileModel.countDocuments({ _id: { $in: ids }, ownerId: owner, petId: pet }).exec()
  } = dependencies;

  const uniqueIds = Array.from(
    new Map(fileIds.map((id) => [id.toString(), id])).values()
  );

  const count = await countFilesForPet(ownerId, petId, uniqueIds);
  if (count !== uniqueIds.length) {
    throw new AppError(
      400,
      "INVALID_FILE_IDS",
      "fileIds must reference files belonging to the same pet"
    );
  }
};

export interface DetachEventFromFilesDependencies {
  detachEventFromFileRecords?: (
    ownerId: Types.ObjectId,
    eventId: Types.ObjectId
  ) => Promise<void>;
}

export const detachEventFromFiles = async (
  ownerId: Types.ObjectId,
  eventId: Types.ObjectId,
  dependencies: DetachEventFromFilesDependencies = {}
): Promise<void> => {
  const {
    detachEventFromFileRecords = async (owner, event) => {
      await FileModel.updateMany(
        { ownerId: owner, eventId: event },
        { $unset: { eventId: "" } }
      ).exec();
    }
  } = dependencies;

  await detachEventFromFileRecords(ownerId, eventId);
};

type OwnerFileRecord = Pick<IStoredFile, "_id" | "storageKey">;

export interface DeleteOwnerFilesDependencies {
  storage?: FileStorage;
  listOwnerFiles?: (ownerId: Types.ObjectId) => Promise<OwnerFileRecord[]>;
  deleteOwnerFiles?: (ownerId: Types.ObjectId) => Promise<void>;
}

export interface DeletePetFilesDependencies {
  storage?: FileStorage;
  listPetFiles?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<OwnerFileRecord[]>;
  deletePetFileRecords?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<void>;
}

export const deleteAllFilesForPet = async (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  dependencies: DeletePetFilesDependencies = {}
): Promise<void> => {
  const {
    storage = s3Storage,
    listPetFiles = async (owner, pet) =>
      FileModel.find({ ownerId: owner, petId: pet })
        .select({ _id: 1, storageKey: 1 })
        .exec() as unknown as OwnerFileRecord[],
    deletePetFileRecords = async (owner, pet) => {
      await FileModel.deleteMany({ ownerId: owner, petId: pet }).exec();
    }
  } = dependencies;

  const files = await listPetFiles(ownerId, petId);

  for (const file of files) {
    try {
      await storage.deleteObject({ key: file.storageKey });
    } catch (error) {
      if (!isMissingObjectError(error)) {
        throw toStorageError(error, "FILE_STORAGE_DELETE_FAILED", "Could not delete file from storage");
      }
    }
  }

  await deletePetFileRecords(ownerId, petId);
};

export const deleteAllFilesForOwner = async (
  ownerId: Types.ObjectId,
  dependencies: DeleteOwnerFilesDependencies = {}
): Promise<void> => {
  const {
    storage = s3Storage,
    listOwnerFiles = async (owner) =>
      FileModel.find({ ownerId: owner })
        .select({ _id: 1, storageKey: 1 })
        .exec() as unknown as OwnerFileRecord[],
    deleteOwnerFiles = async (owner) => {
      await FileModel.deleteMany({ ownerId: owner }).exec();
    }
  } = dependencies;

  const files = await listOwnerFiles(ownerId);

  for (const file of files) {
    try {
      await storage.deleteObject({ key: file.storageKey });
    } catch (error) {
      if (!isMissingObjectError(error)) {
        throw toStorageError(error, "FILE_STORAGE_DELETE_FAILED", "Could not delete file from storage");
      }
    }
  }

  await deleteOwnerFiles(ownerId);
};
