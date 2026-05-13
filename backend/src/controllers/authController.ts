import { env } from "../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import { notImplemented } from "../utils/notImplemented";
import * as authService from "../services/authService";

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

export const requestPasswordReset = notImplemented("auth", "requestPasswordReset");
