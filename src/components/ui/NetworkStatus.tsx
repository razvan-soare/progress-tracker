import { useEffect, useState, useRef } from "react";
import { View, Text, Animated, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function NetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [showBanner, setShowBanner] = useState(false);
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isConnected === false) {
      setShowBanner(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else if (isConnected === true && showBanner) {
      // Show "back online" briefly then hide
      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowBanner(false));
      }, 2000);
    }
  }, [isConnected, showBanner, slideAnim]);

  if (!showBanner) return null;

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
        isConnected === false
          ? "You are offline. Some features may be unavailable."
          : "You are back online."
      }
      accessibilityLiveRegion="polite"
    >
      <View
        className={`mx-4 px-4 py-2 rounded-lg flex-row items-center justify-center ${
          isConnected === false ? "bg-warning" : "bg-success"
        }`}
      >
        <Text className="text-sm mr-2">
          {isConnected === false ? "📡" : "✓"}
        </Text>
        <Text className="text-background text-sm font-medium">
          {isConnected === false
            ? "You're offline - changes saved locally"
            : "Back online"}
        </Text>
      </View>
    </Animated.View>
  );
}
