import { Types } from "mongoose";

import { env } from "../config/env";
import { enqueueJob, type EnqueueJobInput } from "../jobs/backgroundJobService";
import { AppError } from "../middleware/errorHandler";
import { EVENT_TYPES, type EventType } from "../models/Event";
import {
  ExportModel,
  EXPORT_SECTIONS,
  type ExportSection,
  type IExport,
  type IExportPeriod
} from "../models/Export";
import {
  ExportArtifactModel,
  type IExportArtifact
} from "../models/ExportArtifact";
import { UserModel, type IUser } from "../models/User";
import {
  getObjectDownloadUrl,
  isMissingObjectError,
  s3Storage,
  type FileStorage
} from "../storage/s3Storage";
import {
  findPetByIdForOwner,
  serializePeriodForReport,
  type NormalizedExportPeriod,
  type PetRecord
} from "./petExportReport";
import {
  buildPetExportFingerprint,
  type PetExportFingerprintResult
} from "./petExportFingerprint";

type ExportStorageRecord = Pick<IExport | IExportArtifact, "_id" | "fileKey">;
type ArtifactRecord = Pick<
  IExportArtifact,
  | "_id"
  | "ownerId"
  | "petId"
  | "dataHash"
  | "fileKey"
  | "status"
  | "expiresAt"
  | "lastAccessedAt"
  | "generation"
  | "createdAt"
  | "updatedAt"
>;

export interface CreatePetExportInput {
  period?: unknown;
  sections?: unknown;
  eventTypes?: unknown;
  sendEmail?: unknown;
  notificationEmail?: unknown;
  fallbackNotificationEmail?: unknown;
}

export interface SerializedExportPeriod {
  from?: string;
  to?: string;
}

export interface SerializedExport {
  id: string;
  ownerId: string;
  petId: string;
  period?: SerializedExportPeriod;
  sections: ExportSection[];
  eventTypes?: EventType[];
  fileKey?: string;
  downloadUrl?: string;
  status: IExport["status"];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

type ExportRecord = Pick<
  IExport,
  | "_id"
  | "ownerId"
  | "petId"
  | "period"
  | "sections"
  | "eventTypes"
  | "artifactId"
  | "dataHash"
  | "fileKey"
  | "status"
  | "expiresAt"
  | "cacheHit"
  | "createdAt"
  | "updatedAt"
>;

interface CreateExportPersistInput {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  period?: NormalizedExportPeriod;
  sections: ExportSection[];
  eventTypes?: EventType[];
  artifactId?: Types.ObjectId;
  dataHash?: string;
  fileKey?: string;
  expiresAt?: Date;
  cacheHit?: boolean;
  status: "pending" | "ready";
}

interface CreateOrReuseArtifactInput {
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  exportId: Types.ObjectId;
  dataHash: string;
  now: Date;
  expiresAt: Date;
}

export interface CreatePetExportDependencies {
  findPetByIdForOwner?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<PetRecord | null>;
  buildFingerprint?: (
    input: {
      ownerId: Types.ObjectId;
      petId: Types.ObjectId;
      pet: PetRecord;
      period?: NormalizedExportPeriod;
      sections: ExportSection[];
      eventTypes?: EventType[];
    }
  ) => Promise<PetExportFingerprintResult>;
  createOrReuseArtifact?: (input: CreateOrReuseArtifactInput) => Promise<ArtifactRecord>;
  createExportRecord?: (input: CreateExportPersistInput) => Promise<ExportRecord>;
  enqueuePetExportJob?: (input: EnqueueJobInput) => Promise<unknown>;
  loadNotificationRecipient?: (
    ownerId: Types.ObjectId
  ) => Promise<Pick<IUser, "email" | "emailVerified"> | null>;
  getPublicUrl?: (key: string) => string;
  now?: () => Date;
  retentionDays?: number;
}

export interface GetPetExportDependencies {
  findExportByIdForOwner?: (
    exportId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<ExportRecord | null>;
  findArtifactById?: (artifactId: Types.ObjectId) => Promise<ArtifactRecord | null>;
  touchArtifact?: (artifactId: Types.ObjectId, now: Date, expiresAt: Date) => Promise<ArtifactRecord | null>;
  updateExportFromArtifact?: (
    exportId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: Partial<Pick<IExport, "status" | "fileKey" | "expiresAt">>
  ) => Promise<ExportRecord | null>;
  getPublicUrl?: (key: string) => string;
  now?: () => Date;
  retentionDays?: number;
}

export interface DeleteOwnerExportsDependencies {
  storage?: FileStorage;
  listOwnerExportRecords?: (ownerId: Types.ObjectId) => Promise<ExportStorageRecord[]>;
  listOwnerArtifacts?: (ownerId: Types.ObjectId) => Promise<ExportStorageRecord[]>;
  deleteOwnerExports?: (ownerId: Types.ObjectId) => Promise<void>;
  deleteOwnerArtifacts?: (ownerId: Types.ObjectId) => Promise<void>;
}

export interface DeletePetExportsDependencies {
  storage?: FileStorage;
  listPetExports?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<ExportStorageRecord[]>;
  listPetArtifacts?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<ExportStorageRecord[]>;
  deletePetExports?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<void>;
  deletePetArtifacts?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<void>;
}

const DEFAULT_SECTIONS: ExportSection[] = ["profile", "events"];

type MaybeMongoDuplicateKeyError = {
  code?: number;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as MaybeMongoDuplicateKeyError).code === 11000;

export const addExportRetention = (now: Date, retentionDays = env.EXPORT_RETENTION_DAYS): Date =>
  new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

export const buildExportArtifactStorageKey = (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  dataHash: string
): string =>
  `users/${ownerId.toString()}/pets/${petId.toString()}/exports/${dataHash}.pdf`;

const requireOwnerId = (ownerId: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(ownerId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }
  return new Types.ObjectId(ownerId);
};

const requirePetId = (petId: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(petId)) {
    throw new AppError(400, "INVALID_PET_ID", "petId must be a valid id");
  }
  return new Types.ObjectId(petId);
};

const requireExportId = (exportId: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(exportId)) {
    throw new AppError(400, "INVALID_EXPORT_ID", "exportId must be a valid id");
  }
  return new Types.ObjectId(exportId);
};

