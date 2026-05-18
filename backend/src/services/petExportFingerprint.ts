import crypto from "node:crypto";
import { Types } from "mongoose";

import type { EventType } from "../models/Event";
import type { ExportSection } from "../models/Export";
import {
  buildPetExportReport,
  type BuildPetExportReportDependencies,
  type NormalizedExportPeriod,
  type PetExportPdfReport,
  type PetRecord
} from "./petExportReport";

export interface BuildPetExportFingerprintInput {
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  pet: PetRecord;
  period?: NormalizedExportPeriod;
  sections: ExportSection[];
  eventTypes?: EventType[];
}

export interface PetExportFingerprintResult {
  dataHash: string;
  canonicalData: unknown;
}

const FINGERPRINT_EXPORT_ID = new Types.ObjectId("000000000000000000000000");
const FINGERPRINT_GENERATED_AT = new Date(0);

const normalizeDate = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const normalizeValue = (value: unknown): unknown => {
  const normalizedDate = normalizeDate(value);
  if (normalizedDate !== value) {
    return normalizedDate;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, normalizeValue(record[key] ?? null)])
    );
  }

  return value ?? null;
};

export const stableJson = (value: unknown): string => JSON.stringify(normalizeValue(value));

const byString = (left?: string, right?: string): number => (left ?? "").localeCompare(right ?? "");

const canonicalizeReport = (
  report: PetExportPdfReport,
  input: BuildPetExportFingerprintInput
): unknown => {
  const events = report.events
    ? [...report.events].sort(
        (left, right) =>
          byString(left.eventDate, right.eventDate) ||
          byString(left.title, right.title) ||
          byString(left.id, right.id)
      )
    : undefined;
  const files = report.files
    ? [...report.files].sort(
        (left, right) =>
          byString(left.uploadedAt, right.uploadedAt) ||
          byString(left.originalName, right.originalName) ||
          byString(left.id, right.id)
      )
    : undefined;
  const reminders = report.reminders
    ? [...report.reminders].sort(
        (left, right) =>
          byString(left.dueAt, right.dueAt) ||
          byString(left.sendAt, right.sendAt) ||
          byString(left.id, right.id)
      )
    : undefined;

  return {
    ownerId: input.ownerId.toString(),
    petId: input.petId.toString(),
    filters: {
      period: report.period ?? null,
      sections: [...input.sections].sort(),
      eventTypes: input.eventTypes ? [...input.eventTypes].sort() : null
    },
    renderData: {
      profile: report.profile ?? null,
      events: events ?? null,
      files:
        files?.map(({ downloadUrl, ...file }) => ({
          ...file,
          storageKey: downloadUrl.replace(/^storage-key:/, "")
        })) ?? null,
      reminders: reminders ?? null
    }
  };
};

export const buildPetExportFingerprint = async (
  input: BuildPetExportFingerprintInput,
  dependencies: BuildPetExportReportDependencies = {}
): Promise<PetExportFingerprintResult> => {
  const report = await buildPetExportReport(
    {
      exportId: FINGERPRINT_EXPORT_ID,
      ownerId: input.ownerId,
      petId: input.petId,
      pet: input.pet,
      period: input.period,
      sections: input.sections,
      eventTypes: input.eventTypes,
      generatedAt: FINGERPRINT_GENERATED_AT
    },
    {
      ...dependencies,
      getFileDownloadUrl: (key) => `storage-key:${key}`
    }
  );

  const canonicalData = canonicalizeReport(report, input);
  const dataHash = crypto.createHash("sha256").update(stableJson(canonicalData), "utf8").digest("hex");

  return {
    dataHash,
    canonicalData
  };
};
