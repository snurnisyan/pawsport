import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import { notImplemented } from "../utils/notImplemented";
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

export const createPet = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const pet = await petService.createPet(requireUserId(req), req.body ?? {});
  res.status(201).json({ pet });
});

export const getPet = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const pet = await petService.getPet(requireUserId(req), req.params.id);
  res.status(200).json({ pet });
});

export const updatePet = notImplemented("pets", "updatePet");
export const deletePet = notImplemented("pets", "deletePet");
