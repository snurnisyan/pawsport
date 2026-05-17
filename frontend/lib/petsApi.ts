import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapApiResponse } from "@/lib/api";
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

export const petsQueryKey = ["pets"] as const;
export const petQueryKey = (id: string) => ["pets", id] as const;

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

export const usePetsQuery = () => {
  const session = useAuthSession();

  return useQuery({
    queryKey: petsQueryKey,
    queryFn: listPets,
    enabled: Boolean(session?.accessToken),
  });
};
