import {
  confirmEmail,
  confirmPasswordReset,
  login,
  register,
  requestPasswordReset,
  validatePasswordResetToken
} from "../controllers/authController";
import { createDocumentedRouter } from "../docs/route";
import { jsonRequestBody, jsonResponse } from "../docs/routeContent";
import {
  AuthResponseSchema,
  ConfirmEmailRequestSchema,
  ErrorResponseSchema,
  LoginRequestSchema,
  MessageResponseSchema,
  PasswordResetConfirmRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetValidateRequestSchema,
  RegisterRequestSchema
} from "../docs/schemas";

const auth = createDocumentedRouter({ basePath: "/auth", tags: ["Auth"] });

auth.route("post", "/register", {
  operationId: "register",
  summary: "Register a user",
  request: { body: jsonRequestBody(RegisterRequestSchema) },
  responses: { 201: jsonResponse("User registered", AuthResponseSchema) },
  handlers: [register]
});

auth.route("post", "/confirm", {
  operationId: "confirmEmail",
  summary: "Confirm a user's email and issue an access token",
  request: { body: jsonRequestBody(ConfirmEmailRequestSchema) },
  responses: {
    200: jsonResponse("Email confirmed", AuthResponseSchema),
    400: jsonResponse("Invalid or expired confirmation token", ErrorResponseSchema)
  },
  handlers: [confirmEmail]
});

auth.route("post", "/login", {
  operationId: "login",
  summary: "Log in with email and password",
  request: { body: jsonRequestBody(LoginRequestSchema) },
  responses: {
    200: jsonResponse("Login succeeded", AuthResponseSchema),
    401: jsonResponse("Invalid credentials", ErrorResponseSchema)
  },
  handlers: [login]
});

auth.route("post", "/password-reset", {
  operationId: "requestPasswordReset",
  summary: "Request a password reset email",
  request: { body: jsonRequestBody(PasswordResetRequestSchema) },
  responses: { 202: jsonResponse("Password reset request accepted", MessageResponseSchema) },
  handlers: [requestPasswordReset]
});

auth.route("post", "/password-reset/validate", {
  operationId: "validatePasswordResetToken",
  summary: "Check a password reset token and extend its expiry while the user fills the form",
  request: { body: jsonRequestBody(PasswordResetValidateRequestSchema) },
  responses: {
    204: { description: "Reset token is valid" },
    400: jsonResponse("Invalid or expired reset token", ErrorResponseSchema)
  },
  handlers: [validatePasswordResetToken]
});

auth.route("post", "/password-reset/confirm", {
  operationId: "confirmPasswordReset",
  summary: "Confirm password reset with a token and a new password",
  request: { body: jsonRequestBody(PasswordResetConfirmRequestSchema) },
  responses: {
    204: { description: "Password updated" },
    400: jsonResponse("Invalid or expired reset token, or invalid password", ErrorResponseSchema)
  },
  handlers: [confirmPasswordReset]
});

export const authRoutes = auth.router;
