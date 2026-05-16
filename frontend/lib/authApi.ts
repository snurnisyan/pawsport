import { apiClient, unwrapApiResponse } from "@/lib/api";
import type { components } from "@/types/api";

export type TAuthResponse = components["schemas"]["AuthResponse"];
export type TRegisterRequest = components["schemas"]["RegisterRequest"];
export type TLoginRequest = components["schemas"]["LoginRequest"];

export const registerUser = (body: TRegisterRequest): Promise<TAuthResponse> =>
  unwrapApiResponse(apiClient.POST("/auth/register", { body }));

export const loginUser = (body: TLoginRequest): Promise<TAuthResponse> =>
  unwrapApiResponse(apiClient.POST("/auth/login", { body }));

export const confirmEmail = (token: string): Promise<TAuthResponse> =>
  unwrapApiResponse(apiClient.POST("/auth/confirm", { body: { token } }));
