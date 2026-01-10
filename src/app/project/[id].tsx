import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Switch,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton, Button, Card } from "@/components/ui";
import { RecentEntries, ProgressComparison } from "@/components/entry";
import { useProjectsStore, useEntriesStore } from "@/lib/store";
import { colors } from "@/constants/colors";
import type { ProjectCategory } from "@/types";
import type { ProjectStats } from "@/lib/store";

const CATEGORY_GRADIENTS: Record<ProjectCategory, [string, string]> = {
  fitness: ["#f97316", "#dc2626"],
  learning: ["#3b82f6", "#8b5cf6"],
  creative: ["#ec4899", "#f43f5e"],
  custom: ["#6366f1", "#8b5cf6"],
};

const CATEGORY_ICONS: Record<ProjectCategory, string> = {
  fitness: "🏋️",
  learning: "📚",
  creative: "🎨",
  custom: "✨",
};

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  fitness: "Fitness",
  learning: "Learning",
  creative: "Creative",
  custom: "Custom",
};

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return "—";

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

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDaysList(days: string[]): string {
  if (days.length === 7) return "Every day";
  if (days.length === 0) return "";

  const dayLabels: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };

  return days.map((d) => dayLabels[d] || d).join(", ");
}

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <View className="bg-surface rounded-xl p-4 flex-1 min-w-[100px]">
      <Text className="text-2xl mb-2">{icon}</Text>
      <Text className="text-text-primary text-xl font-bold">{value}</Text>
      <Text className="text-text-secondary text-xs mt-1">{label}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Cover Image Skeleton */}
      <View className="aspect-video bg-surface" />

      {/* Content Skeleton */}
      <View className="px-4 py-4">
        <View className="w-48 h-8 bg-surface rounded mb-2" />
        <View className="w-full h-4 bg-surface rounded mb-4" />
        <View className="w-24 h-6 bg-surface rounded-full" />
      </View>

      {/* Stats Skeleton */}
      <View className="px-4 pb-4">
        <View className="w-20 h-3 bg-surface rounded mb-3" />
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1 h-24 bg-surface rounded-xl" />
          <View className="flex-1 h-24 bg-surface rounded-xl" />
          <View className="flex-1 h-24 bg-surface rounded-xl" />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1 h-24 bg-surface rounded-xl" />
          <View className="flex-1 h-24 bg-surface rounded-xl" />
          <View className="flex-1 h-24 bg-surface rounded-xl" />
        </View>
      </View>

      {/* Action Buttons Skeleton */}
      <View className="px-4 pb-4">
        <View className="w-24 h-3 bg-surface rounded mb-3" />
        <View className="w-full h-14 bg-surface rounded-xl mb-3" />
        <View className="flex-row gap-3">
          <View className="flex-1 h-12 bg-surface rounded-xl" />
          <View className="flex-1 h-12 bg-surface rounded-xl" />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    fetchProjectById,
    fetchProjectStats,
    updateProject,
    projectsById,
    projectStats,
  } = useProjectsStore();
  const { fetchEntries, entriesByProject } = useEntriesStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const project = id ? projectsById[id] : null;
  const stats = id ? projectStats[id] : null;
  const entries = id ? entriesByProject[id] ?? [] : [];

  // Get first and latest entries for comparison
  const firstEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const latestEntry = entries.length > 0 ? entries[0] : null;

  const loadProject = useCallback(async () => {
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
        await Promise.all([
          fetchProjectStats(id),
          fetchEntries({ projectId: id }, "desc"),
        ]);
        setReminderEnabled(
          Boolean(fetched.reminderTime && fetched.reminderDays?.length)
        );
      }
    } catch {
      setError("Failed to load project");
    } finally {
      setIsLoading(false);
    }
  }, [id, fetchProjectById, fetchProjectStats, fetchEntries]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProject();
    setIsRefreshing(false);
  };

  const handleBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    router.replace("/");
  };

  const handleEdit = () => {
    router.push(`/project/edit/${id}` as Href);
  };

  const handleAddEntry = () => {
    router.push(`/entry/create?projectId=${id}` as Href);
  };

  const handleViewTimeline = () => {
    router.push(`/project/${id}/timeline` as Href);
  };

  const handleViewReports = () => {
    router.push(`/project/${id}/reports` as Href);
  };

  const handleToggleReminder = async (value: boolean) => {
    if (!project || !id) return;

    setReminderEnabled(value);

    if (!value) {
      // Disable reminders by clearing reminder settings
      try {
        await updateProject(id, {
          reminderTime: undefined,
          reminderDays: undefined,
        });
      } catch {
        // Revert on error
        setReminderEnabled(true);
      }
    } else {
      // Re-enable with default settings if previously cleared
      // For now, just navigate to edit screen to configure
      router.push(`/project/edit/${id}` as Href);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
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
          <Text className="text-5xl mb-4">😕</Text>
          <Text className="text-text-primary text-lg font-semibold text-center mb-2">
            Project Not Found
          </Text>
          <Text className="text-text-secondary text-center mb-6">
            {error || "The project you're looking for doesn't exist."}
          </Text>
          <Button title="Go to Home" onPress={handleGoHome} />
        </View>
      </SafeAreaView>
    );
  }

  const gradientColors = CATEGORY_GRADIENTS[project.category];
  const categoryIcon = CATEGORY_ICONS[project.category];
  const categoryLabel = CATEGORY_LABELS[project.category];

  const hasReminder = Boolean(
    project.reminderTime && project.reminderDays?.length
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero Cover Image with Overlay */}
        <View className="aspect-video relative">
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
              <Text className="text-6xl opacity-50">{categoryIcon}</Text>
            </LinearGradient>
          )}

          {/* Overlay gradient for readability */}
          <LinearGradient
            colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.6)"]}
            locations={[0, 0.4, 1]}
            className="absolute inset-0"
          />

          {/* Back button overlay */}
          <View className="absolute top-4 left-4">
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
            >
              <Text className="text-white text-lg">←</Text>
            </Pressable>
          </View>

          {/* Edit button overlay */}
          <View className="absolute top-4 right-4">
            <Pressable
              onPress={handleEdit}
              className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
            >
              <Text className="text-lg">✏️</Text>
            </Pressable>
          </View>
        </View>

        {/* Project Info */}
        <View className="px-4 py-4">
          {/* Project Name */}
          <Text className="text-text-primary text-2xl font-bold">
            {project.name}
          </Text>

          {/* Description */}
          {project.description && (
            <Text className="text-text-secondary text-base mt-2">
              {project.description}
            </Text>
          )}

          {/* Category Badge */}
          <View className="flex-row items-center mt-3">
            <View className="bg-surface rounded-full px-3 py-1.5 flex-row items-center">
              <Text className="mr-1.5">{categoryIcon}</Text>
              <Text className="text-text-secondary text-sm">{categoryLabel}</Text>
            </View>
          </View>
        </View>

        {/* Statistics Grid */}
        <View className="px-4 pb-4">
          <Text className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium">
            Statistics
          </Text>

          {/* First row: Main stats */}
          <View className="flex-row gap-3 mb-3">
            <StatCard
              icon="📝"
              value={stats?.totalEntries ?? 0}
              label="Total Entries"
            />
            <StatCard
              icon="📅"
              value={stats?.daysSinceStart ?? 0}
              label="Days Active"
            />
            <StatCard
              icon="🔥"
              value={stats?.streakCount ?? 0}
              label="Current Streak"
            />
          </View>

          {/* Second row: Additional stats */}
          <View className="flex-row gap-3">
            <StatCard
              icon="🏆"
              value={stats?.longestStreak ?? 0}
              label="Best Streak"
            />
            <StatCard
              icon="🚀"
              value={formatDate(stats?.firstEntryDate ?? null)}
              label="First Entry"
            />
            <StatCard
              icon="⏱️"
              value={formatRelativeDate(stats?.lastEntryDate ?? null)}
              label="Last Entry"
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 pb-4">
          <Text className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium">
            Quick Actions
          </Text>

          {/* Primary Action - Add Entry */}
          <Pressable
            onPress={handleAddEntry}
            className="bg-primary rounded-xl py-4 flex-row items-center justify-center mb-3 active:opacity-80"
          >
            <Text className="text-xl mr-2">➕</Text>
            <Text className="text-white text-base font-semibold">Add Entry</Text>
          </Pressable>

          {/* Secondary Actions */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleViewTimeline}
              className="flex-1 bg-surface rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
            >
              <Text className="mr-2">📋</Text>
              <Text className="text-text-primary text-sm font-medium">
                Timeline
              </Text>
            </Pressable>

            <Pressable
              onPress={handleViewReports}
              className="flex-1 bg-surface rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
            >
              <Text className="mr-2">📊</Text>
              <Text className="text-text-primary text-sm font-medium">
                Reports
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Entry Preview Section */}
        {entries.length === 0 ? (
          /* Empty State for No Entries */
          <View className="px-4 pb-6">
            <Card className="p-6 items-center">
              <Text className="text-4xl mb-3">🎬</Text>
              <Text className="text-text-primary font-semibold text-center text-lg">
                Record your first entry
              </Text>
              <Text className="text-text-secondary text-sm text-center mt-2 mb-1">
                Small daily records reveal big progress over time
              </Text>
              <View className="flex-row items-center justify-center mt-2 mb-4">
                <Text className="text-text-secondary text-2xl mr-2">↑</Text>
                <Text className="text-text-secondary text-sm italic">
                  Use the Add Entry button above
                </Text>
              </View>
            </Card>
          </View>
        ) : (
          <>
            {/* Recent Entries Section */}
            <RecentEntries
              entries={entries}
              projectId={id!}
              maxEntries={10}
              onSeeAll={handleViewTimeline}
            />

            {/* Progress Comparison Teaser */}
            {firstEntry && latestEntry && entries.length >= 2 && (
              <ProgressComparison
                firstEntry={firstEntry}
                latestEntry={latestEntry}
                projectId={id!}
                onPress={handleViewReports}
              />
            )}
          </>
        )}

        {/* Reminders Section */}
        <View className="px-4 pb-6">
          <Text className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium">
            Reminders
          </Text>

          <Card className="p-4">
            {hasReminder ? (
              <>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-2xl mr-3">🔔</Text>
                    <View className="flex-1">
                      <Text className="text-text-primary font-medium">
                        {project.reminderTime}
                      </Text>
                      <Text className="text-text-secondary text-sm mt-0.5">
                        {formatDaysList(project.reminderDays || [])}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={reminderEnabled}
                    onValueChange={handleToggleReminder}
                    trackColor={{
                      false: colors.surface,
                      true: colors.primary,
                    }}
                    thumbColor={colors.textPrimary}
                  />
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => router.push(`/project/edit/${id}` as Href)}
                className="flex-row items-center"
              >
                <Text className="text-2xl mr-3 opacity-50">🔕</Text>
                <View className="flex-1">
                  <Text className="text-text-secondary">No reminders set</Text>
                  <Text className="text-primary text-sm mt-0.5">
                    Tap to configure
                  </Text>
                </View>
                <Text className="text-text-secondary text-xl">›</Text>
              </Pressable>
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Floating Add Entry Button */}
      {(stats?.totalEntries ?? 0) > 0 && (
        <View className="absolute bottom-6 right-6">
          <Pressable
            onPress={handleAddEntry}
            className="w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg active:opacity-80"
            style={{
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text className="text-white text-2xl">+</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
