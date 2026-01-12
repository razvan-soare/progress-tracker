import { View, Animated } from "react-native";
import { useRef, useEffect } from "react";

export interface UploadProgressBarProps {
  progress: number;
  height?: number;
  backgroundColor?: string;
  progressColor?: string;
  animated?: boolean;
}

export function UploadProgressBar({
  progress,
  height = 4,
  backgroundColor = "#27272a",
  progressColor = "#6366f1",
  animated = true,
}: UploadProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: clampedProgress,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(clampedProgress);
    }
  }, [clampedProgress, animated, widthAnim]);

  const widthInterpolate = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      className="w-full rounded-full overflow-hidden"
      style={{ height, backgroundColor }}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: clampedProgress,
      }}
    >
      <Animated.View
        className="h-full rounded-full"
        style={{
          width: widthInterpolate,
          backgroundColor: progressColor,
        }}
      />
    </View>
  );
}
