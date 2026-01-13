import { useCallback, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useNotificationStore, type ScheduledNotificationRef } from "./notification-store";
import { useNotificationPermissionsStore } from "./notification-permissions-store";
import { useProjectsStore } from "./projects-store";
import {
  requestNotificationPermissions,
  getNotificationScheduler,
  type NotificationSchedulerEvent,
} from "@/lib/notifications";
import type { Project } from "@/types";

/**
 * Hook for managing notification permissions, scheduling, and history.
 * Provides a clean API for components to interact with the notification system.
 */
export function useNotifications() {
  const notificationStore = useNotificationStore();
  const permissionsStore = useNotificationPermissionsStore();

  // Refs for notification listeners
  const receivedListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);
  const schedulerListenerRef = useRef<(() => void) | null>(null);

  /**
   * Request notification permissions from the user
   */
  const requestPermissions = useCallback(async () => {
    try {
      const granted = await requestNotificationPermissions();
      const status = granted ? "granted" : "denied";

      permissionsStore.setStatus(status);
      permissionsStore.markChecked();
      notificationStore.setPermissionStatus(status);
      notificationStore.markPermissionsChecked();

      return granted;
    } catch (error) {
      notificationStore.setError(
        error instanceof Error ? error.message : "Failed to request permissions"
      );
      return false;
    }
  }, [permissionsStore, notificationStore]);

  /**
   * Check current permission status
   */
  const checkPermissions = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();

      let permissionStatus: "undetermined" | "granted" | "denied" | "provisional" =
        "undetermined";

      if (status === "granted") {
        permissionStatus = "granted";
      } else if (status === "denied") {
        permissionStatus = "denied";
      }

      permissionsStore.setStatus(permissionStatus);
      permissionsStore.markChecked();
      notificationStore.setPermissionStatus(permissionStatus);
      notificationStore.markPermissionsChecked();

      return permissionStatus === "granted";
    } catch (error) {
      notificationStore.setError(
        error instanceof Error ? error.message : "Failed to check permissions"
      );
      return false;
    }
  }, [permissionsStore, notificationStore]);

  /**
   * Schedule reminders for a project
   */
  const scheduleProjectReminders = useCallback(
    async (project: Project) => {
      try {
        const scheduler = getNotificationScheduler();
        await scheduler.scheduleForProject(project);

        // Get the updated scheduled notifications
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
        const projectNotifications = scheduledNotifications
          .filter((n) => {
            const data = n.content.data;
            return (
              typeof data === "object" &&
              data !== null &&
              "projectId" in data &&
              data.projectId === project.id
            );
          })
          .map(
            (n): ScheduledNotificationRef => ({
              notificationId: n.identifier,
              scheduledFor:
                n.trigger && "date" in n.trigger
                  ? new Date(n.trigger.date).toISOString()
                  : new Date().toISOString(),
            })
          );

        notificationStore.setProjectNotifications(project.id, projectNotifications);
        notificationStore.clearError();
      } catch (error) {
        notificationStore.setError(
          error instanceof Error
            ? error.message
            : "Failed to schedule project reminders"
        );
      }
    },
    [notificationStore]
  );

  /**
   * Cancel reminders for a project
   */
  const cancelProjectReminders = useCallback(
    async (projectId: string) => {
      try {
        const scheduler = getNotificationScheduler();
        await scheduler.cancelForProject(projectId);
        notificationStore.clearProjectNotifications(projectId);
        notificationStore.clearError();
      } catch (error) {
        notificationStore.setError(
          error instanceof Error
            ? error.message
            : "Failed to cancel project reminders"
        );
      }
    },
    [notificationStore]
  );

  /**
   * Sync notifications for a project when its reminder settings change
   */
  const syncProjectNotifications = useCallback(
    async (project: Project) => {
      // If reminders are disabled, cancel all notifications for this project
      if (
        !project.reminderTime ||
        !project.reminderDays ||
        project.reminderDays.length === 0
      ) {
        await cancelProjectReminders(project.id);
      } else {
        // Schedule/reschedule notifications based on new settings
        await scheduleProjectReminders(project);
      }
    },
    [scheduleProjectReminders, cancelProjectReminders]
  );

  /**
   * Start the notification scheduler
   */
  const startScheduler = useCallback(async () => {
    try {
      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        notificationStore.setError("Notification permissions not granted");
        return false;
      }

      const scheduler = getNotificationScheduler();
      await scheduler.start();
      notificationStore.setSchedulerRunning(true);
      return true;
    } catch (error) {
      notificationStore.setError(
        error instanceof Error ? error.message : "Failed to start scheduler"
      );
      return false;
    }
  }, [checkPermissions, notificationStore]);

  /**
   * Stop the notification scheduler
   */
  const stopScheduler = useCallback(() => {
    const scheduler = getNotificationScheduler();
    scheduler.stop();
    notificationStore.setSchedulerRunning(false);
  }, [notificationStore]);

  /**
   * Force sync all project notifications
   */
  const forceSyncAll = useCallback(async () => {
    try {
      const scheduler = getNotificationScheduler();
      await scheduler.forceSync();
    } catch (error) {
      notificationStore.setError(
        error instanceof Error ? error.message : "Failed to sync notifications"
      );
    }
  }, [notificationStore]);

  // Set up notification listeners on mount
  useEffect(() => {
    // Listen for received notifications (when app is in foreground)
    receivedListenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const content = notification.request.content;
        notificationStore.addToHistory({
          title: content.title ?? "",
          body: content.body ?? "",
          data: (content.data as Record<string, unknown>) ?? {},
          wasInteracted: false,
        });
      }
    );

    // Listen for notification responses (when user taps notification)
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const content = response.notification.request.content;
        notificationStore.addToHistory({
          title: content.title ?? "",
          body: content.body ?? "",
          data: (content.data as Record<string, unknown>) ?? {},
          wasInteracted: true,
        });
      }
    );

    // Listen for scheduler events
    const scheduler = getNotificationScheduler();
    schedulerListenerRef.current = scheduler.addListener(
      (event: NotificationSchedulerEvent) => {
        switch (event.type) {
          case "schedulerStarted":
            notificationStore.setSchedulerRunning(true);
            break;
          case "schedulerStopped":
            notificationStore.setSchedulerRunning(false);
            break;
          case "error":
            notificationStore.setError(event.message);
            break;
        }
      }
    );

    // Check initial permissions
    checkPermissions();

    // Cleanup on unmount
    return () => {
      if (receivedListenerRef.current) {
        receivedListenerRef.current.remove();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
      if (schedulerListenerRef.current) {
        schedulerListenerRef.current();
      }
    };
  }, [checkPermissions, notificationStore]);

  return {
    // Permission state
    permissionStatus: notificationStore.permissionStatus,
    hasCheckedPermissions: notificationStore.hasCheckedPermissions,

    // Permission actions
    requestPermissions,
    checkPermissions,

    // Scheduling actions
    scheduleProjectReminders,
    cancelProjectReminders,
    syncProjectNotifications,

    // Scheduler control
    isSchedulerRunning: notificationStore.isSchedulerRunning,
    startScheduler,
    stopScheduler,
    forceSyncAll,

    // Notification history
    notificationHistory: notificationStore.notificationHistory,
    clearHistory: notificationStore.clearHistory,

    // Per-project scheduled notifications
    scheduledByProject: notificationStore.scheduledByProject,
    getProjectNotificationIds: notificationStore.getProjectNotificationIds,

    // Push token (for future cloud notifications)
    pushToken: notificationStore.pushToken,
    setPushToken: notificationStore.setPushToken,

    // Error handling
    lastError: notificationStore.lastError,
    clearError: notificationStore.clearError,
  };
}

