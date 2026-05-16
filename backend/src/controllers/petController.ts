import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import * as fileService from "../services/fileService";
import * as petService from "../services/petService";
import { serializePetForApi, serializePetsForApi } from "./petResponse";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

export interface ListPetsHandlerDependencies {
  listPets?: typeof petService.listPets;
  resolvePetPhotoUrl?: typeof fileService.resolvePetPhotoUrl;
}

export const listPetsHandler = (dependencies: ListPetsHandlerDependencies = {}) => {
  const {
    listPets: listPetsFn = petService.listPets,
    resolvePetPhotoUrl = fileService.resolvePetPhotoUrl
  } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req);
    const items = await listPetsFn(userId);
    res.status(200).json({ items: await serializePetsForApi(userId, items, resolvePetPhotoUrl) });
  });
};

export const listPets = listPetsHandler();

export const parsePetFieldsFromMultipart = (raw: unknown): Record<string, unknown> => {
  if (raw === undefined || raw === null || raw === "") {
    return {};
  }
  if (typeof raw !== "string") {
    throw new AppError(400, "INVALID_PET_PAYLOAD", "pet field must be a JSON string");
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new AppError(400, "INVALID_PET_PAYLOAD", "pet field must encode a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "INVALID_PET_PAYLOAD", "pet field is not valid JSON");
  }
};

export interface CreatePetHandlerDependencies {
  createPet?: typeof petService.createPet;
  deletePet?: typeof petService.deletePet;
  resolvePetPhotoUrl?: typeof fileService.resolvePetPhotoUrl;
  serializePet?: typeof petService.serializePet;
  uploadPetPhoto?: typeof fileService.uploadPetPhoto;
}

export const createPetHandler = (dependencies: CreatePetHandlerDependencies = {}) => {
  const {
    createPet = petService.createPet,
    deletePet = petService.deletePet,
    resolvePetPhotoUrl = fileService.resolvePetPhotoUrl,
    serializePet = petService.serializePet,
    uploadPetPhoto = fileService.uploadPetPhoto
  } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req);
    const photoFile = req.file;
    const petInput = photoFile
      ? parsePetFieldsFromMultipart((req.body as Record<string, unknown> | undefined)?.pet)
      : (req.body ?? {});

    if (photoFile && petInput.photoFileId !== undefined && petInput.photoFileId !== null) {
      throw new AppError(
        400,
        "PHOTO_FILE_ID_CONFLICT",
        "Pass either photoFileId or an inline photo file, not both"
      );
    }

    const pet = await createPet(userId, petInput);

    if (!photoFile) {
      res.status(201).json({ pet: await serializePetForApi(userId, pet, resolvePetPhotoUrl) });
      return;
    }

    try {
      const { pet: petWithPhoto } = await uploadPetPhoto(userId, pet.id, {
        file: photoFile
      });
      const serializedPet = serializePet(petWithPhoto);
      res.status(201).json({
        pet: await serializePetForApi(userId, serializedPet, resolvePetPhotoUrl)
      });
    } catch (error) {
      try {
        await deletePet(userId, pet.id);
      } catch {
        // Best effort: surface the original upload failure to the caller.
      }
      throw error;
    }
  });
};

export const createPet = createPetHandler();

export interface GetPetHandlerDependencies {
  getPet?: typeof petService.getPet;
  resolvePetPhotoUrl?: typeof fileService.resolvePetPhotoUrl;
}

export const getPetHandler = (dependencies: GetPetHandlerDependencies = {}) => {
  const {
    getPet: getPetFn = petService.getPet,
    resolvePetPhotoUrl = fileService.resolvePetPhotoUrl
  } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req);
    const pet = await getPetFn(userId, req.params.id);

    res.status(200).json({
      pet: await serializePetForApi(userId, pet, resolvePetPhotoUrl)
    });
  });
};

export const getPet = getPetHandler();

export interface UpdatePetHandlerDependencies {
  updatePet?: typeof petService.updatePet;
  resolvePetPhotoUrl?: typeof fileService.resolvePetPhotoUrl;
}

export const updatePetHandler = (dependencies: UpdatePetHandlerDependencies = {}) => {
  const {
    updatePet: updatePetFn = petService.updatePet,
    resolvePetPhotoUrl = fileService.resolvePetPhotoUrl
  } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req);
    const pet = await updatePetFn(userId, req.params.id, req.body ?? {});
    res.status(200).json({ pet: await serializePetForApi(userId, pet, resolvePetPhotoUrl) });
  });
};

export const updatePet = updatePetHandler();

export const deletePet = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await petService.deletePet(requireUserId(req), req.params.id);
  res.status(204).send();
});
