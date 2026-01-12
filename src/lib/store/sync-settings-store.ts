import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import * as FileSystem from "expo-file-system/legacy";

export interface SyncSettings {
  /** Whether to allow sync over cellular data (default: false, wifi-only) */
  syncOnCellular: boolean;
  /** Timestamp of the last successful sync */
  lastSuccessfulSync: string | null;
  /** Timestamp of the last sync attempt */
  lastSyncAttempt: string | null;
}

interface SyncSettingsState extends SyncSettings {
  /** Toggle cellular sync setting */
  setSyncOnCellular: (enabled: boolean) => void;
  /** Update the last successful sync timestamp */
  setLastSuccessfulSync: (timestamp: string) => void;
  /** Update the last sync attempt timestamp */
  setLastSyncAttempt: (timestamp: string) => void;
  /** Reset all settings to defaults */
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: SyncSettings = {
  syncOnCellular: false,
  lastSuccessfulSync: null,
  lastSyncAttempt: null,
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
      console.warn("Failed to save sync settings:", error);
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

export const useSyncSettingsStore = create<SyncSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setSyncOnCellular: (enabled) => set({ syncOnCellular: enabled }),
      setLastSuccessfulSync: (timestamp) => set({ lastSuccessfulSync: timestamp }),
      setLastSyncAttempt: (timestamp) => set({ lastSyncAttempt: timestamp }),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "sync-settings",
      storage: createJSONStorage(() => fileStorage),
    }
  )
);
