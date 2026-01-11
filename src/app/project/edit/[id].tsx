import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  TextInput,
  Button,
  IconButton,
  DatePicker,
  TimePicker,
  ErrorView,
  FormSkeleton,
} from "@/components/ui";
import { useProjectsStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { useBackHandler, useDebouncedPress } from "@/lib/hooks";
import {
  formatDate,
  formatDateTime,
  generateId,
  pickImageFromCamera,
  pickImageFromLibrary,
  deleteImage,
} from "@/lib/utils";
import { getDatabase } from "@/lib/db/database";
import { colors } from "@/constants/colors";
import type { ProjectCategory, Project } from "@/types";

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

const CATEGORY_GRADIENTS: Record<ProjectCategory, [string, string]> = {
  fitness: ["#f97316", "#dc2626"],
  learning: ["#3b82f6", "#8b5cf6"],
  creative: ["#ec4899", "#f43f5e"],
  custom: ["#6366f1", "#8b5cf6"],
};

const CATEGORY_ICONS: Record<ProjectCategory, string> = {
  fitness: "🏋️",
  learning: "📚",
  creative: "🎨",
  custom: "✨",
};

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

interface FormData {
  name: string;
  description: string;
  category: ProjectCategory;
  startDate: string;
  reminderEnabled: boolean;
  reminderTime: string;
  reminderDays: string[];
  coverImageUri: string | null;
}

interface FormErrors {
  name?: string;
  description?: string;
  startDate?: string;
}

function formatTimeForDisplay(time: string): string {
  const [hour, minute] = time.split(":");
  const h = parseInt(hour, 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${minute} ${period}`;
}

function formatDisplayDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function LoadingSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="w-10 h-10 bg-surface rounded" />
        <View className="w-32 h-6 bg-surface rounded" />
        <View className="w-10 h-10 bg-surface rounded" />
      </View>
      <View className="flex-1 px-4 py-4">
        <View className="w-full h-12 bg-surface rounded-lg mb-4" />
        <View className="w-full h-24 bg-surface rounded-lg mb-4" />
        <View className="w-full h-12 bg-surface rounded-lg mb-4" />
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 h-28 bg-surface rounded-xl" />
          <View className="flex-1 h-28 bg-surface rounded-xl" />
        </View>
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 h-28 bg-surface rounded-xl" />
          <View className="flex-1 h-28 bg-surface rounded-xl" />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function EditProjectScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showSuccess, showError } = useToast();
  const {
    fetchProjectById,
    fetchProjectStats,
    updateProject,
    deleteProject,
    projectsById,
    projectStats,
  } = useProjectsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    category: "custom",
    startDate: formatDate(new Date()),
    reminderEnabled: false,
    reminderTime: "09:00",
    reminderDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    coverImageUri: null,
  });

  const [originalData, setOriginalData] = useState<FormData | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [nameBlurred, setNameBlurred] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const project = id ? projectsById[id] : null;
  const stats = id ? projectStats[id] : null;

  // Load project data on mount
  useEffect(() => {
    const loadProject = async () => {
      if (!id) {
        setError("Project not found");
        setIsLoading(false);
        return;
      }

      try {
        const fetched = await fetchProjectById(id);
        if (!fetched) {
          setError("Project not found");
          setIsLoading(false);
          return;
        }

        await fetchProjectStats(id);

        const initialFormData: FormData = {
          name: fetched.name,
          description: fetched.description || "",
          category: fetched.category,
          startDate: fetched.startDate,
          reminderEnabled: Boolean(
            fetched.reminderTime && fetched.reminderDays?.length
          ),
          reminderTime: fetched.reminderTime || "09:00",
          reminderDays: fetched.reminderDays || [
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
          ],
          coverImageUri: fetched.coverImageUri || null,
        };

        setFormData(initialFormData);
        setOriginalData(initialFormData);
      } catch {
        setError("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [id, fetchProjectById, fetchProjectStats]);

  // Check if form has changes
  const isDirty = useMemo(() => {
    if (!originalData) return false;

    return (
      formData.name !== originalData.name ||
      formData.description !== originalData.description ||
      formData.category !== originalData.category ||
      formData.startDate !== originalData.startDate ||
      formData.reminderEnabled !== originalData.reminderEnabled ||
      formData.reminderTime !== originalData.reminderTime ||
      JSON.stringify(formData.reminderDays.sort()) !==
        JSON.stringify(originalData.reminderDays.sort()) ||
      formData.coverImageUri !== originalData.coverImageUri
    );
  }, [formData, originalData]);

  // Check if start date has changed (for warning)
  const startDateChanged = useMemo(() => {
    if (!originalData) return false;
    return formData.startDate !== originalData.startDate;
  }, [formData.startDate, originalData]);

  // Validate form
  const hasValidationErrors = useMemo(() => {
    if (!formData.name.trim()) return true;
    if (formData.name.length > MAX_NAME_LENGTH) return true;
    if (formData.description.length > MAX_DESCRIPTION_LENGTH) return true;
    return false;
  }, [formData.name, formData.description]);

  const canSave = isDirty && !hasValidationErrors && !isSaving;

  // Handle Android back button
  useBackHandler({
    enabled: isDirty && !isSaving && !isDeleting,
    confirmExit: true,
    confirmTitle: "Discard Changes?",
    confirmMessage: "You have unsaved changes. Are you sure you want to leave?",
  });

  const setFormField = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when field is changed
      if (field in errors) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const handleClose = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [isDirty, router]);

  const handleNameChange = useCallback(
    (text: string) => {
      const trimmedText = text.slice(0, MAX_NAME_LENGTH);
      setFormField("name", trimmedText);
    },
    [setFormField]
  );

  const handleNameBlur = useCallback(() => {
    setNameBlurred(true);
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setErrors((prev) => ({ ...prev, name: "Project name is required" }));
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      setErrors((prev) => ({
        ...prev,
        name: `Project name must be ${MAX_NAME_LENGTH} characters or less`,
      }));
    } else {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  }, [formData.name]);

  const handleDescriptionChange = useCallback(
    (text: string) => {
      const trimmedText = text.slice(0, MAX_DESCRIPTION_LENGTH);
      setFormField("description", trimmedText);
    },
    [setFormField]
  );

  const handleDescriptionBlur = useCallback(() => {
    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      setErrors((prev) => ({
        ...prev,
        description: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
      }));
    } else {
      setErrors((prev) => ({ ...prev, description: undefined }));
    }
  }, [formData.description]);

  const handleDatePress = useCallback(() => {
    if (stats && stats.totalEntries > 0) {
      Alert.alert(
        "Change Start Date?",
        "Changing the start date will affect your project statistics like 'Days Active'. Are you sure you want to continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => setShowDatePicker(true),
          },
        ]
      );
    } else {
      setShowDatePicker(true);
    }
  }, [stats]);

  const handleDateChange = useCallback(
    (selectedDate: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate > today) {
        setErrors((prev) => ({
          ...prev,
          startDate: "Start date cannot be in the future",
        }));
      } else {
        setFormField("startDate", formatDate(selectedDate));
        setErrors((prev) => ({ ...prev, startDate: undefined }));
      }
    },
    [setFormField]
  );

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

  const handleTakePhoto = useCallback(async () => {
    setIsLoadingImage(true);
    setError(null);

    const result = await pickImageFromCamera();

    if (result.success) {
      setFormField("coverImageUri", result.uri);
    } else if (!result.cancelled) {
      setError(result.error);
      showError(result.error || "Failed to take photo");
    }

    setIsLoadingImage(false);
  }, [setFormField, showError]);

  const handleChooseFromLibrary = useCallback(async () => {
    setIsLoadingImage(true);
    setError(null);

    const result = await pickImageFromLibrary();

    if (result.success) {
      setFormField("coverImageUri", result.uri);
    } else if (!result.cancelled) {
      setError(result.error);
      showError(result.error || "Failed to pick image");
    }

    setIsLoadingImage(false);
  }, [setFormField, showError]);

  const handleRemoveImage = useCallback(async () => {
    if (formData.coverImageUri && formData.coverImageUri !== originalData?.coverImageUri) {
      await deleteImage(formData.coverImageUri);
    }
    setFormField("coverImageUri", null);
  }, [formData.coverImageUri, originalData?.coverImageUri, setFormField]);

  const addToSyncQueue = async (projectId: string, operation: "update" | "delete") => {
    try {
      const db = await getDatabase();
      const now = formatDateTime(new Date());
      await db.runAsync(
        `INSERT INTO sync_queue (id, table_name, record_id, operation, created_at, attempts)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [generateId(), "projects", projectId, operation, now, 0]
      );
    } catch {
      console.warn(`Failed to add project ${operation} to sync queue`);
    }
  };

  const handleSave = useCallback(async () => {
    if (!id || !canSave) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateProject(id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        startDate: formData.startDate,
        reminderTime: formData.reminderEnabled ? formData.reminderTime : undefined,
        reminderDays: formData.reminderEnabled ? formData.reminderDays : undefined,
        coverImageUri: formData.coverImageUri || undefined,
      });

      await addToSyncQueue(id, "update");

      showSuccess("Project updated successfully");
      // Navigate back to project detail
      router.back();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save changes";
      setError(message);
      showError(message);
    } finally {
      setIsSaving(false);
    }
  }, [id, canSave, formData, updateProject, router, showSuccess, showError]);

  const handleDelete = useCallback(() => {
    if (!id) return;

    const entryCount = stats?.totalEntries || 0;

    Alert.alert(
      "Delete Project?",
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (entryCount > 0) {
              Alert.alert(
                "Delete All Entries?",
                `This project has ${entryCount} ${entryCount === 1 ? "entry" : "entries"} that will also be deleted.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete All",
                    style: "destructive",
                    onPress: performDelete,
                  },
                ]
              );
            } else {
              performDelete();
            }
          },
        },
      ]
    );
  }, [id, stats]);

  const performDelete = useCallback(async () => {
    if (!id) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteProject(id);
      await addToSyncQueue(id, "delete");

      showSuccess("Project deleted");
      // Navigate to home
      router.replace("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete project";
      setError(message);
      showError(message);
      setIsDeleting(false);
    }
  }, [id, deleteProject, router, showSuccess, showError]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error && !project) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <IconButton
            icon="←"
            variant="default"
            size="md"
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-5xl mb-4">😕</Text>
          <Text className="text-text-primary text-lg font-semibold text-center mb-2">
            Project Not Found
          </Text>
          <Text className="text-text-secondary text-center mb-6">
            {error || "The project you're looking for doesn't exist."}
          </Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const gradientColors = CATEGORY_GRADIENTS[formData.category];
  const categoryIcon = CATEGORY_ICONS[formData.category];

  const currentDate = formData.startDate
    ? new Date(formData.startDate + "T00:00:00")
    : new Date();

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
            icon="←"
            variant="default"
            size="md"
            onPress={handleClose}
            accessibilityLabel="Back"
            disabled={isSaving || isDeleting}
          />
          <Text className="text-lg font-semibold text-text-primary">
            Edit Project
          </Text>
          <View className="w-10" />
        </View>

        {/* Form Content */}
        <ScrollView
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
              editable={!isSaving && !isDeleting}
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
              editable={!isSaving && !isDeleting}
            />
            <Text className="text-text-secondary text-xs mt-1 text-right">
              {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
            </Text>
          </View>

          {/* Category Selection */}
          <View className="mt-6">
            <Text className="text-text-primary text-base font-semibold mb-3">
              Category
            </Text>

            <View className="flex-row flex-wrap -mx-1.5">
              {CATEGORIES.map((category) => {
                const isSelected = formData.category === category.id;
                return (
                  <View key={category.id} className="w-1/2 p-1.5">
                    <Pressable
                      onPress={() => handleCategorySelect(category.id)}
                      disabled={isSaving || isDeleting}
                      className={`bg-surface rounded-xl p-4 items-center justify-center min-h-[100px] border-2 ${
                        isSelected ? "border-primary" : "border-transparent"
                      } active:opacity-80 ${isSaving || isDeleting ? "opacity-50" : ""}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${category.label} category`}
                    >
                      <Text className="text-3xl mb-2">{category.icon}</Text>
                      <Text className="text-text-primary text-sm font-semibold">
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
          </View>

          {/* Start Date */}
          <View className="mt-6">
            <Text className="text-text-secondary text-sm mb-2">Start Date</Text>
            <Pressable
              onPress={handleDatePress}
              disabled={isSaving || isDeleting}
              className={`bg-surface px-4 py-3 rounded-lg border ${
                startDateChanged ? "border-warning" : "border-transparent"
              } active:opacity-80 ${isSaving || isDeleting ? "opacity-50" : ""}`}
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
            {startDateChanged && !errors.startDate && (
              <Text className="text-warning text-xs mt-1">
                Changing the start date will affect your statistics
              </Text>
            )}
          </View>

          {/* Reminders */}
          <View className="mt-6">
            <Text className="text-text-primary text-base font-semibold mb-3">
              Reminders
            </Text>

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
                  disabled={isSaving || isDeleting}
                />
              </View>

              {formData.reminderEnabled && (
                <View className="mt-4 pt-4 border-t border-border">
                  {/* Time Picker */}
                  <View className="mb-4">
                    <Text className="text-text-secondary text-sm mb-2">
                      Reminder Time
                    </Text>
                    <Pressable
                      onPress={() => setShowTimePicker(true)}
                      disabled={isSaving || isDeleting}
                      className={`bg-background px-4 py-3 rounded-lg active:opacity-80 ${
                        isSaving || isDeleting ? "opacity-50" : ""
                      }`}
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
                            disabled={isSaving || isDeleting}
                            className={`w-10 h-10 rounded-full items-center justify-center ${
                              isSelected ? "bg-primary" : "bg-background"
                            } active:opacity-80 ${
                              isSaving || isDeleting ? "opacity-50" : ""
                            }`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={day.id}
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

          {/* Cover Image */}
          <View className="mt-6">
            <Text className="text-text-primary text-base font-semibold mb-3">
              Cover Image
            </Text>

            <View className="bg-surface rounded-xl overflow-hidden aspect-video">
              {isLoadingImage ? (
                <View className="flex-1 items-center justify-center bg-surface">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text className="text-text-secondary mt-3 text-sm">
                    Processing image...
                  </Text>
                </View>
              ) : formData.coverImageUri ? (
                <Image
                  source={{ uri: formData.coverImageUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="flex-1 items-center justify-center"
                >
                  <Text className="text-6xl">{categoryIcon}</Text>
                  <Text className="text-white/80 mt-3 text-sm">
                    No cover image
                  </Text>
                </LinearGradient>
              )}
            </View>

            {/* Image Action Buttons */}
            <View className="mt-3 flex-row gap-3">
              <Pressable
                onPress={handleTakePhoto}
                disabled={isLoadingImage || isSaving || isDeleting}
                className={`flex-1 bg-surface rounded-xl py-3 px-4 items-center active:opacity-80 ${
                  isLoadingImage || isSaving || isDeleting ? "opacity-50" : ""
                }`}
              >
                <Text className="text-xl mb-1">📷</Text>
                <Text className="text-text-primary text-xs font-medium">
                  Take Photo
                </Text>
              </Pressable>

              <Pressable
                onPress={handleChooseFromLibrary}
                disabled={isLoadingImage || isSaving || isDeleting}
                className={`flex-1 bg-surface rounded-xl py-3 px-4 items-center active:opacity-80 ${
                  isLoadingImage || isSaving || isDeleting ? "opacity-50" : ""
                }`}
              >
                <Text className="text-xl mb-1">🖼️</Text>
                <Text className="text-text-primary text-xs font-medium">
                  From Library
                </Text>
              </Pressable>
            </View>

            {formData.coverImageUri && !isLoadingImage && (
              <Pressable
                onPress={handleRemoveImage}
                disabled={isSaving || isDeleting}
                className={`mt-2 py-2 ${isSaving || isDeleting ? "opacity-50" : ""}`}
              >
                <Text className="text-error text-center text-sm">
                  Remove Image
                </Text>
              </Pressable>
            )}
          </View>

          {/* Error Message */}
          {error && (
            <View className="mt-4 bg-error/10 rounded-xl p-4">
              <Text className="text-error text-sm text-center">{error}</Text>
            </View>
          )}

          {/* Delete Section */}
          <View className="mt-8 pt-6 border-t border-border">
            <Text className="text-text-secondary text-xs uppercase tracking-wide mb-3 font-medium">
              Danger Zone
            </Text>

            <Pressable
              onPress={handleDelete}
              disabled={isSaving || isDeleting}
              className={`bg-error/10 border border-error rounded-xl py-4 px-4 items-center active:opacity-80 ${
                isSaving || isDeleting ? "opacity-50" : ""
              }`}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Text className="text-error text-base font-semibold">
                    Delete Project
                  </Text>
                  <Text className="text-error/70 text-xs mt-1">
                    This action cannot be undone
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>

        {/* Bottom Save Button */}
        <View className="px-4 py-4 border-t border-border">
          <Button
            title={isSaving ? "Saving..." : "Save Changes"}
            onPress={handleSave}
            disabled={!canSave || isDeleting}
            loading={isSaving}
            variant="primary"
          />
          {!isDirty && (
            <Text className="text-text-secondary text-xs text-center mt-2">
              No changes to save
            </Text>
          )}
        </View>

        {/* Date Picker Modal */}
        <DatePicker
          value={currentDate}
          onChange={handleDateChange}
          maximumDate={new Date()}
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
        />

        {/* Time Picker Modal */}
        <TimePicker
          value={formData.reminderTime}
          onChange={handleTimeChange}
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
