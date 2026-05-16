import { useSyncExternalStore } from "react";
import type { components } from "@/types/api";

export type TAuthUser = components["schemas"]["AuthUser"];

export type TAuthSession = {
  accessToken: string;
  user: TAuthUser;
};

const STORAGE_KEY = "pawsport.auth.v1";
const SESSION_EVENT = "pawsport:auth-session";

const isBrowser = () => typeof window !== "undefined";

let cachedRawSession: string | null | undefined;
let cachedSession: TAuthSession | null = null;

const readSession = (): TAuthSession | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRawSession) return cachedSession;

    cachedRawSession = raw;
    if (!raw) {
      cachedSession = null;
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<TAuthSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      !parsed.accessToken ||
      !parsed.user ||
      typeof parsed.user.id !== "string" ||
      typeof parsed.user.email !== "string" ||
      typeof parsed.user.emailVerified !== "boolean"
    ) {
      cachedSession = null;
      return null;
    }

    cachedSession = { accessToken: parsed.accessToken, user: parsed.user };
    return cachedSession;
  } catch {
    cachedSession = null;
    return null;
  }
};

const emitSessionChange = () => {
  if (isBrowser()) {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
};

export const getAuthSession = (): TAuthSession | null => readSession();

export const getAccessToken = (): string | null => readSession()?.accessToken ?? null;

export const persistAuthSession = (session: TAuthSession): void => {
  if (!isBrowser()) return;

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: session.accessToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
      },
    })
  );
  emitSessionChange();
};

export const clearAuthSession = (): void => {
  if (!isBrowser()) return;

  window.localStorage.removeItem(STORAGE_KEY);
  cachedRawSession = null;
  cachedSession = null;
  emitSessionChange();
};

const subscribe = (onStoreChange: () => void) => {
  if (!isBrowser()) return () => undefined;

  window.addEventListener(SESSION_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(SESSION_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
};

export const useAuthSession = () => {
  return useSyncExternalStore(subscribe, readSession, () => null);
};

const subscribeClientReady = () => () => undefined;

export const useClientReady = () => {
  return useSyncExternalStore(subscribeClientReady, () => true, () => false);
};
