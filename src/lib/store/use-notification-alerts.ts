import { useEffect, useCallback, useRef } from "react";
import { useNotificationAlertsStore } from "./notification-alerts-store";
import {
  getAlertsScheduler,
  type AlertsSchedulerEvent,
  type ProjectStreakInfo,
  type WeeklySummaryStats,
} from "@/lib/notifications";

/**
 * Hook for managing notification alerts (streak alerts and weekly summaries)
 *
 * This hook:
 * - Starts/stops the alerts scheduler based on settings
 * - Provides methods to check streak status and get weekly stats
 * - Syncs settings changes to the scheduler
 */
export function useNotificationAlerts() {
  const {
    streakAlertsEnabled,
    weeklySummaryEnabled,
    weeklySummaryTime,
    lastStreakCheckAt,
    lastWeeklySummaryAt,
    setStreakAlertsEnabled,
    setWeeklySummaryEnabled,
    setWeeklySummaryTime,
    setLastStreakCheckAt,
    setLastWeeklySummaryAt,
    removePendingStreakAlert,
  } = useNotificationAlertsStore();

  const schedulerRef = useRef(getAlertsScheduler());
  const listenerRef = useRef<(() => void) | null>(null);

  // Handle scheduler events
  const handleSchedulerEvent = useCallback(
    (event: AlertsSchedulerEvent) => {
      switch (event.type) {
        case "stateChange":
          if (event.state.lastStreakCheckAt) {
            setLastStreakCheckAt(event.state.lastStreakCheckAt);
          }
          if (event.state.lastWeeklySummaryAt) {
            setLastWeeklySummaryAt(event.state.lastWeeklySummaryAt);
          }
          break;
      }
    },
    [setLastStreakCheckAt, setLastWeeklySummaryAt]
  );

  // Start/stop scheduler based on settings
  useEffect(() => {
    const scheduler = schedulerRef.current;

    // Add listener
    if (!listenerRef.current) {
      listenerRef.current = scheduler.addListener(handleSchedulerEvent);
    }

    // Start if any alerts are enabled
    if (streakAlertsEnabled || weeklySummaryEnabled) {
      scheduler.start();
    } else {
      scheduler.stop();
    }

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [streakAlertsEnabled, weeklySummaryEnabled, handleSchedulerEvent]);

  // Update scheduler config when settings change
  useEffect(() => {
    const scheduler = schedulerRef.current;
    scheduler.updateConfig({ weeklySummaryTime });
  }, [weeklySummaryTime]);

  // Toggle streak alerts
  const toggleStreakAlerts = useCallback(
    (enabled: boolean) => {
      setStreakAlertsEnabled(enabled);
    },
    [setStreakAlertsEnabled]
  );

  // Toggle weekly summary
  const toggleWeeklySummary = useCallback(
    (enabled: boolean) => {
      setWeeklySummaryEnabled(enabled);
    },
    [setWeeklySummaryEnabled]
  );

  // Update weekly summary time
  const updateWeeklySummaryTime = useCallback(
    (time: string) => {
      setWeeklySummaryTime(time);
    },
    [setWeeklySummaryTime]
  );

  // Clear streak alert for a project (call when user adds an entry)
  const clearProjectStreakAlert = useCallback(
    (projectId: string) => {
      schedulerRef.current.clearStreakAlertForProject(projectId);
      removePendingStreakAlert(projectId);
    },
    [removePendingStreakAlert]
  );

  // Force check streak alerts
  const forceStreakCheck = useCallback(async () => {
    await schedulerRef.current.forceStreakCheck();
  }, []);

  // Get projects at risk
  const getProjectsAtRisk = useCallback(async (): Promise<ProjectStreakInfo[]> => {
    return schedulerRef.current.getProjectsAtRisk();
  }, []);

  // Get weekly summary stats
  const getWeeklySummaryStats = useCallback(async (): Promise<WeeklySummaryStats> => {
    return schedulerRef.current.getWeeklySummaryStats();
  }, []);

  return {
    // Settings
    streakAlertsEnabled,
    weeklySummaryEnabled,
    weeklySummaryTime,
    lastStreakCheckAt,
    lastWeeklySummaryAt,

    // Actions
    toggleStreakAlerts,
    toggleWeeklySummary,
    updateWeeklySummaryTime,
    clearProjectStreakAlert,
    forceStreakCheck,
    getProjectsAtRisk,
    getWeeklySummaryStats,
  };
}

/**
 * Hook to clear streak alert when a new entry is added to a project
 */
export function useStreakAlertClearer(projectId: string) {
  const { clearProjectStreakAlert } = useNotificationAlerts();

  const clearAlert = useCallback(() => {
    clearProjectStreakAlert(projectId);
  }, [projectId, clearProjectStreakAlert]);

  return { clearStreakAlert: clearAlert };
}
