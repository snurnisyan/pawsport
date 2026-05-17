import { Types } from "mongoose";
import { z } from "zod";

import { sanitizeJobDiagnostic } from "../backgroundJobRunner";
import { registerJobHandler } from "../backgroundJobService";
import type { BackgroundJobHandler } from "../types";
import {
  GotenbergRequestError,
  GotenbergUnavailableError,
  renderHtmlToPdf
} from "../../services/gotenbergClient";
import { renderPetExportTemplate } from "../../services/petExportTemplate";
import {
  buildPetExportReport,
  findPetByIdForOwner,
  type NormalizedExportPeriod,
  type PetRecord
} from "../../services/petExportReport";
import {
  buildPetExportFilename,
  PET_EXPORT_PDF_CONTENT_TYPE,
  sendExportReadyEmail,
  type ExportReadyEmailPayload
} from "../../services/exportEmail";
import { ExportModel, EXPORT_SECTIONS, type ExportSection, type IExport } from "../../models/Export";
import { EVENT_TYPES, type EventType } from "../../models/Event";
import { getObjectDownloadUrl, s3Storage, type FileStorage } from "../../storage/s3Storage";

type ExportJobRecord = Pick<
  IExport,
  | "_id"
  | "ownerId"
  | "petId"
  | "period"
  | "sections"
  | "fileKey"
  | "fileToken"
  | "status"
  | "emailSentAt"
  | "createdAt"
  | "updatedAt"
>;

interface UpdateExportInput {
  set?: Partial<Pick<IExport, "status" | "fileKey" | "emailSentAt" | "lastError">>;
  unset?: Partial<Record<"lastError", "">>;
}

export interface PetExportHandlerDependencies {
  findExportById?: (exportId: Types.ObjectId) => Promise<ExportJobRecord | null>;
  updateExportRecord?: (
    exportId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: UpdateExportInput
  ) => Promise<ExportJobRecord | null>;
  findPet?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<PetRecord | null>;
  buildReport?: typeof buildPetExportReport;
  renderTemplate?: typeof renderPetExportTemplate;
  renderPdf?: typeof renderHtmlToPdf;
  storage?: FileStorage;
  sendExportReadyEmail?: (payload: ExportReadyEmailPayload) => Promise<void>;
  getPublicUrl?: (key: string) => string;
  now?: () => Date;
}

const objectIdSchema = z.string().refine((value) => Types.ObjectId.isValid(value), {
  message: "must be a valid ObjectId"
});

const periodSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  })
  .optional();

const payloadSchema = z.object({
  exportId: objectIdSchema,
  ownerId: objectIdSchema,
  petId: objectIdSchema,
  period: periodSchema,
  sections: z.array(z.enum(EXPORT_SECTIONS)).nonempty(),
  eventTypes: z.array(z.enum(EVENT_TYPES)).optional(),
  notificationEmail: z.string().email().optional()
});

const parseDateOnly = (value?: string): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return date;
};

const parsePayloadPeriod = (period?: { from?: string; to?: string }): NormalizedExportPeriod | undefined => {
  if (!period) {
    return undefined;
  }
  const parsed: NormalizedExportPeriod = {
    from: parseDateOnly(period.from),
    to: parseDateOnly(period.to)
  };
  return parsed.from || parsed.to ? parsed : undefined;
};

const buildStorageKey = (
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  exportId: Types.ObjectId,
  token: string
): string =>
  `users/${ownerId.toString()}/pets/${petId.toString()}/exports/${exportId.toString()}-${token}.pdf`;

