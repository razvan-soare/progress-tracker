import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  Pressable,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { useProject, useEntries } from "@/lib/store/hooks";
import { EmptyState, IconButton, ErrorView, Skeleton } from "@/components/ui";
import { EntryThumbnail } from "@/components/entry";
import { colors } from "@/constants/colors";
import type { Entry } from "@/types";

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

export default function TimelineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project, isLoading: projectLoading } = useProject(id);
  const {
    entries,
    isLoading: entriesLoading,
    error,
    refetch,
  } = useEntries(id, { sortOrder: "desc" });

  const [refreshing, setRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isLoading = projectLoading || entriesLoading;

  const sections = useMemo(() => groupEntriesByDate(entries), [entries]);

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
  if (isLoading && entries.length === 0 && !refreshing) {
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
  if (error && entries.length === 0) {
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
      </View>

      {/* Inline error banner when we have cached data but fetch failed */}
      {error && entries.length > 0 && (
        <ErrorView
          compact
          title="Couldn't refresh"
          message={error}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      )}

      {/* Content */}
      {entries.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No entries yet"
          description="Start documenting your progress by adding your first entry."
          actionLabel="Add Entry"
          onAction={handleAddEntry}
        />
      ) : (
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
          accessibilityLabel={`Timeline with ${entries.length} entries`}
        />
      )}
    </SafeAreaView>
  );
}
