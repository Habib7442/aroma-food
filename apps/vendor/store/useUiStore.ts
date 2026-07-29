import { create } from "zustand";

interface UiState {
  /** Transient banner shown across screens (e.g. "restaurant record pending setup"). Null hides it. */
  banner: string | null;
  showBanner: (message: string) => void;
  hideBanner: () => void;
  /** Restaurant name typed at sign-up, handed off to no-org.tsx's create-org form for pre-fill. */
  pendingRestaurantName: string | null;
  setPendingRestaurantName: (name: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  banner: null,
  showBanner: (message) => set({ banner: message }),
  hideBanner: () => set({ banner: null }),
  pendingRestaurantName: null,
  setPendingRestaurantName: (name) => set({ pendingRestaurantName: name }),
}));
