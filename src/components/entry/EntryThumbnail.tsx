import { View, Text, Image, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Entry, EntryType } from "@/types";

const ENTRY_TYPE_ICONS: Record<EntryType, string> = {
  video: "🎬",
  photo: "📷",
  text: "📝",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

export interface EntryThumbnailProps {
  entry: Entry;
  size?: "small" | "medium" | "large";
  showDate?: boolean;
  onPress?: () => void;
}

const SIZES = {
  small: { width: 80, height: 80, textLines: 2 },
  medium: { width: 100, height: 100, textLines: 3 },
  large: { width: 120, height: 120, textLines: 4 },
};

export function EntryThumbnail({
  entry,
  size = "medium",
  showDate = true,
  onPress,
}: EntryThumbnailProps) {
  const { width, height, textLines } = SIZES[size];
  const maxChars = textLines * 15;

  const renderThumbnailContent = () => {
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
                <Text className="text-3xl opacity-50">🎬</Text>
              </LinearGradient>
            )}
            {/* Play icon overlay */}
            <View className="absolute inset-0 items-center justify-center">
              <View className="w-8 h-8 bg-black/60 rounded-full items-center justify-center">
                <Text className="text-white text-sm ml-0.5">▶</Text>
              </View>
            </View>
            {/* Duration badge */}
            {entry.durationSeconds && (
              <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded">
                <Text className="text-white text-xs font-medium">
                  {formatDuration(entry.durationSeconds)}
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
            <Text className="text-3xl opacity-50">📷</Text>
          </LinearGradient>
        );

      case "text":
        return (
          <View className="w-full h-full bg-surface p-2">
            <View className="flex-row items-center mb-1">
              <Text className="text-sm">{ENTRY_TYPE_ICONS.text}</Text>
            </View>
            {entry.contentText ? (
              <Text
                className="text-text-secondary text-xs leading-4"
                numberOfLines={textLines}
              >
                {truncateText(entry.contentText, maxChars)}
              </Text>
            ) : (
              <Text className="text-text-secondary text-xs italic opacity-50">
                Empty note
              </Text>
            )}
          </View>
        );

      default:
        return (
          <View className="w-full h-full bg-surface items-center justify-center">
            <Text className="text-2xl opacity-50">📄</Text>
          </View>
        );
    }
  };

  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-80 active:scale-95"
      style={{ width }}
    >
      <View
        className="rounded-lg overflow-hidden bg-surface"
        style={{ width, height }}
      >
        {renderThumbnailContent()}
      </View>
      {showDate && (
        <Text className="text-text-secondary text-xs text-center mt-1.5">
          {formatShortDate(entry.createdAt)}
        </Text>
      )}
    </Pressable>
  );
}
