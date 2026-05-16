import {
  deleteFile,
  downloadFile,
  listPetFiles,
  uploadPetFile,
  uploadPetPhoto
} from "../controllers/fileController";
import { createDocumentedRouter } from "../docs/route";
import { jsonResponse } from "../docs/routeContent";
import {
  DateRangeQuerySchema,
  FileListResponseSchema,
  FileResponseSchema,
  IdPathParamsSchema,
  PetPhotoResponseSchema,
  UploadPetFileRequestSchema,
  UploadPetPhotoRequestSchema
} from "../docs/schemas";
import { upload } from "../middleware/uploadMiddleware";

const binarySchema = { type: "string", format: "binary" } as const;
const binaryFileContent = {
  "application/pdf": { schema: binarySchema },
  "image/png": { schema: binarySchema },
  "image/jpeg": { schema: binarySchema }
};

const petFiles = createDocumentedRouter({
  basePath: "/pets/:id/files",
  tags: ["Files"],
  auth: true,
  mergeParams: true
});

petFiles.route("get", "/", {
  operationId: "listPetFiles",
  summary: "List files attached to a pet",
  request: { params: IdPathParamsSchema, query: DateRangeQuerySchema },
  responses: { 200: jsonResponse("File list", FileListResponseSchema) },
  handlers: [listPetFiles]
});

petFiles.route("post", "/", {
  operationId: "uploadPetFile",
  summary: "Upload a PDF or image for a pet",
  request: {
    params: IdPathParamsSchema,
    body: {
      required: true,
      content: { "multipart/form-data": { schema: UploadPetFileRequestSchema } }
    }
  },
  responses: { 201: jsonResponse("File uploaded", FileResponseSchema) },
  handlers: [upload.single("file"), uploadPetFile]
});

const petPhoto = createDocumentedRouter({
  basePath: "/pets/:id/photo",
  tags: ["Pets"],
  auth: true,
  mergeParams: true
});

petPhoto.route("post", "/", {
  operationId: "uploadPetPhoto",
  summary: "Upload and set the pet's profile photo in a single request",
  request: {
    params: IdPathParamsSchema,
    body: {
      required: true,
      content: { "multipart/form-data": { schema: UploadPetPhotoRequestSchema } }
    }
  },
  responses: {
    201: jsonResponse("Photo uploaded and attached to the pet", PetPhotoResponseSchema)
  },
  handlers: [upload.single("file"), uploadPetPhoto]
});

const files = createDocumentedRouter({ basePath: "/files", tags: ["Files"], auth: true });

files.route("get", "/:id/download", {
  operationId: "downloadFile",
  summary: "Download a stored file",
  request: { params: IdPathParamsSchema },
  responses: { 200: { description: "File binary stream", content: binaryFileContent } },
  handlers: [downloadFile]
});

files.route("delete", "/:id", {
  operationId: "deleteFile",
  summary: "Delete a stored file",
  request: { params: IdPathParamsSchema },
  responses: { 204: { description: "File deleted" } },
  handlers: [deleteFile]
});

export const petFileRoutes = petFiles.router;
export const petPhotoRoutes = petPhoto.router;
export const fileRoutes = files.router;