const parseDateOnly = (value: unknown, field: string): Date | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, "INVALID_EXPORT_PERIOD", `period.${field} must be a date-only string`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError(400, "INVALID_EXPORT_PERIOD", `period.${field} must be a valid date`);
  }

  return date;
};

const normalizePeriod = (value: unknown): NormalizedExportPeriod | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "INVALID_EXPORT_PERIOD", "period must be an object");
  }

  const raw = value as Record<string, unknown>;
  const period: NormalizedExportPeriod = {
    from: parseDateOnly(raw.from, "from"),
    to: parseDateOnly(raw.to, "to")
  };

  if (period.from && period.to && period.from.getTime() > period.to.getTime()) {
    throw new AppError(400, "INVALID_EXPORT_PERIOD", "period.from must be before or equal to period.to");
  }

  return period.from || period.to ? period : undefined;
};

const normalizeSections = (value: unknown): ExportSection[] => {
  if (value === undefined || value === null) {
    return [...DEFAULT_SECTIONS];
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(400, "INVALID_EXPORT_SECTIONS", "sections must be a non-empty array");
  }

  const seen = new Set<ExportSection>();
  for (const item of value) {
    if (typeof item !== "string" || !(EXPORT_SECTIONS as readonly string[]).includes(item)) {
      throw new AppError(
        400,
        "INVALID_EXPORT_SECTIONS",
        `sections must contain only: ${EXPORT_SECTIONS.join(", ")}`
      );
    }
    seen.add(item as ExportSection);
  }

  return [...seen];
};

const normalizeEventTypes = (value: unknown): EventType[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, "INVALID_EXPORT_EVENT_TYPES", "eventTypes must be an array");
  }

  const seen = new Set<EventType>();
  for (const item of value) {
    if (typeof item !== "string" || !(EVENT_TYPES as readonly string[]).includes(item)) {
      throw new AppError(
        400,
        "INVALID_EXPORT_EVENT_TYPES",
        `eventTypes must contain only: ${EVENT_TYPES.join(", ")}`
      );
    }
    seen.add(item as EventType);
  }

  return seen.size > 0 ? [...seen] : undefined;
};

const normalizeNotificationEmail = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeSendEmail = (value: unknown): boolean => value === true;

const defaultLoadNotificationRecipient: NonNullable<
  CreatePetExportDependencies["loadNotificationRecipient"]
