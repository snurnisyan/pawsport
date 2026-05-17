import {
  createReminder,
  deleteReminder,
  listReminders,
  markRemindersRead,
  updateReminder
} from "../controllers/reminderController";
import { createDocumentedRouter } from "../docs/route";
import { jsonRequestBody, jsonResponse } from "../docs/routeContent";
import {
  CreateReminderRequestSchema,
  IdPathParamsSchema,
  MarkRemindersReadRequestSchema,
  MarkRemindersReadResponseSchema,
  ReminderListQuerySchema,
  ReminderListResponseSchema,
  ReminderResponseSchema,
  UpdateReminderRequestSchema
} from "../docs/schemas";

const reminders = createDocumentedRouter({ basePath: "/reminders", tags: ["Reminders"], auth: true });

reminders.route("get", "/", {
  operationId: "listReminders",
  summary: "List reminders",
  request: { query: ReminderListQuerySchema },
  responses: { 200: jsonResponse("Reminder list", ReminderListResponseSchema) },
  handlers: [listReminders]
});

reminders.route("post", "/", {
  operationId: "createReminder",
  summary: "Create a reminder",
  request: { body: jsonRequestBody(CreateReminderRequestSchema) },
  responses: { 201: jsonResponse("Reminder created", ReminderResponseSchema) },
  handlers: [createReminder]
});

reminders.route("post", "/read", {
  operationId: "markRemindersRead",
  summary: "Mark reminders as read",
  request: { body: jsonRequestBody(MarkRemindersReadRequestSchema) },
  responses: { 200: jsonResponse("Reminders marked as read", MarkRemindersReadResponseSchema) },
  handlers: [markRemindersRead]
});

reminders.route("patch", "/:id", {
  operationId: "updateReminder",
  summary: "Update a reminder",
  request: { params: IdPathParamsSchema, body: jsonRequestBody(UpdateReminderRequestSchema) },
  responses: { 200: jsonResponse("Reminder updated", ReminderResponseSchema) },
  handlers: [updateReminder]
});

reminders.route("delete", "/:id", {
  operationId: "deleteReminder",
  summary: "Delete a reminder",
  request: { params: IdPathParamsSchema },
  responses: { 204: { description: "Reminder deleted" } },
  handlers: [deleteReminder]
});

export const reminderRoutes = reminders.router;
