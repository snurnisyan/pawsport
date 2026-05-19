import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { ApiError } from "@/lib/api";
import { getCurrentUser, logoutUser } from "@/lib/authApi";
import { useAuthStore, type TAuthUser } from "@/store/auth";

export type { TAuthUser };

export type TAuthSession = {
  user: TAuthUser;
};

const toAuthUser = (user: {
  id: string;
  email: string;
  emailVerified: boolean;
}): TAuthUser => ({
  id: user.id,
  email: user.email,
  emailVerified: user.emailVerified,
});

export const getAuthSession = (): TAuthSession | null => {
  const { user } = useAuthStore.getState();
  return user ? { user } : null;
};

export const persistAuthSession = (session: TAuthSession): void => {
  useAuthStore.getState().setUser(session.user);
};

export const clearAuthSession = (): void => {
  useAuthStore.getState().setAnonymous();
};

export const useAuthSession = (): TAuthSession | null => {
  const user = useAuthStore((state) => state.user);
  return useMemo(() => (user ? { user } : null), [user]);
};

export const useAuthStatus = () => useAuthStore((state) => state.status);

export const useClientReady = () => {
  const status = useAuthStatus();
  return status !== "loading";
};

export const useRedirectIfAuthenticated = (target = "/pets"): boolean => {
  const router = useRouter();
  const session = useAuthSession();
  const clientReady = useClientReady();
  const shouldRedirect = clientReady && Boolean(session);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace(target);
  }, [router, shouldRedirect, target]);

  return shouldRedirect;
};

export const isInvalidAuthSessionError = (error: unknown): boolean =>
  error instanceof ApiError &&
  (error.status === 401 || error.code === "UNAUTHORIZED" || error.code === "USER_NOT_FOUND");

const clearServerAuthCookie = async (): Promise<void> => {
  try {
    await logoutUser();
  } catch (error) {
    if (!isInvalidAuthSessionError(error)) {
      console.error("Failed to clear auth cookie", error);
    }
  }
};

let bootstrapStarted = false;

export function AuthSessionBootstrap() {
  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;

    getCurrentUser()
      .then(({ user }) => {
        useAuthStore.getState().setUser(toAuthUser(user));
      })
      .catch(async (error) => {
        if (isInvalidAuthSessionError(error)) {
          await clearServerAuthCookie();
        } else {
          console.error("Failed to restore auth session", error);
        }
        useAuthStore.getState().setAnonymous();
      });
  }, []);

  return null;
}
