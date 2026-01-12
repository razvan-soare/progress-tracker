import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { useProject, useEntries } from "@/lib/store/hooks";
import { EmptyState, IconButton, ErrorView, Skeleton } from "@/components/ui";
import { EntryThumbnail } from "@/components/entry";
import { EntryTypeFilter, FilterOption } from "@/components/timeline";
import { CalendarView } from "@/components/calendar";
import { colors } from "@/constants/colors";
import type { Entry } from "@/types";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ViewMode = "list" | "calendar";

interface DateSection {
  title: string;
  dateKey: string;
  data: Entry[];
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (entryDate.getTime() === today.getTime()) {
    return "Today";
  }
  if (entryDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDateKey(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function groupEntriesByDate(entries: Entry[]): DateSection[] {
  const groups: Record<string, Entry[]> = {};

  entries.forEach((entry) => {
    const dateKey = getDateKey(entry.createdAt);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(entry);
  });

  // Sort by date descending (newest first)
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((dateKey) => ({
    title: formatDateHeader(groups[dateKey][0].createdAt),
    dateKey,
    data: groups[dateKey],
  }));
}

function TimelineEntrySkeleton() {
  return (
    <View className="flex-row items-center px-4 py-3 gap-3">
      <Skeleton width={80} height={80} borderRadius={8} />
      <View className="flex-1">
        <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

function TimelineSkeleton() {
  return (
    <View className="flex-1 bg-background">
      {/* Header skeleton */}
      <View className="px-4 py-3">
        <Skeleton width="50%" height={20} />
      </View>
      {/* Entry skeletons */}
      <TimelineEntrySkeleton />
      <TimelineEntrySkeleton />
      <TimelineEntrySkeleton />
      <View className="px-4 py-3 mt-4">
        <Skeleton width="40%" height={20} />
      </View>
      <TimelineEntrySkeleton />
      <TimelineEntrySkeleton />
    </View>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  video: "Video",
  photo: "Photo",
  text: "Note",
};

interface TimelineEntryItemProps {
  entry: Entry;
  onPress: () => void;
  index: number;
}

function TimelineEntryItem({ entry, onPress, index }: TimelineEntryItemProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        delay: index * 30,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 250,
        delay: index * 30,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateX, index]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateX }],
      }}
    >
      <Pressable
        onPress={onPress}
        className="flex-row items-center px-4 py-3 active:bg-surface/50"
        accessibilityRole="button"
        accessibilityLabel={`${ENTRY_TYPE_LABELS[entry.entryType] || "Entry"} from ${formatTime(entry.createdAt)}`}
      >
        <EntryThumbnail entry={entry} size="small" showDate={false} />
        <View className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text className="text-text-primary font-medium">
              {ENTRY_TYPE_LABELS[entry.entryType] || "Entry"}
            </Text>
            {entry.contentText && entry.entryType === "text" && (
              <Text
                className="text-text-secondary text-sm ml-2 flex-1"
                numberOfLines={1}
              >
                {entry.contentText}
              </Text>
            )}
          </View>
          <Text className="text-text-secondary text-sm mt-1">
            {formatTime(entry.createdAt)}
          </Text>
        </View>
        <Text className="text-text-secondary text-lg ml-2">›</Text>
      </Pressable>
    </Animated.View>
  );
}

// Labels for empty state messages
const FILTER_TYPE_LABELS: Record<FilterOption, string> = {
  all: "entries",
  video: "video",
  photo: "photo",
  text: "note",
};

interface ViewToggleProps {
  viewMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
}

