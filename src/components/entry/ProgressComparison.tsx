import { View, Text, Image, Pressable } from "react-native";
import { useRouter, Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { Entry, EntryType } from "@/types";
import { colors } from "@/constants/colors";

const ENTRY_TYPE_ICONS: Record<EntryType, string> = {
  video: "🎬",
  photo: "📷",
  text: "📝",
};

function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export interface ProgressComparisonProps {
  firstEntry: Entry;
  latestEntry: Entry;
  projectId: string;
  onPress?: () => void;
}

interface ComparisonThumbnailProps {
  entry: Entry;
  label: string;
}

function ComparisonThumbnail({ entry, label }: ComparisonThumbnailProps) {
  const renderContent = () => {
    if (entry.entryType === "text") {
      return (
        <View className="w-full h-full bg-surface/80 items-center justify-center">
          <Text className="text-2xl">{ENTRY_TYPE_ICONS.text}</Text>
        </View>
      );
    }

    const imageUri = entry.thumbnailUri || entry.mediaUri;
    if (imageUri) {
      return (
        <View className="w-full h-full relative">
          <Image
            source={{ uri: imageUri }}
            className="w-full h-full"
            resizeMode="cover"
          />
          {entry.entryType === "video" && (
            <View className="absolute inset-0 items-center justify-center">
              <View className="w-6 h-6 bg-black/60 rounded-full items-center justify-center">
                <Text className="text-white text-xs ml-0.5">▶</Text>
              </View>
            </View>
          )}
        </View>
      );
    }

    return (
      <LinearGradient
        colors={["#6366f1", "#8b5cf6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full h-full items-center justify-center"
      >
        <Text className="text-2xl opacity-50">
          {ENTRY_TYPE_ICONS[entry.entryType]}
        </Text>
      </LinearGradient>
    );
  };

  return (
    <View className="items-center">
      <View className="w-20 h-20 rounded-lg overflow-hidden bg-surface">
        {renderContent()}
      </View>
      <Text className="text-text-secondary text-xs mt-1.5">{label}</Text>
      <Text className="text-text-secondary text-xs opacity-70">
        {formatShortDate(entry.createdAt)}
      </Text>
    </View>
  );
}

export function ProgressComparison({
  firstEntry,
  latestEntry,
  projectId,
  onPress,
}: ProgressComparisonProps) {
  const router = useRouter();
  const daysBetween = calculateDaysBetween(
    firstEntry.createdAt,
    latestEntry.createdAt
  );

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/project/${projectId}/reports` as Href);
    }
  };

  // Don't show if first and latest are the same entry
  if (firstEntry.id === latestEntry.id) {
    return null;
  }

  return (
    <View className="px-4 pb-4">
      <Text className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium">
        Your Progress
      </Text>

      <Pressable
        onPress={handlePress}
        className="bg-surface rounded-xl p-4 active:opacity-80"
      >
        <View className="flex-row items-center justify-between">
          {/* First Entry Thumbnail */}
          <ComparisonThumbnail entry={firstEntry} label="First" />

          {/* Progress Indicator */}
          <View className="flex-1 items-center px-2">
            <View className="flex-row items-center">
              <View className="h-px bg-border flex-1" />
              <View className="mx-2 px-2 py-1 bg-primary/20 rounded-full">
                <Text className="text-primary text-xs font-semibold">
                  {daysBetween} {daysBetween === 1 ? "day" : "days"}
                </Text>
              </View>
              <View className="h-px bg-border flex-1" />
            </View>
            <Text className="text-text-secondary text-xs mt-1">of progress</Text>
          </View>

          {/* Latest Entry Thumbnail */}
          <ComparisonThumbnail entry={latestEntry} label="Latest" />
        </View>

        {/* View Full Comparison Link */}
        <View className="flex-row items-center justify-center mt-3 pt-3 border-t border-border">
          <Text className="text-primary text-sm font-medium mr-1">
            View full comparison
          </Text>
          <Text className="text-primary">→</Text>
        </View>
      </Pressable>
    </View>
  );
}
