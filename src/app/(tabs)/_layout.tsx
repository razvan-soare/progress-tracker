import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { GlobalUploadIndicator } from "@/components/ui";
import { useBackgroundUpload } from "@/lib/sync/useBackgroundUpload";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View className="items-center justify-center">
      <Text
        className={`text-xs mt-1 ${focused ? "text-primary" : "text-text-secondary"}`}
      >
        {name}
      </Text>
    </View>
  );
}

function UploadStatusHeader() {
  const {
    pendingCount,
    failedCount,
    currentProgress,
    isRunning,
    isPaused,
    checkPendingUploads,
  } = useBackgroundUpload({ autoStart: true });

  const handlePress = async () => {
    if (failedCount > 0) {
      await checkPendingUploads();
    }
  };

  return (
    <GlobalUploadIndicator
      pendingCount={pendingCount}
      failedCount={failedCount}
      currentProgress={currentProgress}
      isUploading={isRunning && !isPaused && pendingCount > 0}
      isPaused={isPaused}
      onPress={handlePress}
    />
  );
}

export default function TabLayout() {
  return (
    <View className="flex-1 bg-background">
      <View className="pt-2">
        <UploadStatusHeader />
      </View>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#1a1a1a",
            borderTopColor: "#2a2a2a",
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: "#6366f1",
          tabBarInactiveTintColor: "#a1a1aa",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Projects",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="Projects" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Calendar",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="Calendar" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="Profile" focused={focused} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
