import { useRef, useCallback } from "react";
import { View, Text, Image, Pressable, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Project, ProjectCategory } from "@/types";

const CATEGORY_ICONS: Record<ProjectCategory, string> = {
  fitness: "💪",
  learning: "📚",
  creative: "🎨",
  custom: "✨",
};

const CATEGORY_GRADIENTS: Record<ProjectCategory, [string, string]> = {
  fitness: ["#ef4444", "#f97316"],
  learning: ["#3b82f6", "#6366f1"],
  creative: ["#ec4899", "#a855f7"],
  custom: ["#6366f1", "#8b5cf6"],
};

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  fitness: "Fitness",
  learning: "Learning",
  creative: "Creative",
  custom: "Custom",
};

export interface ProjectCardProps {
  project: Project;
  entryCount: number;
  lastEntryDate?: string;
  currentStreak?: number;
  hasPendingUploads?: boolean;
  onPress: () => void;
}

function formatRelativeDate(dateString: string | undefined): string {
  if (!dateString) return "No entries yet";

  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function calculateDaysSinceStart(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

export function ProjectCard({
  project,
  entryCount,
  lastEntryDate,
  currentStreak = 0,
  hasPendingUploads = false,
  onPress,
}: ProjectCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const categoryIcon = CATEGORY_ICONS[project.category] || "📁";
  const categoryLabel = CATEGORY_LABELS[project.category] || "Custom";
  const gradientColors = CATEGORY_GRADIENTS[project.category] || CATEGORY_GRADIENTS.custom;
  const daysSinceStart = calculateDaysSinceStart(project.startDate);
  const relativeLastEntry = formatRelativeDate(lastEntryDate);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [scaleAnim]);

  // Build accessibility label
  const accessibilityLabel = `${project.name}, ${categoryLabel} project, ${entryCount} ${entryCount === 1 ? "entry" : "entries"}, ${daysSinceStart} days active${currentStreak > 0 ? `, ${currentStreak} day streak` : ""}, last entry ${relativeLastEntry}${hasPendingUploads ? ", has pending uploads" : ""}`;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double tap to view project details"
    >
      <Animated.View
        className="mb-3 rounded-xl overflow-hidden"
        style={{ transform: [{ scale: scaleAnim }] }}
      >
        {/* Cover Image or Gradient Placeholder */}
        <View className="h-32 relative">
          {project.coverImageUri ? (
            <Image
              source={{ uri: project.coverImageUri }}
              className="w-full h-full"
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-full h-full items-center justify-center"
            >
              <Text className="text-5xl opacity-30" accessibilityElementsHidden>
                {categoryIcon}
              </Text>
            </LinearGradient>
          )}

          {/* Overlay gradient for text readability */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            className="absolute inset-0"
          />

          {/* Category Badge */}
          <View className="absolute top-3 left-3" accessibilityElementsHidden>
            <View className="bg-black/50 px-2 py-1 rounded-full flex-row items-center">
              <Text className="text-xs mr-1">{categoryIcon}</Text>
              <Text className="text-text-primary text-xs font-medium">
                {categoryLabel}
              </Text>
            </View>
          </View>

          {/* Pending Uploads Indicator */}
          {hasPendingUploads && (
            <View
              className="absolute top-3 right-3"
              accessibilityLabel="Has pending uploads"
            >
              <View className="bg-warning/80 px-2 py-1 rounded-full">
                <Text className="text-xs">🔄</Text>
              </View>
            </View>
          )}

          {/* Project Name */}
          <View className="absolute bottom-3 left-3 right-3">
            <Text
              className="text-text-primary text-xl font-bold"
              numberOfLines={1}
              ellipsizeMode="tail"
              accessibilityRole="header"
            >
              {project.name}
            </Text>
          </View>
        </View>

        {/* Stats Section */}
        <View className="bg-surface px-3 py-3">
          {/* Quick Stats Row */}
          <View
            className="flex-row items-center justify-between mb-2"
            accessibilityElementsHidden
          >
            <View className="flex-row items-center">
              <StatItem icon="📝" value={entryCount} label="entries" />
              <View className="w-px h-4 bg-border mx-3" />
              <StatItem icon="📅" value={daysSinceStart} label="days" />
              {currentStreak > 0 && (
                <>
                  <View className="w-px h-4 bg-border mx-3" />
                  <StatItem icon="🔥" value={currentStreak} label="streak" />
                </>
              )}
            </View>
          </View>

          {/* Last Entry Date */}
          <View
            className="flex-row items-center justify-between"
            accessibilityElementsHidden
          >
            <Text className="text-text-secondary text-xs">
              Last entry: {relativeLastEntry}
            </Text>
            <Text className="text-text-secondary text-xl">›</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

interface StatItemProps {
  icon: string;
  value: number;
  label: string;
}

function StatItem({ icon, value, label }: StatItemProps) {
  return (
    <View className="flex-row items-center">
      <Text className="text-sm mr-1">{icon}</Text>
      <Text className="text-text-primary text-sm font-semibold">{value}</Text>
      <Text className="text-text-secondary text-xs ml-1">{label}</Text>
    </View>
  );
}
