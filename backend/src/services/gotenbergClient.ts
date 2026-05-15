import { env } from "../config/env";

export interface GotenbergAsset {
  path: string;
  content: Buffer;
}

export interface RenderHtmlToPdfInput {
  html: string;
  assets?: GotenbergAsset[];
}

export interface RenderHtmlToPdfDependencies {
  gotenbergUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class GotenbergUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GotenbergUnavailableError";
  }
}

export class GotenbergRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GotenbergRequestError";
  }
}

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const buildEndpoint = (gotenbergUrl: string): string =>
  `${normalizeBaseUrl(gotenbergUrl)}/forms/chromium/convert/html`;

const appendFile = (form: FormData, content: Buffer | string, filename: string, type: string): void => {
  const body: BlobPart = typeof content === "string" ? content : new Uint8Array(content);
  const blob = new Blob([body], { type });
  form.append("files", blob, filename);
};

export const renderHtmlToPdf = async (
  { html, assets = [] }: RenderHtmlToPdfInput,
  dependencies: RenderHtmlToPdfDependencies = {}
): Promise<Buffer> => {
  const gotenbergUrl = dependencies.gotenbergUrl ?? env.GOTENBERG_URL;
  if (!gotenbergUrl) {
    throw new GotenbergRequestError("GOTENBERG_URL is not configured");
  }

  const form = new FormData();
  appendFile(form, html, "index.html", "text/html; charset=utf-8");
  for (const asset of assets) {
    appendFile(form, asset.content, asset.path, "application/octet-stream");
  }

  form.append("paperWidth", "8.27");
  form.append("paperHeight", "11.69");
  form.append("marginTop", "0.4");
  form.append("marginBottom", "0.4");
  form.append("marginLeft", "0.4");
  form.append("marginRight", "0.4");
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");

  const fetchFn = dependencies.fetchFn ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? env.GOTENBERG_TIMEOUT_MS;
  let response: Response;
  try {
    response = await fetchFn(buildEndpoint(gotenbergUrl), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gotenberg request failed";
    throw new GotenbergUnavailableError(message);
  }

  if (response.status >= 500) {
    throw new GotenbergUnavailableError(`Gotenberg returned ${response.status}`);
  }

  if (!response.ok) {
    throw new GotenbergRequestError(`Gotenberg returned ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
};
