import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import * as FileSystem from "expo-file-system/legacy";
import type { NotificationPermissionStatus } from "./notification-permissions-store";

/**
 * Received notification data structure
 */
export interface ReceivedNotification {
  /** Unique identifier for the notification */
  id: string;
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Additional data attached to the notification */
  data: Record<string, unknown>;
  /** When the notification was received */
  receivedAt: string;
  /** Whether the notification was interacted with (tapped) */
  wasInteracted: boolean;
}

/**
 * Scheduled notification reference for a project
 */
export interface ScheduledNotificationRef {
  /** The expo notification identifier */
  notificationId: string;
  /** Scheduled trigger date as ISO string */
  scheduledFor: string;
}

/**
 * Per-project notification tracking data
 */
export interface ProjectNotificationData {
  /** Project ID */
  projectId: string;
  /** List of scheduled notification IDs for this project */
  scheduledNotifications: ScheduledNotificationRef[];
  /** Last time notifications were scheduled for this project */
  lastScheduledAt: string | null;
}

/**
 * Notification store state
 */
export interface NotificationState {
  /** Current permission status (synced from permissions store) */
  permissionStatus: NotificationPermissionStatus;
  /** Whether permissions have been checked at least once */
  hasCheckedPermissions: boolean;
  /** Push token for cloud notifications (future use) */
  pushToken: string | null;
  /** Scheduled notification data by project ID */
  scheduledByProject: Record<string, ProjectNotificationData>;
  /** Recently received notifications (limited history) */
  notificationHistory: ReceivedNotification[];
  /** Maximum number of notifications to keep in history */
  historyLimit: number;
  /** Whether the notification scheduler is running */
  isSchedulerRunning: boolean;
  /** Last error message */
  lastError: string | null;
}

/**
 * Notification store actions
 */
interface NotificationActions {
  /** Update permission status */
  setPermissionStatus: (status: NotificationPermissionStatus) => void;
  /** Mark permissions as checked */
  markPermissionsChecked: () => void;
  /** Set push token */
  setPushToken: (token: string | null) => void;
  /** Add or update scheduled notifications for a project */
  setProjectNotifications: (
    projectId: string,
    notifications: ScheduledNotificationRef[]
  ) => void;
  /** Remove all scheduled notifications for a project */
  clearProjectNotifications: (projectId: string) => void;
  /** Add a received notification to history */
  addToHistory: (notification: Omit<ReceivedNotification, "id" | "receivedAt">) => void;
  /** Mark a notification as interacted */
  markAsInteracted: (notificationId: string) => void;
  /** Clear notification history */
  clearHistory: () => void;
  /** Set scheduler running state */
  setSchedulerRunning: (running: boolean) => void;
  /** Set error */
  setError: (error: string | null) => void;
  /** Clear error */
  clearError: () => void;
  /** Get scheduled notification IDs for a project */
  getProjectNotificationIds: (projectId: string) => string[];
  /** Reset store to default state */
  reset: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

const DEFAULT_STATE: NotificationState = {
  permissionStatus: "undetermined",
  hasCheckedPermissions: false,
  pushToken: null,
  scheduledByProject: {},
  notificationHistory: [],
  historyLimit: 50,
  isSchedulerRunning: false,
  lastError: null,
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
      console.warn("Failed to save notification store state:", error);
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

/**
 * Generate a unique ID for received notifications
 */
function generateNotificationHistoryId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setPermissionStatus: (status) =>
        set({ permissionStatus: status }),

      markPermissionsChecked: () =>
        set({ hasCheckedPermissions: true }),

      setPushToken: (token) =>
        set({ pushToken: token }),

      setProjectNotifications: (projectId, notifications) =>
        set((state) => ({
          scheduledByProject: {
            ...state.scheduledByProject,
            [projectId]: {
              projectId,
              scheduledNotifications: notifications,
              lastScheduledAt: new Date().toISOString(),
            },
          },
        })),

      clearProjectNotifications: (projectId) =>
        set((state) => {
          const { [projectId]: _, ...remaining } = state.scheduledByProject;
          return { scheduledByProject: remaining };
        }),

      addToHistory: (notification) =>
        set((state) => {
          const newNotification: ReceivedNotification = {
            ...notification,
            id: generateNotificationHistoryId(),
            receivedAt: new Date().toISOString(),
          };

          // Keep only the most recent notifications up to historyLimit
          const updatedHistory = [newNotification, ...state.notificationHistory].slice(
            0,
            state.historyLimit
          );

          return { notificationHistory: updatedHistory };
        }),

      markAsInteracted: (notificationId) =>
        set((state) => ({
          notificationHistory: state.notificationHistory.map((n) =>
            n.id === notificationId ? { ...n, wasInteracted: true } : n
          ),
        })),

      clearHistory: () =>
        set({ notificationHistory: [] }),

      setSchedulerRunning: (running) =>
        set({ isSchedulerRunning: running }),

      setError: (error) =>
        set({ lastError: error }),

      clearError: () =>
        set({ lastError: null }),

      getProjectNotificationIds: (projectId) => {
        const projectData = get().scheduledByProject[projectId];
        if (!projectData) return [];
        return projectData.scheduledNotifications.map((n) => n.notificationId);
      },

      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: "notification-store",
      storage: createJSONStorage(() => fileStorage),
      // Persist specific fields across app restarts
      partialize: (state) => ({
        permissionStatus: state.permissionStatus,
        hasCheckedPermissions: state.hasCheckedPermissions,
        pushToken: state.pushToken,
        scheduledByProject: state.scheduledByProject,
        notificationHistory: state.notificationHistory,
        historyLimit: state.historyLimit,
      }),
    }
  )
);
