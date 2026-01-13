import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { Card } from "@/components/ui";
import { useBackgroundUpload } from "@/lib/sync/useBackgroundUpload";

interface SettingsItemProps {
  title: string;
  description?: string;
  icon: string;
  onPress: () => void;
  badge?: string;
  badgeColor?: string;
}

function SettingsItem({
  title,
  description,
  icon,
  onPress,
  badge,
  badgeColor = "#6366f1",
}: SettingsItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-4 px-4 active:bg-surface/50"
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
    >
      <Text className="text-2xl mr-4">{icon}</Text>
      <View className="flex-1">
        <Text className="text-text-primary text-base font-medium">{title}</Text>
        {description && (
          <Text className="text-text-secondary text-sm mt-0.5">
            {description}
          </Text>
        )}
      </View>
      {badge && (
        <View
          className="px-2 py-1 rounded-full mr-2"
          style={{ backgroundColor: `${badgeColor}20` }}
        >
          <Text className="text-xs font-medium" style={{ color: badgeColor }}>
            {badge}
          </Text>
        </View>
      )}
      <Text className="text-text-secondary text-lg">›</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { pendingCount, failedCount } = useBackgroundUpload({ autoStart: false });

  const getSyncBadge = (): { text: string; color: string } | null => {
    if (failedCount > 0) {
      return { text: `${failedCount} failed`, color: "#ef4444" };
    }
    if (pendingCount > 0) {
      return { text: `${pendingCount} pending`, color: "#f59e0b" };
    }
    return null;
  };

  const syncBadge = getSyncBadge();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView className="flex-1">
        <View className="px-4 pt-4">
          <Text className="text-3xl font-bold text-text-primary mb-6">
            Profile
          </Text>
        </View>

        {/* Settings Section */}
        <View className="mb-6">
          <Text className="text-text-secondary text-sm font-medium uppercase px-4 mb-2">
            Settings
          </Text>
          <Card className="mx-4 p-0 overflow-hidden">
            <SettingsItem
              title="Notifications"
              description="Streak alerts, weekly summaries, and reminders"
              icon="🔔"
              onPress={() => router.push("/settings/notifications" as Href)}
            />
            <View className="h-px bg-border mx-4" />
            <SettingsItem
              title="Sync & Storage"
              description="Manage uploads, storage, and sync settings"
              icon="☁️"
              onPress={() => router.push("/settings/sync" as Href)}
              badge={syncBadge?.text}
              badgeColor={syncBadge?.color}
            />
          </Card>
        </View>

        {/* About Section */}
        <View className="mb-6">
          <Text className="text-text-secondary text-sm font-medium uppercase px-4 mb-2">
            About
          </Text>
          <Card className="mx-4">
            <Text className="text-text-primary text-base font-medium mb-1">
              Progress Tracker
            </Text>
            <Text className="text-text-secondary text-sm">
              Track your daily progress with photos, videos, and notes.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
