import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, Href } from "expo-router";
import { EntryThumbnail } from "./EntryThumbnail";
import type { Entry } from "@/types";

export interface RecentEntriesProps {
  entries: Entry[];
  projectId: string;
  maxEntries?: number;
  totalEntries?: number;
  onSeeAll?: () => void;
}

export function RecentEntries({
  entries,
  projectId,
  maxEntries = 10,
  totalEntries,
  onSeeAll,
}: RecentEntriesProps) {
  const router = useRouter();

  const recentEntries = entries.slice(0, maxEntries);

  const handleEntryPress = (entryId: string) => {
    router.push(`/entry/view/${entryId}` as Href);
  };

  const handleSeeAll = () => {
    if (onSeeAll) {
      onSeeAll();
    } else {
      router.push(`/project/${projectId}/timeline` as Href);
    }
  };

  if (recentEntries.length === 0) {
    return null;
  }

  const entryCount = totalEntries ?? entries.length;
  const hasMore = entryCount > recentEntries.length;

  return (
    <View className="pb-4">
      {/* Section Header */}
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-text-secondary text-xs uppercase tracking-wide font-medium">
          Recent Entries
        </Text>
        <Pressable
          onPress={handleSeeAll}
          className="flex-row items-center active:opacity-60"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`View all ${entryCount} entries`}
        >
          <Text className="text-primary text-sm font-medium">
            {hasMore ? `View All (${entryCount})` : "View All"}
          </Text>
          <Text className="text-primary text-sm ml-1">›</Text>
        </Pressable>
      </View>

      {/* Horizontal Scrollable Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {recentEntries.map((entry) => (
          <EntryThumbnail
            key={entry.id}
            entry={entry}
            size="medium"
            showDate
            onPress={() => handleEntryPress(entry.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
