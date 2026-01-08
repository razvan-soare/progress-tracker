import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SystemUI from "expo-system-ui";
import { initDatabase } from "@/lib/db";

import "../../global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync("#0a0a0a");

    async function setupDatabase() {
      try {
        await initDatabase();
        setIsDbReady(true);
      } catch (error) {
        console.error("Failed to initialize database:", error);
        setDbError(
          error instanceof Error ? error.message : "Unknown database error"
        );
      }
    }

    setupDatabase();
  }, []);

  if (dbError) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-error text-lg mb-2">Database Error</Text>
        <Text className="text-text-secondary text-center px-4">{dbError}</Text>
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="text-text-secondary mt-4">Loading...</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0a" },
          animation: "slide_from_right",
        }}
      />
    </QueryClientProvider>
  );
}
