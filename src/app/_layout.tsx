import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SystemUI from "expo-system-ui";
import { initDatabase } from "@/lib/db";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import { NetworkProvider } from "@/lib/network";
import { ErrorBoundary, NetworkStatusBanner } from "@/components/ui";
import { colors } from "@/constants/colors";

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
  const [isRetrying, setIsRetrying] = useState(false);

  const setupDatabase = useCallback(async () => {
    try {
      setIsRetrying(true);
      setDbError(null);
      await initDatabase();
      setIsDbReady(true);
    } catch (error) {
      console.error("Failed to initialize database:", error);
      setDbError(
        error instanceof Error ? error.message : "Unknown database error"
      );
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync("#0a0a0a");
    setupDatabase();
  }, [setupDatabase]);

  if (dbError) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background px-6"
        accessibilityRole="alert"
        accessibilityLabel="Database initialization error"
      >
        <Text className="text-5xl mb-4">💾</Text>
        <Text className="text-error text-xl font-semibold mb-2">
          Database Error
        </Text>
        <Text className="text-text-secondary text-center mb-6">{dbError}</Text>
        <Pressable
          onPress={setupDatabase}
          disabled={isRetrying}
          className="bg-primary px-6 py-3 rounded-lg active:opacity-80 flex-row items-center"
          accessibilityRole="button"
          accessibilityLabel="Retry database initialization"
        >
          {isRetrying ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text className="text-white font-semibold ml-2">Retrying...</Text>
            </>
          ) : (
            <Text className="text-white font-semibold">Try Again</Text>
          )}
        </Pressable>
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        accessibilityRole="progressbar"
        accessibilityLabel="Loading application"
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-text-secondary mt-4">Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <NetworkProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <StatusBar style="light" />
              <NetworkStatusBanner />
              <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#0a0a0a" },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{
                  animation: "fade",
                }}
              />
              <Stack.Screen
                name="project/create"
                options={{
                  animation: "slide_from_bottom",
                  presentation: "modal",
                }}
              />
              <Stack.Screen
                name="project/category"
                options={{
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="project/cover"
                options={{
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="project/[id]"
                options={{
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="project/edit/[id]"
                options={{
                  animation: "slide_from_bottom",
                  presentation: "modal",
                }}
              />
              <Stack.Screen
                name="project/timeline/[id]"
                options={{
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="entry/camera/[projectId]"
                options={{
                  animation: "slide_from_bottom",
                  presentation: "fullScreenModal",
                }}
              />
              <Stack.Screen
                name="entry/create/[projectId]"
                options={{
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="entry/view/[id]"
                options={{
                  animation: "slide_from_bottom",
                  presentation: "fullScreenModal",
                }}
              />
              <Stack.Screen
                name="settings/sync"
                options={{
                  animation: "slide_from_right",
                }}
              />
            </Stack>
            </ToastProvider>
          </QueryClientProvider>
        </AuthProvider>
      </NetworkProvider>
    </ErrorBoundary>
  );
}