function ViewToggle({ viewMode, onToggle }: ViewToggleProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View
      className="flex-row bg-surface rounded-lg overflow-hidden"
      style={{ transform: [{ scale: scaleAnim }] }}
    >
      <Pressable
        onPress={() => onToggle("list")}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={`px-3 py-2 ${viewMode === "list" ? "bg-primary" : ""}`}
        accessibilityRole="button"
        accessibilityLabel="List view"
        accessibilityState={{ selected: viewMode === "list" }}
      >
        <Text
          className={`text-sm ${viewMode === "list" ? "text-white" : "text-text-secondary"}`}
        >
          ☰
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onToggle("calendar")}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={`px-3 py-2 ${viewMode === "calendar" ? "bg-primary" : ""}`}
        accessibilityRole="button"
        accessibilityLabel="Calendar view"
        accessibilityState={{ selected: viewMode === "calendar" }}
      >
        <Text
          className={`text-sm ${viewMode === "calendar" ? "text-white" : "text-text-secondary"}`}
        >
          📅
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function TimelineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project, isLoading: projectLoading } = useProject(id);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Filter state - persists during session (memory only, resets on exit)
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  // Fetch all entries (unfiltered) to get accurate statistics
  const {
    entries: allEntries,
    statistics,
    isLoading: entriesLoading,
    error,
    refetch,
  } = useEntries(id, { sortOrder: "desc" });

  // Filter entries locally based on active filter for immediate response
  const filteredEntries = useMemo(() => {
    if (activeFilter === "all") return allEntries;
    return allEntries.filter((entry) => entry.entryType === activeFilter);
  }, [allEntries, activeFilter]);

  const [refreshing, setRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isLoading = projectLoading || entriesLoading;

  const sections = useMemo(() => groupEntriesByDate(filteredEntries), [filteredEntries]);

  // Handle view mode toggle with animation
  const handleViewModeToggle = useCallback((mode: ViewMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(mode);
  }, []);

  // Handle filter change with animation
  const handleFilterChange = useCallback((filter: FilterOption) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveFilter(filter);
  }, []);

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

  const handleEntryPress = useCallback(
    (entryId: string) => {
      router.push(`/entry/view/${entryId}` as Href);
    },
    [router]
  );

  const handleAddEntry = useCallback(() => {
    router.push(`/entry/create/${id}` as Href);
  }, [router, id]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: DateSection }) => (
      <View className="bg-background px-4 py-2 border-b border-border">
        <Text
          className="text-text-primary font-semibold text-base"
          accessibilityRole="header"
        >
          {section.title}
        </Text>
      </View>
    ),
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Entry; index: number }) => (
      <TimelineEntryItem
        entry={item}
        onPress={() => handleEntryPress(item.id)}
        index={index}
      />
    ),
    [handleEntryPress]
  );

  const keyExtractor = useCallback((item: Entry) => item.id, []);

  // Show loading skeleton on initial load
  if (isLoading && allEntries.length === 0 && !refreshing) {
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
          <View className="flex-1 ml-3">
            <Skeleton width={120} height={20} />
          </View>
        </View>
        <TimelineSkeleton />
      </SafeAreaView>
    );
  }

  // Show error state with retry
  if (error && allEntries.length === 0) {
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
            {project?.name || "Timeline"}
          </Text>
        </View>
        <ErrorView
          title="Failed to load entries"
          message={error}
          icon="📋"
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      </SafeAreaView>
    );
  }

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
          {project?.name || "Timeline"}
        </Text>
        {/* View toggle button */}
        <ViewToggle viewMode={viewMode} onToggle={handleViewModeToggle} />
      </View>

      {/* Filter bar - show when there are entries and in list view */}
      {allEntries.length > 0 && viewMode === "list" && (
        <EntryTypeFilter
          selected={activeFilter}
          onSelect={handleFilterChange}
          statistics={statistics}
        />
      )}

      {/* Inline error banner when we have cached data but fetch failed */}
      {error && allEntries.length > 0 && (
        <ErrorView
          compact
          title="Couldn't refresh"
          message={error}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      )}

      {/* Content */}
      {allEntries.length === 0 ? (
        // No entries at all - show initial empty state
        <EmptyState
          icon="📋"
          title="No entries yet"
          description="Start documenting your progress by adding your first entry."
          actionLabel="Add Entry"
          onAction={handleAddEntry}
        />
      ) : viewMode === "calendar" ? (
        // Calendar view
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
          <CalendarView
            entries={allEntries}
            project={project ?? undefined}
            onEntryPress={handleEntryPress}
          />
        </ScrollView>
      ) : filteredEntries.length === 0 ? (
        // Has entries but filter returns empty (list view only)
        <EmptyState
          icon="🔍"
          title={`No ${FILTER_TYPE_LABELS[activeFilter]} entries yet`}
          description={`You haven't added any ${FILTER_TYPE_LABELS[activeFilter]}s to this project yet.`}
          actionLabel="View All"
          onAction={() => handleFilterChange("all")}
        />
      ) : (
        // List view
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          accessibilityRole="list"
          accessibilityLabel={`Timeline with ${filteredEntries.length} ${activeFilter === "all" ? "entries" : FILTER_TYPE_LABELS[activeFilter] + " entries"}`}
        />
      )}
    </SafeAreaView>
  );
}
