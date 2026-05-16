import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import * as fileService from "../services/fileService";
import * as petService from "../services/petService";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

export const listPets = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const items = await petService.listPets(requireUserId(req));
  res.status(200).json({ items });
});

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
  serializePet?: typeof petService.serializePet;
  uploadPetPhoto?: typeof fileService.uploadPetPhoto;
}

export const createPetHandler = (dependencies: CreatePetHandlerDependencies = {}) => {
  const {
    createPet = petService.createPet,
    deletePet = petService.deletePet,
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
      res.status(201).json({ pet });
      return;
    }

    try {
      const { pet: petWithPhoto } = await uploadPetPhoto(userId, pet.id, {
        file: photoFile
      });
      res.status(201).json({ pet: serializePet(petWithPhoto) });
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

// Pet photos are not sensitive (just pictures) and the same pet detail page is
// the only place that surfaces the URL, so we sign with the AWS SigV4 maximum
// to maximise browser cache reuse and minimise re-signing overhead.
const PET_PHOTO_URL_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

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

    const { photoFileId, ...rest } = pet;
    const photoUrl = photoFileId
      ? await resolvePetPhotoUrl(userId, photoFileId, PET_PHOTO_URL_EXPIRES_SECONDS)
      : null;

    res.status(200).json({
      pet: photoUrl ? { ...rest, photoUrl } : rest
    });
  });
};

export const getPet = getPetHandler();

export const updatePet = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const pet = await petService.updatePet(requireUserId(req), req.params.id, req.body ?? {});
  res.status(200).json({ pet });
});

export const deletePet = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await petService.deletePet(requireUserId(req), req.params.id);
  res.status(204).send();
});
