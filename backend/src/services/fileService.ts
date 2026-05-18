import { basename } from "node:path";
import { Readable } from "node:stream";
import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { enqueueJob, type EnqueueJobInput } from "../jobs/backgroundJobService";
import { ALLOWED_FILE_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "../middleware/uploadMiddleware";
import { EventModel } from "../models/Event";
import { FileModel, type AllowedFileMimeType, type IStoredFile } from "../models/File";
import { PetModel, type IPet } from "../models/Pet";
import {
  getObjectDownloadUrl,
  isMissingObjectError,
  s3Storage,
  type FileStorage
} from "../storage/s3Storage";
import {
  parseOptionalDateRange,
  type DateRangeQuery,
  type OptionalDateRange
} from "./dateRange";

export const ALLOWED_PHOTO_MIME_TYPES = ["image/png", "image/jpeg"] as const;
export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];
export const TEMPORARY_EVENT_FILE_TTL_MS = 24 * 60 * 60 * 1000;
export const TEMPORARY_EVENT_FILE_CLEANUP_JOB_TYPE = "temporary-event-file-cleanup";

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadPetFileInput {
  file?: UploadedFileInput;
  temporaryForEvent?: unknown;
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
  | "tempExpiresAt"
  | "originalName"
  | "mimeType"
  | "sizeBytes"
  | "storageKey"
  | "uploadedAt"
  | "createdAt"
  | "updatedAt"
>;

type PetRecord = Pick<IPet, "_id" | "photoFileId">;

interface CreateFilePersistInput {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  tempExpiresAt?: Date;
  originalName: string;
  mimeType: AllowedFileMimeType;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: Date;
}

export interface FileServiceDependencies {
  storage?: FileStorage;
  findPetByIdForOwner?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<PetRecord | null>;
  createFileRecord?: (input: CreateFilePersistInput) => Promise<FileRecord>;
  enqueueTemporaryFileCleanup?: (input: EnqueueJobInput) => Promise<unknown>;
  listFilesForPet?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    range: OptionalDateRange
  ) => Promise<FileRecord[]>;
  findFileByIdForOwner?: (fileId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<FileRecord | null>;
  deleteFileRecord?: (fileId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<FileRecord | null>;
  removeFileIdFromEvents?: (fileId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<void>;
  now?: () => Date;
}

const isFileServiceDependencies = (
  value: DateRangeQuery | FileServiceDependencies
): value is FileServiceDependencies => {
  const candidate = value as FileServiceDependencies;
  return (
    candidate.storage !== undefined ||
    typeof candidate.findPetByIdForOwner === "function" ||
    typeof candidate.createFileRecord === "function" ||
    typeof candidate.enqueueTemporaryFileCleanup === "function" ||
    typeof candidate.listFilesForPet === "function" ||
    typeof candidate.findFileByIdForOwner === "function" ||
    typeof candidate.deleteFileRecord === "function" ||
    typeof candidate.removeFileIdFromEvents === "function" ||
    typeof candidate.now === "function"
  );
};

const requireOwnerId = (ownerId: string): Types.ObjectId => {
  if (!isValidObjectId(ownerId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }
  return new Types.ObjectId(ownerId);
};

const requireObjectId = (value: string, code: string, message: string): Types.ObjectId => {
  if (!isValidObjectId(value)) {
    throw new AppError(400, code, message);
  }
  return new Types.ObjectId(value);
};

const parseOptionalBoolean = (value: unknown, fieldName: string): boolean => {
  if (value === undefined || value === null || value === "") {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  throw new AppError(400, "INVALID_TEMPORARY_FOR_EVENT", `${fieldName} must be a boolean`);
};

const defaultFindPet: NonNullable<FileServiceDependencies["findPetByIdForOwner"]> = async (
  petId,
  ownerId
) =>
  PetModel.findOne({ _id: petId, ownerId })
    .select({ _id: 1, photoFileId: 1 })
    .exec() as Promise<PetRecord | null>;

const isAllowedMimeType = (mimeType: string): mimeType is AllowedFileMimeType =>
  (ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(mimeType);

const sanitizeOriginalName = (name: string): string => {
  const base = basename(name).replace(/[^\w.\- ]+/g, "_").trim();
  return base.length > 0 ? base.slice(0, 160) : "file";
};

const looksLikeLatin1DecodedUtf8 = (name: string): boolean =>
  /(?:[\u00c2\u00c3\u00d0\u00d1]|\u00e2[\u0080-\u00bf])/.test(name);

const normalizeOriginalName = (name: string): string => {
  if (!looksLikeLatin1DecodedUtf8(name)) {
    return name;
  }

  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("\ufffd") ? name : decoded;
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
    createFileRecord = async (payload) => FileModel.create(payload) as unknown as FileRecord,
    deleteFileRecord = async (id, owner) =>
      FileModel.findOneAndDelete({ _id: id, ownerId: owner }).exec() as unknown as FileRecord | null,
    enqueueTemporaryFileCleanup = enqueueJob,
    now = () => new Date()
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requireObjectId(petId, "INVALID_PET_ID", "petId must be a valid id");
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

  const temporaryForEvent = parseOptionalBoolean(input.temporaryForEvent, "temporaryForEvent");

  const fileObjectId = new Types.ObjectId();
  const originalName = normalizeOriginalName(file.originalname);
  const storageKey = buildStorageKey(ownerObjectId, petObjectId, fileObjectId, originalName);
  const uploadedAt = now();
  const tempExpiresAt = temporaryForEvent
    ? new Date(uploadedAt.getTime() + TEMPORARY_EVENT_FILE_TTL_MS)
    : undefined;

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
    tempExpiresAt,
    originalName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageKey,
    uploadedAt
  });

  if (tempExpiresAt) {
    try {
      await enqueueTemporaryFileCleanup({
        type: TEMPORARY_EVENT_FILE_CLEANUP_JOB_TYPE,
        payload: {
          fileId: fileObjectId.toString(),
          ownerId: ownerObjectId.toString()
        },
        runAt: tempExpiresAt,
        maxAttempts: 5,
        idempotencyKey: `${TEMPORARY_EVENT_FILE_CLEANUP_JOB_TYPE}:${fileObjectId.toString()}`
      });
    } catch (error) {
      await deleteFileRecord(fileObjectId, ownerObjectId);
      try {
        await storage.deleteObject({ key: storageKey });
      } catch {
        // Best effort: surface the enqueue failure because without the job the temp file may leak.
      }
      throw toStorageError(error, "TEMPORARY_FILE_CLEANUP_ENQUEUE_FAILED", "Could not schedule temporary file cleanup");
    }
  }

  return serializeFile(created);
};

export interface UploadPetPhotoInput {
  file?: UploadedFileInput;
}

export type PetPhotoPetRecord = Pick<
  IPet,
  | "_id"
  | "ownerId"
  | "name"
  | "species"
  | "breed"
  | "birthDate"
  | "sex"
  | "weight"
  | "photoFileId"
  | "microchipNumber"
  | "tags"
  | "notes"
  | "vetContact"
  | "createdAt"
  | "updatedAt"
>;

export interface UploadPetPhotoResult {
  file: SerializedFile;
  pet: PetPhotoPetRecord;
}

export interface UploadPetPhotoDependencies {
  storage?: FileStorage;
  findPetWithPhotoForOwner?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<PetPhotoPetRecord | null>;
  createFileRecord?: (input: CreateFilePersistInput) => Promise<FileRecord>;
  setPetPhoto?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId,
    photoFileId: Types.ObjectId
  ) => Promise<PetPhotoPetRecord | null>;
  findFileByIdForOwner?: (
    fileId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<FileRecord | null>;
  deleteFileRecord?: (
    fileId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<FileRecord | null>;
  now?: () => Date;
}

const isAllowedPhotoMimeType = (mimeType: string): mimeType is AllowedPhotoMimeType =>
  (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType);

const PET_PHOTO_FIELDS = {
  _id: 1,
  ownerId: 1,
  name: 1,
  species: 1,
  breed: 1,
  birthDate: 1,
  sex: 1,
  weight: 1,
  photoFileId: 1,
  microchipNumber: 1,
  tags: 1,
  notes: 1,
  vetContact: 1,
  createdAt: 1,
  updatedAt: 1
} as const;

const defaultFindPetWithPhoto: NonNullable<
  UploadPetPhotoDependencies["findPetWithPhotoForOwner"]
> = async (petId, ownerId) =>
  PetModel.findOne({ _id: petId, ownerId })
    .select(PET_PHOTO_FIELDS)
    .exec() as Promise<PetPhotoPetRecord | null>;

const defaultSetPetPhoto: NonNullable<UploadPetPhotoDependencies["setPetPhoto"]> = async (
  petId,
  ownerId,
  photoFileId
) =>
  PetModel.findOneAndUpdate(
    { _id: petId, ownerId },
    { $set: { photoFileId } },
    { new: true, projection: PET_PHOTO_FIELDS }
  ).exec() as Promise<PetPhotoPetRecord | null>;

export const uploadPetPhoto = async (
  ownerId: string,
  petId: string,
  input: UploadPetPhotoInput,
  dependencies: UploadPetPhotoDependencies = {}
): Promise<UploadPetPhotoResult> => {
  const {
    storage = s3Storage,
    findPetWithPhotoForOwner = defaultFindPetWithPhoto,
    createFileRecord = async (payload) => FileModel.create(payload) as unknown as FileRecord,
    setPetPhoto = defaultSetPetPhoto,
    findFileByIdForOwner = async (id, owner) =>
      FileModel.findOne({ _id: id, ownerId: owner }).exec() as unknown as FileRecord | null,
    deleteFileRecord = async (id, owner) =>
      FileModel.findOneAndDelete({ _id: id, ownerId: owner }).exec() as unknown as FileRecord | null,
    now = () => new Date()
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requireObjectId(petId, "INVALID_PET_ID", "petId must be a valid id");
  const file = input.file;

  if (!file) {
    throw new AppError(400, "FILE_REQUIRED", "file is required");
  }
  if (!isAllowedPhotoMimeType(file.mimetype)) {
    throw new AppError(
      400,
      "UNSUPPORTED_PHOTO_TYPE",
      "Pet photo must be image/png or image/jpeg"
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError(400, "FILE_TOO_LARGE", "file exceeds the maximum allowed size");
  }
  if (file.size <= 0) {
    throw new AppError(400, "EMPTY_FILE", "file must not be empty");
  }

  const existingPet = await findPetWithPhotoForOwner(petObjectId, ownerObjectId);
  if (!existingPet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }
  const previousPhotoFileId = existingPet.photoFileId;

  const fileObjectId = new Types.ObjectId();
  const originalName = normalizeOriginalName(file.originalname);
  const storageKey = buildStorageKey(ownerObjectId, petObjectId, fileObjectId, originalName);
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
    originalName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageKey,
    uploadedAt
  });

  const updatedPet = await setPetPhoto(petObjectId, ownerObjectId, fileObjectId);
  if (!updatedPet) {
    // Pet was deleted between read and write — roll back the just-uploaded photo.
    await deleteFileRecord(fileObjectId, ownerObjectId);
    try {
      await storage.deleteObject({ key: storageKey });
    } catch (error) {
      if (!isMissingObjectError(error)) {
        throw toStorageError(error, "FILE_STORAGE_DELETE_FAILED", "Could not delete file from storage");
      }
    }
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  if (previousPhotoFileId && !previousPhotoFileId.equals(fileObjectId)) {
    const previous = await findFileByIdForOwner(previousPhotoFileId, ownerObjectId);
    if (previous) {
      try {
        await storage.deleteObject({ key: previous.storageKey });
      } catch (error) {
        if (!isMissingObjectError(error)) {
          throw toStorageError(error, "FILE_STORAGE_DELETE_FAILED", "Could not delete file from storage");
        }
      }
      await deleteFileRecord(previousPhotoFileId, ownerObjectId);
    }
  }

  return { file: serializeFile(created), pet: updatedPet };
};

export interface ResolvePetPhotoUrlDependencies {
  findFileByIdForOwner?: (
    fileId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<Pick<FileRecord, "_id" | "storageKey"> | null>;
  getDownloadUrl?: (key: string, expiresInSeconds?: number) => string;
}

export const resolvePetPhotoUrl = async (
  ownerId: string,
  photoFileId: string,
  expiresInSeconds: number,
  dependencies: ResolvePetPhotoUrlDependencies = {}
): Promise<string | null> => {
  const {
    findFileByIdForOwner = async (id, owner) =>
      FileModel.findOne({ _id: id, ownerId: owner })
        .select({ _id: 1, storageKey: 1 })
        .exec() as unknown as Pick<FileRecord, "_id" | "storageKey"> | null,
    getDownloadUrl = getObjectDownloadUrl
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const fileObjectId = requireObjectId(
    photoFileId,
    "INVALID_PHOTO_FILE_ID",
    "photoFileId must be a valid id"
  );

  const file = await findFileByIdForOwner(fileObjectId, ownerObjectId);
  if (!file) {
    return null;
  }

  return getDownloadUrl(file.storageKey, expiresInSeconds);
};

export const listPetFiles = async (
  ownerId: string,
  petId: string,
  queryOrDependencies: DateRangeQuery | FileServiceDependencies = {},
  maybeDependencies?: FileServiceDependencies
): Promise<SerializedFile[]> => {
  const thirdArgumentIsDependencies = isFileServiceDependencies(queryOrDependencies);
  const query = maybeDependencies
    ? (queryOrDependencies as DateRangeQuery)
    : thirdArgumentIsDependencies
      ? {}
      : (queryOrDependencies as DateRangeQuery);
  const dependencies = maybeDependencies ?? (thirdArgumentIsDependencies ? queryOrDependencies : {});
  const {
    findPetByIdForOwner = defaultFindPet,
    listFilesForPet = async (owner, pet, range) => {
      const filter: Record<string, unknown> = {
        ownerId: owner,
        petId: pet,
        tempExpiresAt: { $exists: false }
      };
      const uploadedAt: Record<string, Date> = {};
      if (range.from) uploadedAt.$gte = range.from;
      if (range.to) uploadedAt.$lte = range.to;
      if (Object.keys(uploadedAt).length > 0) filter.uploadedAt = uploadedAt;

      return FileModel.find(filter)
        .sort({ uploadedAt: -1 })
        .exec() as unknown as FileRecord[];
    }
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requireObjectId(petId, "INVALID_PET_ID", "petId must be a valid id");
  const range = parseOptionalDateRange(query);

  const pet = await findPetByIdForOwner(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const files = await listFilesForPet(ownerObjectId, petObjectId, range);
  const visibleFiles = pet.photoFileId
    ? files.filter((file) => !file._id.equals(pet.photoFileId) && !file.tempExpiresAt)
    : files.filter((file) => !file.tempExpiresAt);
  return visibleFiles.map(serializeFile);
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
  const fileObjectId = requireObjectId(fileId, "INVALID_FILE_ID", "fileId must be a valid id");

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
  const fileObjectId = requireObjectId(fileId, "INVALID_FILE_ID", "fileId must be a valid id");

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
  now?: () => Date;
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
      FileModel.countDocuments({
        _id: { $in: ids },
        ownerId: owner,
        petId: pet,
        $or: [
          { tempExpiresAt: { $exists: false } },
          { tempExpiresAt: { $gt: (dependencies.now ?? (() => new Date()))() } }
        ]
      }).exec()
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

export interface AttachFilesToEventDependencies {
  attachFileRecordsToEvent?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    eventId: Types.ObjectId,
    fileIds: Types.ObjectId[]
  ) => Promise<void>;
}

export const attachFilesToEvent = async (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  eventId: Types.ObjectId,
  fileIds: Types.ObjectId[],
  dependencies: AttachFilesToEventDependencies = {}
): Promise<void> => {
  if (fileIds.length === 0) {
    return;
  }

  const {
    attachFileRecordsToEvent = async (owner, pet, event, ids) => {
      await FileModel.updateMany(
        { _id: { $in: ids }, ownerId: owner, petId: pet },
        {
          $set: { eventId: event },
          $unset: { tempExpiresAt: "" }
        }
      ).exec();
    }
  } = dependencies;

  const uniqueIds = Array.from(
    new Map(fileIds.map((id) => [id.toString(), id])).values()
  );
  await attachFileRecordsToEvent(ownerId, petId, eventId, uniqueIds);
};

type TemporaryFileRecord = Pick<
  IStoredFile,
  "_id" | "ownerId" | "eventId" | "storageKey" | "tempExpiresAt"
>;

export interface CleanupExpiredTemporaryFileDependencies {
  storage?: FileStorage;
  findTemporaryFileByIdForOwner?: (
    fileId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<TemporaryFileRecord | null>;
  deleteTemporaryFileRecord?: (
    fileId: Types.ObjectId,
    ownerId: Types.ObjectId,
    tempExpiresAt: Date
  ) => Promise<TemporaryFileRecord | null>;
  now?: () => Date;
}

export const cleanupExpiredTemporaryFile = async (
  ownerId: string,
  fileId: string,
  dependencies: CleanupExpiredTemporaryFileDependencies = {}
): Promise<void> => {
  const {
    storage = s3Storage,
    findTemporaryFileByIdForOwner = async (id, owner) =>
      FileModel.findOne({ _id: id, ownerId: owner }).exec() as unknown as TemporaryFileRecord | null,
    deleteTemporaryFileRecord = async (id, owner, expiresAt) =>
      FileModel.findOneAndDelete({
        _id: id,
        ownerId: owner,
        eventId: { $exists: false },
        tempExpiresAt: expiresAt
      }).exec() as unknown as TemporaryFileRecord | null,
    now = () => new Date()
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const fileObjectId = requireObjectId(fileId, "INVALID_FILE_ID", "fileId must be a valid id");
  const file = await findTemporaryFileByIdForOwner(fileObjectId, ownerObjectId);

  if (!file || file.eventId || !file.tempExpiresAt || file.tempExpiresAt.getTime() > now().getTime()) {
    return;
  }

  const deleted = await deleteTemporaryFileRecord(fileObjectId, ownerObjectId, file.tempExpiresAt);
  if (!deleted) {
    return;
  }

  try {
    await storage.deleteObject({ key: deleted.storageKey });
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw toStorageError(error, "FILE_STORAGE_DELETE_FAILED", "Could not delete file from storage");
    }
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
