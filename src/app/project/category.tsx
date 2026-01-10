import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, IconButton, TimePicker } from "@/components/ui";
import { useWizardStore } from "@/lib/store";
import type { ProjectCategory } from "@/types";

interface CategoryOption {
  id: ProjectCategory;
  label: string;
  icon: string;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: "fitness",
    label: "Fitness",
    icon: "🏋️",
    description: "Workouts & health",
  },
  {
    id: "learning",
    label: "Learning",
    icon: "📚",
    description: "Skills & knowledge",
  },
  {
    id: "creative",
    label: "Creative",
    icon: "🎨",
    description: "Art & design",
  },
  {
    id: "custom",
    label: "Custom",
    icon: "✨",
    description: "Something unique",
  },
];

const DAYS = [
  { id: "Mon", label: "M" },
  { id: "Tue", label: "T" },
  { id: "Wed", label: "W" },
  { id: "Thu", label: "T" },
  { id: "Fri", label: "F" },
  { id: "Sat", label: "S" },
  { id: "Sun", label: "S" },
];

function formatTimeForDisplay(time: string): string {
  const [hour, minute] = time.split(":");
  const h = parseInt(hour, 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${minute} ${period}`;
}

export default function CategorySelectionScreen() {
  const router = useRouter();
  const {
    formData,
    errors,
    setFormField,
    validateCategory,
    previousStep,
    nextStep,
    resetWizard,
  } = useWizardStore();

  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleBack = () => {
    previousStep();
    router.back();
  };

  const handleClose = () => {
    resetWizard();
    router.replace("/");
  };

  const handleCategorySelect = useCallback(
    (category: ProjectCategory) => {
      setFormField("category", category);
    },
    [setFormField]
  );

  const handleReminderToggle = useCallback(
    (enabled: boolean) => {
      setFormField("reminderEnabled", enabled);
    },
    [setFormField]
  );

  const handleTimeChange = useCallback(
    (time: string) => {
      setFormField("reminderTime", time);
    },
    [setFormField]
  );

  const handleDayToggle = useCallback(
    (day: string) => {
      const currentDays = formData.reminderDays;
      if (currentDays.includes(day)) {
        // Don't allow removing all days - keep at least one
        if (currentDays.length > 1) {
          setFormField(
            "reminderDays",
            currentDays.filter((d) => d !== day)
          );
        }
      } else {
        setFormField("reminderDays", [...currentDays, day]);
      }
    },
    [formData.reminderDays, setFormField]
  );

  const handleNext = useCallback(() => {
    if (validateCategory()) {
      nextStep();
      // Navigate to cover image step (Step 3)
      router.push("/project/cover");
    }
  }, [validateCategory, nextStep, router]);

  const handleSkip = useCallback(() => {
    if (validateCategory()) {
      // Skip reminder setup but still proceed
      setFormField("reminderEnabled", false);
      nextStep();
      router.push("/project/cover");
    }
  }, [validateCategory, nextStep, router, setFormField]);

  const isNextDisabled = !formData.category;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <IconButton
          icon="←"
          variant="default"
          size="md"
          onPress={handleBack}
          accessibilityLabel="Back"
        />
        <Text className="text-lg font-semibold text-text-primary">
          New Project
        </Text>
        <IconButton
          icon="×"
          variant="default"
          size="md"
          onPress={handleClose}
          accessibilityLabel="Close"
        />
      </View>

      {/* Progress Indicator */}
      <View className="px-4 py-3">
        <View className="flex-row items-center justify-center">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
              <Text className="text-white font-semibold">✓</Text>
            </View>
            <View className="w-12 h-0.5 bg-primary mx-2" />
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
              <Text className="text-white font-semibold">2</Text>
            </View>
            <View className="w-12 h-0.5 bg-border mx-2" />
            <View className="w-8 h-8 rounded-full bg-surface items-center justify-center">
              <Text className="text-text-secondary font-semibold">3</Text>
            </View>
          </View>
        </View>
        <Text className="text-text-secondary text-center mt-2 text-sm">
          Step 2 of 3 - Category & Reminders
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Category Selection */}
        <View className="mt-4">
          <Text className="text-text-primary text-base font-semibold mb-3">
            Select a Category *
          </Text>

          {/* 2x2 Grid */}
          <View className="flex-row flex-wrap -mx-1.5">
            {CATEGORIES.map((category) => {
              const isSelected = formData.category === category.id;
              return (
                <View key={category.id} className="w-1/2 p-1.5">
                  <Pressable
                    onPress={() => handleCategorySelect(category.id)}
                    className={`bg-surface rounded-xl p-4 items-center justify-center min-h-[120px] border-2 ${
                      isSelected ? "border-primary" : "border-transparent"
                    } active:opacity-80`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${category.label} category`}
                  >
                    <Text className="text-4xl mb-2">{category.icon}</Text>
                    <Text className="text-text-primary text-base font-semibold">
                      {category.label}
                    </Text>
                    <Text className="text-text-secondary text-xs text-center mt-1">
                      {category.description}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {errors.category && (
            <Text className="text-error text-sm mt-2">{errors.category}</Text>
          )}
        </View>

        {/* Reminder Configuration */}
        <View className="mt-8">
          <Text className="text-text-primary text-base font-semibold mb-3">
            Reminders
          </Text>

          {/* Toggle */}
          <View className="bg-surface rounded-xl p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-text-primary text-base">
                  Enable Reminders
                </Text>
                <Text className="text-text-secondary text-sm mt-1">
                  Get notified to update your progress
                </Text>
              </View>
              <Switch
                value={formData.reminderEnabled}
                onValueChange={handleReminderToggle}
                trackColor={{ false: "#3e3e3e", true: "#6366f1" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Reminder Options (shown when enabled) */}
            {formData.reminderEnabled && (
              <View className="mt-4 pt-4 border-t border-border">
                {/* Time Picker */}
                <View className="mb-4">
                  <Text className="text-text-secondary text-sm mb-2">
                    Reminder Time
                  </Text>
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    className="bg-background px-4 py-3 rounded-lg active:opacity-80"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-text-primary text-base">
                        {formatTimeForDisplay(formData.reminderTime)}
                      </Text>
                      <Text className="text-text-secondary text-lg">🕐</Text>
                    </View>
                  </Pressable>
                </View>

                {/* Day Selector */}
                <View>
                  <Text className="text-text-secondary text-sm mb-2">
                    Reminder Days
                  </Text>
                  <View className="flex-row justify-between">
                    {DAYS.map((day) => {
                      const isSelected = formData.reminderDays.includes(day.id);
                      return (
                        <Pressable
                          key={day.id}
                          onPress={() => handleDayToggle(day.id)}
                          className={`w-10 h-10 rounded-full items-center justify-center ${
                            isSelected ? "bg-primary" : "bg-background"
                          } active:opacity-80`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`${day.id}`}
                        >
                          <Text
                            className={`text-sm font-semibold ${
                              isSelected ? "text-white" : "text-text-secondary"
                            }`}
                          >
                            {day.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View className="px-4 py-4 border-t border-border">
        <Button
          title="Next"
          onPress={handleNext}
          disabled={isNextDisabled}
          variant="primary"
        />
        <Pressable
          onPress={handleSkip}
          disabled={isNextDisabled}
          className={`mt-3 py-2 ${isNextDisabled ? "opacity-50" : ""}`}
        >
          <Text className="text-text-secondary text-center text-sm">
            Skip reminder setup
          </Text>
        </Pressable>
      </View>

      {/* Time Picker Modal */}
      <TimePicker
        value={formData.reminderTime}
        onChange={handleTimeChange}
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
      />
    </SafeAreaView>
  );
}
