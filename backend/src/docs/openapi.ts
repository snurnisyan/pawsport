import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas30";

import { env } from "../config/env";

export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT"
});

export const createOpenApiDocument = (): OpenAPIObject => {
  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Pawsport Backend API",
      version: "0.1.0",
      description: "OpenAPI contract generated from the Express route registry and Zod schemas."
    },
    servers: [{ url: env.API_PREFIX, description: "Backend API root" }]
  });
};
