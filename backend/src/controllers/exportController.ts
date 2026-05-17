import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import * as exportService from "../services/exportService";
import { asyncHandler } from "../utils/asyncHandler";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

export interface CreatePetExportHandlerDependencies {
  createPetExport?: typeof exportService.createPetExport;
}

export const createPetExportHandler = (dependencies: CreatePetExportHandlerDependencies = {}) => {
  const { createPetExport: createPetExportFn = exportService.createPetExport } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    const petExport = await createPetExportFn(requireUserId(req), req.params.id, {
      period: req.body?.period,
      sections: req.body?.sections,
      eventTypes: req.body?.eventTypes,
      sendEmail: req.body?.sendEmail,
      notificationEmail: req.body?.notificationEmail,
      fallbackNotificationEmail: req.user?.email
    });
    res.status(202).json({ export: petExport });
  });
};

export const createPetExport = createPetExportHandler();

export const getPetExport = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const petExport = await exportService.getPetExport(requireUserId(req), req.params.id);
  res.status(200).json({ export: petExport });
});
