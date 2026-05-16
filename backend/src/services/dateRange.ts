import { AppError } from "../middleware/errorHandler";

export interface DateRangeQuery {
  from?: unknown;
  to?: unknown;
}

export interface OptionalDateRange {
  from?: Date;
  to?: Date;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseOptionalString = (value: unknown, code: string, message: string): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(400, code, message);
  }
  return value;
};

const parseDayBoundary = (
  value: string,
  time: "start" | "end",
  code: string,
  message: string
): Date => {
  if (!DATE_PATTERN.test(value)) {
    throw new AppError(400, code, message);
  }

  const suffix = time === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const date = new Date(`${value}${suffix}`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, code, message);
  }
  return date;
};

export const parseOptionalDateRange = (query: DateRangeQuery): OptionalDateRange => {
  const fromRaw = parseOptionalString(query.from, "INVALID_FROM", "from must be a YYYY-MM-DD date");
  const toRaw = parseOptionalString(query.to, "INVALID_TO", "to must be a YYYY-MM-DD date");

  const from = fromRaw
    ? parseDayBoundary(fromRaw, "start", "INVALID_FROM", "from must be a YYYY-MM-DD date")
    : undefined;
  const to = toRaw
    ? parseDayBoundary(toRaw, "end", "INVALID_TO", "to must be a YYYY-MM-DD date")
    : undefined;

  if (from && to && from.getTime() > to.getTime()) {
    throw new AppError(400, "INVALID_RANGE", "from must be on or before to");
  }

  return { from, to };
};
