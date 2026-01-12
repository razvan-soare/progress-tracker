import { View, Text, Pressable, Animated } from "react-native";
import { useRef, useEffect, useState } from "react";
import { UploadProgressBar } from "./UploadProgressBar";

export interface GlobalUploadIndicatorProps {
  pendingCount: number;
  failedCount: number;
  currentProgress?: number | null;
  isUploading: boolean;
  isPaused: boolean;
  onPress?: () => void;
}

export function GlobalUploadIndicator({
  pendingCount,
  failedCount,
  currentProgress,
  isUploading,
  isPaused,
  onPress,
}: GlobalUploadIndicatorProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isVisible, setIsVisible] = useState(false);

  const totalPending = pendingCount + failedCount;
  const hasContent = totalPending > 0 || isUploading;

  useEffect(() => {
    if (hasContent) {
      setIsVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsVisible(false));
    }
  }, [hasContent, slideAnim]);

  useEffect(() => {
    if (isUploading && !isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isUploading, isPaused, pulseAnim]);

  if (!isVisible) return null;

  const getStatusText = () => {
    if (failedCount > 0 && pendingCount === 0) {
      return `${failedCount} upload${failedCount > 1 ? "s" : ""} failed`;
    }
    if (isPaused) {
      return `${totalPending} upload${totalPending > 1 ? "s" : ""} paused`;
    }
    if (isUploading) {
      const remaining = totalPending;
      if (remaining > 1) {
        return `Uploading ${remaining - 1} of ${remaining}...`;
      }
      return "Uploading 1 of 1...";
    }
    return `${totalPending} upload${totalPending > 1 ? "s" : ""} pending`;
  };

  const getStatusColor = () => {
    if (failedCount > 0) return "#ef4444";
    if (isPaused) return "#eab308";
    if (isUploading) return "#6366f1";
    return "#a1a1aa";
  };

  const getIcon = () => {
    if (failedCount > 0) return "☁✗";
    if (isPaused) return "☁⏸";
    if (isUploading) return "☁↑";
    return "☁⏱";
  };

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }, { scale: pulseAnim }],
      }}
    >
      <Pressable
        onPress={onPress}
        className="mx-4 mb-2 bg-surface border border-border rounded-xl overflow-hidden"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 3,
        }}
        accessibilityRole="button"
        accessibilityLabel={getStatusText()}
        accessibilityHint="Tap to view upload details"
      >
        <View className="px-4 py-3">
          <View className="flex-row items-center">
            <View
              className="w-8 h-8 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: `${getStatusColor()}20` }}
            >
              <Text style={{ color: getStatusColor(), fontSize: 14 }}>
                {getIcon()}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className="text-text-primary font-medium text-sm"
                numberOfLines={1}
              >
                {getStatusText()}
              </Text>
              {isUploading && currentProgress != null && (
                <Text className="text-text-secondary text-xs mt-0.5">
                  {Math.round(currentProgress)}% complete
                </Text>
              )}
            </View>
            {failedCount > 0 && (
              <View className="bg-error/20 px-2 py-1 rounded-full">
                <Text className="text-error text-xs font-medium">
                  Tap to retry
                </Text>
              </View>
            )}
          </View>
          {isUploading && currentProgress != null && (
            <View className="mt-2">
              <UploadProgressBar progress={currentProgress} height={3} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
