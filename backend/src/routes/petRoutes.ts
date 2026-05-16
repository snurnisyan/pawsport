import { createPet, deletePet, getPet, listPets, updatePet } from "../controllers/petController";
import { createDocumentedRouter } from "../docs/route";
import { jsonRequestBody, jsonResponse } from "../docs/routeContent";
import {
  CreatePetMultipartRequestSchema,
  CreatePetRequestSchema,
  IdPathParamsSchema,
  PetListResponseSchema,
  PetResponseSchema,
  UpdatePetRequestSchema
} from "../docs/schemas";
import { upload } from "../middleware/uploadMiddleware";
import { multipartOnly } from "../middleware/multipartOnly";

const pets = createDocumentedRouter({ basePath: "/pets", tags: ["Pets"], auth: true });

pets.route("get", "/", {
  operationId: "listPets",
  summary: "List pets owned by the authenticated user",
  responses: { 200: jsonResponse("Pet list", PetListResponseSchema) },
  handlers: [listPets]
});

pets.route("post", "/", {
  operationId: "createPet",
  summary: "Create a pet profile (optionally with an inline photo via multipart/form-data)",
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: CreatePetRequestSchema },
        "multipart/form-data": { schema: CreatePetMultipartRequestSchema }
      }
    }
  },
  responses: { 201: jsonResponse("Pet created", PetResponseSchema) },
  handlers: [multipartOnly(upload.single("photo")), createPet]
});

pets.route("get", "/:id", {
  operationId: "getPet",
  summary: "Get a pet profile",
  request: { params: IdPathParamsSchema },
  responses: { 200: jsonResponse("Pet profile", PetResponseSchema) },
  handlers: [getPet]
});

pets.route("patch", "/:id", {
  operationId: "updatePet",
  summary: "Update a pet profile",
  request: { params: IdPathParamsSchema, body: jsonRequestBody(UpdatePetRequestSchema) },
  responses: { 200: jsonResponse("Pet updated", PetResponseSchema) },
  handlers: [updatePet]
});

pets.route("delete", "/:id", {
  operationId: "deletePet",
  summary: "Delete a pet profile",
  request: { params: IdPathParamsSchema },
  responses: { 204: { description: "Pet deleted" } },
  handlers: [deletePet]
});

export const petRoutes = pets.router;
