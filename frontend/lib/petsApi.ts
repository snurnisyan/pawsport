import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapApiResponse } from "@/lib/api";
import { useAuthSession } from "@/lib/session";
import type { components } from "@/types/api";

export type TPetDetail = components["schemas"]["PetDetail"];
export type TCreatePetRequest = components["schemas"]["CreatePetRequest"];
export type TPetListResponse = components["schemas"]["PetListResponse"];
export type TPetResponse = components["schemas"]["PetResponse"];

export const petsQueryKey = ["pets"] as const;

export const listPets = (): Promise<TPetListResponse> =>
  unwrapApiResponse(apiClient.GET("/pets"));

export const createPet = (body: TCreatePetRequest): Promise<TPetResponse> =>
  unwrapApiResponse(
    apiClient.POST("/pets", {
      body,
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
