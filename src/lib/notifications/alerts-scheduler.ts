import * as Notifications from "expo-notifications";
import { AppState, type AppStateStatus } from "react-native";
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
 * Project with streak information for alert processing
 */
export interface ProjectStreakInfo {
  project: Project;
  streakCount: number;
  daysSinceLastEntry: number;
  lastEntryDate: string | null;
}

/**
 * Weekly summary statistics
 */
export interface WeeklySummaryStats {
  totalEntriesThisWeek: number;
  projectsUpdatedThisWeek: number;
  totalVideos: number;
  totalPhotos: number;
  totalTexts: number;
  projectStats: Array<{
    projectId: string;
    projectName: string;
    entriesThisWeek: number;
    currentStreak: number;
  }>;
}

/**
 * Streak alert notification data structure
 */
interface StreakAlertNotificationData {
  type: "streak_alert";
  projectId: string;
  projectName: string;
  streakCount: number;
  [key: string]: unknown;
}

/**
 * Weekly summary notification data structure
 */
interface WeeklySummaryNotificationData {
  type: "weekly_summary";
  weekStartDate: string;
  totalEntries: number;
  projectsUpdated: number;
  [key: string]: unknown;
}

/**
 * Configuration for the AlertsScheduler
 */
export interface AlertsSchedulerConfig {
  /** How often to check for streak alerts (default: 3600000ms = 1 hour) */
  streakCheckIntervalMs?: number;
  /** Days without entry before triggering streak alert (default: 2) */
  streakAlertThresholdDays?: number;
  /** Time for weekly summary in HH:MM format (default: "18:00") */
  weeklySummaryTime?: string;
}

/**
 * State of the alerts scheduler
 */
export interface AlertsSchedulerState {
  isRunning: boolean;
  isPaused: boolean;
  lastStreakCheckAt: string | null;
  lastWeeklySummaryAt: string | null;
  scheduledWeeklySummaryId: string | null;
}

/**
 * Events emitted by the alerts scheduler
 */
export type AlertsSchedulerEvent =
  | { type: "stateChange"; state: AlertsSchedulerState }
  | { type: "schedulerStarted" }
  | { type: "schedulerStopped" }
  | { type: "streakAlertScheduled"; projectId: string; streakCount: number }
  | { type: "weeklySummaryScheduled"; scheduledFor: Date }
  | { type: "error"; message: string };

export type AlertsSchedulerEventListener = (event: AlertsSchedulerEvent) => void;

const DEFAULT_CONFIG: Required<AlertsSchedulerConfig> = {
  streakCheckIntervalMs: 3600000, // 1 hour
  streakAlertThresholdDays: 2,
  weeklySummaryTime: "18:00",
};

/**
 * Type guards for notification data
 */
function isStreakAlertNotificationData(
  data: unknown
): data is StreakAlertNotificationData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as StreakAlertNotificationData).type === "streak_alert"
  );
}

function isWeeklySummaryNotificationData(
  data: unknown
): data is WeeklySummaryNotificationData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as WeeklySummaryNotificationData).type === "weekly_summary"
  );
}

/**
 * AlertsScheduler manages streak alerts and weekly summary notifications.
 *
 * Features:
 * - Monitors projects for streak at-risk status (no entry in 2+ days)
 * - Schedules streak alert notifications with current streak count
 * - Schedules weekly summary notifications for Sunday evening
 * - Uses separate notification channels for each type
 */
export class AlertsScheduler {
  private config: Required<AlertsSchedulerConfig>;
  private state: AlertsSchedulerState;
  private listeners: Set<AlertsSchedulerEventListener> = new Set();
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private alertedProjectIds: Set<string> = new Set();

