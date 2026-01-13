import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Notification permission status values
 * - undetermined: User has not been asked yet
 * - granted: User granted permission
 * - denied: User denied permission
 * - provisional: iOS-only, temporary permission that delivers quietly
 */
export type NotificationPermissionStatus =
  | "undetermined"
  | "granted"
  | "denied"
  | "provisional";

export interface NotificationPermissionsState {
  /** Current permission status */
  status: NotificationPermissionStatus;
  /** Whether permissions have been checked at least once */
  hasChecked: boolean;
  /** Whether the pre-permission modal has been shown */
  hasShownExplanation: boolean;
  /** Timestamp of last permission check */
  lastCheckedAt: string | null;
  /** Whether the user dismissed the explanation modal without requesting permission */
  userDismissedExplanation: boolean;
}

interface NotificationPermissionsActions {
  /** Update the permission status */
  setStatus: (status: NotificationPermissionStatus) => void;
  /** Mark that permissions have been checked */
  markChecked: () => void;
  /** Mark that the explanation modal has been shown */
  markExplanationShown: () => void;
  /** Mark that user dismissed the explanation without requesting permission */
  setUserDismissedExplanation: (dismissed: boolean) => void;
  /** Reset the explanation shown state (e.g., for testing or re-prompting) */
  resetExplanationState: () => void;
  /** Reset all state to defaults */
  reset: () => void;
}

type NotificationPermissionsStore = NotificationPermissionsState &
  NotificationPermissionsActions;

const DEFAULT_STATE: NotificationPermissionsState = {
  status: "undetermined",
  hasChecked: false,
  hasShownExplanation: false,
  lastCheckedAt: null,
  userDismissedExplanation: false,
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
      console.warn("Failed to save notification permissions state:", error);
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

export const useNotificationPermissionsStore =
  create<NotificationPermissionsStore>()(
    persist(
      (set) => ({
        ...DEFAULT_STATE,

        setStatus: (status) =>
          set({
            status,
            lastCheckedAt: new Date().toISOString(),
          }),

        markChecked: () =>
          set({
            hasChecked: true,
            lastCheckedAt: new Date().toISOString(),
          }),

        markExplanationShown: () =>
          set({
            hasShownExplanation: true,
          }),

        setUserDismissedExplanation: (dismissed) =>
          set({
            userDismissedExplanation: dismissed,
          }),

        resetExplanationState: () =>
          set({
            hasShownExplanation: false,
            userDismissedExplanation: false,
          }),

        reset: () => set(DEFAULT_STATE),
      }),
      {
        name: "notification-permissions",
        storage: createJSONStorage(() => fileStorage),
        // Only persist specific fields, not actions
        partialize: (state) => ({
          status: state.status,
          hasChecked: state.hasChecked,
          hasShownExplanation: state.hasShownExplanation,
          lastCheckedAt: state.lastCheckedAt,
          userDismissedExplanation: state.userDismissedExplanation,
        }),
      }
    )
  );
