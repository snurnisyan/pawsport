import { Types } from "mongoose";
import { z } from "zod";

import { sanitizeJobDiagnostic } from "../backgroundJobRunner";
import { enqueueJob, registerJobHandler, type EnqueueJobInput } from "../backgroundJobService";
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
  addExportRetention,
  buildExportArtifactStorageKey
} from "../../services/exportService";
import { PET_EXPORT_PDF_CONTENT_TYPE } from "../../services/exportEmail";
import { ExportModel, EXPORT_SECTIONS, type ExportSection, type IExport } from "../../models/Export";
import { ExportArtifactModel, type IExportArtifact } from "../../models/ExportArtifact";
import { EVENT_TYPES, type EventType } from "../../models/Event";
import { env } from "../../config/env";
import { s3Storage, type FileStorage } from "../../storage/s3Storage";

type ExportJobRecord = Pick<
  IExport,
  | "_id"
  | "ownerId"
  | "petId"
  | "period"
  | "sections"
  | "artifactId"
  | "dataHash"
  | "fileKey"
  | "status"
  | "expiresAt"
  | "emailSentAt"
  | "createdAt"
  | "updatedAt"
>;

type ExportArtifactJobRecord = Pick<
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
  | "renderClaimExpiresAt"
  | "lastError"
  | "createdAt"
  | "updatedAt"
>;

interface UpdateExportInput {
  set?: Partial<Pick<IExport, "status" | "fileKey" | "expiresAt" | "emailSentAt" | "lastError">>;
  unset?: Partial<Record<"lastError", "">>;
}

interface UpdateArtifactInput {
  set?: Partial<
    Pick<
      IExportArtifact,
      "status" | "fileKey" | "expiresAt" | "lastAccessedAt" | "renderClaimExpiresAt" | "lastError"
    >
  >;
  unset?: Partial<Record<"lastError" | "renderClaimExpiresAt", "">>;
}

