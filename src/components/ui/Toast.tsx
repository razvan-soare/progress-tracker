import { useEffect, useRef } from "react";
import { View, Text, Animated, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  duration?: number;
  onDismiss: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: "bg-success",
  error: "bg-error",
  warning: "bg-warning",
  info: "bg-primary",
};

export function Toast({
  message,
  type = "info",
  visible,
  duration = 3000,
  onDismiss,
  action,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          hideToast();
        }, duration);
        return () => clearTimeout(timer);
      }
    }
  }, [visible, duration]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
        position: "absolute",
        bottom: insets.bottom + 16,
        left: 16,
        right: 16,
        zIndex: 1000,
      }}
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <Pressable onPress={hideToast}>
        <View
          className={`${TOAST_STYLES[type]} px-4 py-3 rounded-xl flex-row items-center shadow-lg`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <View className="w-6 h-6 rounded-full bg-white/20 items-center justify-center mr-3">
            <Text className="text-white text-xs font-bold">
              {TOAST_ICONS[type]}
            </Text>
          </View>
          <Text className="text-white text-sm font-medium flex-1">{message}</Text>
          {action && (
            <Pressable
              onPress={() => {
                action.onPress();
                hideToast();
              }}
              className="ml-2 px-2 py-1 rounded bg-white/20 active:bg-white/30"
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text className="text-white text-xs font-semibold">
                {action.label}
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
