import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProjects } from "@/lib/store/hooks";
import { Card, EmptyState, LoadingSpinner, IconButton } from "@/components/ui";
import { colors } from "@/constants/colors";
import type { Project } from "@/types";

const CATEGORY_ICONS: Record<string, string> = {
  fitness: "💪",
  learning: "📚",
  creative: "🎨",
  custom: "✨",
};

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

function ProjectCard({ project, onPress }: ProjectCardProps) {
  const categoryIcon = CATEGORY_ICONS[project.category] || "📁";
  const formattedDate = new Date(project.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card onPress={onPress} className="mb-3">
      <View className="flex-row items-center">
        <View className="w-12 h-12 bg-primary/20 rounded-xl items-center justify-center mr-3">
          <Text className="text-2xl">{categoryIcon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-text-primary text-lg font-semibold" numberOfLines={1}>
            {project.name}
          </Text>
          {project.description ? (
            <Text className="text-text-secondary text-sm mt-0.5" numberOfLines={1}>
              {project.description}
            </Text>
          ) : null}
          <Text className="text-text-secondary text-xs mt-1">
            Updated {formattedDate}
          </Text>
        </View>
        <View className="ml-2">
          <Text className="text-text-secondary text-xl">›</Text>
        </View>
      </View>
    </Card>
  );
}

export default function ProjectsScreen() {
  const { projects, isLoading, refetch } = useProjects();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAddProject = useCallback(() => {
    // TODO: Navigate to create project screen
    console.log("Navigate to create project");
  }, []);

  const handleProjectPress = useCallback((project: Project) => {
    // TODO: Navigate to project detail screen
    console.log("Navigate to project:", project.id);
  }, []);

  const renderProject = useCallback(
    ({ item }: { item: Project }) => (
      <ProjectCard project={item} onPress={() => handleProjectPress(item)} />
    ),
    [handleProjectPress]
  );

  const keyExtractor = useCallback((item: Project) => item.id, []);

  // Show loading spinner on initial load (not during refresh)
  if (isLoading && projects.length === 0 && !refreshing) {
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
      {projects.length === 0 ? (
        <EmptyState
          icon="🚀"
          title="Start your first progress journey"
          description="Create a project to begin tracking your progress with photos, videos, and notes."
          actionLabel="Create Project"
          onAction={handleAddProject}
        />
      ) : (
        <FlatList
          data={projects}
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
