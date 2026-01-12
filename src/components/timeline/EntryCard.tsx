import { useRef, useCallback } from "react";
import { View, Text, Image, Pressable, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Entry, EntryType } from "@/types";

const ENTRY_TYPE_ICONS: Record<EntryType, string> = {
  video: "🎬",
  photo: "📷",
  text: "📝",
};

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  video: "Video",
  photo: "Photo",
  text: "Note",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function truncateText(text: string, maxLines: number, charsPerLine: number): string {
  const maxChars = maxLines * charsPerLine;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim() + "...";
}

export interface EntryCardProps {
  entry: Entry;
  onPress?: () => void;
  onLongPress?: () => void;
  showDate?: boolean;
  showTime?: boolean;
}

const THUMBNAIL_SIZE = { width: 80, height: 80 };
const TEXT_PREVIEW_LINES = 3;
const CHARS_PER_LINE = 40;

export function EntryCard({
  entry,
  onPress,
  onLongPress,
  showDate = false,
  showTime = true,
}: EntryCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const renderVideoThumbnail = () => (
    <View className="relative" style={THUMBNAIL_SIZE}>
      {entry.thumbnailUri ? (
        <Image
          source={{ uri: entry.thumbnailUri }}
          className="w-full h-full rounded-lg"
          resizeMode="cover"
        />
      ) : entry.mediaUri ? (
        <Image
          source={{ uri: entry.mediaUri }}
          className="w-full h-full rounded-lg"
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={["#3b82f6", "#6366f1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-full h-full rounded-lg items-center justify-center"
        >
          <Text className="text-2xl opacity-50">{ENTRY_TYPE_ICONS.video}</Text>
        </LinearGradient>
      )}
      {/* Play icon overlay */}
      <View className="absolute inset-0 items-center justify-center">
        <View className="w-8 h-8 bg-black/60 rounded-full items-center justify-center">
          <Text className="text-white text-sm ml-0.5">▶</Text>
        </View>
      </View>
      {/* Duration badge */}
      {entry.durationSeconds != null && (
        <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded">
          <Text className="text-white text-xs font-medium">
            {formatDuration(entry.durationSeconds)}
          </Text>
        </View>
      )}
    </View>
  );

  const renderPhotoThumbnail = () => (
    <View className="relative" style={THUMBNAIL_SIZE}>
      {entry.thumbnailUri || entry.mediaUri ? (
        <Image
          source={{ uri: entry.thumbnailUri || entry.mediaUri }}
          className="w-full h-full rounded-lg"
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={["#ec4899", "#f43f5e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-full h-full rounded-lg items-center justify-center"
        >
          <Text className="text-2xl opacity-50">{ENTRY_TYPE_ICONS.photo}</Text>
        </LinearGradient>
      )}
      {/* Photo indicator */}
      <View className="absolute bottom-1 right-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center">
        <Text className="text-xs">{ENTRY_TYPE_ICONS.photo}</Text>
      </View>
    </View>
  );

  const renderTextThumbnail = () => (
    <View
      className="bg-surface/80 border border-border rounded-lg p-2 justify-start"
      style={THUMBNAIL_SIZE}
    >
      <View className="flex-row items-center mb-1">
        <Text className="text-sm">{ENTRY_TYPE_ICONS.text}</Text>
      </View>
      {entry.contentText ? (
        <Text
          className="text-text-secondary text-xs leading-4"
          numberOfLines={TEXT_PREVIEW_LINES}
        >
          {truncateText(entry.contentText, TEXT_PREVIEW_LINES, 12)}
        </Text>
      ) : (
        <Text className="text-text-secondary text-xs italic opacity-50">
          Empty note
        </Text>
      )}
    </View>
  );

  const renderThumbnail = () => {
    switch (entry.entryType) {
      case "video":
        return renderVideoThumbnail();
      case "photo":
        return renderPhotoThumbnail();
      case "text":
        return renderTextThumbnail();
      default:
        return (
          <View
            className="bg-surface rounded-lg items-center justify-center"
            style={THUMBNAIL_SIZE}
          >
            <Text className="text-2xl opacity-50">📄</Text>
          </View>
        );
    }
  };

  const renderTextContent = () => {
    if (entry.entryType === "text") {
      return (
        <View className="flex-1 ml-3 justify-center">
          <View className="flex-row items-center mb-1">
            <Text className="text-text-primary font-medium">
              {ENTRY_TYPE_LABELS[entry.entryType]}
            </Text>
          </View>
          {entry.contentText && (
            <Text
              className="text-text-secondary text-sm leading-5 mb-1"
              numberOfLines={2}
            >
              {truncateText(entry.contentText, 2, CHARS_PER_LINE)}
            </Text>
          )}
          <Text className="text-text-secondary text-xs">
            {showDate && `${formatShortDate(entry.createdAt)} · `}
            {showTime && formatTime(entry.createdAt)}
          </Text>
        </View>
      );
    }

    return (
      <View className="flex-1 ml-3 justify-center">
        <View className="flex-row items-center mb-1">
          <Text className="text-text-primary font-medium">
            {ENTRY_TYPE_LABELS[entry.entryType]}
          </Text>
          {entry.entryType === "video" && entry.durationSeconds != null && (
            <Text className="text-text-secondary text-sm ml-2">
              {formatDuration(entry.durationSeconds)}
            </Text>
          )}
        </View>
        {entry.contentText && (
          <Text
            className="text-text-secondary text-sm mb-1"
            numberOfLines={1}
          >
            {entry.contentText}
          </Text>
        )}
        <Text className="text-text-secondary text-xs">
          {showDate && `${formatShortDate(entry.createdAt)} · `}
          {showTime && formatTime(entry.createdAt)}
        </Text>
      </View>
    );
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={500}
        className="flex-row bg-surface rounded-xl p-3 border border-border/50"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
        accessibilityRole="button"
        accessibilityLabel={`${ENTRY_TYPE_LABELS[entry.entryType]} entry from ${formatTime(entry.createdAt)}`}
        accessibilityHint="Tap to view entry details, long press for more options"
      >
        {renderThumbnail()}
        {renderTextContent()}
        <View className="justify-center ml-2">
          <Text className="text-text-secondary text-lg">›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
