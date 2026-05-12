import { confirmEmail, login, register, requestPasswordReset } from "../controllers/authController";
import { createDocumentedRouter } from "../docs/route";
import { jsonRequestBody, jsonResponse } from "../docs/routeContent";
import {
  AuthResponseSchema,
  ConfirmEmailQuerySchema,
  ErrorResponseSchema,
  LoginRequestSchema,
  MessageResponseSchema,
  PasswordResetRequestSchema,
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

auth.route("get", "/confirm", {
  operationId: "confirmEmail",
  summary: "Confirm a user's email",
  request: { query: ConfirmEmailQuerySchema },
  responses: {
    302: {
      description: "Email confirmation processed; redirects to the frontend confirmation page",
      headers: {
        Location: {
          schema: { type: "string", format: "uri" },
          description: "Frontend confirmation page URL"
        }
      }
    }
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

export const authRoutes = auth.router;
