import { useCallback, useState } from "react";
import { View, Text, ScrollView, Switch, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Card, TimePicker } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useNotificationAlerts } from "@/lib/store";

function formatTimeForDisplay(time: string): string {
  const [hour, minute] = time.split(":");
  const h = parseInt(hour, 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${minute} ${period}`;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) {
    return "Never";
  }
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

export default function NotificationsSettingsScreen() {
  const [showTimePicker, setShowTimePicker] = useState(false);

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

  const handleStreakAlertsToggle = useCallback(
    (value: boolean) => {
      toggleStreakAlerts(value);
    },
    [toggleStreakAlerts]
  );

  const handleWeeklySummaryToggle = useCallback(
    (value: boolean) => {
      toggleWeeklySummary(value);
    },
    [toggleWeeklySummary]
  );

  const handleTimeChange = useCallback(
    (time: string) => {
      updateWeeklySummaryTime(time);
    },
    [updateWeeklySummaryTime]
  );

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
      >
        {/* Intro */}
        <View className="mt-4 mb-2">
          <Text className="text-text-secondary text-sm">
            Configure which notifications you receive from Progress Tracker.
          </Text>
        </View>

        {/* Streak Alerts */}
        <Card className="mt-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center mb-1">
                <Text className="text-lg mr-2">🔥</Text>
                <Text className="text-base font-semibold text-text-primary">
                  Streak Alerts
                </Text>
              </View>
              <Text className="text-text-secondary text-sm">
                Get notified when you're about to break a streak. Alerts fire
                when you haven't logged an entry for 2 days on a project with
                an active streak.
              </Text>
            </View>
            <Switch
              value={streakAlertsEnabled}
              onValueChange={handleStreakAlertsToggle}
              trackColor={{ false: colors.surface, true: colors.primary }}
              thumbColor={colors.textPrimary}
              accessibilityLabel="Toggle streak alerts"
              accessibilityHint={
                streakAlertsEnabled
                  ? "Streak alerts are enabled. Tap to disable."
                  : "Streak alerts are disabled. Tap to enable."
              }
            />
          </View>

          {lastStreakCheckAt && (
            <View className="mt-3 pt-3 border-t border-border">
              <Text className="text-text-secondary text-xs">
                Last checked: {formatRelativeTime(lastStreakCheckAt)}
              </Text>
            </View>
          )}
        </Card>

        {/* Weekly Summary */}
        <Card className="mt-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center mb-1">
                <Text className="text-lg mr-2">📊</Text>
                <Text className="text-base font-semibold text-text-primary">
                  Weekly Summary
                </Text>
              </View>
              <Text className="text-text-secondary text-sm">
                Receive a summary of your progress every Sunday evening,
                including entries logged and projects updated.
              </Text>
            </View>
            <Switch
              value={weeklySummaryEnabled}
              onValueChange={handleWeeklySummaryToggle}
              trackColor={{ false: colors.surface, true: colors.primary }}
              thumbColor={colors.textPrimary}
              accessibilityLabel="Toggle weekly summary"
              accessibilityHint={
                weeklySummaryEnabled
                  ? "Weekly summary is enabled. Tap to disable."
                  : "Weekly summary is disabled. Tap to enable."
              }
            />
          </View>

          {weeklySummaryEnabled && (
            <View className="mt-3 pt-3 border-t border-border">
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="flex-row items-center justify-between py-2"
                accessibilityLabel={`Weekly summary time: ${formatTimeForDisplay(weeklySummaryTime)}`}
                accessibilityHint="Tap to change the time"
              >
                <View>
                  <Text className="text-text-primary text-sm font-medium">
                    Summary Time
                  </Text>
                  <Text className="text-text-secondary text-xs mt-0.5">
                    Every Sunday at this time
                  </Text>
                </View>
                <View className="bg-surface px-3 py-2 rounded-lg">
                  <Text className="text-primary font-medium">
                    {formatTimeForDisplay(weeklySummaryTime)}
                  </Text>
                </View>
              </Pressable>
            </View>
          )}

          {lastWeeklySummaryAt && (
            <View className="mt-3 pt-3 border-t border-border">
              <Text className="text-text-secondary text-xs">
                Last summary: {formatRelativeTime(lastWeeklySummaryAt)}
              </Text>
            </View>
          )}
        </Card>

        {/* Notification Channels Info */}
        <Card className="mt-4">
          <Text className="text-base font-semibold text-text-primary mb-3">
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
                style={{ backgroundColor: "#6366f1" }}
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

            <View className="flex-row items-center">
              <View
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: "#f59e0b" }}
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

            <View className="flex-row items-center">
              <View
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: "#10b981" }}
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

        {/* Time Picker Modal */}
        <TimePicker
          value={weeklySummaryTime}
          onChange={handleTimeChange}
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
