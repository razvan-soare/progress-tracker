import { useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import type { SortOrder } from "@/lib/store/entries-store";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SortOptionProps {
  label: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
}

function SortOption({ label, icon, isActive, onPress }: SortOptionProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={`px-3 py-2 rounded-lg flex-row items-center ${
          isActive ? "bg-primary" : "bg-surface"
        }`}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`Sort ${label}`}
      >
        <Text
          className={`text-sm mr-1 ${
            isActive ? "text-white" : "text-text-secondary"
          }`}
        >
          {icon}
        </Text>
        <Text
          className={`text-sm font-medium ${
            isActive ? "text-white" : "text-text-secondary"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

interface SortOrderSelectorProps {
  selected: SortOrder;
  onSelect: (sortOrder: SortOrder) => void;
}

const SORT_OPTIONS: { key: SortOrder; label: string; icon: string }[] = [
  { key: "desc", label: "Newest", icon: "↓" },
  { key: "asc", label: "Oldest", icon: "↑" },
];

export function SortOrderSelector({
  selected,
  onSelect,
}: SortOrderSelectorProps) {
  const handleSelect = (key: SortOrder) => {
    if (key !== selected) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onSelect(key);
    }
  };

  return (
    <View className="flex-row items-center bg-surface/50 rounded-lg p-1">
      {SORT_OPTIONS.map((option) => (
        <SortOption
          key={option.key}
          label={option.label}
          icon={option.icon}
          isActive={selected === option.key}
          onPress={() => handleSelect(option.key)}
        />
      ))}
    </View>
  );
}
