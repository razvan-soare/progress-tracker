import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton, LoadingSpinner } from "@/components/ui";
import { useProjectsStore } from "@/lib/store";
import type { Project } from "@/types";

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  fitness: ["#f97316", "#dc2626"],
  learning: ["#3b82f6", "#8b5cf6"],
  creative: ["#ec4899", "#f43f5e"],
  custom: ["#6366f1", "#8b5cf6"],
};

const CATEGORY_ICONS: Record<string, string> = {
  fitness: "🏋️",
  learning: "📚",
  creative: "🎨",
  custom: "✨",
};

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fetchProjectById, fetchProjectStats, projectsById, projectStats } =
    useProjectsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const project = id ? projectsById[id] : null;
  const stats = id ? projectStats[id] : null;

  useEffect(() => {
    async function loadProject() {
      if (!id) {
        setError("Project not found");
        setIsLoading(false);
        return;
      }

      try {
        const fetched = await fetchProjectById(id);
        if (!fetched) {
          setError("Project not found");
        } else {
          await fetchProjectStats(id);
        }
      } catch {
        setError("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [id, fetchProjectById, fetchProjectStats]);

  const handleBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    router.replace("/");
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner message="Loading project..." />
      </SafeAreaView>
    );
  }

  if (error || !project) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <IconButton
            icon="←"
            variant="default"
            size="md"
            onPress={handleGoHome}
            accessibilityLabel="Back to home"
          />
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-text-secondary text-center">
            {error || "Project not found"}
          </Text>
          <Pressable onPress={handleGoHome} className="mt-4">
            <Text className="text-primary font-medium">Go to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const gradientColors = CATEGORY_GRADIENTS[project.category] || CATEGORY_GRADIENTS.custom;
  const categoryIcon = CATEGORY_ICONS[project.category] || CATEGORY_ICONS.custom;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <IconButton
          icon="←"
          variant="default"
          size="md"
          onPress={handleBack}
          accessibilityLabel="Back"
        />
        <Text className="text-lg font-semibold text-text-primary" numberOfLines={1}>
          {project.name}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View className="aspect-video">
          {project.coverImageUri ? (
            <Image
              source={{ uri: project.coverImageUri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="flex-1 items-center justify-center"
            >
              <Text className="text-6xl">{categoryIcon}</Text>
            </LinearGradient>
          )}
        </View>

        {/* Project Info */}
        <View className="px-4 py-4">
          <Text className="text-text-primary text-2xl font-bold">
            {project.name}
          </Text>

          {project.description && (
            <Text className="text-text-secondary text-base mt-2">
              {project.description}
            </Text>
          )}

          {/* Category Badge */}
          <View className="flex-row items-center mt-3">
            <View className="bg-surface rounded-full px-3 py-1 flex-row items-center">
              <Text className="mr-1">{categoryIcon}</Text>
              <Text className="text-text-secondary text-sm capitalize">
                {project.category}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="px-4 pb-4">
          <View className="bg-surface rounded-xl p-4">
            <Text className="text-text-secondary text-xs uppercase tracking-wide mb-3">
              Statistics
            </Text>
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-text-primary text-2xl font-bold">
                  {stats?.totalEntries ?? 0}
                </Text>
                <Text className="text-text-secondary text-xs mt-1">Entries</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-text-primary text-2xl font-bold">
                  {stats?.streakCount ?? 0}
                </Text>
                <Text className="text-text-secondary text-xs mt-1">Day Streak</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-text-primary text-2xl font-bold">
                  {stats?.daysSinceStart ?? 0}
                </Text>
                <Text className="text-text-secondary text-xs mt-1">Days</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Reminders Info */}
        {project.reminderTime && project.reminderDays && project.reminderDays.length > 0 && (
          <View className="px-4 pb-4">
            <View className="bg-surface rounded-xl p-4">
              <Text className="text-text-secondary text-xs uppercase tracking-wide mb-2">
                Reminders
              </Text>
              <Text className="text-text-primary">
                🔔 {project.reminderTime} on {project.reminderDays.join(", ")}
              </Text>
            </View>
          </View>
        )}

        {/* Placeholder for entries */}
        <View className="px-4 pb-6">
          <View className="bg-surface rounded-xl p-6 items-center">
            <Text className="text-4xl mb-2">📝</Text>
            <Text className="text-text-primary font-semibold text-center">
              Start tracking your progress
            </Text>
            <Text className="text-text-secondary text-sm text-center mt-1">
              Add your first entry to begin documenting your journey
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
