import { useQuery } from "@tanstack/react-query";
import {
  apiClient,
  authenticatedFetch,
  normalizeApiError,
  unwrapApiResponse,
  unwrapVoidApiResponse,
} from "@/lib/api";
import { useAuthSession } from "@/lib/session";
import type { components } from "@/types/api";

export type TPetDetail = components["schemas"]["PetDetail"];
export type TCreatePetRequest = components["schemas"]["CreatePetRequest"];
export type TUpdatePetRequest = Omit<
  components["schemas"]["UpdatePetRequest"],
  "breed" | "birthDate" | "weight" | "microchipNumber" | "vetContact"
> & {
  breed?: string | null;
  birthDate?: string | null;
  weight?: number | null;
  microchipNumber?: string | null;
  vetContact?: components["schemas"]["VetContact"] | null;
};
export type TPetListResponse = components["schemas"]["PetListResponse"];
export type TPetResponse = components["schemas"]["PetResponse"];
export type TPetFile = components["schemas"]["File"];
export type TPetFileListResponse = components["schemas"]["FileListResponse"];
export type TPetFileResponse = components["schemas"]["FileResponse"];
export type TPetFilesQuery = {
  from?: string;
  to?: string;
};
export type TUploadPetFileOptions = {
  eventId?: string;
};

export const petsQueryKey = ["pets"] as const;
export const petQueryKey = (id: string) => ["pets", id] as const;
export const petFilesQueryKey = (petId: string, filters?: TPetFilesQuery) =>
  ["pets", petId, "files", filters ?? {}] as const;
export const petEventsQueryKey = (petId: string) => ["pets", petId, "events"] as const;

export const listPets = (): Promise<TPetListResponse> =>
  unwrapApiResponse(apiClient.GET("/pets"));

export const getPet = (id: string): Promise<TPetResponse> =>
  unwrapApiResponse(apiClient.GET("/pets/{id}", { params: { path: { id } } }));

export const createPet = (body: TCreatePetRequest): Promise<TPetResponse> =>
  unwrapApiResponse(
    apiClient.POST("/pets", {
      body,
      headers: { "Content-Type": "application/json" },
    })
  );

export const updatePet = (
  id: string,
  body: TUpdatePetRequest
): Promise<TPetResponse> =>
  unwrapApiResponse(
    apiClient.PATCH("/pets/{id}", {
      params: { path: { id } },
      body: body as components["schemas"]["UpdatePetRequest"],
      headers: { "Content-Type": "application/json" },
    })
  );

export const listPetFiles = (
  petId: string,
  query?: TPetFilesQuery
): Promise<TPetFileListResponse> =>
  unwrapApiResponse(
    apiClient.GET("/pets/{id}/files", {
      params: { path: { id: petId }, query },
    })
  );

export const uploadPetFile = async (
  petId: string,
  file: File,
  options?: TUploadPetFileOptions
): Promise<TPetFileResponse> => {
  const body = new FormData();
  body.append("file", file);
  if (options?.eventId) body.append("eventId", options.eventId);

  const response = await authenticatedFetch(`/pets/${petId}/files`, {
    method: "POST",
    body,
  });

  const payload = (await response.json().catch(() => undefined)) as unknown;

  if (!response.ok) {
    throw normalizeApiError(payload, response);
  }

  return payload as TPetFileResponse;
};

export const downloadFile = async (
  fileId: string
): Promise<{ blob: Blob; filename?: string }> => {
  const response = await authenticatedFetch(`/files/${fileId}/download`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as unknown;
    throw normalizeApiError(payload, response);
  }

  return {
    blob: await response.blob(),
    filename: extractContentDispositionFilename(
      response.headers.get("Content-Disposition")
    ),
  };
};

export const deleteFile = (fileId: string): Promise<void> =>
  unwrapVoidApiResponse(
    apiClient.DELETE("/files/{id}", { params: { path: { id: fileId } } })
  );

const extractContentDispositionFilename = (header: string | null): string | undefined => {
  if (!header) return undefined;

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

  const quotedMatch = header.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const plainMatch = header.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim();
};

export const usePetsQuery = () => {
  const session = useAuthSession();

  return useQuery({
    queryKey: petsQueryKey,
    queryFn: listPets,
    enabled: Boolean(session?.accessToken),
  });
};
