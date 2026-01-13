import { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Card, Button, TimePicker } from "@/components/ui";
import { colors } from "@/constants/colors";
import {
  useNotifications,
  useNotificationAlerts,
  useProjectsStore,
} from "@/lib/store";
import {
  scheduleNotification,
  NotificationChannels,
  getNotificationScheduler,
} from "@/lib/notifications";
import type { Project } from "@/types";

/**
 * Format relative time for notification history
 */
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Format days array to human-readable string
 */
function formatDays(days: string[] | undefined): string {
  if (!days || days.length === 0) return "No days selected";
  if (days.length === 7) return "Every day";

  const dayMap: Record<string, string> = {
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
  };

  const orderedDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const sortedDays = [...days].sort(
    (a, b) => orderedDays.indexOf(a) - orderedDays.indexOf(b)
  );

  return sortedDays.map((d) => dayMap[d] || d).join(", ");
}

/**
 * Format time string from HH:MM to 12-hour format
 */
function formatTime(time: string | undefined): string {
  if (!time) return "Not set";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Get permission status display info
 */
function getPermissionInfo(status: string): {
  label: string;
  color: string;
  icon: string;
} {
  switch (status) {
    case "granted":
      return { label: "Enabled", color: colors.success, icon: "✓" };
    case "denied":
      return { label: "Denied", color: colors.error, icon: "✗" };
    case "provisional":
      return { label: "Provisional", color: colors.warning, icon: "~" };
    default:
      return { label: "Not Determined", color: colors.textSecondary, icon: "?" };
  }
}

export default function NotificationSettingsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [projectsWithReminders, setProjectsWithReminders] = useState<Project[]>([]);
  const [togglingProjects, setTogglingProjects] = useState<Set<string>>(new Set());
  const [showWeeklyTimePicker, setShowWeeklyTimePicker] = useState(false);
  const isMounted = useRef(true);

  // Notification hooks
  const {
    permissionStatus,
    checkPermissions,
    requestPermissions,
    notificationHistory,
    clearHistory,
    scheduledByProject,
    syncProjectNotifications,
    cancelProjectReminders,
    isSchedulerRunning,
    startScheduler,
    stopScheduler,
  } = useNotifications();

  const {
    streakAlertsEnabled,
    weeklySummaryEnabled,
    weeklySummaryTime,
    lastStreakCheckAt,
    lastWeeklySummaryAt,
    toggleStreakAlerts,
    toggleWeeklySummary,
    updateWeeklySummaryTime,
  } = useNotificationAlerts();

  // Projects store
  const projects = useProjectsStore((state) => state.projects);
  const fetchProjects = useProjectsStore((state) => state.fetchProjects);
  const updateProject = useProjectsStore((state) => state.updateProject);

  // Load data
  const loadData = useCallback(async () => {
    try {
      await Promise.all([checkPermissions(), fetchProjects()]);
    } catch (error) {
      console.error("Failed to load notification settings data:", error);
    }
  }, [checkPermissions, fetchProjects]);

  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);
    loadData().finally(() => {
      if (isMounted.current) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted.current = false;
    };
  }, [loadData]);

  // Update projects with reminders when projects change
  useEffect(() => {
    const withReminders = projects.filter(
      (p) => p.reminderTime && p.reminderDays && p.reminderDays.length > 0
    );
    setProjectsWithReminders(withReminders);
  }, [projects]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const handleOpenSettings = useCallback(() => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  }, []);

  const handleRequestPermissions = useCallback(async () => {
    const granted = await requestPermissions();
    if (granted) {
      Alert.alert("Success", "Notification permissions granted!");
    } else {
      Alert.alert(
        "Permission Required",
        "Please enable notifications in your device settings to receive reminders.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: handleOpenSettings },
        ]
      );
    }
  }, [requestPermissions, handleOpenSettings]);

  const handleToggleProjectReminder = useCallback(
    async (project: Project, enabled: boolean) => {
      setTogglingProjects((prev) => new Set(prev).add(project.id));
      try {
        if (enabled) {
          // Re-enable reminders by syncing with existing settings
          await syncProjectNotifications(project);
        } else {
          // Disable reminders by canceling notifications
          await cancelProjectReminders(project.id);
          // Clear reminder settings from project
          await updateProject(project.id, {
            reminderTime: undefined,
            reminderDays: undefined,
          });
        }
        await fetchProjects();
      } catch (error) {
        console.error("Failed to toggle project reminder:", error);
        Alert.alert("Error", "Failed to update reminder settings");
      } finally {
        setTogglingProjects((prev) => {
          const newSet = new Set(prev);
          newSet.delete(project.id);
          return newSet;
        });
      }
    },
    [syncProjectNotifications, cancelProjectReminders, updateProject, fetchProjects]
  );

  const handleToggleDailyReminders = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        // Start the scheduler
        const started = await startScheduler();
        if (!started) {
          Alert.alert(
            "Permission Required",
            "Please enable notifications to use daily reminders.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Enable", onPress: handleRequestPermissions },
            ]
          );
        }
      } else {
        // Stop the scheduler and optionally cancel all reminders
        Alert.alert(
          "Disable Daily Reminders",
          "This will stop all scheduled project reminders. Continue?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Disable",
              style: "destructive",
              onPress: async () => {
                stopScheduler();
                const scheduler = getNotificationScheduler();
                await scheduler.cancelAllReminders();
              },
            },
          ]
        );
      }
    },
    [startScheduler, stopScheduler, handleRequestPermissions]
  );

  const handleSendTestNotification = useCallback(async () => {
    if (permissionStatus !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please enable notifications to send a test notification.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Enable", onPress: handleRequestPermissions },
        ]
      );
      return;
    }

    setIsSendingTest(true);
    try {
      await scheduleNotification({
        title: "Test Notification",
        body: "This is a test notification from Progress Tracker. If you see this, notifications are working correctly!",
        data: { type: "test" },
        channelId: NotificationChannels.REMINDERS,
      });
      Alert.alert("Success", "Test notification sent! Check your notification tray.");
    } catch (error) {
      console.error("Failed to send test notification:", error);
      Alert.alert("Error", "Failed to send test notification. Please try again.");
    } finally {
      setIsSendingTest(false);
    }
  }, [permissionStatus, handleRequestPermissions]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      "Clear Notification History",
      "This will remove all notification history. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: clearHistory,
        },
      ]
    );
  }, [clearHistory]);

  const handleWeeklyTimeChange = useCallback(
    (time: string) => {
      updateWeeklySummaryTime(time);
    },
    [updateWeeklySummaryTime]
  );

  const permissionInfo = getPermissionInfo(permissionStatus);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Notifications",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
          }}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-text-secondary mt-4">Loading notification settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Notifications",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Permission Status */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Permission Status
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Text
                className="text-2xl mr-3"
                style={{ color: permissionInfo.color }}
              >
                {permissionInfo.icon}
              </Text>
              <View>
                <Text className="text-text-primary text-base font-medium">
                  Notifications
                </Text>
                <Text
                  className="text-sm font-medium"
                  style={{ color: permissionInfo.color }}
                >
                  {permissionInfo.label}
                </Text>
              </View>
            </View>

            {permissionStatus !== "granted" && (
              <Button
                title={permissionStatus === "denied" ? "Open Settings" : "Enable"}
                variant="primary"
                onPress={
                  permissionStatus === "denied"
                    ? handleOpenSettings
                    : handleRequestPermissions
                }
                className="px-4"
                accessibilityLabel={
                  permissionStatus === "denied"
                    ? "Open device settings to enable notifications"
                    : "Request notification permissions"
                }
              />
            )}
          </View>

          {permissionStatus === "denied" && (
            <Text className="text-text-secondary text-sm mt-3">
              Notifications are blocked. Tap "Open Settings" to enable them in your device settings.
            </Text>
          )}
        </Card>

        {/* Global Toggles */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Notification Types
          </Text>

          {/* Daily Reminders Toggle */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center mb-1">
                <Text className="text-lg mr-2">🔔</Text>
                <Text className="text-base font-medium text-text-primary">
                  Daily Reminders
                </Text>
              </View>
              <Text className="text-text-secondary text-sm">
                {isSchedulerRunning
                  ? "Receive reminders for your projects"
                  : "Enable to receive project reminders"}
              </Text>
            </View>
            <Switch
              value={isSchedulerRunning}
              onValueChange={handleToggleDailyReminders}
              trackColor={{ false: colors.surface, true: colors.primary }}
              thumbColor={colors.textPrimary}
              accessibilityLabel="Toggle daily reminders"
              accessibilityHint={
                isSchedulerRunning
                  ? "Daily reminders enabled. Tap to disable."
                  : "Daily reminders disabled. Tap to enable."
              }
            />
          </View>

          <View className="h-px bg-border" />

          {/* Streak Alerts Toggle */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center mb-1">
                <Text className="text-lg mr-2">🔥</Text>
                <Text className="text-base font-medium text-text-primary">
                  Streak Alerts
                </Text>
              </View>
              <Text className="text-text-secondary text-sm">
                {streakAlertsEnabled
                  ? "Get notified when streaks are at risk"
                  : "Enable to protect your streaks"}
              </Text>
              {lastStreakCheckAt && (
                <Text className="text-text-secondary text-xs mt-1">
                  Last checked: {formatRelativeTime(lastStreakCheckAt)}
                </Text>
              )}
            </View>
            <Switch
              value={streakAlertsEnabled}
              onValueChange={toggleStreakAlerts}
              trackColor={{ false: colors.surface, true: colors.primary }}
              thumbColor={colors.textPrimary}
              accessibilityLabel="Toggle streak alerts"
              accessibilityHint={
                streakAlertsEnabled
                  ? "Streak alerts enabled. Tap to disable."
                  : "Streak alerts disabled. Tap to enable."
              }
            />
          </View>

          <View className="h-px bg-border" />

          {/* Weekly Summary Toggle */}
          <View className="py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <View className="flex-row items-center mb-1">
                  <Text className="text-lg mr-2">📊</Text>
                  <Text className="text-base font-medium text-text-primary">
                    Weekly Summary
                  </Text>
                </View>
                <Text className="text-text-secondary text-sm">
                  {weeklySummaryEnabled
                    ? `Receive progress summaries every Sunday at ${formatTime(weeklySummaryTime)}`
                    : "Enable to receive weekly progress reports"}
                </Text>
                {lastWeeklySummaryAt && (
                  <Text className="text-text-secondary text-xs mt-1">
                    Last summary: {formatRelativeTime(lastWeeklySummaryAt)}
                  </Text>
                )}
              </View>
              <Switch
                value={weeklySummaryEnabled}
                onValueChange={toggleWeeklySummary}
                trackColor={{ false: colors.surface, true: colors.primary }}
                thumbColor={colors.textPrimary}
                accessibilityLabel="Toggle weekly summary"
                accessibilityHint={
                  weeklySummaryEnabled
                    ? "Weekly summary enabled. Tap to disable."
                    : "Weekly summary disabled. Tap to enable."
                }
              />
            </View>

            {weeklySummaryEnabled && (
              <Pressable
                onPress={() => setShowWeeklyTimePicker(true)}
                className="mt-3 flex-row items-center justify-between py-2 px-3 bg-background rounded-lg"
                accessibilityLabel={`Change weekly summary time. Currently set to ${formatTime(weeklySummaryTime)}`}
              >
                <Text className="text-text-secondary text-sm">Summary Time</Text>
                <View className="flex-row items-center">
                  <Text className="text-primary text-sm font-medium mr-2">
                    {formatTime(weeklySummaryTime)}
                  </Text>
                  <Text className="text-text-secondary">›</Text>
                </View>
              </Pressable>
            )}
          </View>
        </Card>

        {/* Project Reminders List */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Project Reminders
          </Text>

          {projectsWithReminders.length === 0 ? (
            <Text className="text-text-secondary text-center py-4">
              No projects have reminders set.{"\n"}
              Configure reminders when creating or editing a project.
            </Text>
          ) : (
            projectsWithReminders.map((project, index) => {
              const isToggling = togglingProjects.has(project.id);
              const hasScheduled = scheduledByProject[project.id]?.scheduledNotifications?.length > 0;

              return (
                <View
                  key={project.id}
                  className={index > 0 ? "border-t border-border" : ""}
                >
                  <View className="flex-row items-center justify-between py-3">
                    <View className="flex-1 pr-4">
                      <Text className="text-text-primary text-base font-medium">
                        {project.name}
                      </Text>
                      <Text className="text-text-secondary text-sm mt-1">
                        {formatTime(project.reminderTime)} • {formatDays(project.reminderDays)}
                      </Text>
                      {hasScheduled && (
                        <Text className="text-success text-xs mt-1">
                          {scheduledByProject[project.id].scheduledNotifications.length} notifications scheduled
                        </Text>
                      )}
                    </View>
                    {isToggling ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Switch
                        value={hasScheduled}
                        onValueChange={(enabled) =>
                          handleToggleProjectReminder(project, enabled)
                        }
                        trackColor={{ false: colors.surface, true: colors.primary }}
                        thumbColor={colors.textPrimary}
                        accessibilityLabel={`Toggle reminders for ${project.name}`}
                        accessibilityHint={
                          hasScheduled
                            ? `Reminders enabled for ${project.name}. Tap to disable.`
                            : `Reminders disabled for ${project.name}. Tap to enable.`
                        }
                      />
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Notification Channels Info */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-3">
            Notification Channels
          </Text>
          <Text className="text-text-secondary text-sm mb-4">
            Each notification type uses its own channel. You can customize how
            each type appears in your device settings.
          </Text>

          <View className="space-y-3">
            <View className="flex-row items-center">
              <View
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: colors.primary }}
              />
              <View className="flex-1">
                <Text className="text-text-primary text-sm font-medium">
                  Daily Reminders
                </Text>
                <Text className="text-text-secondary text-xs">
                  Project reminder notifications
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mt-3">
              <View
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: colors.warning }}
              />
              <View className="flex-1">
                <Text className="text-text-primary text-sm font-medium">
                  Streak Alerts
                </Text>
                <Text className="text-text-secondary text-xs">
                  Warnings about streaks at risk
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mt-3">
              <View
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: colors.success }}
              />
              <View className="flex-1">
                <Text className="text-text-primary text-sm font-medium">
                  Reports
                </Text>
                <Text className="text-text-secondary text-xs">
                  Weekly and monthly summaries
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Test Notification */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Debugging
          </Text>

          <Button
            title={isSendingTest ? "Sending..." : "Send Test Notification"}
            variant="secondary"
            loading={isSendingTest}
            onPress={handleSendTestNotification}
            accessibilityLabel="Send a test notification"
            accessibilityHint="Sends a test notification to verify notifications are working"
          />

          <Text className="text-text-secondary text-sm mt-3 text-center">
            Tap to send a test notification and verify everything is working.
          </Text>
        </Card>

        {/* Notification History */}
        <Card className="mt-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-text-primary">
              Recent Notifications
            </Text>
            {notificationHistory.length > 0 && (
              <Pressable
                onPress={handleClearHistory}
                className="px-3 py-1 bg-error/20 rounded-lg active:opacity-80"
                accessibilityLabel="Clear notification history"
              >
                <Text className="text-error text-sm font-medium">Clear</Text>
              </Pressable>
            )}
          </View>

          {notificationHistory.length === 0 ? (
            <Text className="text-text-secondary text-center py-4">
              No notifications received yet.
            </Text>
          ) : (
            notificationHistory.slice(0, 20).map((notification, index) => (
              <View
                key={notification.id}
                className={`py-3 ${index > 0 ? "border-t border-border" : ""}`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-text-primary text-sm font-medium">
                      {notification.title || "Notification"}
                    </Text>
                    {notification.body && (
                      <Text
                        className="text-text-secondary text-sm mt-1"
                        numberOfLines={2}
                      >
                        {notification.body}
                      </Text>
                    )}
                    <View className="flex-row items-center mt-1">
                      <Text className="text-text-secondary text-xs">
                        {formatRelativeTime(notification.receivedAt)}
                      </Text>
                      {notification.wasInteracted && (
                        <Text className="text-primary text-xs ml-2">• Tapped</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}

          {notificationHistory.length > 20 && (
            <Text className="text-text-secondary text-center text-sm pt-3 border-t border-border mt-2">
              Showing 20 of {notificationHistory.length} notifications
            </Text>
          )}
        </Card>
      </ScrollView>

      {/* Weekly Summary Time Picker Modal */}
      <TimePicker
        value={weeklySummaryTime}
        onChange={handleWeeklyTimeChange}
        visible={showWeeklyTimePicker}
        onClose={() => setShowWeeklyTimePicker(false)}
      />
    </SafeAreaView>
  );
}
