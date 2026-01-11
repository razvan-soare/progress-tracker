import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { View, Text, FlatList, RefreshControl, Animated, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Href } from "expo-router";
import { useProjects } from "@/lib/store/hooks";
import { useProjectsStore } from "@/lib/store";
import {
  EmptyState,
  IconButton,
  ErrorView,
  ProjectCardSkeleton,
} from "@/components/ui";
import { ProjectCard } from "@/components/project";
import { useDebouncedPress } from "@/lib/hooks";
import { colors } from "@/constants/colors";
import type { Project } from "@/types";

// Set to false in production
const SHOW_TEST_CARDS = false;

// Test data for development
const TEST_PROJECTS: Project[] = SHOW_TEST_CARDS
  ? [
      {
        id: "test-1",
        name: "Morning Workout Journey",
        description: "Tracking my fitness transformation",
        category: "fitness",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        isDeleted: false,
      },
      {
        id: "test-2",
        name: "Learning TypeScript - A Very Long Project Name That Should Be Truncated",
        description: "From beginner to pro",
        category: "learning",
        coverImageUri: undefined,
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        isDeleted: false,
      },
    ]
  : [];

const TEST_PROJECT_STATS: Record<
  string,
  { entryCount: number; lastEntryDate?: string; currentStreak: number; hasPendingUploads: boolean }
> = {
  "test-1": { entryCount: 28, lastEntryDate: new Date().toISOString(), currentStreak: 7, hasPendingUploads: false },
  "test-2": { entryCount: 15, lastEntryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), currentStreak: 0, hasPendingUploads: true },
};

function AnimatedProjectCard({
  project,
  stats,
  onPress,
  index,
}: {
  project: Project;
  stats: { entryCount: number; lastEntryDate?: string; currentStreak: number; hasPendingUploads: boolean };
  onPress: () => void;
  index: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY, index]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY }],
      }}
    >
      <ProjectCard
        project={project}
        entryCount={stats.entryCount}
        lastEntryDate={stats.lastEntryDate}
        currentStreak={stats.currentStreak}
        hasPendingUploads={stats.hasPendingUploads}
        onPress={onPress}
      />
    </Animated.View>
  );
}

function LoadingSkeletons() {
  return (
    <View className="px-4 pt-4">
      <ProjectCardSkeleton />
      <ProjectCardSkeleton />
      <ProjectCardSkeleton />
    </View>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { projects, isLoading, refetch, error } = useProjects();
  const { projectStats, fetchProjectStats } = useProjectsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Fetch stats for all projects
  useEffect(() => {
    projects.forEach((project) => {
      if (!projectStats[project.id]) {
        fetchProjectStats(project.id);
      }
    });
  }, [projects, projectStats, fetchProjectStats]);

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

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await refetch();
    setIsRetrying(false);
  }, [refetch]);

  const handleAddProject = useDebouncedPress(
    useCallback(() => {
      router.push("/project/create");
    }, [router]),
    300
  );

  const handleProjectPress = useCallback(
    (project: Project) => {
      router.push(`/project/${project.id}` as Href);
    },
    [router]
  );

  const renderProject = useCallback(
    ({ item, index }: { item: Project; index: number }) => {
      const testStats = TEST_PROJECT_STATS[item.id];
      const storedStats = projectStats[item.id];

      const entryCount = testStats?.entryCount ?? storedStats?.totalEntries ?? 0;
      const lastEntryDate = testStats?.lastEntryDate ?? storedStats?.lastEntryDate ?? undefined;
      const currentStreak = testStats?.currentStreak ?? storedStats?.streakCount ?? 0;
      const hasPendingUploads = testStats?.hasPendingUploads ?? false;

      return (
        <AnimatedProjectCard
          project={item}
          stats={{
            entryCount,
            lastEntryDate,
            currentStreak,
            hasPendingUploads,
          }}
          onPress={() => handleProjectPress(item)}
          index={index}
        />
      );
    },
    [handleProjectPress, projectStats]
  );

  const keyExtractor = useCallback((item: Project) => item.id, []);

  // Show skeleton loaders on initial load
  if (isLoading && displayProjects.length === 0 && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text
            className="text-3xl font-bold text-text-primary"
            accessibilityRole="header"
          >
            My Projects
          </Text>
          <IconButton
            icon="+"
            variant="primary"
            size="md"
            onPress={handleAddProject}
            accessibilityLabel="Add new project"
          />
        </View>
        <LoadingSkeletons />
      </SafeAreaView>
    );
  }

  // Show error state with retry
  if (error && displayProjects.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text
            className="text-3xl font-bold text-text-primary"
            accessibilityRole="header"
          >
            My Projects
          </Text>
          <IconButton
            icon="+"
            variant="primary"
            size="md"
            onPress={handleAddProject}
            accessibilityLabel="Add new project"
          />
        </View>
        <ErrorView
          title="Failed to load projects"
          message={error}
          icon="📂"
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Text
          className="text-3xl font-bold text-text-primary"
          accessibilityRole="header"
        >
          My Projects
        </Text>
        <IconButton
          icon="+"
          variant="primary"
          size="md"
          onPress={handleAddProject}
          accessibilityLabel="Add new project"
          accessibilityHint="Opens the create project wizard"
        />
      </View>

      {/* Inline error banner when we have cached data but fetch failed */}
      {error && displayProjects.length > 0 && (
        <ErrorView
          compact
          title="Couldn't refresh"
          message={error}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      )}

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
          accessibilityRole="list"
          accessibilityLabel={`${displayProjects.length} projects`}
        />
      )}
    </SafeAreaView>
  );
}
