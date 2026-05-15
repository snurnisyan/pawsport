import { createPetExport, getPetExport } from "../controllers/exportController";
import { createDocumentedRouter } from "../docs/route";
import { jsonRequestBody, jsonResponse } from "../docs/routeContent";
import { CreateExportRequestSchema, ExportResponseSchema, IdPathParamsSchema } from "../docs/schemas";

const petExports = createDocumentedRouter({
  basePath: "/pets/:id/export",
  tags: ["Exports"],
  auth: true,
  mergeParams: true
});

petExports.route("post", "/", {
  operationId: "createPetExport",
  summary: "Create an export for a pet",
  request: { params: IdPathParamsSchema, body: jsonRequestBody(CreateExportRequestSchema, false) },
  responses: { 202: jsonResponse("Export queued", ExportResponseSchema) },
  handlers: [createPetExport]
});

const exportStatus = createDocumentedRouter({
  basePath: "/exports",
  tags: ["Exports"],
  auth: true
});

exportStatus.route("get", "/:id", {
  operationId: "getPetExport",
  summary: "Get export status",
  request: { params: IdPathParamsSchema },
  responses: { 200: jsonResponse("Export status", ExportResponseSchema) },
  handlers: [getPetExport]
});

export const petExportRoutes = petExports.router;
export const exportRoutes = exportStatus.router;
