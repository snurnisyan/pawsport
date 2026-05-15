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

export const createPetExport = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const petExport = await exportService.createPetExport(requireUserId(req), req.params.id, {
    period: req.body?.period,
    sections: req.body?.sections,
    notificationEmail: req.body?.notificationEmail ?? req.user?.email
  });
  res.status(202).json({ export: petExport });
});
