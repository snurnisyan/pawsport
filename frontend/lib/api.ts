import createClient from "openapi-fetch";
import type { components, paths } from "@/types/api";

export type TApiErrorCode = string;

export class ApiError extends Error {
  code: TApiErrorCode;
  status: number;
  details: unknown;

  constructor({
    code,
    message,
    status,
    details,
  }: {
    code: TApiErrorCode;
    message: string;
    status: number;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const API_PATH = "/api";
const CONFIGURED_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

const resolveApiBaseUrl = (): string => {
  if (CONFIGURED_API_BASE_URL) {
    return CONFIGURED_API_BASE_URL;
  }

  return API_PATH;
};

export const API_BASE_URL = resolveApiBaseUrl();

export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: "include",
  fetch: (request) => fetch(request, { credentials: "include" }),
});

type TBackendError = components["schemas"]["ErrorResponse"];

const isBackendError = (value: unknown): value is TBackendError =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  typeof (value as TBackendError).error?.code === "string" &&
  typeof (value as TBackendError).error?.message === "string";

export const normalizeApiError = (error: unknown, response?: Response): ApiError => {
  if (error instanceof ApiError) return error;

  if (isBackendError(error)) {
    return new ApiError({
      code: error.error.code,
      message: error.error.message,
      status: response?.status ?? 0,
      details: error,
    });
  }

  if (error instanceof Error) {
    return new ApiError({
      code: "NETWORK_ERROR",
      message: error.message,
      status: response?.status ?? 0,
      details: error,
    });
  }

  return new ApiError({
    code: "UNKNOWN_ERROR",
    message: "Не удалось выполнить запрос. Попробуйте еще раз.",
    status: response?.status ?? 0,
    details: error,
  });
};

export const buildApiUrl = (
  path: string,
  query?: Record<string, string | undefined>
): string => {
  const baseUrl = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const isRelativeBaseUrl = baseUrl.startsWith("/");
  const apiPath = path.replace(/^\/+/, "");

  if (isRelativeBaseUrl) {
    const [pathWithoutSearch, search = ""] = apiPath.split("?", 2);
    const searchParams = new URLSearchParams(search);

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });

    const queryString = searchParams.toString();
    return `${baseUrl}${pathWithoutSearch}${queryString ? `?${queryString}` : ""}`;
  }

  const url = new URL(apiPath, baseUrl);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
};

export const authenticatedFetch = (path: string, init?: RequestInit): Promise<Response> => {
  const request = new Request(buildApiUrl(path), {
    ...init,
    credentials: "include",
  });

  return fetch(request);
};

export const unwrapApiResponse = async <T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>
): Promise<T> => {
  const { data, error, response } = await request;
  if (error) {
    throw normalizeApiError(error, response);
  }

  if (data === undefined) {
    throw new ApiError({
      code: "EMPTY_RESPONSE",
      message: "Сервер вернул пустой ответ.",
      status: response.status,
    });
  }

  return data;
};

export const unwrapVoidApiResponse = async (
  request: Promise<{ data?: unknown; error?: unknown; response: Response }>
): Promise<void> => {
  const { error, response } = await request;
  if (error) {
    throw normalizeApiError(error, response);
  }
};