  constructor(config: AlertsSchedulerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isRunning: false,
      isPaused: false,
      lastStreakCheckAt: null,
      lastWeeklySummaryAt: null,
      scheduledWeeklySummaryId: null,
    };
  }

  /**
   * Start the alerts scheduler
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      return;
    }

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

    // Load any existing alerted project IDs
    await this.loadAlertedProjects();

    // Initial check
    await this.checkStreakAlerts();
    await this.scheduleWeeklySummary();

    // Start periodic check
    this.checkTimer = setInterval(
      () => this.checkStreakAlerts(),
      this.config.streakCheckIntervalMs
    );

    this.emitStateChange();
  }

  /**
   * Stop the alerts scheduler
   */
  stop(): void {
    if (!this.state.isRunning) {
      return;
    }

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

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
  getState(): AlertsSchedulerState {
    return { ...this.state };
  }

  /**
   * Add an event listener
   */
  addListener(listener: AlertsSchedulerEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update configuration (e.g., weekly summary time)
   */
  updateConfig(config: Partial<AlertsSchedulerConfig>): void {
    this.config = { ...this.config, ...config };

    // Reschedule weekly summary if time changed
    if (config.weeklySummaryTime) {
      this.scheduleWeeklySummary();
    }
  }

  /**
   * Clear streak alert for a project (call when user adds an entry)
   */
  clearStreakAlertForProject(projectId: string): void {
    this.alertedProjectIds.delete(projectId);
  }

  /**
   * Force check streak alerts immediately
   */
  async forceStreakCheck(): Promise<void> {
    await this.checkStreakAlerts();
  }

  /**
   * Get projects at risk of breaking their streak
   */
  async getProjectsAtRisk(): Promise<ProjectStreakInfo[]> {
    return this.fetchProjectsAtRisk();
  }

  /**
   * Get weekly summary statistics
   */
  async getWeeklySummaryStats(): Promise<WeeklySummaryStats> {
    return this.calculateWeeklyStats();
  }

  // Private methods

  private emitEvent(event: AlertsSchedulerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn("Error in AlertsScheduler listener:", error);
      }
    }
  }

  private emitStateChange(): void {
    this.emitEvent({ type: "stateChange", state: this.getState() });
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState !== "active" && !this.state.isPaused) {
      this.state.isPaused = true;
      this.emitStateChange();
    } else if (nextAppState === "active" && this.state.isPaused) {
      this.state.isPaused = false;
      this.checkStreakAlerts();
      this.emitStateChange();
    }
  };

  private async loadAlertedProjects(): Promise<void> {
    try {
      const scheduledNotifications = await getScheduledNotifications();
      this.alertedProjectIds.clear();

      for (const notification of scheduledNotifications) {
        const data = notification.content.data;
        if (isStreakAlertNotificationData(data)) {
          this.alertedProjectIds.add(data.projectId);
        }
      }
    } catch (error) {
      console.warn("Failed to load alerted projects:", error);
    }
  }

  /**
   * Check for projects at risk and schedule streak alerts
   */
  private async checkStreakAlerts(): Promise<void> {
    if (this.state.isPaused) {
      return;
    }

    try {
      const projectsAtRisk = await this.fetchProjectsAtRisk();

      for (const info of projectsAtRisk) {
        // Skip if we already alerted for this project
        if (this.alertedProjectIds.has(info.project.id)) {
          continue;
        }

        // Skip if streak is 0 (no streak to break)
        if (info.streakCount === 0) {
          continue;
        }

        await this.scheduleStreakAlert(info);
      }

      // Clear alerts for projects no longer at risk
      const atRiskIds = new Set(projectsAtRisk.map((p) => p.project.id));
      for (const projectId of this.alertedProjectIds) {
        if (!atRiskIds.has(projectId)) {
          await this.cancelStreakAlert(projectId);
        }
      }

      this.state.lastStreakCheckAt = new Date().toISOString();
      this.emitStateChange();
    } catch (error) {
      this.emitEvent({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to check streak alerts",
      });
    }
  }

  /**
   * Fetch projects that are at risk of breaking their streak
   */
  private async fetchProjectsAtRisk(): Promise<ProjectStreakInfo[]> {
    try {
      const db = await getDatabase();

      // Get all active projects
      const projectRows = await db.getAllAsync<ProjectRow>(
        "SELECT * FROM projects WHERE is_deleted = 0"
      );

      const projectsAtRisk: ProjectStreakInfo[] = [];

      for (const row of projectRows) {
        const project = projectRowToModel(row);

        // Get the last entry date and streak info for this project
        const entryInfo = await db.getFirstAsync<{
          last_entry_date: string | null;
        }>(
          `SELECT MAX(date(created_at)) as last_entry_date
           FROM entries
           WHERE project_id = ? AND is_deleted = 0`,
          [project.id]
        );

        if (!entryInfo?.last_entry_date) {
          // No entries, no streak to break
          continue;
        }

        const lastEntryDate = new Date(entryInfo.last_entry_date);
        lastEntryDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysSinceLastEntry = Math.floor(
          (today.getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if at risk (2+ days without entry)
        if (daysSinceLastEntry >= this.config.streakAlertThresholdDays) {
          // Calculate current streak
          const streakCount = await this.calculateStreak(project.id);

          if (streakCount > 0) {
            projectsAtRisk.push({
              project,
              streakCount,
              daysSinceLastEntry,
              lastEntryDate: entryInfo.last_entry_date,
            });
          }
        }
      }

      return projectsAtRisk;
    } catch (error) {
      console.warn("Failed to fetch projects at risk:", error);
      return [];
    }
  }

  /**
   * Calculate the current streak for a project
   */
  private async calculateStreak(projectId: string): Promise<number> {
    try {
      const db = await getDatabase();

      const streakResult = await db.getAllAsync<{ entry_date: string }>(
        `SELECT DISTINCT date(created_at) as entry_date
         FROM entries
         WHERE project_id = ? AND is_deleted = 0
         ORDER BY entry_date DESC`,
        [projectId]
      );

      if (streakResult.length === 0) {
        return 0;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstEntryDate = new Date(streakResult[0].entry_date);
      firstEntryDate.setHours(0, 0, 0, 0);

      const diffFromToday = Math.floor(
        (today.getTime() - firstEntryDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only count streak if there's still a chance to maintain it (within threshold)
      // A streak is "at risk" but not yet broken if we're within the threshold
      if (diffFromToday > this.config.streakAlertThresholdDays) {
        // Streak is already broken, return 0
        return 0;
      }

      let streakCount = 1;
      let previousDate = firstEntryDate;

      for (let i = 1; i < streakResult.length; i++) {
        const currentDate = new Date(streakResult[i].entry_date);
        currentDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor(
          (previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          streakCount++;
          previousDate = currentDate;
        } else {
          break;
        }
      }

      return streakCount;
    } catch (error) {
      console.warn("Failed to calculate streak:", error);
      return 0;
    }
  }

  /**
   * Schedule a streak alert notification for a project
   */
  private async scheduleStreakAlert(info: ProjectStreakInfo): Promise<void> {
    try {
      const { project, streakCount } = info;

      // Create compelling message
      const messages = [
        `Don't break your ${streakCount}-day streak on ${project.name}!`,
        `Your ${streakCount}-day streak on ${project.name} is at risk!`,
        `Keep your ${project.name} momentum going! ${streakCount} days strong.`,
        `${project.name}: ${streakCount} days and counting. Don't stop now!`,
      ];

      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const data: StreakAlertNotificationData = {
        type: "streak_alert",
        projectId: project.id,
        projectName: project.name,
        streakCount,
      };

      // Schedule for 30 seconds from now (immediate-ish alert)
      await scheduleNotification({
        title: "Streak Alert 🔥",
        body: randomMessage,
        data,
        channelId: NotificationChannels.STREAKS,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 30,
        },
      });

      this.alertedProjectIds.add(project.id);

      this.emitEvent({
        type: "streakAlertScheduled",
        projectId: project.id,
        streakCount,
      });
    } catch (error) {
      console.warn(`Failed to schedule streak alert for ${info.project.name}:`, error);
    }
  }

  /**
   * Cancel a streak alert for a project
   */
  private async cancelStreakAlert(projectId: string): Promise<void> {
    try {
      const scheduledNotifications = await getScheduledNotifications();

      for (const notification of scheduledNotifications) {
        const data = notification.content.data;
        if (isStreakAlertNotificationData(data) && data.projectId === projectId) {
          await cancelNotification(notification.identifier);
        }
      }

      this.alertedProjectIds.delete(projectId);
    } catch (error) {
      console.warn(`Failed to cancel streak alert for ${projectId}:`, error);
    }
  }

  /**
   * Schedule the weekly summary notification for next Sunday evening
   */
  private async scheduleWeeklySummary(): Promise<void> {
    try {
      // Cancel any existing weekly summary
      if (this.state.scheduledWeeklySummaryId) {
        await cancelNotification(this.state.scheduledWeeklySummaryId);
        this.state.scheduledWeeklySummaryId = null;
      }

      // Cancel any other weekly summary notifications
      const scheduledNotifications = await getScheduledNotifications();
      for (const notification of scheduledNotifications) {
        const data = notification.content.data;
        if (isWeeklySummaryNotificationData(data)) {
          await cancelNotification(notification.identifier);
        }
      }

      // Calculate next Sunday at the configured time
      const [hours, minutes] = this.config.weeklySummaryTime.split(":").map(Number);
      const now = new Date();
      const nextSunday = new Date(now);

      // Find next Sunday
      const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
      nextSunday.setDate(now.getDate() + daysUntilSunday);
      nextSunday.setHours(hours || 18, minutes || 0, 0, 0);

      // If it's Sunday and we haven't passed the time yet, use today
      if (now.getDay() === 0 && now < nextSunday) {
        nextSunday.setDate(now.getDate());
      }

      // Calculate seconds from now
      const secondsFromNow = Math.floor((nextSunday.getTime() - now.getTime()) / 1000);

      if (secondsFromNow <= 0) {
        // Already past the time, schedule for next week
        nextSunday.setDate(nextSunday.getDate() + 7);
      }

      const finalSecondsFromNow = Math.floor((nextSunday.getTime() - now.getTime()) / 1000);

      // Get stats for the summary message
      const stats = await this.calculateWeeklyStats();

      const data: WeeklySummaryNotificationData = {
        type: "weekly_summary",
        weekStartDate: this.getWeekStartDate().toISOString().split("T")[0],
        totalEntries: stats.totalEntriesThisWeek,
        projectsUpdated: stats.projectsUpdatedThisWeek,
      };

      // Create summary message
      let body: string;
      if (stats.totalEntriesThisWeek === 0) {
        body = "Start the new week strong! No entries logged last week.";
      } else {
        body = `Great week! You logged ${stats.totalEntriesThisWeek} ${stats.totalEntriesThisWeek === 1 ? "entry" : "entries"} across ${stats.projectsUpdatedThisWeek} ${stats.projectsUpdatedThisWeek === 1 ? "project" : "projects"}.`;
      }

      const notificationId = await scheduleNotification({
        title: "Weekly Progress Summary 📊",
        body,
        data,
        channelId: NotificationChannels.REPORTS,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: finalSecondsFromNow,
        },
      });

      this.state.scheduledWeeklySummaryId = notificationId;

      this.emitEvent({
        type: "weeklySummaryScheduled",
        scheduledFor: nextSunday,
      });
    } catch (error) {
      console.warn("Failed to schedule weekly summary:", error);
    }
  }

  /**
   * Calculate weekly summary statistics
   */
  private async calculateWeeklyStats(): Promise<WeeklySummaryStats> {
    try {
      const db = await getDatabase();
      const weekStart = this.getWeekStartDate();
      const weekStartStr = weekStart.toISOString();

      // Get total entries this week
      const totalResult = await db.getFirstAsync<{
        total: number;
        videos: number;
        photos: number;
        texts: number;
      }>(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN entry_type = 'video' THEN 1 ELSE 0 END) as videos,
          SUM(CASE WHEN entry_type = 'photo' THEN 1 ELSE 0 END) as photos,
          SUM(CASE WHEN entry_type = 'text' THEN 1 ELSE 0 END) as texts
         FROM entries
         WHERE is_deleted = 0 AND created_at >= ?`,
        [weekStartStr]
      );

      // Get projects updated this week
      const projectsResult = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT project_id) as count
         FROM entries
         WHERE is_deleted = 0 AND created_at >= ?`,
        [weekStartStr]
      );

      // Get per-project stats
      const projectStats = await db.getAllAsync<{
        project_id: string;
        project_name: string;
        entry_count: number;
      }>(
        `SELECT
          e.project_id,
          p.name as project_name,
          COUNT(*) as entry_count
         FROM entries e
         JOIN projects p ON e.project_id = p.id
         WHERE e.is_deleted = 0 AND e.created_at >= ?
         GROUP BY e.project_id
         ORDER BY entry_count DESC`,
        [weekStartStr]
      );

      // Calculate streaks for each project
      const projectStatsWithStreaks = await Promise.all(
        projectStats.map(async (ps) => ({
          projectId: ps.project_id,
          projectName: ps.project_name,
          entriesThisWeek: ps.entry_count,
          currentStreak: await this.calculateStreak(ps.project_id),
        }))
      );

      return {
        totalEntriesThisWeek: totalResult?.total ?? 0,
        projectsUpdatedThisWeek: projectsResult?.count ?? 0,
        totalVideos: totalResult?.videos ?? 0,
        totalPhotos: totalResult?.photos ?? 0,
        totalTexts: totalResult?.texts ?? 0,
        projectStats: projectStatsWithStreaks,
      };
    } catch (error) {
      console.warn("Failed to calculate weekly stats:", error);
      return {
        totalEntriesThisWeek: 0,
        projectsUpdatedThisWeek: 0,
        totalVideos: 0,
        totalPhotos: 0,
        totalTexts: 0,
        projectStats: [],
      };
    }
  }

  /**
   * Get the start of the current week (Monday)
   */
  private getWeekStartDate(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }
}

// Singleton instance
let alertsSchedulerInstance: AlertsScheduler | null = null;

/**
 * Get or create the singleton AlertsScheduler instance
 */
export function getAlertsScheduler(
  config?: AlertsSchedulerConfig
): AlertsScheduler {
  if (!alertsSchedulerInstance) {
    alertsSchedulerInstance = new AlertsScheduler(config);
  }
  return alertsSchedulerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetAlertsScheduler(): void {
  if (alertsSchedulerInstance) {
    alertsSchedulerInstance.stop();
    alertsSchedulerInstance = null;
  }
}
