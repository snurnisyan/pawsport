import * as fileService from "../services/fileService";
import type { SerializedPet } from "../services/petService";

// Pet photos are not sensitive (just pictures), so use the AWS SigV4 maximum
// to maximise browser cache reuse and minimise re-signing overhead.
export const PET_PHOTO_URL_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

export type PetResponse = Omit<SerializedPet, "photoFileId"> & {
  photoUrl?: string;
};

export const serializePetForApi = async (
  ownerId: string,
  pet: SerializedPet,
  resolvePetPhotoUrl: typeof fileService.resolvePetPhotoUrl = fileService.resolvePetPhotoUrl
): Promise<PetResponse> => {
  const { photoFileId, ...rest } = pet;
  if (!photoFileId) {
    return rest;
  }

  const photoUrl = await resolvePetPhotoUrl(ownerId, photoFileId, PET_PHOTO_URL_EXPIRES_SECONDS);
  return photoUrl ? { ...rest, photoUrl } : rest;
};

export const serializePetsForApi = async (
  ownerId: string,
  pets: SerializedPet[],
  resolvePetPhotoUrl: typeof fileService.resolvePetPhotoUrl = fileService.resolvePetPhotoUrl
): Promise<PetResponse[]> => Promise.all(pets.map((pet) => serializePetForApi(ownerId, pet, resolvePetPhotoUrl)));
