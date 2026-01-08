import { create } from "zustand";

interface AppState {
  isOnline: boolean;
  isSyncing: boolean;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnline: true,
  isSyncing: false,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
}));
