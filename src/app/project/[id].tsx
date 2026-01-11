import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Switch,
  RefreshControl,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton, Button, Card, ErrorView, ProjectDetailSkeleton } from "@/components/ui";
import { RecentEntries, ProgressComparison } from "@/components/entry";
import { useProjectsStore, useEntriesStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { useDebouncedPress } from "@/lib/hooks";
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
    Mon: "Mon",
    Tue: "Tue",
    Wed: "Wed",
    Thu: "Thu",
    Fri: "Fri",
    Sat: "Sat",
    Sun: "Sun",
  };

  return days.map((d) => dayLabels[d] || d).join(", ");
}

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  accessibilityLabel?: string;
}

function StatCard({ icon, value, label, accessibilityLabel }: StatCardProps) {
  return (
    <View
      className="bg-surface rounded-xl p-4 flex-1 min-w-[100px]"
      accessibilityLabel={accessibilityLabel || `${label}: ${value}`}
      accessibilityRole="text"
    >
      <Text className="text-2xl mb-2" accessibilityElementsHidden>
        {icon}
      </Text>
      <Text className="text-text-primary text-xl font-bold">{value}</Text>
      <Text className="text-text-secondary text-xs mt-1">{label}</Text>
    </View>
  );
}

function AnimatedFadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY, delay]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showError, showSuccess } = useToast();
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
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const fabScale = useRef(new Animated.Value(0)).current;

  const project = id ? projectsById[id] : null;
  const stats = id ? projectStats[id] : null;
  const entries = id ? entriesByProject[id] ?? [] : [];

  // Get first and latest entries for comparison
  const firstEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const latestEntry = entries.length > 0 ? entries[0] : null;

  const loadProject = useCallback(async () => {
    if (!id) {
      setError("Invalid project ID");
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load project";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [id, fetchProjectById, fetchProjectStats, fetchEntries]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Animate FAB after content loads
  useEffect(() => {
    if (!isLoading && project && (stats?.totalEntries ?? 0) > 0) {
      Animated.spring(fabScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
        delay: 300,
      }).start();
    }
  }, [isLoading, project, stats, fabScale]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    await loadProject();
    setIsRefreshing(false);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await loadProject();
    setIsRetrying(false);
  };

  const handleBack = useDebouncedPress(
    useCallback(() => {
      router.back();
    }, [router]),
    300
  );

  const handleGoHome = useDebouncedPress(
    useCallback(() => {
      router.replace("/");
    }, [router]),
    300
  );

  const handleEdit = useDebouncedPress(
    useCallback(() => {
      router.push(`/project/edit/${id}` as Href);
    }, [router, id]),
    300
  );

  const handleAddEntry = useDebouncedPress(
    useCallback(() => {
      router.push(`/entry/create?projectId=${id}` as Href);
    }, [router, id]),
    300
  );

  const handleViewTimeline = useDebouncedPress(
    useCallback(() => {
      router.push(`/project/${id}/timeline` as Href);
    }, [router, id]),
    300
  );

  const handleViewReports = useDebouncedPress(
    useCallback(() => {
      router.push(`/project/${id}/reports` as Href);
    }, [router, id]),
    300
  );

  const handleToggleReminder = async (value: boolean) => {
    if (!project || !id) return;

    const previousValue = reminderEnabled;
    setReminderEnabled(value);

    if (!value) {
      try {
        await updateProject(id, {
          reminderTime: undefined,
          reminderDays: undefined,
        });
        showSuccess("Reminders disabled");
      } catch {
        setReminderEnabled(previousValue);
        showError("Failed to update reminder settings");
      }
    } else {
      router.push(`/project/edit/${id}` as Href);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ProjectDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !project) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <IconButton
            icon="←"
            variant="default"
            size="md"
            onPress={handleGoHome}
            accessibilityLabel="Back to home"
          />
        </View>
        <ErrorView
          title="Project Not Found"
          message={error || "The project you're looking for doesn't exist or may have been deleted."}
          icon="📂"
          onRetry={error?.includes("Failed") ? handleRetry : undefined}
          isRetrying={isRetrying}
        />
        {!error?.includes("Failed") && (
          <View className="px-4 pb-6">
            <Button
              title="Go to Home"
              onPress={handleGoHome}
              variant="primary"
            />
          </View>
        )}
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
        accessibilityRole="scrollbar"
      >
        {/* Hero Cover Image with Overlay */}
        <View className="aspect-video relative">
          {project.coverImageUri ? (
            <Image
              source={{ uri: project.coverImageUri }}
              className="w-full h-full"
              resizeMode="cover"
              accessibilityLabel={`Cover image for ${project.name}`}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="flex-1 items-center justify-center"
            >
              <Text className="text-6xl opacity-50" accessibilityElementsHidden>
                {categoryIcon}
              </Text>
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
              className="w-11 h-11 bg-black/50 rounded-full items-center justify-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text className="text-white text-lg">←</Text>
            </Pressable>
          </View>

          {/* Edit button overlay */}
          <View className="absolute top-4 right-4">
            <Pressable
              onPress={handleEdit}
              className="w-11 h-11 bg-black/50 rounded-full items-center justify-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Edit project"
            >
              <Text className="text-lg">✏️</Text>
            </Pressable>
          </View>
        </View>

        {/* Project Info */}
        <AnimatedFadeIn>
          <View className="px-4 py-4">
            {/* Project Name */}
            <Text
              className="text-text-primary text-2xl font-bold"
              accessibilityRole="header"
              numberOfLines={2}
              ellipsizeMode="tail"
            >
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
              <View
                className="bg-surface rounded-full px-3 py-1.5 flex-row items-center"
                accessibilityLabel={`Category: ${categoryLabel}`}
              >
                <Text className="mr-1.5" accessibilityElementsHidden>
                  {categoryIcon}
                </Text>
                <Text className="text-text-secondary text-sm">{categoryLabel}</Text>
              </View>
            </View>
          </View>
        </AnimatedFadeIn>

        {/* Statistics Grid */}
        <AnimatedFadeIn delay={50}>
          <View className="px-4 pb-4">
            <Text
              className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium"
              accessibilityRole="header"
            >
              Statistics
            </Text>

            {/* First row: Main stats */}
            <View className="flex-row gap-3 mb-3">
              <StatCard
                icon="📝"
                value={stats?.totalEntries ?? 0}
                label="Total Entries"
                accessibilityLabel={`${stats?.totalEntries ?? 0} total entries`}
              />
              <StatCard
                icon="📅"
                value={stats?.daysSinceStart ?? 0}
                label="Days Active"
                accessibilityLabel={`${stats?.daysSinceStart ?? 0} days active`}
              />
              <StatCard
                icon="🔥"
                value={stats?.streakCount ?? 0}
                label="Current Streak"
                accessibilityLabel={`Current streak: ${stats?.streakCount ?? 0} days`}
              />
            </View>

            {/* Second row: Additional stats */}
            <View className="flex-row gap-3">
              <StatCard
                icon="🏆"
                value={stats?.longestStreak ?? 0}
                label="Best Streak"
                accessibilityLabel={`Best streak: ${stats?.longestStreak ?? 0} days`}
              />
              <StatCard
                icon="🚀"
                value={formatDate(stats?.firstEntryDate ?? null)}
                label="First Entry"
                accessibilityLabel={`First entry: ${formatDate(stats?.firstEntryDate ?? null)}`}
              />
              <StatCard
                icon="⏱️"
                value={formatRelativeDate(stats?.lastEntryDate ?? null)}
                label="Last Entry"
                accessibilityLabel={`Last entry: ${formatRelativeDate(stats?.lastEntryDate ?? null)}`}
              />
            </View>
          </View>
        </AnimatedFadeIn>

        {/* Quick Actions */}
        <AnimatedFadeIn delay={100}>
          <View className="px-4 pb-4">
            <Text
              className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium"
              accessibilityRole="header"
            >
              Quick Actions
            </Text>

            {/* Primary Action - Add Entry */}
            <Pressable
              onPress={handleAddEntry}
              className="bg-primary rounded-xl py-4 flex-row items-center justify-center mb-3 active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Add a new entry"
              accessibilityHint="Opens the entry creation screen"
              style={{ minHeight: 56 }}
            >
              <Text className="text-xl mr-2" accessibilityElementsHidden>
                ➕
              </Text>
              <Text className="text-white text-base font-semibold">Add Entry</Text>
            </Pressable>

            {/* Secondary Actions */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={handleViewTimeline}
                className="flex-1 bg-surface rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel="View timeline"
                style={{ minHeight: 48 }}
              >
                <Text className="mr-2" accessibilityElementsHidden>
                  📋
                </Text>
                <Text className="text-text-primary text-sm font-medium">
                  Timeline
                </Text>
              </Pressable>

              <Pressable
                onPress={handleViewReports}
                className="flex-1 bg-surface rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel="View reports"
                style={{ minHeight: 48 }}
              >
                <Text className="mr-2" accessibilityElementsHidden>
                  📊
                </Text>
                <Text className="text-text-primary text-sm font-medium">
                  Reports
                </Text>
              </Pressable>
            </View>
          </View>
        </AnimatedFadeIn>

        {/* Entry Preview Section */}
        <AnimatedFadeIn delay={150}>
          {entries.length === 0 ? (
            /* Empty State for No Entries */
            <View className="px-4 pb-6">
              <Card className="p-6 items-center">
                <Text className="text-4xl mb-3" accessibilityElementsHidden>
                  🎬
                </Text>
                <Text
                  className="text-text-primary font-semibold text-center text-lg"
                  accessibilityRole="header"
                >
                  Record your first entry
                </Text>
                <Text className="text-text-secondary text-sm text-center mt-2 mb-1">
                  Small daily records reveal big progress over time
                </Text>
                <View
                  className="flex-row items-center justify-center mt-2 mb-4"
                  accessibilityElementsHidden
                >
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
        </AnimatedFadeIn>

        {/* Reminders Section */}
        <AnimatedFadeIn delay={200}>
          <View className="px-4 pb-6">
            <Text
              className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium"
              accessibilityRole="header"
            >
              Reminders
            </Text>

            <Card className="p-4">
              {hasReminder ? (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-2xl mr-3" accessibilityElementsHidden>
                      🔔
                    </Text>
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
                    accessibilityLabel={`Reminders ${reminderEnabled ? "enabled" : "disabled"}`}
                    accessibilityHint="Toggle to enable or disable reminders"
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push(`/project/edit/${id}` as Href)}
                  className="flex-row items-center active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel="Set up reminders"
                  accessibilityHint="Opens project edit screen to configure reminders"
                  style={{ minHeight: 44 }}
                >
                  <Text className="text-2xl mr-3 opacity-50" accessibilityElementsHidden>
                    🔕
                  </Text>
                  <View className="flex-1">
                    <Text className="text-text-secondary">No reminders set</Text>
                    <Text className="text-primary text-sm mt-0.5">
                      Tap to configure
                    </Text>
                  </View>
                  <Text className="text-text-secondary text-xl" accessibilityElementsHidden>
                    ›
                  </Text>
                </Pressable>
              )}
            </Card>
          </View>
        </AnimatedFadeIn>
      </ScrollView>

      {/* Floating Add Entry Button */}
      {(stats?.totalEntries ?? 0) > 0 && (
        <Animated.View
          className="absolute bottom-6 right-6"
          style={{ transform: [{ scale: fabScale }] }}
        >
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
            accessibilityRole="button"
            accessibilityLabel="Add entry"
            accessibilityHint="Opens entry creation screen"
          >
            <Text className="text-white text-2xl">+</Text>
          </Pressable>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
