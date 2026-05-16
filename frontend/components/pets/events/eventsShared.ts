import type { TDateRange } from "@/components/ui/DateRangeField";
import type { TPetEvent, TPetEventType } from "@/store/pets";

export type TEventsFilters = {
  search: string;
  types: string[];
  dateRange: TDateRange;
};

export const INITIAL_FILTERS: TEventsFilters = {
  search: "",
  types: [],
  dateRange: { from: "", to: "" },
};

export const TYPE_TONE: Record<TPetEventType, "info" | "purple" | "teal" | "warning"> = {
  visit: "info",
  vaccine: "purple",
  treatment: "teal",
  operation: "warning",
};

export const TYPE_LABEL: Record<TPetEventType, string> = {
  visit: "Визит",
  vaccine: "Вакцинация",
  treatment: "Обработка",
  operation: "Операция",
};

export const TYPE_COLOR: Record<TPetEventType, string> = {
  visit: "#3B82F6",
  vaccine: "#A855F7",
  treatment: "#10B981",
  operation: "#F59E0B",
};

export const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as TPetEventType[]).map((t) => ({
  value: t,
  label: TYPE_LABEL[t],
  color: TYPE_COLOR[t],
}));

export const RU_MONTH_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export const RU_MONTH_SHORT = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

export type TEventGroup = {
  key: string;
  year: number;
  month: number;
  label: string;
  isCurrent: boolean;
  events: TPetEvent[];
};

const ymKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export function buildGroups(events: TPetEvent[]): TEventGroup[] {
  const now = new Date();
  const currentKey = ymKey(now.getFullYear(), now.getMonth());

  const byKey = new Map<string, TPetEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    const key = ymKey(d.getFullYear(), d.getMonth());
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(e);
  }
  if (!byKey.has(currentKey)) byKey.set(currentKey, []);

  return Array.from(byKey.keys())
    .sort()
    .map((key) => {
      const [yStr, mStr] = key.split("-");
      const year = Number(yStr);
      const month = Number(mStr);
      const list = byKey.get(key)!;
      list.sort((a, b) => (a.date < b.date ? -1 : 1));
      return {
        key,
        year,
        month,
        label: `${RU_MONTH_NOM[month]} ${year}`,
        isCurrent: key === currentKey,
        events: list,
      };
    });
}

export function filterEvents(events: TPetEvent[], filters: TEventsFilters): TPetEvent[] {
  const q = filters.search.trim().toLowerCase();
  return events.filter((e) => {
    if (filters.types.length > 0 && !filters.types.includes(e.type)) return false;
    if (filters.dateRange.from && e.date < filters.dateRange.from) return false;
    if (filters.dateRange.to && e.date > filters.dateRange.to) return false;
    if (q) {
      const hay = `${e.title} ${e.comment ?? ""} ${e.place ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
