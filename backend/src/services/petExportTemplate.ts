import { promises as fs } from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";

import type { GotenbergAsset } from "./gotenbergClient";
import type { PdfEvent, PdfFileMetadata, PdfReminder, PetExportPdfReport } from "./petExportReport";

export interface RenderPetExportTemplateResult {
  html: string;
  assets: GotenbergAsset[];
}

export interface RenderPetExportTemplateDependencies {
  templateRoot?: string;
}

const DEFAULT_TEMPLATE_ROOT = path.resolve(__dirname, "../../templates/pet-export");
const TEMPLATE_FILE = "index.html.hbs";
const ASSET_DIRS = ["assets", "fonts"] as const;

interface TemplateFile extends PdfFileMetadata {
  sizeLabel: string;
  uploadedLabel: string;
}

interface TemplateReminder extends PdfReminder {
  sendAtLabel: string;
}

interface TemplateEvent extends PdfEvent {
  dateLabel: string;
  typeLabel: string;
  typeClass: string;
  stateClass: "past" | "future";
  contextParts: string[];
  files: TemplateFile[];
  reminders: TemplateReminder[];
}

interface TemplateProfile extends NonNullable<PetExportPdfReport["profile"]> {
  summaryParts: string[];
  speciesLabel: string;
  initial: string;
}

interface TemplateView {
  report: PetExportPdfReport & {
    generatedLabel: string;
    periodLabel: string;
  };
  profile?: TemplateProfile;
  events?: TemplateEvent[];
  files?: TemplateFile[];
  reminders?: TemplateReminder[];
  counts: {
    pastEvents: number;
    futureEvents: number;
    files: number;
    reminders: number;
  };
}

const formatDate = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
};

const formatDateWithWeekday = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
  const weekday = new Intl.DateTimeFormat("en", {
    weekday: "short",
    timeZone: "UTC"
  }).format(date);
  return `${datePart} - ${weekday}`;
};

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  for (const unit of units) {
    if (size < 1024 || unit === units[units.length - 1]) {
      return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
    }
    size /= 1024;
  }
  return `${value} B`;
};

const titleize = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const eventTypeClass = (type: string): string => {
  switch (type) {
    case "vaccination":
      return "vac";
    case "vet_visit":
      return "vet";
    case "medication":
      return "med";
    case "grooming":
      return "gro";
    case "surgery":
      return "sur";
    default:
      return "oth";
  }
};

const recurrenceLabel = (recurrence: PdfEvent["recurrence"]): string | undefined => {
  if (!recurrence) return undefined;
  const frequency = titleize(recurrence.frequency).toLowerCase();
  if (!recurrence.interval || recurrence.interval === 1) {
    return `recurs ${frequency}`;
  }
  return `recurs every ${recurrence.interval} ${frequency}`;
};

const periodLabel = (period: PetExportPdfReport["period"]): string => {
  if (!period?.from && !period?.to) return "all time";
  if (period.from && period.to) return `${formatDate(period.from)} - ${formatDate(period.to)}`;
  if (period.from) return `from ${formatDate(period.from)}`;
  return `until ${formatDate(period.to)}`;
};

const buildTemplateView = (report: PetExportPdfReport): TemplateView => {
  const generatedAt = new Date(report.generatedAt);
  const files: TemplateFile[] = (report.files ?? []).map((file) => ({
    ...file,
    sizeLabel: formatBytes(file.sizeBytes),
    uploadedLabel: formatDate(file.uploadedAt)
  }));
  const reminders: TemplateReminder[] = (report.reminders ?? []).map((reminder) => ({
    ...reminder,
    sendAtLabel: formatDate(reminder.sendAt)
  }));

  const filesById = new Map(files.map((file) => [file.id, file]));
  const filesByEventId = new Map<string, TemplateFile[]>();
  for (const file of files) {
    if (!file.eventId) continue;
    const eventFiles = filesByEventId.get(file.eventId) ?? [];
    eventFiles.push(file);
    filesByEventId.set(file.eventId, eventFiles);
  }

  const remindersByEventId = new Map<string, TemplateReminder[]>();
  for (const reminder of reminders) {
    const eventReminders = remindersByEventId.get(reminder.eventId) ?? [];
    eventReminders.push(reminder);
    remindersByEventId.set(reminder.eventId, eventReminders);
  }

  const events: TemplateEvent[] = (report.events ?? []).map((event) => {
    const eventDate = new Date(event.eventDate);
    const linkedFiles = new Map<string, TemplateFile>();
    for (const fileId of event.fileIds) {
      const file = filesById.get(fileId);
      if (file) linkedFiles.set(file.id, file);
    }
    for (const file of filesByEventId.get(event.id) ?? []) {
      linkedFiles.set(file.id, file);
    }

    const contextParts = [
      event.clinicName,
      recurrenceLabel(event.recurrence),
      event.reminderOffset ? `reminder ${event.reminderOffset} before` : undefined
    ].filter((part): part is string => Boolean(part));

    return {
      ...event,
      dateLabel: formatDateWithWeekday(event.eventDate),
      typeLabel: titleize(event.type),
      typeClass: eventTypeClass(event.type),
      stateClass:
        !Number.isNaN(eventDate.getTime()) && !Number.isNaN(generatedAt.getTime()) && eventDate > generatedAt
          ? "future"
          : "past",
      contextParts,
      files: [...linkedFiles.values()],
      reminders: remindersByEventId.get(event.id) ?? []
    };
  });

  const profile = report.profile
    ? {
        ...report.profile,
        initial: report.profile.name.trim().charAt(0).toUpperCase() || "P",
        speciesLabel: [report.profile.breed, titleize(report.profile.species)].filter(Boolean).join(" - "),
        summaryParts: [
          titleize(report.profile.sex),
          report.profile.birthDate ? `Born ${formatDate(report.profile.birthDate)}` : undefined,
          report.profile.microchipNumber ? `Microchip ${report.profile.microchipNumber}` : undefined,
          report.profile.weight !== undefined ? `Weight ${report.profile.weight} kg` : undefined
        ].filter((part): part is string => Boolean(part))
      }
    : undefined;

  const pastEvents = events.filter((event) => event.stateClass === "past").length;
  const futureEvents = events.length - pastEvents;

  return {
    report: {
      ...report,
      generatedLabel: formatDate(report.generatedAt),
      periodLabel: periodLabel(report.period)
    },
    profile,
    events,
    files,
    reminders,
    counts: {
      pastEvents,
      futureEvents,
      files: files.length,
      reminders: reminders.length
    }
  };
};

const collectFiles = async (
  absoluteDir: string,
  relativeDir: string,
  output: GotenbergAsset[]
): Promise<void> => {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, relativePath, output);
      continue;
    }
    if (!entry.isFile() || entry.name === ".gitkeep") {
      continue;
    }
    output.push({
      path: relativePath,
      content: await fs.readFile(absolutePath)
    });
  }
};

export const renderPetExportTemplate = async (
  report: PetExportPdfReport,
  dependencies: RenderPetExportTemplateDependencies = {}
): Promise<RenderPetExportTemplateResult> => {
  const templateRoot = dependencies.templateRoot ?? DEFAULT_TEMPLATE_ROOT;
  const templateSource = await fs.readFile(path.join(templateRoot, TEMPLATE_FILE), "utf8");
  const template = Handlebars.compile(templateSource, { noEscape: false });
  const html = template(buildTemplateView(report));

  const assets: GotenbergAsset[] = [];
  for (const dirname of ASSET_DIRS) {
    await collectFiles(path.join(templateRoot, dirname), dirname, assets);
  }

  return { html, assets };
};
