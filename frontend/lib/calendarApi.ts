import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient, unwrapApiResponse } from "@/lib/api";
import { useAuthSession } from "@/lib/session";
import type { components, paths } from "@/types/api";

export type TCalendarResponse = components["schemas"]["CalendarResponse"];
export type TCalendarQuery = NonNullable<
  paths["/calendar"]["get"]["parameters"]["query"]
>;

export const calendarQueryKey = (query: TCalendarQuery) =>
  ["calendar", query] as const;

export const listCalendarEvents = (
  query: TCalendarQuery
): Promise<TCalendarResponse> =>
  unwrapApiResponse(apiClient.GET("/calendar", { params: { query } }));

export const useCalendarEventsQuery = (
  query: TCalendarQuery,
  enabled = true
) => {
  const session = useAuthSession();

  return useQuery({
    queryKey: calendarQueryKey(query),
    queryFn: () => listCalendarEvents(query),
    enabled: enabled && Boolean(session),
    placeholderData: keepPreviousData,
  });
};
