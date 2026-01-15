import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { useProject, useReports } from "@/lib/store/hooks";
import { EmptyState, IconButton, ErrorView, Skeleton, Button } from "@/components/ui";
import { colors } from "@/constants/colors";
import { generateMonthlyReport } from "@/lib/reports";
import type { Report } from "@/types";

function formatMonthName(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(year, monthNum - 1, 1);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatGeneratedDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function ReportCardSkeleton() {
  return (
    <View className="bg-surface rounded-xl p-4 mb-3">
      <Skeleton width="60%" height={20} style={{ marginBottom: 12 }} />
      <View className="flex-row items-center mb-3">
        <Skeleton width={80} height={14} />
        <View className="w-px h-4 bg-border mx-3" />
        <Skeleton width={60} height={14} />
      </View>
      <View className="flex-row items-center gap-2 mb-3">
        <Skeleton width={50} height={24} borderRadius={12} />
        <Skeleton width={50} height={24} borderRadius={12} />
        <Skeleton width={50} height={24} borderRadius={12} />
      </View>
      <Skeleton width={120} height={12} />
    </View>
  );
}

function ReportListSkeleton() {
  return (
    <View className="flex-1 bg-background px-4 pt-4">
      <ReportCardSkeleton />
      <ReportCardSkeleton />
      <ReportCardSkeleton />
    </View>
  );
}

interface ReportCardProps {
  report: Report;
  onPress: () => void;
  index: number;
}

function ReportCard({ report, onPress, index }: ReportCardProps) {
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
      <Pressable
        onPress={onPress}
        className="bg-surface rounded-xl p-4 mb-3 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`Report for ${formatMonthName(report.month)}, ${report.totalEntries} entries`}
        accessibilityHint="Opens detailed report view"
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text-primary text-lg font-semibold flex-1">
            {formatMonthName(report.month)}
          </Text>
          <Text className="text-text-secondary text-lg ml-2">&rsaquo;</Text>
        </View>

        <View className="flex-row items-center mb-3">
          <Text className="text-text-primary font-medium">
            {report.totalEntries} {report.totalEntries === 1 ? "entry" : "entries"}
          </Text>
        </View>

        <View className="flex-row items-center gap-2 mb-3 flex-wrap">
          {report.totalVideos > 0 && (
            <View className="flex-row items-center bg-primary/20 px-2 py-1 rounded-full">
              <Text className="text-primary text-xs mr-1" accessibilityElementsHidden>
                🎬
              </Text>
              <Text className="text-primary text-xs font-medium">
                {report.totalVideos} {report.totalVideos === 1 ? "video" : "videos"}
              </Text>
            </View>
          )}
          {report.totalPhotos > 0 && (
            <View className="flex-row items-center bg-success/20 px-2 py-1 rounded-full">
              <Text className="text-success text-xs mr-1" accessibilityElementsHidden>
                📷
              </Text>
              <Text className="text-success text-xs font-medium">
                {report.totalPhotos} {report.totalPhotos === 1 ? "photo" : "photos"}
              </Text>
            </View>
          )}
          {report.totalTextEntries > 0 && (
            <View className="flex-row items-center bg-warning/20 px-2 py-1 rounded-full">
              <Text className="text-warning text-xs mr-1" accessibilityElementsHidden>
                📝
              </Text>
              <Text className="text-warning text-xs font-medium">
                {report.totalTextEntries} {report.totalTextEntries === 1 ? "note" : "notes"}
              </Text>
            </View>
          )}
        </View>

        <Text className="text-text-secondary text-xs">
          Generated {formatGeneratedDate(report.generatedAt)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function ReportListScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { project, isLoading: projectLoading } = useProject(projectId);
  const { reports, isLoading: reportsLoading, error, refetch } = useReports(projectId);

  const [refreshing, setRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const isLoading = projectLoading || reportsLoading;

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => b.month.localeCompare(a.month));
  }, [reports]);

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

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleReportPress = useCallback(
    (reportId: string) => {
      router.push(`/report/${reportId}` as Href);
    },
    [router]
  );

  const handleGenerateReport = useCallback(async () => {
    if (!projectId) return;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const currentMonth = getCurrentMonth();
      const result = await generateMonthlyReport(projectId, currentMonth, {
        skipEmpty: false,
        overwrite: true,
      });

      if (result.success) {
        await refetch();
        if (result.reportId) {
          router.push(`/report/${result.reportId}` as Href);
        }
      } else {
        setGenerateError(result.reason || "Failed to generate report");
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, refetch, router]);

  const renderItem = useCallback(
    ({ item, index }: { item: Report; index: number }) => (
      <ReportCard
        report={item}
        onPress={() => handleReportPress(item.id)}
        index={index}
      />
    ),
    [handleReportPress]
  );

  const keyExtractor = useCallback((item: Report) => item.id, []);

  const ListHeaderComponent = useCallback(() => (
    <View className="mb-4">
      <Button
        title={isGenerating ? "Generating..." : "Generate Report for This Month"}
        onPress={handleGenerateReport}
        loading={isGenerating}
        disabled={isGenerating}
        accessibilityLabel="Generate report for current month"
        accessibilityHint="Creates a new monthly report with all entries from this month"
      />
      {generateError && (
        <Text className="text-error text-sm mt-2 text-center">
          {generateError}
        </Text>
      )}
    </View>
  ), [isGenerating, handleGenerateReport, generateError]);

  if (isLoading && reports.length === 0 && !refreshing) {
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
        <ReportListSkeleton />
      </SafeAreaView>
    );
  }

  if (error && reports.length === 0) {
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
            Reports
          </Text>
        </View>
        <ErrorView
          title="Failed to load reports"
          message={error}
          icon="📊"
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      </SafeAreaView>
    );
  }

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
          accessibilityRole="header"
        >
          {project?.name ? `${project.name} Reports` : "Reports"}
        </Text>
      </View>

      {error && reports.length > 0 && (
        <ErrorView
          compact
          title="Couldn't refresh"
          message={error}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      )}

      {reports.length === 0 ? (
        <View className="flex-1">
          <View className="px-4 pt-4">
            <Button
              title={isGenerating ? "Generating..." : "Generate Report for This Month"}
              onPress={handleGenerateReport}
              loading={isGenerating}
              disabled={isGenerating}
              accessibilityLabel="Generate report for current month"
              accessibilityHint="Creates a new monthly report with all entries from this month"
            />
            {generateError && (
              <Text className="text-error text-sm mt-2 text-center">
                {generateError}
              </Text>
            )}
          </View>
          <EmptyState
            icon="📊"
            title="No reports yet"
            description="Generate your first monthly report to track your progress over time."
          />
        </View>
      ) : (
        <FlatList
          data={sortedReports}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeaderComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          accessibilityRole="list"
          accessibilityLabel={`Reports list with ${sortedReports.length} reports`}
        />
      )}
    </SafeAreaView>
  );
}
