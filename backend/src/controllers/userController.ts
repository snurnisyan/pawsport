import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import * as userService from "../services/userService";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = await userService.getCurrentUser(requireUserId(req));
  res.status(200).json({ user });
});

export const deleteMe = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await userService.deleteCurrentUser(requireUserId(req));
  res.status(204).send();
});
