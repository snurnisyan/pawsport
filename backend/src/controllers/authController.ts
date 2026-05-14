import { env } from "../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import * as authService from "../services/authService";

const PASSWORD_RESET_ACCEPTED_MESSAGE =
  "If the email belongs to an account, a password reset link has been sent";

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);

  res.status(201).json(result);
});

export const confirmEmail = asyncHandler(async (req, res) => {
  const status = await authService.confirmEmail(req.query.token);
  const redirectUrl = new URL("/auth/email-confirmed", env.FRONTEND_URL);
  redirectUrl.searchParams.set("status", status);

  res.redirect(302, redirectUrl.toString());
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);

  res.status(200).json(result);
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body ?? {});

  res.status(202).json({ message: PASSWORD_RESET_ACCEPTED_MESSAGE });
});

export const validatePasswordResetToken = asyncHandler(async (req, res) => {
  await authService.validatePasswordResetToken(req.body ?? {});

  res.status(204).send();
});

export const confirmPasswordReset = asyncHandler(async (req, res) => {
  await authService.confirmPasswordReset(req.body ?? {});

  res.status(204).send();
});
