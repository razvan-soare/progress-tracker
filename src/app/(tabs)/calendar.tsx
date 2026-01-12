import { useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Href } from "expo-router";
import { useAllEntries, useProjects } from "@/lib/store/hooks";
import { CrossProjectCalendarView } from "@/components/calendar";
import { EmptyState, ErrorView, Skeleton } from "@/components/ui";
import { colors } from "@/constants/colors";

function CalendarSkeleton() {
  return (
    <View className="flex-1 bg-background px-4">
      {/* Month header skeleton */}
      <View className="flex-row items-center justify-between py-3">
        <Skeleton width={40} height={40} borderRadius={20} />
        <Skeleton width={150} height={24} />
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>
      {/* Weekday headers */}
      <View className="flex-row mb-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View key={i} className="flex-1 items-center">
            <Skeleton width={30} height={14} />
          </View>
        ))}
      </View>
      {/* Calendar grid skeleton */}
      {[1, 2, 3, 4, 5].map((week) => (
        <View key={week} className="flex-row mb-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <View key={day} className="flex-1 aspect-square p-1">
              <Skeleton width="100%" height="100%" borderRadius={8} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function CalendarScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const {
    entries,
    isLoading: entriesLoading,
    error: entriesError,
    refetch: refetchEntries,
  } = useAllEntries({ sortOrder: "desc" });

  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();

  const isLoading = entriesLoading || projectsLoading;
  const error = entriesError || projectsError;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchEntries(), refetchProjects()]);
    setRefreshing(false);
  }, [refetchEntries, refetchProjects]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await Promise.all([refetchEntries(), refetchProjects()]);
    setIsRetrying(false);
  }, [refetchEntries, refetchProjects]);

  const handleEntryPress = useCallback(
    (entryId: string) => {
      router.push(`/entry/view/${entryId}` as Href);
    },
    [router]
  );

  const handleCreateProject = useCallback(() => {
    router.push("/project/create" as Href);
  }, [router]);

  // Show loading skeleton on initial load
  if (isLoading && entries.length === 0 && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="px-4 pt-4">
          <Text className="text-3xl font-bold text-text-primary mb-4">
            Calendar
          </Text>
        </View>
        <CalendarSkeleton />
      </SafeAreaView>
    );
  }

  // Show error state with retry
  if (error && entries.length === 0 && projects.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="px-4 pt-4">
          <Text className="text-3xl font-bold text-text-primary mb-4">
            Calendar
          </Text>
        </View>
        <ErrorView
          title="Failed to load calendar"
          message={error}
          icon="📅"
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      </SafeAreaView>
    );
  }

  // No projects or entries yet
  if (projects.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="px-4 pt-4">
          <Text className="text-3xl font-bold text-text-primary mb-4">
            Calendar
          </Text>
        </View>
        <EmptyState
          icon="📅"
          title="No projects yet"
          description="Create a project to start tracking your progress. Your entries will appear here in a calendar view."
          actionLabel="Create Project"
          onAction={handleCreateProject}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-4 pt-4">
        <Text
          className="text-3xl font-bold text-text-primary mb-2"
          accessibilityRole="header"
        >
          Calendar
        </Text>
        <Text className="text-text-secondary text-sm mb-2">
          All entries across {projects.length} {projects.length === 1 ? "project" : "projects"}
        </Text>
      </View>

      {/* Inline error banner when we have cached data but fetch failed */}
      {error && (entries.length > 0 || projects.length > 0) && (
        <ErrorView
          compact
          title="Couldn't refresh"
          message={error}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      )}

      {entries.length === 0 ? (
        // Has projects but no entries
        <EmptyState
          icon="📝"
          title="No entries yet"
          description="Start documenting your progress by adding entries to your projects. They'll appear here in a calendar view."
        />
      ) : (
        // Show cross-project calendar
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <CrossProjectCalendarView
            entries={entries}
            projects={projects}
            onEntryPress={handleEntryPress}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
