import { Types } from "mongoose";

import { EventModel, type EventType, type IEvent, type IRecurrence } from "../models/Event";
import type { ExportSection, IExportPeriod } from "../models/Export";
import { FileModel, type IStoredFile } from "../models/File";
import { PetModel, type IPet } from "../models/Pet";
import { ReminderModel, type IReminder } from "../models/Reminder";
import { getObjectDownloadUrl, s3Storage, type FileStorage } from "../storage/s3Storage";

export interface PdfExportPeriod {
  from?: string;
  to?: string;
}

export interface PdfVetContact {
  name?: string;
  phone?: string;
  email?: string;
}

export interface PdfProfile {
  id: string;
  name: string;
  species: string;
  photo?: {
    src: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  };
  breed?: string;
  birthDate?: string;
  sex: string;
  weight?: number;
  microchipNumber?: string;
  notes: string[];
  vetContact?: PdfVetContact;
}

export interface PdfEvent {
  id: string;
  type: string;
  title: string;
  eventDate: string;
  nextDate?: string;
  clinicName?: string;
  comment?: string;
  recurrence?: {
    frequency: string;
    interval?: number;
  };
  reminderOffset?: string;
  fileIds: string[];
}

export interface PdfFileMetadata {
  id: string;
  eventId?: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  eventTitle?: string;
  downloadUrl: string;
}

export interface PdfReminder {
  id: string;
  eventId: string;
  eventTitle?: string;
  channel: string;
  dueAt: string;
  sendAt: string;
  offset: string;
  status: string;
}

export interface PetExportPdfReport {
  exportId: string;
  ownerId: string;
  petId: string;
  generatedAt: string;
  period?: PdfExportPeriod;
  sections: ExportSection[];
  eventTypes?: EventType[];
  profile?: PdfProfile;
  events?: PdfEvent[];
  files?: PdfFileMetadata[];
  reminders?: PdfReminder[];
}

export type PetRecord = Pick<
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
  | "notes"
  | "vetContact"
  | "createdAt"
  | "updatedAt"
>;

type EventRecord = Pick<
  IEvent,
  | "_id"
  | "ownerId"
  | "petId"
  | "type"
  | "title"
  | "eventDate"
  | "nextDate"
  | "clinicName"
  | "comment"
  | "recurrence"
  | "reminderOffset"
  | "fileIds"
  | "createdAt"
  | "updatedAt"
>;

type FileMetadataRecord = Pick<
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

type PhotoFileRecord = Pick<
  IStoredFile,
  "_id" | "originalName" | "mimeType" | "sizeBytes" | "storageKey"
>;

type ReminderRecord = Pick<
  IReminder,
  | "_id"
  | "ownerId"
  | "petId"
  | "eventId"
  | "channel"
  | "dueAt"
  | "sendAt"
  | "offset"
  | "status"
  | "lastError"
  | "createdAt"
  | "updatedAt"
>;

export interface NormalizedExportPeriod {
  from?: Date;
  to?: Date;
}

export interface DateRange {
  from?: Date;
  toExclusive?: Date;
}

export interface BuildPetExportReportInput {
  exportId: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  pet: PetRecord;
  period?: NormalizedExportPeriod;
  sections: ExportSection[];
  eventTypes?: EventType[];
  generatedAt: Date;
}

export interface BuildPetExportReportDependencies {
  listEventsForPet?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    range: DateRange,
    eventTypes?: EventType[]
  ) => Promise<EventRecord[]>;
  listFileMetadataForPet?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    range: DateRange
  ) => Promise<FileMetadataRecord[]>;
  listRemindersForPet?: (
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    range: DateRange
  ) => Promise<ReminderRecord[]>;
  findPhotoFileForPet?: (
    fileId: Types.ObjectId,
    ownerId: Types.ObjectId,
    petId: Types.ObjectId
  ) => Promise<PhotoFileRecord | null>;
  storage?: FileStorage;
  getFileDownloadUrl?: (key: string) => string;
}

export const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

export const serializePeriodForReport = (
  period?: IExportPeriod | NormalizedExportPeriod
): PdfExportPeriod | undefined => {
  if (!period?.from && !period?.to) {
    return undefined;
  }
  const result: PdfExportPeriod = {};
  if (period.from) result.from = toDateOnly(period.from);
  if (period.to) result.to = toDateOnly(period.to);
  return result;
};

export const buildExportDateRange = (period?: NormalizedExportPeriod): DateRange => {
  const range: DateRange = {};
  if (period?.from) {
    range.from = period.from;
  }
  if (period?.to) {
    range.toExclusive = new Date(period.to.getTime() + 24 * 60 * 60 * 1000);
  }
  return range;
};

const buildDateQuery = (range: DateRange): Record<string, Date> | undefined => {
  const query: Record<string, Date> = {};
  if (range.from) query.$gte = range.from;
  if (range.toExclusive) query.$lt = range.toExclusive;
  return Object.keys(query).length > 0 ? query : undefined;
};

