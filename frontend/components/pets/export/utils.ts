import type { TDateRange } from "@/components/ui/DateRangeField";
import type { TCreatePetExportRequest, downloadExport } from "@/lib/petsApi";
import { EVENT_TYPE_OPTIONS } from "@/lib/eventTypes";
import { saveBlob, saveUrl } from "@/utils/files";
import { subtractMonths, toDateOnly } from "@/utils/dates";
import type { TExportEventType, TPeriod } from "./types";

export const DATA_TYPE_IDS: TExportEventType[] = EVENT_TYPE_OPTIONS.map(
  (option) => option.value
);

export const INITIAL_SELECTED = DATA_TYPE_IDS.reduce<Record<TExportEventType, boolean>>(
  (acc, id) => {
    acc[id] = true;
    return acc;
  },
  {} as Record<TExportEventType, boolean>
);

export const getPeriodPayload = (
  period: TPeriod,
  customPeriod: TDateRange
): TCreatePetExportRequest["period"] | undefined => {
  if (period === "Все время") return undefined;
  if (period === "Другой период") {
    return customPeriod.from && customPeriod.to
      ? { from: customPeriod.from, to: customPeriod.to }
      : undefined;
  }

  const today = new Date();
  const to = toDateOnly(today);
  const from =
    period === "Год"
      ? toDateOnly(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()))
      : period === "Полгода"
        ? toDateOnly(subtractMonths(today, 6))
        : toDateOnly(subtractMonths(today, 3));

  return { from, to };
};

export const isCustomPeriodValid = (
  period: TPeriod,
  customPeriod: TDateRange
): boolean => {
  if (period !== "Другой период") return true;
  return Boolean(
    customPeriod.from &&
      customPeriod.to &&
      customPeriod.from <= customPeriod.to
  );
};

export const getSelectedEventTypes = (
  selected: Record<TExportEventType, boolean>
): TExportEventType[] => DATA_TYPE_IDS.filter((id) => selected[id]);

export const makeFilename = (petName: string): string => {
  const normalized = petName
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `pawsport-${normalized || "pet"}-export.pdf`;
};

export const saveDownloadResult = (
  result: Awaited<ReturnType<typeof downloadExport>>,
  fallbackFilename: string
) => {
  if ("blob" in result) {
    saveBlob(result.blob, result.filename ?? fallbackFilename);
    return;
  }

  saveUrl(result.downloadUrl, fallbackFilename);
};
