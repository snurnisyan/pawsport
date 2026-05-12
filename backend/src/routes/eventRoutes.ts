import { createPetEvent, deleteEvent, getEvent, listPetEvents, updateEvent } from "../controllers/eventController";
import { createDocumentedRouter } from "../docs/route";
import { jsonRequestBody, jsonResponse } from "../docs/routeContent";
import {
  CreateEventRequestSchema,
  EventListResponseSchema,
  EventResponseSchema,
  IdPathParamsSchema,
  UpdateEventRequestSchema
} from "../docs/schemas";

const petEvents = createDocumentedRouter({
  basePath: "/pets/:id/events",
  tags: ["Events"],
  auth: true,
  mergeParams: true
});

petEvents.route("get", "/", {
  operationId: "listPetEvents",
  summary: "List events for a pet",
  request: { params: IdPathParamsSchema },
  responses: { 200: jsonResponse("Event list", EventListResponseSchema) },
  handlers: [listPetEvents]
});

petEvents.route("post", "/", {
  operationId: "createPetEvent",
  summary: "Create an event for a pet",
  request: { params: IdPathParamsSchema, body: jsonRequestBody(CreateEventRequestSchema) },
  responses: { 201: jsonResponse("Event created", EventResponseSchema) },
  handlers: [createPetEvent]
});

const events = createDocumentedRouter({ basePath: "/events", tags: ["Events"], auth: true });

events.route("get", "/:id", {
  operationId: "getEvent",
  summary: "Get an event",
  request: { params: IdPathParamsSchema },
  responses: { 200: jsonResponse("Event", EventResponseSchema) },
  handlers: [getEvent]
});

events.route("patch", "/:id", {
  operationId: "updateEvent",
  summary: "Update an event",
  request: { params: IdPathParamsSchema, body: jsonRequestBody(UpdateEventRequestSchema) },
  responses: { 200: jsonResponse("Event updated", EventResponseSchema) },
  handlers: [updateEvent]
});

events.route("delete", "/:id", {
  operationId: "deleteEvent",
  summary: "Delete an event",
  request: { params: IdPathParamsSchema },
  responses: { 204: { description: "Event deleted" } },
  handlers: [deleteEvent]
});

export const petEventRoutes = petEvents.router;
export const eventRoutes = events.router;