export const findPetByIdForOwner = async (
  petId: Types.ObjectId,
  ownerId: Types.ObjectId
): Promise<PetRecord | null> =>
  PetModel.findOne({ _id: petId, ownerId }).lean().exec() as unknown as PetRecord | null;

const defaultListEvents: NonNullable<BuildPetExportReportDependencies["listEventsForPet"]> = async (
  ownerId,
  petId,
  range,
  eventTypes
) => {
  const dateQuery = buildDateQuery(range);
  const query: Record<string, unknown> = { ownerId, petId };
  if (dateQuery) query.eventDate = dateQuery;
  if (eventTypes?.length) query.type = { $in: eventTypes };
  return EventModel.find(query)
    .sort({ eventDate: 1, _id: 1 })
    .exec() as unknown as EventRecord[];
};

const defaultListFiles: NonNullable<BuildPetExportReportDependencies["listFileMetadataForPet"]> = async (
  ownerId,
  petId,
  range
) => {
  const dateQuery = buildDateQuery(range);
  const query: Record<string, unknown> = { ownerId, petId };
  if (dateQuery) query.uploadedAt = dateQuery;
  return FileModel.find(query)
    .sort({ uploadedAt: 1, _id: 1 })
    .exec() as unknown as FileMetadataRecord[];
};

const defaultListReminders: NonNullable<BuildPetExportReportDependencies["listRemindersForPet"]> = async (
  ownerId,
  petId,
  range
) => {
  const dateQuery = buildDateQuery(range);
  const query: Record<string, unknown> = { ownerId, petId };
  if (dateQuery) query.dueAt = dateQuery;
  return ReminderModel.find(query)
    .sort({ dueAt: 1, _id: 1 })
    .exec() as unknown as ReminderRecord[];
};

const defaultFindPhotoFile: NonNullable<BuildPetExportReportDependencies["findPhotoFileForPet"]> = async (
  fileId,
  ownerId,
  petId
) =>
  FileModel.findOne({
    _id: fileId,
    ownerId,
    petId,
    mimeType: { $in: ["image/png", "image/jpeg"] }
  }).exec() as unknown as PhotoFileRecord | null;

