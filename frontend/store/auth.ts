import { create } from "zustand";
import type { components } from "@/types/api";

export type TAuthUser = components["schemas"]["AuthUser"];
export type TAuthStatus = "loading" | "authenticated" | "anonymous";

type TAuthState = {
  user: TAuthUser | null;
  status: TAuthStatus;
  setUser: (user: TAuthUser) => void;
  setAnonymous: () => void;
};

export const useAuthStore = create<TAuthState>((set) => ({
  user: null,
  status: "loading",
  setUser: (user) => set({ user, status: "authenticated" }),
  setAnonymous: () => set({ user: null, status: "anonymous" }),
}));
