import { Types } from "mongoose";
import { z } from "zod";

import { sanitizeJobDiagnostic } from "../backgroundJobRunner";
import { registerJobHandler } from "../backgroundJobService";
import type { BackgroundJobHandler } from "../types";
import { ExportModel, type IExport } from "../../models/Export";
import { ExportArtifactModel, type IExportArtifact } from "../../models/ExportArtifact";
import { findPetByIdForOwner, type PetRecord } from "../../services/petExportReport";
import {
  buildPetExportFilename,
  PET_EXPORT_PDF_CONTENT_TYPE,
  sendExportReadyEmail,
  type ExportReadyEmailPayload
} from "../../services/exportEmail";
import { getObjectDownloadUrl, s3Storage, type FileStorage } from "../../storage/s3Storage";

type ExportEmailRecord = Pick<
  IExport,
  "_id" | "ownerId" | "petId" | "artifactId" | "fileKey" | "status" | "emailSentAt"
>;

type ExportEmailArtifactRecord = Pick<
  IExportArtifact,
  "_id" | "ownerId" | "petId" | "fileKey" | "status" | "expiresAt"
>;

interface UpdateExportInput {
  set?: Partial<Pick<IExport, "emailSentAt" | "lastError">>;
  unset?: Partial<Record<"lastError", "">>;
}

export interface ExportEmailHandlerDependencies {
  findExportById?: (exportId: Types.ObjectId) => Promise<ExportEmailRecord | null>;
  findArtifactById?: (artifactId: Types.ObjectId) => Promise<ExportEmailArtifactRecord | null>;
  updateExportRecord?: (
    exportId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: UpdateExportInput
  ) => Promise<void>;
  findPet?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<PetRecord | null>;
  storage?: FileStorage;
  sendExportReadyEmail?: (payload: ExportReadyEmailPayload) => Promise<void>;
  getPublicUrl?: (key: string) => string;
  now?: () => Date;
}

const objectIdSchema = z.string().refine((value) => Types.ObjectId.isValid(value), {
  message: "must be a valid ObjectId"
});

const payloadSchema = z.object({
  exportId: objectIdSchema,
  ownerId: objectIdSchema,
  petId: objectIdSchema,
  artifactId: objectIdSchema,
  notificationEmail: z.string().email()
});

const streamToBuffer = async (body: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const defaultFindExportById: NonNullable<ExportEmailHandlerDependencies["findExportById"]> = async (
  exportId
) => ExportModel.findById(exportId).exec() as unknown as ExportEmailRecord | null;

const defaultFindArtifactById: NonNullable<ExportEmailHandlerDependencies["findArtifactById"]> = async (
  artifactId
) => ExportArtifactModel.findById(artifactId).exec() as unknown as ExportEmailArtifactRecord | null;

const defaultUpdateExportRecord: NonNullable<
  ExportEmailHandlerDependencies["updateExportRecord"]
> = async (exportId, ownerId, updates) => {
  await ExportModel.updateOne(
    { _id: exportId, ownerId },
    {
      ...(updates.set ? { $set: updates.set } : {}),
      ...(updates.unset ? { $unset: updates.unset } : {})
    }
  ).exec();
};

export const createExportEmailJobHandler = (
  dependencies: ExportEmailHandlerDependencies = {}
): BackgroundJobHandler => {
  const {
    findExportById = defaultFindExportById,
    findArtifactById = defaultFindArtifactById,
    updateExportRecord = defaultUpdateExportRecord,
    findPet = findPetByIdForOwner,
    storage = s3Storage,
    sendExportReadyEmail: sendEmail = sendExportReadyEmail,
    getPublicUrl = getObjectDownloadUrl,
    now = () => new Date()
  } = dependencies;

  return async (job) => {
    const parsed = payloadSchema.safeParse(job.payload);
    if (!parsed.success) {
      job.logger.error("invalid export-email job payload", { cause: parsed.error.message });
      return;
    }

    const exportId = new Types.ObjectId(parsed.data.exportId);
    const ownerId = new Types.ObjectId(parsed.data.ownerId);
    const petId = new Types.ObjectId(parsed.data.petId);
    const artifactId = new Types.ObjectId(parsed.data.artifactId);
    const record = await findExportById(exportId);
    if (
      !record ||
      !record.ownerId.equals(ownerId) ||
      !record.petId.equals(petId) ||
      record.status !== "ready" ||
      record.emailSentAt
    ) {
      return;
    }

    const artifact = await findArtifactById(artifactId);
    const fileKey = artifact?.status === "ready" && artifact.fileKey ? artifact.fileKey : record.fileKey;
    if (!fileKey) {
      return;
    }

    const pet = await findPet(petId, ownerId);
    if (!pet) {
      return;
    }

    try {
      const stored = await storage.getObject({ key: fileKey });
      const pdfBody = await streamToBuffer(stored.body);
      await sendEmail({
        to: parsed.data.notificationEmail,
        petName: pet.name,
        downloadUrl: getPublicUrl(fileKey),
        attachment: {
          filename: buildPetExportFilename(pet.name),
          content: pdfBody,
          contentType: PET_EXPORT_PDF_CONTENT_TYPE
        }
      });
      await updateExportRecord(exportId, ownerId, {
        set: { emailSentAt: now() },
        unset: { lastError: "" }
      });
    } catch (error) {
      if (job.attempts + 1 >= job.maxAttempts) {
        job.logger.warn("export ready email delivery exhausted", {
          exportId: exportId.toString(),
          cause: sanitizeJobDiagnostic(error)
        });
        return;
      }

      throw error;
    }
  };
};

export const registerExportEmailJobHandler = (): void => {
  registerJobHandler("export-email", createExportEmailJobHandler());
};