const streamToBuffer = async (body: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const optionalId = (id?: Types.ObjectId): string | undefined => id?.toString();

const serializeVetContact = (vetContact: PetRecord["vetContact"]): PdfVetContact | undefined => {
  if (!vetContact) {
    return undefined;
  }

  const result: PdfVetContact = {};
  if (vetContact.name) result.name = vetContact.name;
  if (vetContact.phone) result.phone = vetContact.phone;
  if (vetContact.email) result.email = vetContact.email;
  return Object.keys(result).length > 0 ? result : undefined;
};

const serializeProfileForPdf = async (
  pet: PetRecord,
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  findPhotoFileForPet: NonNullable<BuildPetExportReportDependencies["findPhotoFileForPet"]>,
  storage: FileStorage
): Promise<PdfProfile> => {
  const result: PdfProfile = {
    id: pet._id.toString(),
    name: pet.name,
    species: pet.species,
    sex: pet.sex,
    notes: [...(pet.notes ?? [])]
  };

  if (pet.breed) result.breed = pet.breed;
  if (pet.birthDate) result.birthDate = toDateOnly(pet.birthDate);
  if (pet.weight !== undefined && pet.weight !== null) result.weight = pet.weight;
  if (pet.microchipNumber) result.microchipNumber = pet.microchipNumber;
  const vetContact = serializeVetContact(pet.vetContact);
  if (vetContact) result.vetContact = vetContact;

  if (pet.photoFileId) {
    const photoFile = await findPhotoFileForPet(pet.photoFileId, ownerId, petId);
    if (photoFile) {
      try {
        const object = await storage.getObject({ key: photoFile.storageKey });
        const content = await streamToBuffer(object.body);
        result.photo = {
          src: `data:${photoFile.mimeType};base64,${content.toString("base64")}`,
          originalName: photoFile.originalName,
          mimeType: photoFile.mimeType,
          sizeBytes: photoFile.sizeBytes
        };
      } catch {
        delete result.photo;
      }
    }
  }

  return result;
};

const serializeRecurrence = (recurrence?: IRecurrence): IRecurrence | undefined => {
  if (!recurrence) {
    return undefined;
  }
  const result: IRecurrence = { frequency: recurrence.frequency };
  if (recurrence.interval !== undefined && recurrence.interval !== null) {
    result.interval = recurrence.interval;
  }
  return result;
};

const serializeEventForPdf = (event: EventRecord): PdfEvent => {
  const result: PdfEvent = {
    id: event._id.toString(),
    type: event.type,
    title: event.title,
    eventDate: event.eventDate.toISOString(),
    fileIds: (event.fileIds ?? []).map((id) => id.toString())
  };

  if (event.nextDate) result.nextDate = event.nextDate.toISOString();
  if (event.clinicName) result.clinicName = event.clinicName;
  if (event.comment) result.comment = event.comment;
  if (event.reminderOffset) result.reminderOffset = event.reminderOffset;
  const recurrence = serializeRecurrence(event.recurrence);
  if (recurrence) result.recurrence = recurrence;
  return result;
};

const serializeFileForPdf = (
  file: FileMetadataRecord,
  getFileDownloadUrl: (key: string) => string
): PdfFileMetadata => {
  const result: PdfFileMetadata = {
    id: file._id.toString(),
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    uploadedAt: file.uploadedAt.toISOString(),
    downloadUrl: getFileDownloadUrl(file.storageKey)
  };

  const eventId = optionalId(file.eventId);
  if (eventId) result.eventId = eventId;
  return result;
};

const isCurrentPetPhotoFile = (
  file: FileMetadataRecord,
  photoFileId?: Types.ObjectId
): boolean => Boolean(photoFileId && file._id.equals(photoFileId));

const isUnlinkedFile = (file: FileMetadataRecord): boolean => !optionalId(file.eventId);

const isFileUploadedInRange = (file: FileMetadataRecord, range: DateRange): boolean => {
  if (range.from && file.uploadedAt < range.from) return false;
  if (range.toExclusive && file.uploadedAt >= range.toExclusive) return false;
  return true;
};

const serializeReminderForPdf = (reminder: ReminderRecord): PdfReminder => ({
  id: reminder._id.toString(),
  eventId: reminder.eventId.toString(),
  channel: reminder.channel,
  dueAt: reminder.dueAt.toISOString(),
  sendAt: reminder.sendAt.toISOString(),
  offset: reminder.offset,
  status: reminder.status
});

export const buildPetExportReport = async (
  input: BuildPetExportReportInput,
  dependencies: BuildPetExportReportDependencies = {}
): Promise<PetExportPdfReport> => {
  const {
    listEventsForPet = defaultListEvents,
    listFileMetadataForPet = defaultListFiles,
    listRemindersForPet = defaultListReminders,
    findPhotoFileForPet = defaultFindPhotoFile,
    storage = s3Storage,
    getFileDownloadUrl = getObjectDownloadUrl
  } = dependencies;

  const range = buildExportDateRange(input.period);
  const report: PetExportPdfReport = {
    exportId: input.exportId.toString(),
    ownerId: input.ownerId.toString(),
    petId: input.petId.toString(),
    generatedAt: input.generatedAt.toISOString(),
    period: serializePeriodForReport(input.period),
    sections: input.sections
  };
  if (input.eventTypes?.length) report.eventTypes = input.eventTypes;

  const eventTitleById = new Map<string, string>();
  if (input.sections.includes("profile")) {
    report.profile = await serializeProfileForPdf(
      input.pet,
      input.ownerId,
      input.petId,
      findPhotoFileForPet,
      storage
    );
  }
  if (input.sections.includes("events")) {
    report.events = (await listEventsForPet(input.ownerId, input.petId, range, input.eventTypes)).map((event) => {
      const serialized = serializeEventForPdf(event);
      eventTitleById.set(serialized.id, serialized.title);
      return serialized;
    });
  }
  const shouldIncludeFileSection = input.sections.includes("files");
  const linkedEventFileIds = new Set((report.events ?? []).flatMap((event) => event.fileIds));
  const shouldIncludeUnlinkedFiles = input.sections.includes("events");
  if (shouldIncludeFileSection || linkedEventFileIds.size > 0 || shouldIncludeUnlinkedFiles) {
    report.files = (await listFileMetadataForPet(input.ownerId, input.petId, range))
      .filter((file) => !isCurrentPetPhotoFile(file, input.pet.photoFileId))
      .filter((file) => isFileUploadedInRange(file, range))
      .filter(
        (file) =>
          shouldIncludeFileSection ||
          linkedEventFileIds.has(file._id.toString()) ||
          (shouldIncludeUnlinkedFiles && isUnlinkedFile(file))
      )
      .map((file) => {
        const serialized = serializeFileForPdf(file, getFileDownloadUrl);
        if (serialized.eventId) {
          const eventTitle = eventTitleById.get(serialized.eventId);
          if (eventTitle) serialized.eventTitle = eventTitle;
        }
        return serialized;
      });
  }
  if (input.sections.includes("reminders")) {
    report.reminders = (await listRemindersForPet(input.ownerId, input.petId, range)).map((reminder) => {
      const serialized = serializeReminderForPdf(reminder);
      const eventTitle = eventTitleById.get(serialized.eventId);
      if (eventTitle) serialized.eventTitle = eventTitle;
      return serialized;
    });
  }

  return report;
};
