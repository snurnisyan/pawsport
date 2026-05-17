import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapApiResponse, unwrapVoidApiResponse } from "@/lib/api";
import {
  petEventsQueryKey,
  listPetEvents,
  type TPetEvent,
  type TPetEventListResponse,
  type TPetEventsQuery,
} from "@/lib/petsApi";
import { useAuthSession } from "@/lib/session";
import type { components } from "@/types/api";

export type { TPetEvent, TPetEventListResponse, TPetEventsQuery };
export { petEventsQueryKey, listPetEvents };

export type TPetEventResponse = components["schemas"]["EventResponse"];
export type TCreateEventRequest = components["schemas"]["CreateEventRequest"];
export type TUpdateEventRequest = components["schemas"]["UpdateEventRequest"];

export const eventQueryKey = (id: string) => ["events", id] as const;

export const getEvent = (id: string): Promise<TPetEventResponse> =>
  unwrapApiResponse(apiClient.GET("/events/{id}", { params: { path: { id } } }));

export const createPetEvent = (
  petId: string,
  body: TCreateEventRequest
): Promise<TPetEventResponse> =>
  unwrapApiResponse(
    apiClient.POST("/pets/{id}/events", {
      params: { path: { id: petId } },
      body,
      headers: { "Content-Type": "application/json" },
    })
  );

export const updateEvent = (
  id: string,
  body: TUpdateEventRequest
): Promise<TPetEventResponse> =>
  unwrapApiResponse(
    apiClient.PATCH("/events/{id}", {
      params: { path: { id } },
      body,
      headers: { "Content-Type": "application/json" },
    })
  );

export const deleteEvent = (id: string): Promise<void> =>
  unwrapVoidApiResponse(
    apiClient.DELETE("/events/{id}", { params: { path: { id } } })
  );

export const usePetEventsQuery = (petId?: string, query?: TPetEventsQuery) => {
  const session = useAuthSession();

  return useQuery({
    queryKey: petId
      ? petEventsQueryKey(petId, query)
      : ["pets", "events", "missing"],
    queryFn: () => listPetEvents(petId!, query),
    enabled: Boolean(petId) && Boolean(session?.accessToken),
  });
};
