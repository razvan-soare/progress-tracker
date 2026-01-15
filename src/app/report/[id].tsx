import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Animated,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton, ErrorView, Skeleton } from "@/components/ui";
import { useReport, useEntry, useProject } from "@/lib/store/hooks";
import { colors } from "@/constants/colors";
import type { Entry, Report } from "@/types";

function formatMonthName(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(year, monthNum - 1, 1);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDateRange(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNum - 1, 1);
  const lastDay = new Date(year, monthNum, 0);

  const formatOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };

  return `${firstDay.toLocaleDateString("en-US", formatOptions)} - ${lastDay.toLocaleDateString("en-US", formatOptions)}, ${year}`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatShortDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getDayNumber(entry: Entry, month: string): number {
  const entryDate = new Date(entry.createdAt);
  const [year, monthNum] = month.split("-").map(Number);
  const firstDayOfMonth = new Date(year, monthNum - 1, 1);

  const diffTime = entryDate.getTime() - firstDayOfMonth.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(1, diffDays);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
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

function ReportDetailSkeleton() {
  return (
    <View className="flex-1 bg-background px-4 pt-4">
      {/* Header skeleton */}
      <View className="items-center mb-6">
        <Skeleton width={200} height={28} style={{ marginBottom: 8 }} />
        <Skeleton width={160} height={16} />
      </View>

      {/* Comparison skeleton */}
      <View className="flex-row gap-4 mb-6">
        <View className="flex-1">
          <Skeleton width="100%" height={160} borderRadius={12} style={{ marginBottom: 8 }} />
          <Skeleton width={60} height={14} style={{ alignSelf: "center" }} />
        </View>
        <View className="flex-1">
          <Skeleton width="100%" height={160} borderRadius={12} style={{ marginBottom: 8 }} />
          <Skeleton width={60} height={14} style={{ alignSelf: "center" }} />
        </View>
      </View>

      {/* Stats skeleton */}
      <Skeleton width={100} height={14} style={{ marginBottom: 12 }} />
      <View className="flex-row gap-3">
        <Skeleton width="30%" height={80} borderRadius={12} />
        <Skeleton width="30%" height={80} borderRadius={12} />
        <Skeleton width="30%" height={80} borderRadius={12} />
      </View>
    </View>
  );
}

interface EntryPreviewProps {
  entry: Entry | null;
  label: string;
  onPress?: () => void;
  isDeleted?: boolean;
}

function EntryPreview({ entry, label, onPress, isDeleted }: EntryPreviewProps) {
  const renderContent = () => {
    if (isDeleted || !entry) {
      return (
        <View className="w-full h-full bg-surface items-center justify-center">
          <Text className="text-3xl opacity-30 mb-2">🗑️</Text>
          <Text className="text-text-secondary text-xs text-center px-2">
            Entry deleted
          </Text>
        </View>
      );
    }

    switch (entry.entryType) {
      case "video":
        return (
          <View className="w-full h-full relative">
            {entry.thumbnailUri ? (
              <Image
                source={{ uri: entry.thumbnailUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : entry.mediaUri ? (
              <Image
                source={{ uri: entry.mediaUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={["#3b82f6", "#6366f1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="w-full h-full items-center justify-center"
              >
                <Text className="text-4xl opacity-50">🎬</Text>
              </LinearGradient>
            )}
            {/* Play icon overlay */}
            <View className="absolute inset-0 items-center justify-center">
              <View className="w-12 h-12 bg-black/60 rounded-full items-center justify-center">
                <Text className="text-white text-lg ml-1">▶</Text>
              </View>
            </View>
            {/* Duration badge */}
            {entry.durationSeconds && (
              <View className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded">
                <Text className="text-white text-xs font-medium">
                  {formatShortDuration(entry.durationSeconds)}
                </Text>
              </View>
            )}
          </View>
        );

      case "photo":
        return entry.thumbnailUri || entry.mediaUri ? (
          <Image
            source={{ uri: entry.thumbnailUri || entry.mediaUri }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={["#ec4899", "#f43f5e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="w-full h-full items-center justify-center"
          >
            <Text className="text-4xl opacity-50">📷</Text>
          </LinearGradient>
        );

      case "text":
        return (
          <View className="w-full h-full bg-surface p-3">
            <View className="flex-row items-center mb-2">
              <Text className="text-lg">📝</Text>
            </View>
            {entry.contentText ? (
              <Text
                className="text-text-secondary text-sm leading-5"
                numberOfLines={5}
              >
                {truncateText(entry.contentText, 120)}
              </Text>
            ) : (
              <Text className="text-text-secondary text-sm italic opacity-50">
                Empty note
              </Text>
            )}
          </View>
        );

      default:
        return (
          <View className="w-full h-full bg-surface items-center justify-center">
            <Text className="text-3xl opacity-50">📄</Text>
          </View>
        );
    }
  };

  const isDisabled = isDeleted || !entry;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      className={`flex-1 ${isDisabled ? "opacity-60" : "active:opacity-80 active:scale-[0.98]"}`}
      accessibilityRole={isDisabled ? "text" : "button"}
      accessibilityLabel={
        isDeleted || !entry
          ? `${label} - Entry was deleted`
          : `${label} - ${entry.entryType} entry. Tap to view`
      }
      accessibilityHint={isDisabled ? undefined : "Opens the full entry viewer"}
    >
      <View className="rounded-xl overflow-hidden bg-surface aspect-square">
        {renderContent()}
      </View>
      <Text className="text-text-secondary text-sm text-center mt-2 font-medium">
        {label}
      </Text>
    </Pressable>
  );
}

interface StatItemProps {
  icon: string;
  value: string | number;
  label: string;
  subLabel?: string;
}

function StatItem({ icon, value, label, subLabel }: StatItemProps) {
  return (
    <View
      className="bg-surface rounded-xl p-4 flex-1"
      accessibilityLabel={`${label}: ${value}${subLabel ? `, ${subLabel}` : ""}`}
      accessibilityRole="text"
    >
      <Text className="text-2xl mb-2" accessibilityElementsHidden>
        {icon}
      </Text>
      <Text className="text-text-primary text-xl font-bold">{value}</Text>
      <Text className="text-text-secondary text-xs mt-1">{label}</Text>
      {subLabel && (
        <Text className="text-text-secondary text-xs opacity-70">{subLabel}</Text>
      )}
    </View>
  );
}

interface EntryBreakdownProps {
  videos: number;
  photos: number;
  textEntries: number;
}

function EntryBreakdown({ videos, photos, textEntries }: EntryBreakdownProps) {
  return (
    <View className="flex-row items-center gap-2 flex-wrap">
      {videos > 0 && (
        <View className="flex-row items-center bg-primary/20 px-2 py-1 rounded-full">
          <Text className="text-primary text-xs mr-1" accessibilityElementsHidden>
            🎬
          </Text>
          <Text className="text-primary text-xs font-medium">
            {videos} {videos === 1 ? "video" : "videos"}
          </Text>
        </View>
      )}
      {photos > 0 && (
        <View className="flex-row items-center bg-success/20 px-2 py-1 rounded-full">
          <Text className="text-success text-xs mr-1" accessibilityElementsHidden>
            📷
          </Text>
          <Text className="text-success text-xs font-medium">
            {photos} {photos === 1 ? "photo" : "photos"}
          </Text>
        </View>
      )}
      {textEntries > 0 && (
        <View className="flex-row items-center bg-warning/20 px-2 py-1 rounded-full">
          <Text className="text-warning text-xs mr-1" accessibilityElementsHidden>
            📝
          </Text>
          <Text className="text-warning text-xs font-medium">
            {textEntries} {textEntries === 1 ? "note" : "notes"}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ReportDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { report, isLoading: reportLoading, error: reportError, refetch: refetchReport } = useReport(id);
  const { entry: firstEntry, isLoading: firstLoading } = useEntry(report?.firstEntryId);
  const { entry: lastEntry, isLoading: lastLoading } = useEntry(report?.lastEntryId);
  const { project, isLoading: projectLoading } = useProject(report?.projectId);

  const [refreshing, setRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isLoading = reportLoading || firstLoading || lastLoading || projectLoading;

  // Check if entries were deleted (ID exists but entry not found after loading)
  const firstEntryDeleted = report?.firstEntryId && !firstLoading && !firstEntry;
  const lastEntryDeleted = report?.lastEntryId && !lastLoading && !lastEntry;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchReport();
    setRefreshing(false);
  }, [refetchReport]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await refetchReport();
    setIsRetrying(false);
  }, [refetchReport]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleViewEntry = useCallback((entryId: string) => {
    router.push(`/entry/view/${entryId}` as Href);
  }, [router]);

  // Calculate days active - count unique days with entries
  const getDaysActive = (report: Report): number => {
    // If entryIds is available, we could calculate unique days
    // For now, use a simple approximation based on totalEntries
    // Assume roughly 1 entry per active day as an estimate
    return Math.min(report.totalEntries, 30);
  };

  if (isLoading && !report && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <IconButton
            icon="←"
            variant="default"
            size="md"
            onPress={handleBack}
            accessibilityLabel="Go back"
          />
          <View className="flex-1 ml-3">
            <Skeleton width={120} height={20} />
          </View>
        </View>
        <ReportDetailSkeleton />
      </SafeAreaView>
    );
  }

  if ((reportError || !report) && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <IconButton
            icon="←"
            variant="default"
            size="md"
            onPress={handleBack}
            accessibilityLabel="Go back"
          />
          <Text
            className="text-text-primary text-lg font-semibold ml-3 flex-1"
            numberOfLines={1}
          >
            Report
          </Text>
        </View>
        <ErrorView
          title="Report Not Found"
          message={reportError || "The report you're looking for doesn't exist or may have been deleted."}
          icon="📊"
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      </SafeAreaView>
    );
  }

  const firstDayLabel = firstEntry
    ? `Day ${getDayNumber(firstEntry, report!.month)}`
    : "Day 1";

  const lastDayLabel = lastEntry
    ? `Day ${getDayNumber(lastEntry, report!.month)}`
    : report?.totalEntries
    ? `Day ${report.totalEntries}`
    : "Last Day";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <IconButton
          icon="←"
          variant="default"
          size="md"
          onPress={handleBack}
          accessibilityLabel="Go back"
        />
        <Text
          className="text-text-primary text-lg font-semibold ml-3 flex-1"
          numberOfLines={1}
          accessibilityRole="header"
        >
          {project?.name ? `${project.name}` : "Report"}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        accessibilityRole="scrollbar"
      >
        {/* Month Header */}
        <AnimatedFadeIn>
          <View className="items-center pt-6 pb-4 px-4">
            <Text
              className="text-text-primary text-2xl font-bold text-center"
              accessibilityRole="header"
            >
              {formatMonthName(report!.month)}
            </Text>
            <Text className="text-text-secondary text-sm mt-1">
              {formatDateRange(report!.month)}
            </Text>
            {project?.name && (
              <View className="mt-2 bg-surface px-3 py-1 rounded-full">
                <Text className="text-text-secondary text-xs">
                  {project.name}
                </Text>
              </View>
            )}
          </View>
        </AnimatedFadeIn>

        {/* Side-by-Side Comparison */}
        <AnimatedFadeIn delay={50}>
          <View className="px-4 pb-6">
            <Text
              className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium"
              accessibilityRole="header"
            >
              Progress Comparison
            </Text>

            <View className="flex-row gap-4">
              <EntryPreview
                entry={firstEntry}
                label={firstDayLabel}
                onPress={firstEntry ? () => handleViewEntry(firstEntry.id) : undefined}
                isDeleted={Boolean(firstEntryDeleted)}
              />

              {/* Arrow between entries */}
              <View className="justify-center items-center px-1">
                <Text className="text-text-secondary text-2xl">→</Text>
              </View>

              <EntryPreview
                entry={lastEntry}
                label={lastDayLabel}
                onPress={lastEntry ? () => handleViewEntry(lastEntry.id) : undefined}
                isDeleted={Boolean(lastEntryDeleted)}
              />
            </View>
          </View>
        </AnimatedFadeIn>

        {/* Statistics Section */}
        <AnimatedFadeIn delay={100}>
          <View className="px-4 pb-4">
            <Text
              className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium"
              accessibilityRole="header"
            >
              Monthly Statistics
            </Text>

            {/* Total Entries with Breakdown */}
            <View className="bg-surface rounded-xl p-4 mb-3">
              <View className="flex-row items-center mb-2">
                <Text className="text-2xl mr-3" accessibilityElementsHidden>
                  📊
                </Text>
                <View className="flex-1">
                  <Text className="text-text-primary text-xl font-bold">
                    {report!.totalEntries}
                  </Text>
                  <Text className="text-text-secondary text-sm">
                    Total Entries
                  </Text>
                </View>
              </View>
              <EntryBreakdown
                videos={report!.totalVideos}
                photos={report!.totalPhotos}
                textEntries={report!.totalTextEntries}
              />
            </View>

            {/* Duration and Days Active */}
            <View className="flex-row gap-3">
              <StatItem
                icon="⏱️"
                value={formatDuration(report!.totalDurationSeconds)}
                label="Total Duration"
                subLabel="Video time"
              />
              <StatItem
                icon="📅"
                value={getDaysActive(report!)}
                label="Days Active"
                subLabel="This month"
              />
            </View>
          </View>
        </AnimatedFadeIn>

        {/* Summary Section (if available) */}
        {report?.summaryText && (
          <AnimatedFadeIn delay={150}>
            <View className="px-4 pb-4">
              <Text
                className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium"
                accessibilityRole="header"
              >
                Summary
              </Text>
              <View className="bg-surface rounded-xl p-4">
                <Text className="text-text-primary text-base leading-6">
                  {report.summaryText}
                </Text>
              </View>
            </View>
          </AnimatedFadeIn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
