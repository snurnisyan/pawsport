import assert from "node:assert/strict";
import test from "node:test";

import {
  GotenbergRequestError,
  GotenbergUnavailableError,
  renderHtmlToPdf
} from "../src/services/gotenbergClient";

test("renderHtmlToPdf posts index.html first and attaches relative asset paths", async () => {
  let requestedUrl = "";
  let fileNames: string[] = [];
  let fields = new Map<string, string>();

  const pdf = await renderHtmlToPdf(
    {
      html: "<h1>Hello</h1>",
      assets: [{ path: "assets/logo.svg", content: Buffer.from("<svg />") }]
    },
    {
      gotenbergUrl: "http://localhost:3001/",
      timeoutMs: 1000,
      fetchFn: async (url, init) => {
        requestedUrl = url.toString();
        const form = init?.body as FormData;
        fileNames = [];
        fields = new Map();
        for (const [key, value] of form.entries()) {
          if (key === "files") {
            fileNames.push((value as File).name);
          } else {
            fields.set(key, value.toString());
          }
        }
        return new Response(Buffer.from("%PDF-ok"));
      }
    }
  );

  assert.equal(requestedUrl, "http://localhost:3001/forms/chromium/convert/html");
  assert.deepEqual(fileNames, ["index.html", "assets/logo.svg"]);
  assert.equal(fields.get("printBackground"), "true");
  assert.equal(fields.get("preferCssPageSize"), "true");
  assert.equal(pdf.toString("utf8"), "%PDF-ok");
});

test("renderHtmlToPdf treats Gotenberg 5xx and network failures as retryable", async () => {
  await assert.rejects(
    () =>
      renderHtmlToPdf(
        { html: "x" },
        {
          gotenbergUrl: "http://localhost:3001",
          fetchFn: async () => new Response("nope", { status: 503 })
        }
      ),
    GotenbergUnavailableError
  );

  await assert.rejects(
    () =>
      renderHtmlToPdf(
        { html: "x" },
        {
          gotenbergUrl: "http://localhost:3001",
          fetchFn: async () => {
            throw new Error("connect ECONNREFUSED");
          }
        }
      ),
    GotenbergUnavailableError
  );
});

test("renderHtmlToPdf treats Gotenberg 4xx as non-retryable", async () => {
  await assert.rejects(
    () =>
      renderHtmlToPdf(
        { html: "x" },
        {
          gotenbergUrl: "http://localhost:3001",
          fetchFn: async () => new Response("bad template", { status: 400 })
        }
      ),
    GotenbergRequestError
  );
});
