import { randomBytes } from "node:crypto";
import { Types } from "mongoose";

import { enqueueJob, type EnqueueJobInput } from "../jobs/backgroundJobService";
import { AppError } from "../middleware/errorHandler";
import {
  ExportModel,
  EXPORT_SECTIONS,
  type ExportSection,
  type IExport,
  type IExportPeriod
} from "../models/Export";
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

type OwnerExportRecord = Pick<IExport, "_id" | "fileKey">;

export interface CreatePetExportInput {
  period?: unknown;
  sections?: unknown;
  notificationEmail?: unknown;
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
  fileKey?: string;
  downloadUrl?: string;
  status: IExport["status"];
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
  | "fileKey"
  | "status"
  | "createdAt"
  | "updatedAt"
>;

interface CreateExportPersistInput {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  period?: NormalizedExportPeriod;
  sections: ExportSection[];
  fileToken: string;
  status: "pending";
}

export interface CreatePetExportDependencies {
  findPetByIdForOwner?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<PetRecord | null>;
  createExportRecord?: (input: CreateExportPersistInput) => Promise<ExportRecord>;
  enqueuePetExportJob?: (input: EnqueueJobInput) => Promise<unknown>;
  getPublicUrl?: (key: string) => string;
  randomToken?: () => string;
}

export interface GetPetExportDependencies {
  findExportByIdForOwner?: (
    exportId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<ExportRecord | null>;
  getPublicUrl?: (key: string) => string;
}

export interface DeleteOwnerExportsDependencies {
  storage?: FileStorage;
  listOwnerExports?: (ownerId: Types.ObjectId) => Promise<OwnerExportRecord[]>;
  deleteOwnerExports?: (ownerId: Types.ObjectId) => Promise<void>;
}

export interface DeletePetExportsDependencies {
  storage?: FileStorage;
  listPetExports?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<OwnerExportRecord[]>;
  deletePetExports?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<void>;
}

const DEFAULT_SECTIONS: ExportSection[] = ["profile", "events"];

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
  if (record.fileKey) {
    result.fileKey = record.fileKey;
    result.downloadUrl = getPublicUrl(record.fileKey);
  }

  return result;
};

export const createPetExport = async (
  ownerId: string,
  petId: string,
  input: CreatePetExportInput = {},
  dependencies: CreatePetExportDependencies = {}
): Promise<SerializedExport> => {
  const {
    findPetByIdForOwner: findPet = findPetByIdForOwner,
    createExportRecord = async (payload) => ExportModel.create(payload) as unknown as ExportRecord,
    enqueuePetExportJob = enqueueJob,
    getPublicUrl = getObjectDownloadUrl,
    randomToken = () => randomBytes(24).toString("hex")
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetId(petId);
  const period = normalizePeriod(input.period);
  const sections = normalizeSections(input.sections);
  const notificationEmail = normalizeNotificationEmail(input.notificationEmail);

  const pet = await findPet(petObjectId, ownerObjectId);
  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  const exportId = new Types.ObjectId();
  const created = await createExportRecord({
    _id: exportId,
    ownerId: ownerObjectId,
    petId: petObjectId,
    period,
    sections,
    fileToken: randomToken(),
    status: "pending"
  });

  await enqueuePetExportJob({
    type: "pet-export",
    payload: {
      exportId: exportId.toString(),
      ownerId: ownerObjectId.toString(),
      petId: petObjectId.toString(),
      period: serializePeriodForReport(period),
      sections,
      notificationEmail
    },
    idempotencyKey: exportId.toString(),
    maxAttempts: 5
  });

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
    getPublicUrl = getObjectDownloadUrl
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const exportObjectId = requireExportId(exportId);

  const petExport = await findExportByIdForOwner(exportObjectId, ownerObjectId);
  if (!petExport) {
    throw new AppError(404, "EXPORT_NOT_FOUND", "Export was not found");
  }

  return serializeExport(petExport, getPublicUrl);
};

const cleanupExportStorage = async (
  records: OwnerExportRecord[],
  storage: FileStorage
): Promise<void> => {
  for (const record of records) {
    if (!record.fileKey) {
      continue;
    }
    try {
      await storage.deleteObject({ key: record.fileKey });
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
    listOwnerExports = async (owner) =>
      ExportModel.find({ ownerId: owner })
        .select({ _id: 1, fileKey: 1 })
        .exec() as unknown as OwnerExportRecord[],
    deleteOwnerExports = async (owner) => {
      await ExportModel.deleteMany({ ownerId: owner }).exec();
    }
  } = dependencies;

  const exports = await listOwnerExports(ownerId);
  await cleanupExportStorage(exports, storage);
  await deleteOwnerExports(ownerId);
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
        .exec() as unknown as OwnerExportRecord[],
    deletePetExports = async (owner, pet) => {
      await ExportModel.deleteMany({ ownerId: owner, petId: pet }).exec();
    }
  } = dependencies;

  const exports = await listPetExports(ownerId, petId);
  await cleanupExportStorage(exports, storage);
  await deletePetExports(ownerId, petId);
};
