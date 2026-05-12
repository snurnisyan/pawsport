import { getCalendar } from "../controllers/calendarController";
import { createDocumentedRouter } from "../docs/route";
import { jsonResponse } from "../docs/routeContent";
import { CalendarQuerySchema, CalendarResponseSchema } from "../docs/schemas";

const calendar = createDocumentedRouter({ basePath: "/calendar", tags: ["Calendar"], auth: true });

calendar.route("get", "/", {
  operationId: "getCalendar",
  summary: "Get events and reminders for a date range",
  request: { query: CalendarQuerySchema },
  responses: { 200: jsonResponse("Calendar data", CalendarResponseSchema) },
  handlers: [getCalendar]
});

export const calendarRoutes = calendar.router;
