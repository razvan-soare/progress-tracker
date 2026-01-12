import { useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import type { EntryType } from "@/types";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type FilterOption = "all" | EntryType;

interface FilterChipProps {
  label: string;
  count?: number;
  isActive: boolean;
  onPress: () => void;
}

function FilterChip({ label, count, isActive, onPress }: FilterChipProps) {
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
        className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
          isActive ? "bg-primary" : "bg-surface"
        }`}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`Filter by ${label}${count !== undefined ? `, ${count} entries` : ""}`}
      >
        <Text
          className={`text-sm font-medium ${
            isActive ? "text-white" : "text-text-secondary"
          }`}
        >
          {label}
        </Text>
        {count !== undefined && (
          <View
            className={`ml-2 px-2 py-0.5 rounded-full ${
              isActive ? "bg-white/20" : "bg-border"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                isActive ? "text-white" : "text-text-secondary"
              }`}
            >
              {count}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface EntryTypeFilterProps {
  selected: FilterOption;
  onSelect: (filter: FilterOption) => void;
  statistics: {
    totalCount: number;
    videoCount: number;
    photoCount: number;
    textCount: number;
  };
}

const FILTER_OPTIONS: { key: FilterOption; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "" },
  { key: "video", label: "Videos", icon: "" },
  { key: "photo", label: "Photos", icon: "" },
  { key: "text", label: "Notes", icon: "" },
];

export function EntryTypeFilter({
  selected,
  onSelect,
  statistics,
}: EntryTypeFilterProps) {
  const getCount = (key: FilterOption): number => {
    switch (key) {
      case "all":
        return statistics.totalCount;
      case "video":
        return statistics.videoCount;
      case "photo":
        return statistics.photoCount;
      case "text":
        return statistics.textCount;
    }
  };

  const handleSelect = (key: FilterOption) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSelect(key);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingLeft: 16, paddingVertical: 12 }}
    >
      {FILTER_OPTIONS.map((option) => (
        <FilterChip
          key={option.key}
          label={option.label}
          count={getCount(option.key)}
          isActive={selected === option.key}
          onPress={() => handleSelect(option.key)}
        />
      ))}
    </ScrollView>
  );
}
