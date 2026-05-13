import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import { notImplemented } from "../utils/notImplemented";
import * as userService from "../services/userService";

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }

  const user = await userService.getCurrentUser(req.user.id);

  res.status(200).json({ user });
});

export const deleteMe = notImplemented("users", "deleteMe");