/**
 * Hook for syncing project reminder settings with notification scheduling.
 * Should be used in components that modify project reminder settings.
 */
export function useProjectNotificationSync() {
  const { syncProjectNotifications, cancelProjectReminders } = useNotifications();
  const projectsById = useProjectsStore((state) => state.projectsById);

  /**
   * Sync notifications when a project's reminder settings change
   */
  const onProjectReminderChange = useCallback(
    async (projectId: string) => {
      const project = projectsById[projectId];
      if (project) {
        await syncProjectNotifications(project);
      }
    },
    [projectsById, syncProjectNotifications]
  );

  /**
   * Cancel notifications when a project is deleted
   */
  const onProjectDelete = useCallback(
    async (projectId: string) => {
      await cancelProjectReminders(projectId);
    },
    [cancelProjectReminders]
  );

  return {
    onProjectReminderChange,
    onProjectDelete,
  };
}

/**
 * Hook for getting notification data for a specific project
 */
export function useProjectNotifications(projectId: string | null | undefined) {
  const scheduledByProject = useNotificationStore(
    (state) => state.scheduledByProject
  );
  const getProjectNotificationIds = useNotificationStore(
    (state) => state.getProjectNotificationIds
  );

  if (!projectId) {
    return {
      scheduledNotifications: [],
      notificationIds: [],
      lastScheduledAt: null,
      hasScheduledNotifications: false,
    };
  }

  const projectData = scheduledByProject[projectId];

  return {
    scheduledNotifications: projectData?.scheduledNotifications ?? [],
    notificationIds: getProjectNotificationIds(projectId),
    lastScheduledAt: projectData?.lastScheduledAt ?? null,
    hasScheduledNotifications: (projectData?.scheduledNotifications.length ?? 0) > 0,
  };
}

/**
 * Hook that wraps project mutations with automatic notification syncing.
 * Use this instead of useProjectMutations when you want notifications
 * to be automatically scheduled/cancelled based on reminder settings.
 */
export function useProjectMutationsWithNotifications() {
  const createProject = useProjectsStore((state) => state.createProject);
  const updateProject = useProjectsStore((state) => state.updateProject);
  const deleteProject = useProjectsStore((state) => state.deleteProject);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const error = useProjectsStore((state) => state.error);
  const clearError = useProjectsStore((state) => state.clearError);

  const { syncProjectNotifications, cancelProjectReminders } = useNotifications();

  /**
   * Create a project and schedule notifications if reminders are set
   */
  const createProjectWithNotifications = useCallback(
    async (input: Parameters<typeof createProject>[0]) => {
      const project = await createProject(input);
      if (project.reminderTime && project.reminderDays?.length) {
        await syncProjectNotifications(project);
      }
      return project;
    },
    [createProject, syncProjectNotifications]
  );

  /**
   * Update a project and sync notifications if reminder settings changed
   */
  const updateProjectWithNotifications = useCallback(
    async (id: string, input: Parameters<typeof updateProject>[1]) => {
      const project = await updateProject(id, input);
      // Always sync notifications after update in case reminder settings changed
      await syncProjectNotifications(project);
      return project;
    },
    [updateProject, syncProjectNotifications]
  );

  /**
   * Delete a project and cancel its scheduled notifications
   */
  const deleteProjectWithNotifications = useCallback(
    async (id: string) => {
      await cancelProjectReminders(id);
      await deleteProject(id);
    },
    [deleteProject, cancelProjectReminders]
  );

  return {
    createProject: createProjectWithNotifications,
    updateProject: updateProjectWithNotifications,
    deleteProject: deleteProjectWithNotifications,
    isLoading,
    error,
    clearError,
  };
}
