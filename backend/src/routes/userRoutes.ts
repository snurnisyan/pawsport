import { deleteMe, getMe } from "../controllers/userController";
import { createDocumentedRouter } from "../docs/route";
import { jsonResponse } from "../docs/routeContent";
import { UserResponseSchema } from "../docs/schemas";

const users = createDocumentedRouter({ basePath: "/users", tags: ["Users"], auth: true });

users.route("get", "/me", {
  operationId: "getMe",
  summary: "Get the authenticated user profile",
  responses: { 200: jsonResponse("Current user", UserResponseSchema) },
  handlers: [getMe]
});

users.route("delete", "/me/delete", {
  operationId: "deleteMe",
  summary: "Delete the authenticated user account",
  responses: { 204: { description: "User deleted" } },
  handlers: [deleteMe]
});

export const userRoutes = users.router;
