import { View, Text, Pressable, Animated } from "react-native";
import { useRef, useEffect } from "react";
import type { UploadStatus } from "@/types";

export interface UploadStatusIndicatorProps {
  status: UploadStatus;
  progress?: number;
  onRetry?: () => void;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const ICON_SIZES = {
  sm: { container: 20, icon: 10, badge: 8, text: "text-xs" },
  md: { container: 28, icon: 14, badge: 10, text: "text-sm" },
  lg: { container: 36, icon: 18, badge: 12, text: "text-base" },
} as const;

const STATUS_CONFIG = {
  pending: {
    bgColor: "bg-yellow-500/20",
    iconColor: "#eab308",
    cloudIcon: "☁",
    badgeIcon: "⏱",
    label: "Queued",
  },
  uploading: {
    bgColor: "bg-primary/20",
    iconColor: "#6366f1",
    cloudIcon: "☁",
    badgeIcon: "↑",
    label: "Uploading",
  },
  uploaded: {
    bgColor: "bg-success/20",
    iconColor: "#22c55e",
    cloudIcon: "☁",
    badgeIcon: "✓",
    label: "Uploaded",
  },
  failed: {
    bgColor: "bg-error/20",
    iconColor: "#ef4444",
    cloudIcon: "☁",
    badgeIcon: "✗",
    label: "Failed",
  },
} as const;

export function UploadStatusIndicator({
  status,
  progress,
  onRetry,
  size = "md",
  showLabel = false,
}: UploadStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const sizeConfig = ICON_SIZES[size];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === "uploading") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else if (status === "pending") {
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      rotate.start();
      return () => rotate.stop();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [status, pulseAnim, rotateAnim]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const renderIcon = () => {
    const content = (
      <View
        className={`rounded-lg items-center justify-center ${config.bgColor}`}
        style={{
          width: sizeConfig.container,
          height: sizeConfig.container,
        }}
      >
        {/* Cloud icon */}
        <Text
          style={{
            color: config.iconColor,
            fontSize: sizeConfig.icon,
            fontWeight: "bold",
          }}
        >
          {config.cloudIcon}
        </Text>
        {/* Badge overlay in bottom-right corner */}
        <View
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: sizeConfig.badge + 4,
            height: sizeConfig.badge + 4,
            borderRadius: (sizeConfig.badge + 4) / 2,
            backgroundColor: config.iconColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: sizeConfig.badge - 2,
              fontWeight: "bold",
              lineHeight: sizeConfig.badge,
            }}
          >
            {config.badgeIcon}
          </Text>
        </View>
      </View>
    );

    if (status === "uploading") {
      return (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          {content}
        </Animated.View>
      );
    }

    if (status === "pending") {
      return (
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          {content}
        </Animated.View>
      );
    }

    return content;
  };

  const indicator = (
    <View className="flex-row items-center">
      {renderIcon()}
      {showLabel && (
        <Text
          className={`ml-1.5 ${sizeConfig.text} text-text-secondary`}
          style={{ color: config.iconColor }}
        >
          {status === "uploading" && progress != null
            ? `${Math.round(progress)}%`
            : config.label}
        </Text>
      )}
    </View>
  );

  if (status === "failed" && onRetry) {
    return (
      <Pressable
        onPress={onRetry}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Retry upload"
        accessibilityHint="Tap to retry the failed upload"
      >
        {indicator}
      </Pressable>
    );
  }

  return indicator;
}
