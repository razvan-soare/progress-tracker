import { useState, useCallback } from "react";
import { View, Text, Image, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Button, IconButton } from "@/components/ui";
import { useWizardStore, useProjectsStore } from "@/lib/store";
import { pickImageFromCamera, pickImageFromLibrary, deleteImage } from "@/lib/utils";
import { getDatabase } from "@/lib/db/database";
import { generateId, formatDateTime } from "@/lib/utils";
import { colors } from "@/constants/colors";

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  fitness: ["#f97316", "#dc2626"],
  learning: ["#3b82f6", "#8b5cf6"],
  creative: ["#ec4899", "#f43f5e"],
  custom: ["#6366f1", "#8b5cf6"],
};

const CATEGORY_ICONS: Record<string, string> = {
  fitness: "🏋️",
  learning: "📚",
  creative: "🎨",
  custom: "✨",
};

export default function CoverImageScreen() {
  const router = useRouter();
  const { formData, previousStep, resetWizard, setFormField } = useWizardStore();
  const { createProject } = useProjectsStore();

  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradientColors = formData.category
    ? CATEGORY_GRADIENTS[formData.category]
    : CATEGORY_GRADIENTS.custom;

  const categoryIcon = formData.category
    ? CATEGORY_ICONS[formData.category]
    : CATEGORY_ICONS.custom;

  const handleBack = () => {
    previousStep();
    router.back();
  };

  const handleClose = () => {
    resetWizard();
    router.replace("/");
  };

  const handleTakePhoto = useCallback(async () => {
    setIsLoadingImage(true);
    setError(null);

    const result = await pickImageFromCamera();

    if (result.success) {
      setFormField("coverImageUri", result.uri);
    } else if (!result.cancelled) {
      setError(result.error);
    }

    setIsLoadingImage(false);
  }, [setFormField]);

  const handleChooseFromLibrary = useCallback(async () => {
    setIsLoadingImage(true);
    setError(null);

    const result = await pickImageFromLibrary();

    if (result.success) {
      setFormField("coverImageUri", result.uri);
    } else if (!result.cancelled) {
      setError(result.error);
    }

    setIsLoadingImage(false);
  }, [setFormField]);

  const handleRemoveImage = useCallback(async () => {
    if (formData.coverImageUri) {
      await deleteImage(formData.coverImageUri);
      setFormField("coverImageUri", null);
    }
  }, [formData.coverImageUri, setFormField]);

  const addToSyncQueue = async (projectId: string) => {
    try {
      const db = await getDatabase();
      const now = formatDateTime(new Date());
      await db.runAsync(
        `INSERT INTO sync_queue (id, table_name, record_id, operation, created_at, attempts)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [generateId(), "projects", projectId, "create", now, 0]
      );
    } catch {
      // Sync queue failure shouldn't block project creation
      console.warn("Failed to add project to sync queue");
    }
  };

  const handleCreateProject = useCallback(async () => {
    if (!formData.category) {
      setError("Category is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const project = await createProject({
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category,
        coverImageUri: formData.coverImageUri || undefined,
        startDate: formData.startDate,
        reminderTime: formData.reminderEnabled ? formData.reminderTime : undefined,
        reminderDays: formData.reminderEnabled ? formData.reminderDays : undefined,
      });

      // Add to sync queue for cloud sync
      await addToSyncQueue(project.id);

      // Reset wizard state
      resetWizard();

      // Navigate to the new project's detail screen
      router.replace(`/project/${project.id}` as Href);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setError(message);
      setIsCreating(false);
    }
  }, [formData, createProject, resetWizard, router]);

  const handleRetry = () => {
    setError(null);
    handleCreateProject();
  };

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
          disabled={isCreating}
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
          disabled={isCreating}
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
              <Text className="text-white font-semibold">✓</Text>
            </View>
            <View className="w-12 h-0.5 bg-primary mx-2" />
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
              <Text className="text-white font-semibold">3</Text>
            </View>
          </View>
        </View>
        <Text className="text-text-secondary text-center mt-2 text-sm">
          Step 3 of 3 - Cover Image
        </Text>
      </View>

      {/* Content */}
      <View className="flex-1 px-4">
        {/* Cover Image Preview */}
        <View className="mt-4">
          <Text className="text-text-primary text-base font-semibold mb-3">
            Cover Image (Optional)
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
                  Add a cover image
                </Text>
              </LinearGradient>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={handleTakePhoto}
            disabled={isLoadingImage || isCreating}
            className={`flex-1 bg-surface rounded-xl py-4 px-4 items-center active:opacity-80 ${
              isLoadingImage || isCreating ? "opacity-50" : ""
            }`}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            <Text className="text-2xl mb-1">📷</Text>
            <Text className="text-text-primary text-sm font-medium">
              Take Photo
            </Text>
          </Pressable>

          <Pressable
            onPress={handleChooseFromLibrary}
            disabled={isLoadingImage || isCreating}
            className={`flex-1 bg-surface rounded-xl py-4 px-4 items-center active:opacity-80 ${
              isLoadingImage || isCreating ? "opacity-50" : ""
            }`}
            accessibilityRole="button"
            accessibilityLabel="Choose from library"
          >
            <Text className="text-2xl mb-1">🖼️</Text>
            <Text className="text-text-primary text-sm font-medium">
              Choose from Library
            </Text>
          </Pressable>
        </View>

        {/* Remove Image Option */}
        {formData.coverImageUri && !isLoadingImage && (
          <Pressable
            onPress={handleRemoveImage}
            disabled={isCreating}
            className={`mt-3 py-2 ${isCreating ? "opacity-50" : ""}`}
          >
            <Text className="text-error text-center text-sm">
              Remove Image
            </Text>
          </Pressable>
        )}

        {/* Error Message */}
        {error && (
          <View className="mt-4 bg-error/10 rounded-xl p-4">
            <Text className="text-error text-sm text-center">{error}</Text>
            {error.includes("Failed to create") && (
              <Pressable onPress={handleRetry} className="mt-2">
                <Text className="text-primary text-center text-sm font-medium">
                  Tap to retry
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Project Summary */}
        <View className="mt-6 bg-surface rounded-xl p-4">
          <Text className="text-text-secondary text-xs uppercase tracking-wide mb-2">
            Project Summary
          </Text>
          <Text className="text-text-primary text-base font-semibold">
            {formData.name}
          </Text>
          {formData.description && (
            <Text className="text-text-secondary text-sm mt-1" numberOfLines={2}>
              {formData.description}
            </Text>
          )}
          <View className="flex-row items-center mt-2">
            <Text className="text-text-secondary text-sm">
              {categoryIcon} {formData.category && formData.category.charAt(0).toUpperCase() + formData.category.slice(1)}
            </Text>
            {formData.reminderEnabled && (
              <Text className="text-text-secondary text-sm ml-3">
                🔔 Reminders on
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Bottom Button */}
      <View className="px-4 py-4 border-t border-border">
        <Button
          title={isCreating ? "Creating..." : "Create Project"}
          onPress={handleCreateProject}
          disabled={isCreating || isLoadingImage}
          loading={isCreating}
          variant="primary"
        />
      </View>
    </SafeAreaView>
  );
}
