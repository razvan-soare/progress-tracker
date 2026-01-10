import { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProjects } from "@/lib/store/hooks";
import { EmptyState, LoadingSpinner, IconButton } from "@/components/ui";
import { ProjectCard } from "@/components/project";
import { colors } from "@/constants/colors";
import type { Project } from "@/types";

// Test data for verifying the ProjectCard component
const TEST_PROJECTS: Project[] = [
  {
    id: "test-1",
    name: "Morning Workout Journey",
    description: "Tracking my fitness transformation",
    category: "fitness",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: false,
  },
  {
    id: "test-2",
    name: "Learning TypeScript",
    description: "From beginner to pro",
    category: "learning",
    coverImageUri: undefined, // No cover image
    startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isDeleted: false,
  },
  {
    id: "test-3",
    name: "Digital Art Portfolio",
    category: "creative",
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    isDeleted: false,
  },
  {
    id: "test-4",
    name: "Garden Progress 2024",
    description: "Watching my plants grow",
    category: "custom",
    startDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days ago
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    isDeleted: false,
  },
];

// Mock stats for test projects
const TEST_PROJECT_STATS: Record<string, { entryCount: number; lastEntryDate?: string; currentStreak: number; hasPendingUploads: boolean }> = {
  "test-1": { entryCount: 28, lastEntryDate: new Date().toISOString(), currentStreak: 7, hasPendingUploads: false },
  "test-2": { entryCount: 15, lastEntryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), currentStreak: 0, hasPendingUploads: true },
  "test-3": { entryCount: 42, lastEntryDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), currentStreak: 0, hasPendingUploads: false },
  "test-4": { entryCount: 0, lastEntryDate: undefined, currentStreak: 0, hasPendingUploads: false },
};

// Set to true to show test cards for verifying the ProjectCard component
const SHOW_TEST_CARDS = true;

export default function ProjectsScreen() {
  const router = useRouter();
  const { projects, isLoading, refetch } = useProjects();
  const [refreshing, setRefreshing] = useState(false);

  // Combine real projects with test projects when SHOW_TEST_CARDS is enabled
  const displayProjects = useMemo(() => {
    if (SHOW_TEST_CARDS) {
      return [...projects, ...TEST_PROJECTS];
    }
    return projects;
  }, [projects]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAddProject = useCallback(() => {
    router.push("/project/create");
  }, [router]);

  const handleProjectPress = useCallback((project: Project) => {
    // TODO: Navigate to project detail screen
    console.log("Navigate to project:", project.id);
  }, []);

  const renderProject = useCallback(
    ({ item }: { item: Project }) => {
      // Get stats from test data if available, otherwise use defaults
      const stats = TEST_PROJECT_STATS[item.id] || {
        entryCount: 0,
        lastEntryDate: undefined,
        currentStreak: 0,
        hasPendingUploads: false,
      };

      return (
        <ProjectCard
          project={item}
          entryCount={stats.entryCount}
          lastEntryDate={stats.lastEntryDate}
          currentStreak={stats.currentStreak}
          hasPendingUploads={stats.hasPendingUploads}
          onPress={() => handleProjectPress(item)}
        />
      );
    },
    [handleProjectPress]
  );

  const keyExtractor = useCallback((item: Project) => item.id, []);

  // Show loading spinner on initial load (not during refresh)
  if (isLoading && displayProjects.length === 0 && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner size="large" message="Loading projects..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Text className="text-3xl font-bold text-text-primary">My Projects</Text>
        <IconButton
          icon="+"
          variant="primary"
          size="md"
          onPress={handleAddProject}
          accessibilityLabel="Add new project"
        />
      </View>

      {/* Content */}
      {displayProjects.length === 0 ? (
        <EmptyState
          icon="🚀"
          title="Start your first progress journey"
          description="Create a project to begin tracking your progress with photos, videos, and notes."
          actionLabel="Create Project"
          onAction={handleAddProject}
        />
      ) : (
        <FlatList
          data={displayProjects}
          renderItem={renderProject}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
