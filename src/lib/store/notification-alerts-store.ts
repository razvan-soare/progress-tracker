import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Settings for notification alerts (streak alerts and weekly summaries)
 */
export interface NotificationAlertsSettings {
  /** Whether streak alerts are enabled (default: true) */
  streakAlertsEnabled: boolean;
  /** Whether weekly summary notifications are enabled (default: true) */
  weeklySummaryEnabled: boolean;
  /** Time of day for weekly summary in HH:MM format (default: "18:00") */
  weeklySummaryTime: string;
  /** Last time streak alerts were checked */
  lastStreakCheckAt: string | null;
  /** Last time weekly summary was sent */
  lastWeeklySummaryAt: string | null;
  /** IDs of projects that have pending streak alerts (to avoid duplicates) */
  pendingStreakAlertProjectIds: string[];
}

interface NotificationAlertsState extends NotificationAlertsSettings {
  /** Toggle streak alerts */
  setStreakAlertsEnabled: (enabled: boolean) => void;
  /** Toggle weekly summary */
  setWeeklySummaryEnabled: (enabled: boolean) => void;
  /** Set weekly summary time */
  setWeeklySummaryTime: (time: string) => void;
  /** Update last streak check timestamp */
  setLastStreakCheckAt: (timestamp: string) => void;
  /** Update last weekly summary timestamp */
  setLastWeeklySummaryAt: (timestamp: string) => void;
  /** Add a project ID to pending streak alerts */
  addPendingStreakAlert: (projectId: string) => void;
  /** Remove a project ID from pending streak alerts */
  removePendingStreakAlert: (projectId: string) => void;
  /** Clear all pending streak alerts */
  clearPendingStreakAlerts: () => void;
  /** Reset all settings to defaults */
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: NotificationAlertsSettings = {
  streakAlertsEnabled: true,
  weeklySummaryEnabled: true,
  weeklySummaryTime: "18:00",
  lastStreakCheckAt: null,
  lastWeeklySummaryAt: null,
  pendingStreakAlertProjectIds: [],
};

// Custom file-based storage adapter using expo-file-system
const SETTINGS_DIR = `${FileSystem.documentDirectory}settings/`;

async function ensureSettingsDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(SETTINGS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(SETTINGS_DIR, { intermediates: true });
  }
}

const fileStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      await ensureSettingsDir();
      const filePath = `${SETTINGS_DIR}${name}.json`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return null;
      }
      return await FileSystem.readAsStringAsync(filePath);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await ensureSettingsDir();
      const filePath = `${SETTINGS_DIR}${name}.json`;
      await FileSystem.writeAsStringAsync(filePath, value);
    } catch (error) {
      console.warn("Failed to save notification alerts settings:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const filePath = `${SETTINGS_DIR}${name}.json`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch {
      // Ignore errors on removal
    }
  },
};

export const useNotificationAlertsStore = create<NotificationAlertsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setStreakAlertsEnabled: (enabled) =>
        set({ streakAlertsEnabled: enabled }),

      setWeeklySummaryEnabled: (enabled) =>
        set({ weeklySummaryEnabled: enabled }),

      setWeeklySummaryTime: (time) =>
        set({ weeklySummaryTime: time }),

      setLastStreakCheckAt: (timestamp) =>
        set({ lastStreakCheckAt: timestamp }),

      setLastWeeklySummaryAt: (timestamp) =>
        set({ lastWeeklySummaryAt: timestamp }),

      addPendingStreakAlert: (projectId) =>
        set((state) => ({
          pendingStreakAlertProjectIds: state.pendingStreakAlertProjectIds.includes(projectId)
            ? state.pendingStreakAlertProjectIds
            : [...state.pendingStreakAlertProjectIds, projectId],
        })),

      removePendingStreakAlert: (projectId) =>
        set((state) => ({
          pendingStreakAlertProjectIds: state.pendingStreakAlertProjectIds.filter(
            (id) => id !== projectId
          ),
        })),

      clearPendingStreakAlerts: () =>
        set({ pendingStreakAlertProjectIds: [] }),

      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "notification-alerts",
      storage: createJSONStorage(() => fileStorage),
    }
  )
);
