import type { Express, RequestHandler } from "express";

import { createOpenApiDocument } from "./openapi";

const SWAGGER_UI_VERSION = "5.17.14";
const SWAGGER_UI_BASE = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

const swaggerHtml = (specUrl: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pawsport API Docs</title>
    <link rel="stylesheet" href="${SWAGGER_UI_BASE}/swagger-ui.css" />
    <style>body { margin: 0; background: #f7f8fa; } .swagger-ui .topbar { display: none; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI_BASE}/swagger-ui-bundle.js"></script>
    <script>
      window.addEventListener("load", function () {
        window.ui = SwaggerUIBundle({
          url: ${JSON.stringify(specUrl)},
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout"
        });
      });
    </script>
  </body>
</html>`;

const jsonHandler: RequestHandler = (_req, res) => {
  res.json(createOpenApiDocument());
};

const uiHandler: RequestHandler = (_req, res) => {
  res.type("html").send(swaggerHtml("./docs.json"));
};

export const registerSwaggerRoutes = (app: Express, mountPath: string): void => {
  app.get(`${mountPath}/docs.json`, jsonHandler);
  app.get(`${mountPath}/docs`, uiHandler);
};
