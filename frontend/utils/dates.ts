export const pad2 = (value: number): string => String(value).padStart(2, "0");

export const toDateOnly = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const dateParam = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

export const splitDateTime = (iso: string): { date: string; time: string } => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { date, time };
};

export const toIsoDateTime = (date: string, time?: string): string => {
  const hhmm = time && time.length > 0 ? time : "00:00";
  return new Date(`${date}T${hhmm}:00`).toISOString();
};

export const todayIsoDate = (): string => toDateOnly(new Date());

export const subtractMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
};

export const formatFullDateLong = (date: string | Date): string => {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
};

export const formatShortDate = (date: string | Date): string => {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

export const formatDateWithTime = (date: string | Date): string => {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

export const formatTime = (iso: string): string | undefined => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

export const formatEventDateLong = (iso: string): string | undefined => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return formatFullDateLong(date);
};
