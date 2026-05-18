import { asyncHandler } from "../utils/asyncHandler";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppError } from "../middleware/errorHandler";
import * as authService from "../services/authService";

const PASSWORD_RESET_ACCEPTED_MESSAGE =
  "If the email belongs to an account, a password reset link has been sent";
const EMAIL_CONFIRMATION_RESEND_ACCEPTED_MESSAGE =
  "If the email belongs to an unverified account, a confirmation link has been sent";

const requireUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return req.user.id;
};

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);

  res.status(201).json(result);
});

export interface ConfirmEmailHandlerDependencies {
  confirmEmail?: typeof authService.confirmEmail;
}

export const confirmEmailHandler = (dependencies: ConfirmEmailHandlerDependencies = {}) => {
  const { confirmEmail: confirmEmailFn = authService.confirmEmail } = dependencies;

  return asyncHandler(async (req, res) => {
    const result = await confirmEmailFn(req.body ?? {});

    res.status(200).json(result);
  });
};

export const confirmEmail = confirmEmailHandler();

export interface ResendConfirmationEmailHandlerDependencies {
  resendConfirmationEmail?: typeof authService.resendConfirmationEmail;
}

export const resendConfirmationEmailHandler = (
  dependencies: ResendConfirmationEmailHandlerDependencies = {}
) => {
  const {
    resendConfirmationEmail: resendConfirmationEmailFn = authService.resendConfirmationEmail
  } = dependencies;

  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    await resendConfirmationEmailFn(requireUserId(req));

    res.status(202).json({ message: EMAIL_CONFIRMATION_RESEND_ACCEPTED_MESSAGE });
  });
};

export const resendConfirmationEmail = resendConfirmationEmailHandler();

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
