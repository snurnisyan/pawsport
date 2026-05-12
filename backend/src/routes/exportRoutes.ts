import { createPetExport } from "../controllers/exportController";
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

export const exportRoutes = petExports.router;