> = async (ownerId) =>
  UserModel.findById(ownerId)
    .select({ email: 1, emailVerified: 1 })
    .lean()
    .exec() as Promise<Pick<IUser, "email" | "emailVerified"> | null>;

const serializePeriod = (period?: IExportPeriod): SerializedExportPeriod | undefined => {
  const reportPeriod = serializePeriodForReport(period);
  if (!reportPeriod) {
    return undefined;
  }
  const result: SerializedExportPeriod = {};
  if (reportPeriod.from) result.from = reportPeriod.from;
  if (reportPeriod.to) result.to = reportPeriod.to;
  return result;
};

export const serializeExport = (
  record: ExportRecord,
  getPublicUrl: (key: string) => string = getObjectDownloadUrl
): SerializedExport => {
  const result: SerializedExport = {
    id: record._id.toString(),
    ownerId: record.ownerId.toString(),
    petId: record.petId.toString(),
    sections: record.sections,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };

  const period = serializePeriod(record.period);
  if (period) result.period = period;
  if (record.eventTypes?.length) result.eventTypes = record.eventTypes;
  if (record.expiresAt) result.expiresAt = record.expiresAt.toISOString();
  if (record.fileKey) {
    result.fileKey = record.fileKey;
    result.downloadUrl = getPublicUrl(record.fileKey);
  }

  return result;
};

const createPendingArtifact = async ({
  ownerId,
  petId,
  exportId,
  dataHash,
  now,
  expiresAt
}: CreateOrReuseArtifactInput): Promise<ArtifactRecord> =>
  ExportArtifactModel.create({
    ownerId,
    petId,
    dataHash,
    status: "pending",
    sourceExportId: exportId,
    expiresAt,
    lastAccessedAt: now,
    generation: 0
  }) as unknown as ArtifactRecord;

const loadArtifactByKey = async (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  dataHash: string
): Promise<ArtifactRecord | null> =>
  ExportArtifactModel.findOne({ ownerId, petId, dataHash }).exec() as unknown as
    | ArtifactRecord
    | null;

const defaultCreateOrReuseArtifact = async (
  input: CreateOrReuseArtifactInput
): Promise<ArtifactRecord> => {
  try {
    return await createPendingArtifact(input);
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const existing = await loadArtifactByKey(
    input.ownerId,
    input.petId,
    input.dataHash
  );
  if (!existing) {
    return createPendingArtifact(input);
  }

  if (
    existing.status === "ready" &&
    existing.fileKey &&
    existing.expiresAt.getTime() > input.now.getTime()
  ) {
    const touched = await ExportArtifactModel.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          lastAccessedAt: input.now,
          expiresAt: input.expiresAt
        }
      },
      { new: true }
    ).exec();
    return (touched ?? existing) as unknown as ArtifactRecord;
  }

  if (existing.status === "pending" || existing.status === "processing") {
    return existing;
  }

  const reset = await ExportArtifactModel.findOneAndUpdate(
    {
      _id: existing._id,
      status: existing.status
    },
    {
      $set: {
        status: "pending",
        sourceExportId: input.exportId,
        expiresAt: input.expiresAt,
        lastAccessedAt: input.now
      },
      $inc: { generation: 1 },
      $unset: { fileKey: "", lastError: "" }
    },
    { new: true }
  ).exec();

  return (reset ?? existing) as unknown as ArtifactRecord;
};

