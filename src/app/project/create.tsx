import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TextInput, Button, IconButton, DatePicker } from "@/components/ui";
import { useWizardStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

export default function CreateProjectScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    formData,
    errors,
    setFormField,
    setError,
    validateBasicInfo,
    nextStep,
    resetWizard,
    hasFormData,
  } = useWizardStore();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameBlurred, setNameBlurred] = useState(false);

  const handleClose = useCallback(() => {
    if (hasFormData()) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              resetWizard();
              router.back();
            },
          },
        ]
      );
    } else {
      resetWizard();
      router.back();
    }
  }, [hasFormData, resetWizard, router]);

  const handleNameChange = useCallback(
    (text: string) => {
      // Limit to max length
      const trimmedText = text.slice(0, MAX_NAME_LENGTH);
      setFormField("name", trimmedText);
    },
    [setFormField]
  );

  const handleNameBlur = useCallback(() => {
    setNameBlurred(true);
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setError("name", "Project name is required");
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      setError("name", `Project name must be ${MAX_NAME_LENGTH} characters or less`);
    }
  }, [formData.name, setError]);

  const handleDescriptionChange = useCallback(
    (text: string) => {
      // Limit to max length
      const trimmedText = text.slice(0, MAX_DESCRIPTION_LENGTH);
      setFormField("description", trimmedText);
    },
    [setFormField]
  );

  const handleDescriptionBlur = useCallback(() => {
    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      setError(
        "description",
        `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
      );
    }
  }, [formData.description, setError]);

  const handleDatePress = useCallback(() => {
    setShowDatePicker(true);
  }, []);

  const handleDateChange = useCallback(
    (selectedDate: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate > today) {
        setError("startDate", "Start date cannot be in the future");
      } else {
        setFormField("startDate", formatDate(selectedDate));
      }
    },
    [setFormField, setError]
  );

  const handleDatePickerClose = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const handleNext = useCallback(() => {
    if (validateBasicInfo()) {
      nextStep();
      // Navigate to category selection step
      router.push("/project/category");
    }
  }, [validateBasicInfo, nextStep, router]);

  const isNextDisabled = !formData.name.trim();

  const currentDate = formData.startDate
    ? new Date(formData.startDate + "T00:00:00")
    : new Date();

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <IconButton
            icon="×"
            variant="default"
            size="md"
            onPress={handleClose}
            accessibilityLabel="Close"
          />
          <Text className="text-lg font-semibold text-text-primary">
            New Project
          </Text>
          <View className="w-10" />
        </View>

        {/* Progress Indicator */}
        <View className="px-4 py-3">
          <View className="flex-row items-center justify-center">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <Text className="text-white font-semibold">1</Text>
              </View>
              <View className="w-12 h-0.5 bg-border mx-2" />
              <View className="w-8 h-8 rounded-full bg-surface items-center justify-center">
                <Text className="text-text-secondary font-semibold">2</Text>
              </View>
              <View className="w-12 h-0.5 bg-border mx-2" />
              <View className="w-8 h-8 rounded-full bg-surface items-center justify-center">
                <Text className="text-text-secondary font-semibold">3</Text>
              </View>
            </View>
          </View>
          <Text className="text-text-secondary text-center mt-2 text-sm">
            Step 1 of 3 - Basic Info
          </Text>
        </View>

        {/* Form Content */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {/* Project Name */}
          <View className="mt-4">
            <TextInput
              label="Project Name *"
              placeholder="Enter your project name"
              value={formData.name}
              onChangeText={handleNameChange}
              onBlur={handleNameBlur}
              error={nameBlurred ? errors.name : undefined}
              maxLength={MAX_NAME_LENGTH}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />
            <Text className="text-text-secondary text-xs mt-1 text-right">
              {formData.name.length}/{MAX_NAME_LENGTH}
            </Text>
          </View>

          {/* Description */}
          <View className="mt-4">
            <TextInput
              label="Description (optional)"
              placeholder="What is this project about?"
              value={formData.description}
              onChangeText={handleDescriptionChange}
              onBlur={handleDescriptionBlur}
              error={errors.description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-[100px]"
            />
            <Text className="text-text-secondary text-xs mt-1 text-right">
              {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
            </Text>
          </View>

          {/* Start Date */}
          <View className="mt-4">
            <Text className="text-text-secondary text-sm mb-2">Start Date</Text>
            <Pressable
              onPress={handleDatePress}
              className="bg-surface px-4 py-3 rounded-lg border border-transparent active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-text-primary text-base">
                  {formatDisplayDate(formData.startDate)}
                </Text>
                <Text className="text-text-secondary text-lg">📅</Text>
              </View>
            </Pressable>
            {errors.startDate && (
              <Text className="text-error text-sm mt-1">{errors.startDate}</Text>
            )}
            <Text className="text-text-secondary text-xs mt-1">
              When did you start this project? (Cannot be in the future)
            </Text>
          </View>

        </ScrollView>

        {/* Bottom Button */}
        <View className="px-4 py-4 border-t border-border">
          <Button
            title="Next"
            onPress={handleNext}
            disabled={isNextDisabled}
            variant="primary"
          />
        </View>

        {/* Date Picker Modal */}
        <DatePicker
          value={currentDate}
          onChange={handleDateChange}
          maximumDate={new Date()}
          visible={showDatePicker}
          onClose={handleDatePickerClose}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
