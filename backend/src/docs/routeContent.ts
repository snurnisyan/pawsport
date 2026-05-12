import type { ResponseConfig, ZodContentObject, ZodRequestBody } from "@asteasolutions/zod-to-openapi";
import type { ReferenceObject, SchemaObject } from "openapi3-ts/oas30";
import type { ZodType } from "zod";

import { ErrorResponseSchema } from "./schemas";

type SchemaLike = ZodType<unknown> | SchemaObject | ReferenceObject;

export const jsonContent = (schema: SchemaLike): ZodContentObject => ({
  "application/json": { schema }
});

export const jsonRequestBody = (schema: SchemaLike, required = true): ZodRequestBody => ({
  required,
  content: jsonContent(schema)
});

export const jsonResponse = (description: string, schema: SchemaLike): ResponseConfig => ({
  description,
  content: jsonContent(schema)
});

const errorResponse = (description: string): ResponseConfig => ({
  description,
  content: jsonContent(ErrorResponseSchema)
});

export const errorResponses = ({
  auth,
  resource
}: {
  auth: boolean;
  resource: boolean;
}): Record<string, ResponseConfig> => ({
  400: errorResponse("Request validation failed"),
  ...(auth && { 401: errorResponse("Missing or invalid authentication") }),
  ...(resource && { 404: errorResponse("Resource was not found") })
});
