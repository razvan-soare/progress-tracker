import { useEffect, useState, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetwork } from "@/lib/network";

export function NetworkStatusBanner() {
  const { isOnline, connectionType } = useNetwork();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isOnline) {
      // Going offline
      setWasOffline(true);
      setShowBanner(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else if (isOnline && wasOffline) {
      // Coming back online after being offline
      // Show "back online" briefly then hide
      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -60,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowBanner(false);
          setWasOffline(false);
        });
      }, 2000);
    }
  }, [isOnline, wasOffline, slideAnim]);

  if (!showBanner) return null;

  const isOffline = !isOnline;

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        position: "absolute",
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
      accessibilityRole="alert"
      accessibilityLabel={
        isOffline
          ? "You're offline. Changes will sync when connected."
          : "You are back online."
      }
      accessibilityLiveRegion="polite"
    >
      <View
        className={`mx-4 px-4 py-3 rounded-lg flex-row items-center justify-center ${
          isOffline ? "bg-warning" : "bg-success"
        }`}
      >
        <Text className="text-sm mr-2">
          {isOffline ? "📡" : "✓"}
        </Text>
        <Text className="text-background text-sm font-medium">
          {isOffline
            ? "You're offline - changes will sync when connected"
            : "Back online"}
        </Text>
      </View>
    </Animated.View>
  );
}
