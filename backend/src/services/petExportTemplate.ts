import { promises as fs } from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";

import type { GotenbergAsset } from "./gotenbergClient";
import type { PdfEvent, PdfFileMetadata, PetExportPdfReport } from "./petExportReport";

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

interface TemplateEvent extends PdfEvent {
  dateLabel: string;
  typeLabel: string;
  typeClass: string;
  typeIconSvg: string;
  stateClass: "past" | "future";
  contextParts: string[];
  files: TemplateFile[];
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
  documentFiles?: TemplateFile[];
  counts: {
    pastEvents: number;
    futureEvents: number;
    files: number;
    documentFiles: number;
    reminders: number;
  };
  renderFilesSection: boolean;
}

const formatDate = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
};

const formatDateWithWeekday = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
  const weekday = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    timeZone: "UTC"
  }).format(date);
  return `${datePart} - ${weekday}`;
};

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value < 1024) return `${value} Б`;
  const units = ["КБ", "МБ", "ГБ"];
  let size = value / 1024;
  for (const unit of units) {
    if (size < 1024 || unit === units[units.length - 1]) {
      return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
    }
    size /= 1024;
  }
  return `${value} Б`;
};

const titleize = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const iconSvg = (children: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;

const EVENT_TYPE_META: Record<string, { className: string; iconSvg: string }> = {
  vaccine: {
    className: "vac",
    iconSvg: iconSvg(
      '<path d="m18 2 4 4" /><path d="m17 7 3-3" /><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" /><path d="m9 11 4 4" /><path d="m5 19-3 3" /><path d="m14 4 6 6" />'
    )
  },
  treatment: {
    className: "med",
    iconSvg: iconSvg(
      '<path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />'
    )
  },
  visit: {
    className: "vet",
    iconSvg: iconSvg(
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />'
    )
  },
  operation: {
    className: "sur",
    iconSvg: iconSvg(
      '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />'
    )
  },
  lab: {
    className: "lab",
    iconSvg: iconSvg(
      '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />'
    )
  },
  other: {
    className: "oth",
    iconSvg: iconSvg(
      '<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />'
    )
  }
};

const eventTypeMeta = (type: string): { className: string; iconSvg: string } => {
  return EVENT_TYPE_META[type] ?? EVENT_TYPE_META.other;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  vaccine: "Вакцинация",
  treatment: "Обработка",
  visit: "Визит",
  operation: "Операция",
  lab: "Анализы и обследования",
  other: "Другое"
};

const PET_SEX_LABELS: Record<string, string> = {
  male: "Мальчик",
  female: "Девочка",
  unknown: "Пол не указан"
};

const SPECIES_LABELS: Record<string, string> = {
  cat: "Кошка",
  dog: "Собака"
};

const pluralRu = (value: number, one: string, few: string, many: string): string => {
  const mod10 = Math.abs(value) % 10;
  const mod100 = Math.abs(value) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

const recurrenceUnitLabel = (
  frequency: string
): { one: string; few: string; many: string; every: string } | undefined => {
  const labels: Record<string, { one: string; few: string; many: string; every: string }> = {
    daily: { one: "день", few: "дня", many: "дней", every: "каждый день" },
    weekly: { one: "неделю", few: "недели", many: "недель", every: "каждую неделю" },
    monthly: { one: "месяц", few: "месяца", many: "месяцев", every: "каждый месяц" },
    yearly: { one: "год", few: "года", many: "лет", every: "каждый год" }
  };
  return labels[frequency];
};

const recurrenceLabel = (recurrence: PdfEvent["recurrence"]): string | undefined => {
  if (!recurrence) return undefined;
  if (recurrence.frequency === "none") return undefined;
  if (recurrence.frequency === "custom") return "повторяется по индивидуальному графику";
  const frequency = recurrenceUnitLabel(recurrence.frequency);
  if (!frequency) return `повторяется: ${titleize(recurrence.frequency).toLowerCase()}`;
  if (!recurrence.interval || recurrence.interval === 1) {
    return `повторяется ${frequency.every}`;
  }
  return `повторяется каждые ${recurrence.interval} ${pluralRu(
    recurrence.interval,
    frequency.one,
    frequency.few,
    frequency.many
  )}`;
};

const periodLabel = (period: PetExportPdfReport["period"]): string => {
  if (!period?.from && !period?.to) return "за все время";
  if (period.from && period.to) return `${formatDate(period.from)} - ${formatDate(period.to)}`;
  if (period.from) return `с ${formatDate(period.from)}`;
  return `до ${formatDate(period.to)}`;
};

const buildTemplateView = (report: PetExportPdfReport): TemplateView => {
  const generatedAt = new Date(report.generatedAt);
  const files: TemplateFile[] = (report.files ?? []).map((file) => ({
    ...file,
    sizeLabel: formatBytes(file.sizeBytes),
    uploadedLabel: formatDate(file.uploadedAt)
  }));
  const filesById = new Map(files.map((file) => [file.id, file]));
  const filesByEventId = new Map<string, TemplateFile[]>();
  for (const file of files) {
    if (!file.eventId) continue;
    const eventFiles = filesByEventId.get(file.eventId) ?? [];
    eventFiles.push(file);
    filesByEventId.set(file.eventId, eventFiles);
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

    const contextParts = [event.clinicName, recurrenceLabel(event.recurrence)].filter((part): part is string =>
      Boolean(part)
    );

    const typeMeta = eventTypeMeta(event.type);

    return {
      ...event,
      dateLabel: formatDateWithWeekday(event.eventDate),
      typeLabel: EVENT_TYPE_LABELS[event.type] ?? titleize(event.type),
      typeClass: typeMeta.className,
      typeIconSvg: typeMeta.iconSvg,
      stateClass:
        !Number.isNaN(eventDate.getTime()) && !Number.isNaN(generatedAt.getTime()) && eventDate > generatedAt
          ? "future"
          : "past",
      contextParts,
      files: [...linkedFiles.values()]
    };
  });

  const profile = report.profile
    ? {
        ...report.profile,
        initial: report.profile.name.trim().charAt(0).toUpperCase() || "P",
        speciesLabel: [report.profile.breed, SPECIES_LABELS[report.profile.species] ?? titleize(report.profile.species)]
          .filter(Boolean)
          .join(" - "),
        summaryParts: [
          PET_SEX_LABELS[report.profile.sex] ?? titleize(report.profile.sex),
          report.profile.birthDate ? `Дата рождения: ${formatDate(report.profile.birthDate)}` : undefined,
          report.profile.microchipNumber ? `Микрочип: ${report.profile.microchipNumber}` : undefined,
          report.profile.weight !== undefined ? `Вес: ${report.profile.weight} кг` : undefined
        ].filter((part): part is string => Boolean(part))
      }
    : undefined;

  const pastEvents = events.filter((event) => event.stateClass === "past").length;
  const futureEvents = events.length - pastEvents;
  const documentFiles = report.sections.includes("files") ? files : files.filter((file) => !file.eventId);

  return {
    report: {
      ...report,
      generatedLabel: formatDate(report.generatedAt),
      periodLabel: periodLabel(report.period)
    },
    profile,
    events,
    files,
    documentFiles,
    counts: {
      pastEvents,
      futureEvents,
      files: files.length,
      documentFiles: documentFiles.length,
      reminders: report.reminders?.length ?? 0
    },
    renderFilesSection: report.sections.includes("files") || documentFiles.length > 0
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
