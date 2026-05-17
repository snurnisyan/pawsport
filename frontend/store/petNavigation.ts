import { create } from "zustand";

export type TPetPageTab = "overview" | "events" | "files" | "export";

type TPetNavigationState = {
  petTabs: Record<string, TPetPageTab>;
  setPetTab: (petId: string, tab: TPetPageTab) => void;
};

export const usePetNavigationStore = create<TPetNavigationState>((set) => ({
  petTabs: {},
  setPetTab: (petId, tab) =>
    set((state) => ({
      petTabs: {
        ...state.petTabs,
        [petId]: tab,
      },
    })),
}));
