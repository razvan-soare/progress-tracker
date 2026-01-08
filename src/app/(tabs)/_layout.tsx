import { Tabs } from "expo-router";
import { View, Text } from "react-native";

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

export default function TabLayout() {
  return (
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
  );
}
