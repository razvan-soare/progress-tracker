import { useEffect, useRef } from "react";
import { View, Animated, ViewStyle, StyleProp, DimensionValue } from "react-native";
import { colors } from "@/constants/colors";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
  className = "",
}: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      className={`bg-surface ${className}`}
      style={[
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    />
  );
}

export function SkeletonText({
  lines = 1,
  lineHeight = 16,
  spacing = 8,
  lastLineWidth = "60%",
}: {
  lines?: number;
  lineHeight?: number;
  spacing?: number;
  lastLineWidth?: DimensionValue;
}) {
  return (
    <View>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 && lines > 1 ? lastLineWidth : "100%"}
          style={{ marginTop: index > 0 ? spacing : 0 }}
        />
      ))}
    </View>
  );
}

export function ProjectCardSkeleton() {
  return (
    <View className="mb-3 rounded-xl overflow-hidden bg-surface">
      {/* Cover Image Skeleton */}
      <Skeleton height={128} borderRadius={0} />

      {/* Stats Section Skeleton */}
      <View className="px-3 py-3">
        <View className="flex-row items-center mb-2">
          <Skeleton width={60} height={14} />
          <View className="w-px h-4 bg-border mx-3" />
          <Skeleton width={50} height={14} />
          <View className="w-px h-4 bg-border mx-3" />
          <Skeleton width={45} height={14} />
        </View>
        <View className="flex-row items-center justify-between">
          <Skeleton width={100} height={12} />
          <Skeleton width={16} height={16} borderRadius={8} />
        </View>
      </View>
    </View>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <View className="flex-1 bg-background">
      {/* Cover Image Skeleton */}
      <Skeleton height={200} borderRadius={0} className="aspect-video" />

      {/* Content */}
      <View className="px-4 py-4">
        {/* Title */}
        <Skeleton width="70%" height={28} />
        {/* Description */}
        <Skeleton width="100%" height={16} style={{ marginTop: 12 }} />
        {/* Category Badge */}
        <Skeleton width={80} height={28} borderRadius={14} style={{ marginTop: 12 }} />
      </View>

      {/* Stats Section */}
      <View className="px-4 pb-4">
        <Skeleton width={80} height={12} style={{ marginBottom: 12 }} />
        <View className="flex-row gap-3 mb-3">
          <Skeleton className="flex-1" height={96} borderRadius={12} />
          <Skeleton className="flex-1" height={96} borderRadius={12} />
          <Skeleton className="flex-1" height={96} borderRadius={12} />
        </View>
        <View className="flex-row gap-3">
          <Skeleton className="flex-1" height={96} borderRadius={12} />
          <Skeleton className="flex-1" height={96} borderRadius={12} />
          <Skeleton className="flex-1" height={96} borderRadius={12} />
        </View>
      </View>

      {/* Quick Actions */}
      <View className="px-4 pb-4">
        <Skeleton width={100} height={12} style={{ marginBottom: 12 }} />
        <Skeleton height={56} borderRadius={12} style={{ marginBottom: 12 }} />
        <View className="flex-row gap-3">
          <Skeleton className="flex-1" height={48} borderRadius={12} />
          <Skeleton className="flex-1" height={48} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

export function FormSkeleton() {
  return (
    <View className="flex-1 px-4 py-4">
      {/* Input field */}
      <View className="mb-4">
        <Skeleton width={100} height={14} style={{ marginBottom: 8 }} />
        <Skeleton height={48} borderRadius={8} />
      </View>
      {/* Textarea */}
      <View className="mb-4">
        <Skeleton width={140} height={14} style={{ marginBottom: 8 }} />
        <Skeleton height={100} borderRadius={8} />
      </View>
      {/* Category grid */}
      <View className="mb-4">
        <Skeleton width={80} height={14} style={{ marginBottom: 12 }} />
        <View className="flex-row gap-3">
          <Skeleton className="flex-1" height={100} borderRadius={12} />
          <Skeleton className="flex-1" height={100} borderRadius={12} />
        </View>
        <View className="flex-row gap-3 mt-3">
          <Skeleton className="flex-1" height={100} borderRadius={12} />
          <Skeleton className="flex-1" height={100} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}