export const createPetExport = async (
  ownerId: string,
  petId: string,
  input: CreatePetExportInput = {},
  dependencies: CreatePetExportDependencies = {}
): Promise<SerializedExport> => {
  const {
    findPetByIdForOwner: findPet = findPetByIdForOwner,
    buildFingerprint = (payload) => buildPetExportFingerprint(payload),
    createOrReuseArtifact = defaultCreateOrReuseArtifact,
    createExportRecord = async (payload) => ExportModel.create(payload) as unknown as ExportRecord,
    enqueuePetExportJob = enqueueJob,
    loadNotificationRecipient = defaultLoadNotificationRecipient,
    getPublicUrl = getObjectDownloadUrl,
    now = () => new Date(),
    retentionDays = env.EXPORT_RETENTION_DAYS
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetId(petId);
  const period = normalizePeriod(input.period);
  const sections = normalizeSections(input.sections);
  const eventTypes = normalizeEventTypes(input.eventTypes);
  const sendEmail = normalizeSendEmail(input.sendEmail);
  const notificationRecipient = sendEmail
    ? await loadNotificationRecipient(ownerObjectId)
    : null;
  const notificationEmail =
    notificationRecipient?.emailVerified === true
      ? normalizeNotificationEmail(notificationRecipient.email)
      : undefined;

  const pet = await findPet(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const exportId = new Types.ObjectId();
  const requestedAt = now();
  const expiresAt = addExportRetention(requestedAt, retentionDays);
  const fingerprint = await buildFingerprint({
    ownerId: ownerObjectId,
    petId: petObjectId,
    pet,
    period,
    sections,
    eventTypes
  });
  const artifact = await createOrReuseArtifact({
    ownerId: ownerObjectId,
    petId: petObjectId,
    exportId,
    dataHash: fingerprint.dataHash,
    now: requestedAt,
    expiresAt
  });
  const readyCacheHit =
    artifact.status === "ready" &&
    Boolean(artifact.fileKey) &&
    artifact.expiresAt.getTime() > requestedAt.getTime();
  const created = await createExportRecord({
    _id: exportId,
    ownerId: ownerObjectId,
    petId: petObjectId,
    period,
    sections,
    eventTypes,
    artifactId: artifact._id,
    dataHash: fingerprint.dataHash,
    fileKey: readyCacheHit ? artifact.fileKey : undefined,
    expiresAt: readyCacheHit ? artifact.expiresAt : expiresAt,
    cacheHit: readyCacheHit,
    status: readyCacheHit ? "ready" : "pending"
  });

  if (!readyCacheHit) {
    await enqueuePetExportJob({
      type: "pet-export",
      payload: {
        exportId: exportId.toString(),
        ownerId: ownerObjectId.toString(),
        petId: petObjectId.toString(),
        artifactId: artifact._id.toString(),
        dataHash: fingerprint.dataHash,
        generation: artifact.generation,
        period: serializePeriodForReport(period),
        sections,
        ...(eventTypes ? { eventTypes } : {}),
        ...(notificationEmail ? { notificationEmail } : {})
      },
      idempotencyKey: readyCacheHit
        ? exportId.toString()
        : `pet-export-artifact:${artifact._id.toString()}:${artifact.generation}`,
      maxAttempts: 5
    });
  } else if (notificationEmail) {
    await enqueuePetExportJob({
      type: "export-email",
      payload: {
        exportId: exportId.toString(),
        ownerId: ownerObjectId.toString(),
        petId: petObjectId.toString(),
        artifactId: artifact._id.toString(),
        notificationEmail
      },
      idempotencyKey: `export-email:${exportId.toString()}`,
      maxAttempts: 3
    });
  }

  return serializeExport(created, getPublicUrl);
};

export const getPetExport = async (
  ownerId: string,
  exportId: string,
  dependencies: GetPetExportDependencies = {}
): Promise<SerializedExport> => {
  const {
    findExportByIdForOwner = async (id, owner) =>
      ExportModel.findOne({ _id: id, ownerId: owner }).exec() as unknown as ExportRecord | null,
    findArtifactById = async (artifactId) =>
      ExportArtifactModel.findById(artifactId).exec() as unknown as ArtifactRecord | null,
    touchArtifact = async (artifactId, accessedAt, expiresAt) =>
      ExportArtifactModel.findByIdAndUpdate(
        artifactId,
        { $set: { lastAccessedAt: accessedAt, expiresAt } },
        { new: true }
      ).exec() as unknown as ArtifactRecord | null,
    updateExportFromArtifact = async (id, owner, updates) =>
      ExportModel.findOneAndUpdate(
        { _id: id, ownerId: owner },
        { $set: updates },
        { new: true }
      ).exec() as unknown as ExportRecord | null,
    getPublicUrl = getObjectDownloadUrl,
    now = () => new Date(),
    retentionDays = env.EXPORT_RETENTION_DAYS
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const exportObjectId = requireExportId(exportId);

  const petExport = await findExportByIdForOwner(exportObjectId, ownerObjectId);
  if (!petExport) {
    throw new AppError(404, "EXPORT_NOT_FOUND", "Export was not found");
  }

  if (petExport.artifactId) {
    const artifact = await findArtifactById(petExport.artifactId);
    if (!artifact) {
      throw new AppError(404, "EXPORT_NOT_FOUND", "Export was not found");
    }

    if (artifact.status === "ready" && artifact.fileKey) {
      const accessedAt = now();
      if (artifact.expiresAt.getTime() <= accessedAt.getTime()) {
        throw new AppError(404, "EXPORT_NOT_FOUND", "Export was not found");
      }

      const nextExpiresAt = addExportRetention(accessedAt, retentionDays);
      const touched = (await touchArtifact(artifact._id, accessedAt, nextExpiresAt)) ?? {
        ...artifact,
        expiresAt: nextExpiresAt
      };
      const updated = await updateExportFromArtifact(exportObjectId, ownerObjectId, {
        status: "ready",
        fileKey: touched.fileKey,
        expiresAt: touched.expiresAt
      });
      return serializeExport(updated ?? { ...petExport, status: "ready", fileKey: touched.fileKey, expiresAt: touched.expiresAt }, getPublicUrl);
    }

    if (artifact.status === "failed" && petExport.status !== "failed") {
      const updated = await updateExportFromArtifact(exportObjectId, ownerObjectId, {
        status: "failed",
        expiresAt: artifact.expiresAt
      });
      return serializeExport(updated ?? { ...petExport, status: "failed", expiresAt: artifact.expiresAt }, getPublicUrl);
    }
  }

  return serializeExport(petExport, getPublicUrl);
};

const cleanupExportStorage = async (
  records: ExportStorageRecord[],
  storage: FileStorage
): Promise<void> => {
  const keys = new Set(
    records.map((record) => record.fileKey).filter((key): key is string => Boolean(key))
  );
  for (const key of keys) {
    try {
      await storage.deleteObject({ key });
    } catch (error) {
      if (!isMissingObjectError(error)) {
        throw new AppError(
          502,
          "EXPORT_STORAGE_DELETE_FAILED",
          "Could not delete export from storage"
        );
      }
    }
  }
};

export const deleteAllExportsForOwner = async (
  ownerId: Types.ObjectId,
  dependencies: DeleteOwnerExportsDependencies = {}
): Promise<void> => {
  const {
    storage = s3Storage,
    listOwnerExportRecords = async (owner) =>
      ExportModel.find({ ownerId: owner })
        .select({ _id: 1, fileKey: 1 })
        .exec() as unknown as ExportStorageRecord[],
    listOwnerArtifacts = async (owner) =>
      ExportArtifactModel.find({ ownerId: owner })
        .select({ _id: 1, fileKey: 1 })
        .exec() as unknown as ExportStorageRecord[],
    deleteOwnerExports = async (owner) => {
      await ExportModel.deleteMany({ ownerId: owner }).exec();
    },
    deleteOwnerArtifacts = async (owner) => {
      await ExportArtifactModel.deleteMany({ ownerId: owner }).exec();
    }
  } = dependencies;

  const [exports, artifacts] = await Promise.all([
    listOwnerExportRecords(ownerId),
    listOwnerArtifacts(ownerId)
  ]);
  await cleanupExportStorage([...exports, ...artifacts], storage);
  await deleteOwnerExports(ownerId);
  await deleteOwnerArtifacts(ownerId);
};

export const deleteAllExportsForPet = async (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  dependencies: DeletePetExportsDependencies = {}
): Promise<void> => {
  const {
    storage = s3Storage,
    listPetExports = async (owner, pet) =>
      ExportModel.find({ ownerId: owner, petId: pet })
        .select({ _id: 1, fileKey: 1 })
        .exec() as unknown as ExportStorageRecord[],
    listPetArtifacts = async (owner, pet) =>
      ExportArtifactModel.find({ ownerId: owner, petId: pet })
        .select({ _id: 1, fileKey: 1 })
        .exec() as unknown as ExportStorageRecord[],
    deletePetExports = async (owner, pet) => {
      await ExportModel.deleteMany({ ownerId: owner, petId: pet }).exec();
    },
    deletePetArtifacts = async (owner, pet) => {
      await ExportArtifactModel.deleteMany({ ownerId: owner, petId: pet }).exec();
    }
  } = dependencies;

  const [exports, artifacts] = await Promise.all([
    listPetExports(ownerId, petId),
    listPetArtifacts(ownerId, petId)
  ]);
  await cleanupExportStorage([...exports, ...artifacts], storage);
  await deletePetExports(ownerId, petId);
  await deletePetArtifacts(ownerId, petId);
};