export interface PetExportHandlerDependencies {
  findExportById?: (exportId: Types.ObjectId) => Promise<ExportJobRecord | null>;
  updateExportRecord?: (
    exportId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: UpdateExportInput
  ) => Promise<ExportJobRecord | null>;
  findArtifactById?: (artifactId: Types.ObjectId) => Promise<ExportArtifactJobRecord | null>;
  claimArtifactForRender?: (
    artifactId: Types.ObjectId,
    ownerId: Types.ObjectId,
    generation: number,
    now: Date,
    claimExpiresAt: Date
  ) => Promise<ExportArtifactJobRecord | null>;
  updateArtifactRecord?: (
    artifactId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: UpdateArtifactInput
  ) => Promise<ExportArtifactJobRecord | null>;
  markExportsForArtifactReady?: (
    artifactId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: Pick<IExport, "status" | "fileKey" | "expiresAt">
  ) => Promise<void>;
  findPet?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<PetRecord | null>;
  buildReport?: typeof buildPetExportReport;
  renderTemplate?: typeof renderPetExportTemplate;
  renderPdf?: typeof renderHtmlToPdf;
  storage?: FileStorage;
  enqueueEmailJob?: (input: EnqueueJobInput) => Promise<unknown>;
  now?: () => Date;
  retentionDays?: number;
  renderClaimTimeoutMs?: number;
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
  artifactId: objectIdSchema.optional(),
  dataHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  generation: z.number().int().min(0).optional(),
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

const defaultFindArtifactById: NonNullable<PetExportHandlerDependencies["findArtifactById"]> = async (
  artifactId
) => ExportArtifactModel.findById(artifactId).exec() as unknown as ExportArtifactJobRecord | null;

const defaultClaimArtifactForRender: NonNullable<
  PetExportHandlerDependencies["claimArtifactForRender"]
> = async (artifactId, ownerId, generation, now, claimExpiresAt) =>
  ExportArtifactModel.findOneAndUpdate(
    {
      _id: artifactId,
      ownerId,
      generation,
      $or: [
        { status: "pending" },
        {
          status: "processing",
          renderClaimExpiresAt: { $lte: now }
        }
      ]
    },
    {
      $set: {
        status: "processing",
        renderClaimExpiresAt: claimExpiresAt
      },
      $unset: {
        lastError: ""
      }
    },
    { new: true }
  ).exec() as unknown as ExportArtifactJobRecord | null;

const defaultUpdateArtifactRecord: NonNullable<
  PetExportHandlerDependencies["updateArtifactRecord"]
> = async (artifactId, ownerId, updates) =>
  ExportArtifactModel.findOneAndUpdate(
    { _id: artifactId, ownerId },
    {
      ...(updates.set ? { $set: updates.set } : {}),
      ...(updates.unset ? { $unset: updates.unset } : {})
    },
    { new: true }
  ).exec() as unknown as ExportArtifactJobRecord | null;

const defaultMarkExportsForArtifactReady: NonNullable<
  PetExportHandlerDependencies["markExportsForArtifactReady"]
> = async (artifactId, ownerId, updates) => {
  await ExportModel.updateMany(
    { artifactId, ownerId },
    { $set: updates, $unset: { lastError: "" } }
  ).exec();
};

const markFailed = async (
  updateExportRecord: NonNullable<PetExportHandlerDependencies["updateExportRecord"]>,
  record: ExportJobRecord,
  error: unknown,
  artifact: ExportArtifactJobRecord | null | undefined,
  updateArtifactRecord: NonNullable<PetExportHandlerDependencies["updateArtifactRecord"]>
): Promise<void> => {
  const lastError = sanitizeJobDiagnostic(error);
  if (artifact) {
    await updateArtifactRecord(artifact._id, artifact.ownerId, {
      set: {
        status: "failed",
        lastError
      },
      unset: { renderClaimExpiresAt: "" }
    });
  }
  await updateExportRecord(record._id, record.ownerId, {
    set: {
      status: "failed",
      lastError
    }
  });
};

const enqueueExportEmailIfNeeded = async (
  record: ExportJobRecord,
  recipient: string | undefined,
  enqueueEmailJob: NonNullable<PetExportHandlerDependencies["enqueueEmailJob"]>
): Promise<void> => {
  if (!recipient || record.emailSentAt || !record.fileKey || !record.artifactId) {
    return;
  }

  await enqueueEmailJob({
    type: "export-email",
    payload: {
      exportId: record._id.toString(),
      ownerId: record.ownerId.toString(),
      petId: record.petId.toString(),
      artifactId: record.artifactId.toString(),
      notificationEmail: recipient
    },
    idempotencyKey: `export-email:${record._id.toString()}`,
    maxAttempts: 3
  });
};

export const createPetExportJobHandler = (
  dependencies: PetExportHandlerDependencies = {}
): BackgroundJobHandler => {
  const {
    findExportById = defaultFindExportById,
    updateExportRecord = defaultUpdateExportRecord,
    findArtifactById = defaultFindArtifactById,
    claimArtifactForRender = defaultClaimArtifactForRender,
    updateArtifactRecord = defaultUpdateArtifactRecord,
    markExportsForArtifactReady = defaultMarkExportsForArtifactReady,
    findPet = findPetByIdForOwner,
    buildReport = buildPetExportReport,
    renderTemplate = renderPetExportTemplate,
    renderPdf = renderHtmlToPdf,
    storage = s3Storage,
    enqueueEmailJob = enqueueJob,
    now = () => new Date(),
    retentionDays = env.EXPORT_RETENTION_DAYS,
    renderClaimTimeoutMs = env.BACKGROUND_JOB_VISIBILITY_TIMEOUT_MS
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

    const artifact =
      parsed.data.artifactId || record.artifactId
        ? await findArtifactById(new Types.ObjectId(parsed.data.artifactId ?? record.artifactId))
        : null;

    const ownerId = record.ownerId;
    const petId = record.petId;
    const pet = await findPet(petId, ownerId);
    if (!pet) {
      await markFailed(updateExportRecord, record, "Pet was not found", artifact, updateArtifactRecord);
      return;
    }

    const recipient = parsed.data.notificationEmail;
    if (artifact?.status === "ready" && artifact.fileKey) {
      const accessedAt = now();
      if (artifact.expiresAt.getTime() <= accessedAt.getTime()) {
        await markFailed(updateExportRecord, record, "Export artifact expired", artifact, updateArtifactRecord);
        return;
      }
      const expiresAt = addExportRetention(accessedAt, retentionDays);
      const touched =
        (await updateArtifactRecord(artifact._id, ownerId, {
          set: { lastAccessedAt: accessedAt, expiresAt }
        })) ?? artifact;
      const readyFileKey = touched.fileKey ?? artifact.fileKey;
      const ready = await updateExportRecord(record._id, ownerId, {
        set: { status: "ready", fileKey: readyFileKey, expiresAt: touched.expiresAt },
        unset: { lastError: "" }
      });
      await enqueueExportEmailIfNeeded(
        ready ?? { ...record, status: "ready", fileKey: readyFileKey, expiresAt: touched.expiresAt },
        recipient,
        enqueueEmailJob
      );
      return;
    }

    if (record.status === "ready") {
      if (!record.fileKey) {
        return;
      }
      await enqueueExportEmailIfNeeded(
        record,
        recipient,
        enqueueEmailJob
      );
      return;
    }

    if (artifact?.status === "failed") {
      await updateExportRecord(record._id, ownerId, {
        set: { status: "failed", lastError: artifact.lastError }
      });
      return;
    }

    if (
      artifact &&
      parsed.data.generation !== undefined &&
      parsed.data.generation !== artifact.generation
    ) {
      return;
    }

    if (!artifact) {
      await markFailed(
        updateExportRecord,
        record,
        "Export artifact is missing",
        artifact,
        updateArtifactRecord
      );
      return;
    }

    const claimedArtifact = await claimArtifactForRender(
      artifact._id,
      ownerId,
      artifact.generation,
      now(),
      new Date(now().getTime() + renderClaimTimeoutMs)
    );
    if (!claimedArtifact) {
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
      await markFailed(updateExportRecord, record, error, claimedArtifact, updateArtifactRecord);
      return;
    }

    let pdfBody: Buffer;
    try {
      pdfBody = await renderPdf({ html, assets });
    } catch (error) {
      if (error instanceof GotenbergRequestError) {
        await markFailed(updateExportRecord, record, error, claimedArtifact, updateArtifactRecord);
        return;
      }
      if (error instanceof GotenbergUnavailableError && job.attempts + 1 >= job.maxAttempts) {
        await markFailed(updateExportRecord, record, error, claimedArtifact, updateArtifactRecord);
      } else {
        await updateArtifactRecord(claimedArtifact._id, ownerId, {
          set: { status: "pending" },
          unset: { renderClaimExpiresAt: "" }
        });
      }
      throw error;
    }

    const fileKey = buildExportArtifactStorageKey(ownerId, petId, claimedArtifact.dataHash);
    try {
      await storage.putObject({
        key: fileKey,
        body: pdfBody,
        contentType: PET_EXPORT_PDF_CONTENT_TYPE
      });
    } catch (error) {
      if (job.attempts + 1 >= job.maxAttempts) {
        await markFailed(updateExportRecord, record, error, claimedArtifact, updateArtifactRecord);
      } else {
        await updateArtifactRecord(claimedArtifact._id, ownerId, {
          set: { status: "pending" },
          unset: { renderClaimExpiresAt: "" }
        });
      }
      throw error;
    }

    const readyAt = now();
    const expiresAt = addExportRetention(readyAt, retentionDays);
    if (claimedArtifact) {
      await updateArtifactRecord(claimedArtifact._id, ownerId, {
        set: {
          status: "ready",
          fileKey,
          lastAccessedAt: readyAt,
          expiresAt
        },
        unset: { lastError: "", renderClaimExpiresAt: "" }
      });
      await markExportsForArtifactReady(claimedArtifact._id, ownerId, {
        status: "ready",
        fileKey,
        expiresAt
      });
    }

    const ready = await updateExportRecord(record._id, ownerId, {
      set: { status: "ready", fileKey, expiresAt },
      unset: { lastError: "" }
    });

    await enqueueExportEmailIfNeeded(
      ready ?? { ...record, status: "ready", fileKey, artifactId: claimedArtifact._id },
      recipient,
      enqueueEmailJob
    );
  };
};

export const registerPetExportJobHandler = (): void => {
  registerJobHandler("pet-export", createPetExportJobHandler());
};
