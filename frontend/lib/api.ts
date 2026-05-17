import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "@/types/api";
import { getAccessToken } from "@/lib/session";

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

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:4000/api";

const apiBase = new URL(API_BASE_URL);
const apiPathPrefix = apiBase.pathname.endsWith("/")
  ? apiBase.pathname
  : `${apiBase.pathname}/`;

const shouldAttachAuth = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return (
    url.origin === apiBase.origin &&
    (url.pathname === apiBase.pathname || url.pathname.startsWith(apiPathPrefix))
  );
};

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getAccessToken();
    if (!token || !shouldAttachAuth(request.url)) return request;

    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return new Request(request, { headers });
  },
};

export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: "omit",
});

apiClient.use(authMiddleware);

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
  const url = new URL(path.replace(/^\/+/, ""), baseUrl);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
};

export const authenticatedFetch = (path: string, init?: RequestInit): Promise<Response> => {
  const request = new Request(buildApiUrl(path), init);
  const token = getAccessToken();

  if (!token || !shouldAttachAuth(request.url)) return fetch(request);

  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(new Request(request, { headers }));
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
