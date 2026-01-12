import { create } from "zustand";
import type { SortOrder } from "./entries-store";

interface AppState {
  isOnline: boolean;
  isSyncing: boolean;
  // Per-project sort preferences (persists during session)
  projectSortPreferences: Record<string, SortOrder>;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  // Sort preference actions
  getProjectSortOrder: (projectId: string) => SortOrder;
  setProjectSortOrder: (projectId: string, sortOrder: SortOrder) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  projectSortPreferences: {},
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  getProjectSortOrder: (projectId: string) => {
    return get().projectSortPreferences[projectId] ?? "desc";
  },
  setProjectSortOrder: (projectId: string, sortOrder: SortOrder) => {
    set((state) => ({
      projectSortPreferences: {
        ...state.projectSortPreferences,
        [projectId]: sortOrder,
      },
    }));
  },
}));
