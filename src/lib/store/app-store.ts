import { create } from "zustand";
import type { SortOrder } from "./entries-store";

interface ScrollPosition {
  offset: number;
  timestamp: number;
}

interface AppState {
  isOnline: boolean;
  isSyncing: boolean;
  // Per-project sort preferences (persists during session)
  projectSortPreferences: Record<string, SortOrder>;
  // Per-screen scroll position preservation (persists during session)
  scrollPositions: Record<string, ScrollPosition>;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  // Sort preference actions
  getProjectSortOrder: (projectId: string) => SortOrder;
  setProjectSortOrder: (projectId: string, sortOrder: SortOrder) => void;
  // Scroll position actions
  getScrollPosition: (screenKey: string) => number;
  setScrollPosition: (screenKey: string, offset: number) => void;
  clearScrollPosition: (screenKey: string) => void;
}

// Max age for scroll positions (5 minutes)
const SCROLL_POSITION_MAX_AGE = 5 * 60 * 1000;

export const useAppStore = create<AppState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  projectSortPreferences: {},
  scrollPositions: {},
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
  getScrollPosition: (screenKey: string) => {
    const position = get().scrollPositions[screenKey];
    if (!position) return 0;
    // Return 0 if position is stale
    if (Date.now() - position.timestamp > SCROLL_POSITION_MAX_AGE) return 0;
    return position.offset;
  },
  setScrollPosition: (screenKey: string, offset: number) => {
    set((state) => ({
      scrollPositions: {
        ...state.scrollPositions,
        [screenKey]: { offset, timestamp: Date.now() },
      },
    }));
  },
  clearScrollPosition: (screenKey: string) => {
    set((state) => {
      const newScrollPositions = { ...state.scrollPositions };
      delete newScrollPositions[screenKey];
      return { scrollPositions: newScrollPositions };
    });
  },
}));
