import { AppState, type AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { getDatabase } from "@/lib/db/database";
import { projectRowToModel } from "@/lib/db/mappers";
import type { Project, ProjectRow } from "@/types";
import { NotificationChannels } from "./channels";
import {
  scheduleNotification,
  cancelNotification,
  getScheduledNotifications,
  checkNotificationPermissions,
} from "./index";

/**
 * Configuration for the NotificationScheduler
 */
export interface NotificationSchedulerConfig {
  /** How often to check for notifications that need scheduling (default: 60000ms = 1 minute) */
  checkIntervalMs?: number;
  /** Number of days ahead to schedule notifications (default: 7) */
  scheduleDaysAhead?: number;
}

/**
 * State of the notification scheduler
 */
export interface NotificationSchedulerState {
  /** Whether the scheduler is currently running */
  isRunning: boolean;
  /** Whether the scheduler is paused (e.g., app in background) */
  isPaused: boolean;
  /** Number of projects with active reminders */
  activeProjectCount: number;
  /** Number of scheduled notifications */
  scheduledNotificationCount: number;
  /** Last time notifications were synced */
  lastSyncedAt: string | null;
}

/**
 * Event types emitted by the scheduler
 */
export type NotificationSchedulerEvent =
  | { type: "stateChange"; state: NotificationSchedulerState }
  | { type: "schedulerStarted" }
  | { type: "schedulerStopped" }
  | { type: "schedulerPaused" }
  | { type: "schedulerResumed" }
  | { type: "notificationsScheduled"; projectId: string; count: number }
  | { type: "notificationsCanceled"; projectId: string; count: number }
  | { type: "syncCompleted"; scheduledCount: number }
  | { type: "error"; message: string };

export type NotificationSchedulerEventListener = (
  event: NotificationSchedulerEvent
) => void;

/**
 * Notification data stored with scheduled notifications
 */
interface ReminderNotificationData {
  type: "project_reminder";
  projectId: string;
  projectName: string;
  scheduledDay: string; // ISO date string YYYY-MM-DD
  [key: string]: unknown; // Allow index signature for compatibility with Record<string, unknown>
}

/**
 * Type guard to check if notification data is a ReminderNotificationData
 */
function isReminderNotificationData(
  data: unknown
): data is ReminderNotificationData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as ReminderNotificationData).type === "project_reminder"
  );
}

const DEFAULT_CONFIG: Required<NotificationSchedulerConfig> = {
  checkIntervalMs: 60000, // 1 minute
  scheduleDaysAhead: 7,
};

/**
 * Day name to number mapping (0 = Sunday in JS Date)
 */
const DAY_NAME_TO_NUMBER: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Get the day of week name from a Date object (lowercase)
 */
function getDayName(date: Date): string {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[date.getDay()];
}

/**
 * Parse time string (HH:MM) into hours and minutes
 */
