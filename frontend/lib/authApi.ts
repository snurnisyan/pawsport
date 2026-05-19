import {
  apiClient,
  authenticatedFetch,
  normalizeApiError,
  unwrapApiResponse,
  unwrapVoidApiResponse,
} from "@/lib/api";
import type { components } from "@/types/api";

export type TAuthResponse = components["schemas"]["AuthResponse"];
export type TUserResponse = components["schemas"]["UserResponse"];
export type TRegisterRequest = components["schemas"]["RegisterRequest"];
export type TLoginRequest = components["schemas"]["LoginRequest"];
export type TMessageResponse = components["schemas"]["MessageResponse"];
export type TPasswordResetRequest = components["schemas"]["PasswordResetRequest"];
export type TPasswordResetConfirmRequest =
  components["schemas"]["PasswordResetConfirmRequest"];

export const registerUser = (body: TRegisterRequest): Promise<TAuthResponse> =>
  unwrapApiResponse(apiClient.POST("/auth/register", { body }));

export const loginUser = (body: TLoginRequest): Promise<TAuthResponse> =>
  unwrapApiResponse(apiClient.POST("/auth/login", { body }));

export const confirmEmail = (token: string): Promise<TAuthResponse> =>
  unwrapApiResponse(apiClient.POST("/auth/confirm", { body: { token } }));

export const getCurrentUser = (): Promise<TUserResponse> =>
  unwrapApiResponse(apiClient.GET("/users/me"));

export const logoutUser = async (): Promise<void> => {
  const response = await authenticatedFetch("/auth/logout", { method: "POST" });
  if (!response.ok) {
    let error: unknown;
    try {
      error = await response.json();
    } catch {
      error = new Error(response.statusText);
    }
    throw normalizeApiError(error, response);
  }
};

export const resendEmailConfirmation = (): Promise<TMessageResponse> =>
  unwrapApiResponse(apiClient.POST("/auth/resend", {}));

export const requestPasswordReset = (
  body: TPasswordResetRequest
): Promise<TMessageResponse> =>
  unwrapApiResponse(apiClient.POST("/auth/password-reset", { body }));

export const validatePasswordResetToken = (token: string): Promise<void> =>
  unwrapVoidApiResponse(
    apiClient.POST("/auth/password-reset/validate", { body: { token } })
  );

export const confirmPasswordReset = (
  body: TPasswordResetConfirmRequest
): Promise<void> =>
  unwrapVoidApiResponse(apiClient.POST("/auth/password-reset/confirm", { body }));
