import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import * as fileService from "../services/fileService";
import { serializePet } from "../services/petService";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

const contentDisposition = (filename: string): string => {
  const fallback = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export interface ListPetFilesHandlerDependencies {
  listPetFiles?: typeof fileService.listPetFiles;
}

export const listPetFilesHandler = (dependencies: ListPetFilesHandlerDependencies = {}) => {
  const { listPetFiles: listPetFilesFn = fileService.listPetFiles } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const items = await listPetFilesFn(requireUserId(req), req.params.id, req.query ?? {});
    res.status(200).json({ items });
  });
};

export const listPetFiles = listPetFilesHandler();

export const uploadPetFile = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const file = await fileService.uploadPetFile(requireUserId(req), req.params.id, {
    file: req.file,
    eventId: req.body?.eventId
  });
  res.status(201).json({ file });
});

export const uploadPetPhoto = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { file, pet } = await fileService.uploadPetPhoto(requireUserId(req), req.params.id, {
    file: req.file
  });
  res.status(201).json({ file, pet: serializePet(pet) });
});

export const downloadFile = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const file = await fileService.downloadFile(requireUserId(req), req.params.id);

  res.status(200);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Length", file.sizeBytes.toString());
  res.setHeader("Content-Disposition", contentDisposition(file.originalName));

  file.body.pipe(res);
});

export const deleteFile = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await fileService.deleteFile(requireUserId(req), req.params.id);
  res.status(204).send();
});
