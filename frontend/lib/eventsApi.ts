import { useQuery } from "@tanstack/react-query";
import {
  apiClient,
  unwrapApiResponse,
  unwrapVoidApiResponse,
} from "@/lib/api";
import {
  deleteFile,
  petEventsQueryKey,
  listPetEvents,
  uploadPetFile,
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

const cleanupUploadedFiles = async (fileIds: string[]): Promise<void> => {
  await Promise.allSettled(fileIds.map((id) => deleteFile(id)));
};

const uploadTemporaryEventFiles = async (
  petId: string,
  files: File[]
): Promise<string[]> => {
  const uploadedIds: string[] = [];
  for (const file of files) {
    try {
      const result = await uploadPetFile(petId, file, {
        temporaryForEvent: true,
      });
      uploadedIds.push(result.file.id);
    } catch (error) {
      await cleanupUploadedFiles(uploadedIds);
      throw error;
    }
  }
  return uploadedIds;
};

export const createPetEvent = async (
  petId: string,
  body: TCreateEventRequest,
  files: File[] = []
): Promise<TPetEventResponse> => {
  const uploadedIds = await uploadTemporaryEventFiles(petId, files);

  try {
    return await unwrapApiResponse(
      apiClient.POST("/pets/{id}/events", {
        params: { path: { id: petId } },
        body: { ...body, fileIds: [...(body.fileIds ?? []), ...uploadedIds] },
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (error) {
    await cleanupUploadedFiles(uploadedIds);
    throw error;
  }
};

export type TUpdateEventOptions = {
  petId?: string;
  files?: File[];
  existingFileIds?: string[];
};

export const updateEvent = async (
  id: string,
  body: TUpdateEventRequest,
  options: TUpdateEventOptions = {}
): Promise<TPetEventResponse> => {
  const { petId, files = [], existingFileIds } = options;

  if (files.length === 0 || !petId) {
    return unwrapApiResponse(
      apiClient.PATCH("/events/{id}", {
        params: { path: { id } },
        body,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  const uploadedIds = await uploadTemporaryEventFiles(petId, files);

  try {
    return await unwrapApiResponse(
      apiClient.PATCH("/events/{id}", {
        params: { path: { id } },
        body: {
          ...body,
          fileIds: [...(existingFileIds ?? []), ...uploadedIds],
        },
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (error) {
    await cleanupUploadedFiles(uploadedIds);
    throw error;
  }
};

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
