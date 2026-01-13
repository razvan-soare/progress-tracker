import { useCallback, useEffect, useState } from "react";
import {
  getNotificationScheduler,
  type NotificationSchedulerState,
  type NotificationSchedulerEvent,
} from "@/lib/notifications/notification-scheduler";
import type { Project } from "@/types";

/**
 * Result from the useNotificationScheduler hook
 */
export interface UseNotificationSchedulerResult {
  /** Current state of the notification scheduler */
  state: NotificationSchedulerState;
  /** Whether the scheduler is currently running */
  isRunning: boolean;
  /** Whether the scheduler is paused */
  isPaused: boolean;
  /** Number of projects with active reminders */
  activeProjectCount: number;
  /** Number of scheduled notifications */
  scheduledNotificationCount: number;
  /** Schedule notifications for a project */
  scheduleForProject: (project: Project) => Promise<void>;
  /** Cancel notifications for a project */
  cancelForProject: (projectId: string) => Promise<void>;
  /** Reschedule notifications for a project (convenience method) */
  rescheduleForProject: (project: Project) => Promise<void>;
  /** Force sync all project notifications */
  forceSync: () => Promise<void>;
  /** Cancel all reminder notifications */
  cancelAllReminders: () => Promise<void>;
}

/**
 * Hook to interact with the NotificationScheduler service.
 * Provides state tracking and methods for scheduling/canceling notifications.
 *
 * @example
 * ```tsx
 * function ProjectSettings({ project }: { project: Project }) {
 *   const {
 *     scheduleForProject,
 *     cancelForProject,
 *     scheduledNotificationCount,
 *   } = useNotificationScheduler();
 *
 *   const handleToggleReminders = async (enabled: boolean) => {
 *     if (enabled) {
 *       await scheduleForProject(project);
 *     } else {
 *       await cancelForProject(project.id);
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       <Text>Scheduled: {scheduledNotificationCount}</Text>
 *       <Switch
 *         value={project.reminderTime !== undefined}
 *         onValueChange={handleToggleReminders}
 *       />
 *     </View>
 *   );
 * }
 * ```
 */
export function useNotificationScheduler(): UseNotificationSchedulerResult {
  const scheduler = getNotificationScheduler();

  const [state, setState] = useState<NotificationSchedulerState>(
    scheduler.getState()
  );

  useEffect(() => {
    const handleEvent = (event: NotificationSchedulerEvent) => {
      if (event.type === "stateChange") {
        setState(event.state);
      }
    };

    const unsubscribe = scheduler.addListener(handleEvent);

    // Get initial state
    setState(scheduler.getState());

    return unsubscribe;
  }, [scheduler]);

  const scheduleForProject = useCallback(
    async (project: Project) => {
      await scheduler.scheduleForProject(project);
    },
    [scheduler]
  );

  const cancelForProject = useCallback(
    async (projectId: string) => {
      await scheduler.cancelForProject(projectId);
    },
    [scheduler]
  );

  const rescheduleForProject = useCallback(
    async (project: Project) => {
      await scheduler.rescheduleForProject(project);
    },
    [scheduler]
  );

  const forceSync = useCallback(async () => {
    await scheduler.forceSync();
  }, [scheduler]);

  const cancelAllReminders = useCallback(async () => {
    await scheduler.cancelAllReminders();
  }, [scheduler]);

  return {
    state,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    activeProjectCount: state.activeProjectCount,
    scheduledNotificationCount: state.scheduledNotificationCount,
    scheduleForProject,
    cancelForProject,
    rescheduleForProject,
    forceSync,
    cancelAllReminders,
  };
}