const streamToBuffer = async (body: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const defaultFindExportById = async (exportId: Types.ObjectId): Promise<ExportJobRecord | null> =>
  ExportModel.findById(exportId).exec() as unknown as ExportJobRecord | null;

const defaultUpdateExportRecord: NonNullable<PetExportHandlerDependencies["updateExportRecord"]> = async (
  exportId,
  ownerId,
  updates
) =>
  ExportModel.findOneAndUpdate(
    { _id: exportId, ownerId },
    {
      ...(updates.set ? { $set: updates.set } : {}),
      ...(updates.unset ? { $unset: updates.unset } : {})
    },
    { new: true }
  ).exec() as unknown as ExportJobRecord | null;

const markFailed = async (
  updateExportRecord: NonNullable<PetExportHandlerDependencies["updateExportRecord"]>,
  record: ExportJobRecord,
  error: unknown
): Promise<void> => {
  await updateExportRecord(record._id, record.ownerId, {
    set: {
      status: "failed",
      lastError: sanitizeJobDiagnostic(error)
    }
  });
};

const sendReadyEmailIfNeeded = async (
  record: ExportJobRecord,
  pet: PetRecord,
  pdfBody: Buffer,
  recipient: string | undefined,
  dependencies: Required<
    Pick<
      PetExportHandlerDependencies,
      "sendExportReadyEmail" | "getPublicUrl" | "updateExportRecord" | "now"
    >
  >
): Promise<void> => {
  if (!recipient || record.emailSentAt || !record.fileKey) {
    return;
  }

  await dependencies.sendExportReadyEmail({
    to: recipient,
    petName: pet.name,
    downloadUrl: dependencies.getPublicUrl(record.fileKey),
    attachment: {
      filename: buildPetExportFilename(pet.name),
      content: pdfBody,
      contentType: PET_EXPORT_PDF_CONTENT_TYPE
    }
  });

  await dependencies.updateExportRecord(record._id, record.ownerId, {
    set: { emailSentAt: dependencies.now() }
  });
};

export const createPetExportJobHandler = (
  dependencies: PetExportHandlerDependencies = {}
): BackgroundJobHandler => {
  const {
    findExportById = defaultFindExportById,
    updateExportRecord = defaultUpdateExportRecord,
    findPet = findPetByIdForOwner,
    buildReport = buildPetExportReport,
    renderTemplate = renderPetExportTemplate,
    renderPdf = renderHtmlToPdf,
    storage = s3Storage,
    sendExportReadyEmail: sendEmail = sendExportReadyEmail,
    getPublicUrl = getObjectDownloadUrl,
    now = () => new Date()
  } = dependencies;

  return async (job) => {
    const parsed = payloadSchema.safeParse(job.payload);
    if (!parsed.success) {
      job.logger.error("invalid pet-export job payload", { cause: parsed.error.message });
      return;
    }

    const exportId = new Types.ObjectId(parsed.data.exportId);
    const record = await findExportById(exportId);
    if (!record || record.status === "failed" || (record.status === "ready" && record.emailSentAt)) {
      return;
    }

    const ownerId = record.ownerId;
    const petId = record.petId;
    const pet = await findPet(petId, ownerId);
    if (!pet) {
      await markFailed(updateExportRecord, record, "Pet was not found");
      return;
    }

    const recipient = parsed.data.notificationEmail;
    const emailDependencies = {
      sendExportReadyEmail: sendEmail,
      getPublicUrl,
      updateExportRecord,
      now
    };

    if (record.status === "ready") {
      if (!record.fileKey) {
        return;
      }
      const stored = await storage.getObject({ key: record.fileKey });
      await sendReadyEmailIfNeeded(
        record,
        pet,
        await streamToBuffer(stored.body),
        recipient,
        emailDependencies
      );
      return;
    }

    if (!record.fileToken) {
      await markFailed(updateExportRecord, record, "Export file token is missing");
      return;
    }

    let html: string;
    let assets: Awaited<ReturnType<typeof renderPetExportTemplate>>["assets"];
    try {
      const report = await buildReport({
        exportId: record._id,
        ownerId,
        petId,
        pet,
        period: parsePayloadPeriod(parsed.data.period),
        sections: parsed.data.sections as ExportSection[],
        eventTypes: parsed.data.eventTypes as EventType[] | undefined,
        generatedAt: now()
      });
      ({ html, assets } = await renderTemplate(report));
    } catch (error) {
      await markFailed(updateExportRecord, record, error);
      return;
    }

    let pdfBody: Buffer;
    try {
      pdfBody = await renderPdf({ html, assets });
    } catch (error) {
      if (error instanceof GotenbergRequestError) {
        await markFailed(updateExportRecord, record, error);
        return;
      }
      if (error instanceof GotenbergUnavailableError && job.attempts + 1 >= job.maxAttempts) {
        await markFailed(updateExportRecord, record, error);
      }
      throw error;
    }

    const fileKey = buildStorageKey(ownerId, petId, record._id, record.fileToken);
    try {
      await storage.putObject({
        key: fileKey,
        body: pdfBody,
        contentType: PET_EXPORT_PDF_CONTENT_TYPE
      });
    } catch (error) {
      if (job.attempts + 1 >= job.maxAttempts) {
        await markFailed(updateExportRecord, record, error);
      }
      throw error;
    }

    const ready = await updateExportRecord(record._id, ownerId, {
      set: { status: "ready", fileKey },
      unset: { lastError: "" }
    });

    await sendReadyEmailIfNeeded(
      ready ?? { ...record, status: "ready", fileKey },
      pet,
      pdfBody,
      recipient,
      emailDependencies
    );
  };
};

export const registerPetExportJobHandler = (): void => {
  registerJobHandler("pet-export", createPetExportJobHandler());
};