function parseTime(timeString: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeString.split(":").map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Get the next occurrence of a specific day of week at a specific time
 * @param dayName Day name (e.g., "mon", "tue")
 * @param hours Hour of day (0-23)
 * @param minutes Minute of hour (0-59)
 * @param startDate Date to start searching from (defaults to now)
 */
function getNextOccurrence(
  dayName: string,
  hours: number,
  minutes: number,
  startDate: Date = new Date()
): Date {
  const targetDayNum = DAY_NAME_TO_NUMBER[dayName.toLowerCase()];
  if (targetDayNum === undefined) {
    throw new Error(`Invalid day name: ${dayName}`);
  }

  const result = new Date(startDate);
  result.setHours(hours, minutes, 0, 0);

  const currentDayNum = result.getDay();
  let daysUntilTarget = targetDayNum - currentDayNum;

  // If the target day is today, check if the time has passed
  if (daysUntilTarget === 0) {
    const now = new Date();
    if (result <= now) {
      // Time has passed today, schedule for next week
      daysUntilTarget = 7;
    }
  } else if (daysUntilTarget < 0) {
    // Target day is earlier in the week, go to next week
    daysUntilTarget += 7;
  }

  result.setDate(result.getDate() + daysUntilTarget);
  return result;
}

/**
 * Generate a unique notification identifier for a project reminder
 */
function generateNotificationId(projectId: string, date: Date): string {
  const dateStr = date.toISOString().split("T")[0];
  return `reminder_${projectId}_${dateStr}`;
}

/**
 * Create notification content for a project reminder
 */
function createReminderContent(projectName: string): {
  title: string;
  body: string;
} {
  const messages = [
    `Time to track your progress on ${projectName}!`,
    `What's your progress on ${projectName} today?`,
    `Don't forget to log your ${projectName} progress!`,
    `How's ${projectName} going? Time to check in!`,
    `Ready to make progress on ${projectName}?`,
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return {
    title: `${projectName} Reminder`,
    body: randomMessage,
  };
}

/**
 * NotificationScheduler manages scheduling of project reminder notifications.
 *
 * Features:
 * - Schedules notifications based on project reminder settings
 * - Respects selected days of the week
 * - Handles timezone correctly using local time
 * - Automatically reschedules when settings change
 * - Cancels notifications when reminders are disabled
 * - Batches scheduling for efficiency
 *
 * @example
 * ```typescript
 * const scheduler = new NotificationScheduler();
 *
 * scheduler.addListener((event) => {
 *   console.log('Scheduler event:', event);
 * });
 *
 * scheduler.start();
 *
 * // Schedule notifications for a project
 * await scheduler.scheduleForProject(project);
 *
 * // Cancel notifications for a project
 * await scheduler.cancelForProject(projectId);
 *
 * // Later...
 * scheduler.stop();
 * ```
 */
export class NotificationScheduler {
  private config: Required<NotificationSchedulerConfig>;
  private state: NotificationSchedulerState;
  private listeners: Set<NotificationSchedulerEventListener> = new Set();

  // Timers and subscriptions
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;

  // Track scheduled notification IDs by project
  private scheduledByProject: Map<string, Set<string>> = new Map();

  constructor(config: NotificationSchedulerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isRunning: false,
      isPaused: false,
      activeProjectCount: 0,
      scheduledNotificationCount: 0,
      lastSyncedAt: null,
    };
  }

  /**
   * Start the notification scheduler
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      return;
    }

    // Check permissions first
    const hasPermission = await checkNotificationPermissions();
    if (!hasPermission) {
      this.emitEvent({
        type: "error",
        message: "Notification permissions not granted",
      });
      return;
    }

    this.state.isRunning = true;
    this.emitEvent({ type: "schedulerStarted" });

    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange
    );

    // Load existing scheduled notifications
    await this.loadScheduledNotifications();

    // Initial sync
    await this.syncAllProjectNotifications();

    // Start periodic check
    this.checkTimer = setInterval(
      () => this.syncAllProjectNotifications(),
      this.config.checkIntervalMs
    );

    this.emitStateChange();
  }

  /**
   * Stop the notification scheduler
   */
  stop(): void {
    if (!this.state.isRunning) {
      return;
    }

    // Clear timer
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    // Unsubscribe from app state changes
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.state.isRunning = false;
    this.state.isPaused = false;

    this.emitEvent({ type: "schedulerStopped" });
    this.emitStateChange();
  }

  /**
   * Get the current scheduler state
   */
  getState(): NotificationSchedulerState {
    return { ...this.state };
  }

  /**
   * Add an event listener
   */
  addListener(listener: NotificationSchedulerEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove an event listener
   */
  removeListener(listener: NotificationSchedulerEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Schedule notifications for a specific project
   * Call this when a project's reminder settings change
   */
  async scheduleForProject(project: Project): Promise<void> {
    // First cancel any existing notifications for this project
    await this.cancelForProject(project.id);

    // Check if reminders are enabled
    if (
      !project.reminderTime ||
      !project.reminderDays ||
      project.reminderDays.length === 0
    ) {
      return;
    }

    const { hours, minutes } = parseTime(project.reminderTime);
    const now = new Date();
    const scheduledIds = new Set<string>();

    // Schedule notifications for each selected day for the next N days
    for (const dayName of project.reminderDays) {
      // Find the next occurrence of this day
      let nextOccurrence = getNextOccurrence(dayName, hours, minutes, now);

      // Schedule for the next scheduleDaysAhead days
      for (let week = 0; week < Math.ceil(this.config.scheduleDaysAhead / 7); week++) {
        if (nextOccurrence > new Date(now.getTime() + this.config.scheduleDaysAhead * 24 * 60 * 60 * 1000)) {
          break;
        }

        const notificationId = generateNotificationId(
          project.id,
          nextOccurrence
        );
        const { title, body } = createReminderContent(project.name);

        const data: ReminderNotificationData = {
          type: "project_reminder",
          projectId: project.id,
          projectName: project.name,
          scheduledDay: nextOccurrence.toISOString().split("T")[0],
        };

        try {
          // Calculate seconds from now
          const secondsFromNow = Math.floor(
            (nextOccurrence.getTime() - now.getTime()) / 1000
          );

          if (secondsFromNow > 0) {
            await scheduleNotification({
              title,
              body,
              data,
              channelId: NotificationChannels.REMINDERS,
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: secondsFromNow,
              },
            });
            scheduledIds.add(notificationId);
          }
        } catch (error) {
          console.warn(
            `Failed to schedule notification for ${project.name}:`,
            error
          );
        }

        // Move to next week
        nextOccurrence = new Date(
          nextOccurrence.getTime() + 7 * 24 * 60 * 60 * 1000
        );
      }
    }

    this.scheduledByProject.set(project.id, scheduledIds);
    await this.updateState();

    this.emitEvent({
      type: "notificationsScheduled",
      projectId: project.id,
      count: scheduledIds.size,
    });
  }

  /**
   * Cancel all scheduled notifications for a project
   * Call this when reminders are disabled or project is deleted
   */
  async cancelForProject(projectId: string): Promise<void> {
    const scheduledNotifications = await getScheduledNotifications();
    let canceledCount = 0;

    for (const notification of scheduledNotifications) {
      const data = notification.content.data;
      if (isReminderNotificationData(data) && data.projectId === projectId) {
        try {
          await cancelNotification(notification.identifier);
          canceledCount++;
        } catch (error) {
          console.warn(
            `Failed to cancel notification ${notification.identifier}:`,
            error
          );
        }
      }
    }

    this.scheduledByProject.delete(projectId);
    await this.updateState();

    if (canceledCount > 0) {
      this.emitEvent({
        type: "notificationsCanceled",
        projectId,
        count: canceledCount,
      });
    }
  }

  /**
   * Reschedule notifications for a project when settings change
   * This is a convenience method that cancels and reschedules
   */
  async rescheduleForProject(project: Project): Promise<void> {
    await this.scheduleForProject(project);
  }

  /**
   * Schedule notifications for all projects with reminders enabled
   */
  async scheduleAllProjects(): Promise<void> {
    const projects = await this.getProjectsWithReminders();

    for (const project of projects) {
      await this.scheduleForProject(project);
    }

    this.emitEvent({
      type: "syncCompleted",
      scheduledCount: this.state.scheduledNotificationCount,
    });
  }

  /**
   * Cancel all reminder notifications
   */
  async cancelAllReminders(): Promise<void> {
    const scheduledNotifications = await getScheduledNotifications();

    for (const notification of scheduledNotifications) {
      const data = notification.content.data;
      if (isReminderNotificationData(data)) {
        try {
          await cancelNotification(notification.identifier);
        } catch (error) {
          console.warn(
            `Failed to cancel notification ${notification.identifier}:`,
            error
          );
        }
      }
    }

    this.scheduledByProject.clear();
    await this.updateState();
  }

  /**
   * Force a sync of all project notifications
   * Useful for manual refresh or after significant changes
   */
  async forceSync(): Promise<void> {
    await this.syncAllProjectNotifications();
  }

  // Private methods

  private emitEvent(event: NotificationSchedulerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn("Error in NotificationScheduler listener:", error);
      }
    }
  }

  private emitStateChange(): void {
    this.emitEvent({ type: "stateChange", state: this.getState() });
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState !== "active" && !this.state.isPaused) {
      // App went to background, pause
      this.state.isPaused = true;
      this.emitEvent({ type: "schedulerPaused" });
      this.emitStateChange();
    } else if (nextAppState === "active" && this.state.isPaused) {
      // App came to foreground, resume and sync
      this.state.isPaused = false;
      this.emitEvent({ type: "schedulerResumed" });
      this.syncAllProjectNotifications();
      this.emitStateChange();
    }
  };

  private async loadScheduledNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await getScheduledNotifications();
      this.scheduledByProject.clear();

      for (const notification of scheduledNotifications) {
        const data = notification.content.data;
        if (isReminderNotificationData(data)) {
          const existing =
            this.scheduledByProject.get(data.projectId) || new Set();
          existing.add(notification.identifier);
          this.scheduledByProject.set(data.projectId, existing);
        }
      }

      await this.updateState();
    } catch (error) {
      console.warn("Failed to load scheduled notifications:", error);
    }
  }

  private async syncAllProjectNotifications(): Promise<void> {
    if (this.state.isPaused) {
      return;
    }

    try {
      // Get all projects with reminders
      const projects = await this.getProjectsWithReminders();
      const currentProjectIds = new Set(projects.map((p) => p.id));

      // Cancel notifications for projects that no longer have reminders
      for (const projectId of this.scheduledByProject.keys()) {
        if (!currentProjectIds.has(projectId)) {
          await this.cancelForProject(projectId);
        }
      }

      // Schedule/reschedule for all projects with reminders
      for (const project of projects) {
        // Check if we need to reschedule (either no notifications or notifications have expired)
        const existingIds = this.scheduledByProject.get(project.id);
        const needsReschedule =
          !existingIds ||
          existingIds.size === 0 ||
          (await this.hasExpiredNotifications(project.id));

        if (needsReschedule) {
          await this.scheduleForProject(project);
        }
      }

      this.state.lastSyncedAt = new Date().toISOString();
      await this.updateState();

      this.emitEvent({
        type: "syncCompleted",
        scheduledCount: this.state.scheduledNotificationCount,
      });
    } catch (error) {
      this.emitEvent({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to sync notifications",
      });
    }
  }

  private async hasExpiredNotifications(projectId: string): Promise<boolean> {
    const scheduledNotifications = await getScheduledNotifications();
    const projectNotifications = scheduledNotifications.filter((n) => {
      const data = n.content.data;
      return isReminderNotificationData(data) && data.projectId === projectId;
    });

    // If we have fewer notifications than expected, some may have expired
    const existingIds = this.scheduledByProject.get(projectId);
    return !existingIds || projectNotifications.length < existingIds.size;
  }

  private async getProjectsWithReminders(): Promise<Project[]> {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ProjectRow>(
        `SELECT * FROM projects
         WHERE is_deleted = 0
           AND reminder_time IS NOT NULL
           AND reminder_days IS NOT NULL
           AND reminder_days != '[]'
         ORDER BY name ASC`
      );

      return rows.map(projectRowToModel);
    } catch (error) {
      console.warn("Failed to fetch projects with reminders:", error);
      return [];
    }
  }

  private async updateState(): Promise<void> {
    try {
      const scheduledNotifications = await getScheduledNotifications();
      const reminderNotifications = scheduledNotifications.filter((n) => {
        const data = n.content.data;
        return isReminderNotificationData(data);
      });

      this.state.activeProjectCount = this.scheduledByProject.size;
      this.state.scheduledNotificationCount = reminderNotifications.length;

      this.emitStateChange();
    } catch (error) {
      console.warn("Failed to update scheduler state:", error);
    }
  }
}

// Singleton instance for app-wide use
let schedulerInstance: NotificationScheduler | null = null;

/**
 * Get or create the singleton NotificationScheduler instance
 */
export function getNotificationScheduler(
  config?: NotificationSchedulerConfig
): NotificationScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new NotificationScheduler(config);
  }
  return schedulerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetNotificationScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance = null;
  }
}
