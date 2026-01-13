import { useState, useCallback, useEffect } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Button, IconButton, SuccessCelebration, ErrorView, PermissionRequest, PermissionDenied } from "@/components/ui";
import { useWizardStore, useProjectsStore } from "@/lib/store";
import { useNotifications } from "@/lib/store/use-notifications";
import { useToast } from "@/lib/toast";
import { useBackHandler, useDebouncedPress, useMediaPermissions } from "@/lib/hooks";
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

type PermissionModalType = "camera" | "mediaLibrary" | "notification" | null;

export default function CoverImageScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const { formData, previousStep, resetWizard, setFormField, isDirty } = useWizardStore();
  const { createProject } = useProjectsStore();
  const {
    permissionStatus: notificationPermissionStatus,
    requestPermissions: requestNotificationPermissions,
    syncProjectNotifications,
  } = useNotifications();
  const {
    permissions,
    requestCameraPermission,
    requestMediaLibraryPermission,
    openSettings
  } = useMediaPermissions();

  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [permissionModal, setPermissionModal] = useState<PermissionModalType>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const gradientColors = formData.category
    ? CATEGORY_GRADIENTS[formData.category]
    : CATEGORY_GRADIENTS.custom;

  const categoryIcon = formData.category
    ? CATEGORY_ICONS[formData.category]
    : CATEGORY_ICONS.custom;

  // Handle Android back button with confirmation if wizard has data
  useBackHandler({
    enabled: isDirty && !isCreating,
    confirmExit: true,
    confirmTitle: "Discard Project?",
    confirmMessage: "Your project hasn't been created yet. Are you sure you want to leave?",
  });

  const handleBack = useDebouncedPress(
    useCallback(() => {
      previousStep();
      router.back();
    }, [previousStep, router]),
    300
  );

  const handleClose = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        "Discard Project?",
        "Your project hasn't been created yet. Are you sure you want to leave?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              resetWizard();
              router.replace("/");
            },
          },
        ]
      );
    } else {
      resetWizard();
      router.replace("/");
    }
  }, [isDirty, resetWizard, router]);

  const proceedWithCamera = useCallback(async () => {
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

  const proceedWithLibrary = useCallback(async () => {
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

  const handleTakePhoto = useCallback(() => {
    // Check permission status
    if (permissions.camera === "granted") {
      proceedWithCamera();
    } else if (permissions.camera === "denied") {
      // Show denied modal with settings option
      setPermissionModal("camera");
    } else {
      // Show permission request modal
      setPermissionModal("camera");
    }
  }, [permissions.camera, proceedWithCamera]);

  const handleChooseFromLibrary = useCallback(() => {
    // Check permission status
    if (permissions.mediaLibrary === "granted" || permissions.mediaLibrary === "limited") {
      proceedWithLibrary();
    } else if (permissions.mediaLibrary === "denied") {
      // Show denied modal with settings option
      setPermissionModal("mediaLibrary");
    } else {
      // Show permission request modal
      setPermissionModal("mediaLibrary");
    }
  }, [permissions.mediaLibrary, proceedWithLibrary]);

  const [pendingCreateAfterPermission, setPendingCreateAfterPermission] = useState(false);

  const handleRequestPermission = useCallback(async () => {
    setIsRequestingPermission(true);

    let granted = false;
    if (permissionModal === "camera") {
      granted = await requestCameraPermission();
      if (granted) {
        setPermissionModal(null);
        proceedWithCamera();
      }
    } else if (permissionModal === "mediaLibrary") {
      granted = await requestMediaLibraryPermission();
      if (granted) {
        setPermissionModal(null);
        proceedWithLibrary();
      }
    } else if (permissionModal === "notification") {
      granted = await requestNotificationPermissions();
      setPermissionModal(null);
      if (granted) {
        // Set flag to trigger project creation after permission granted
        setPendingCreateAfterPermission(true);
      } else {
        showError("Notification permission is required for reminders. You can create the project without reminders or enable them later.");
      }
    }

    setIsRequestingPermission(false);
  }, [permissionModal, requestCameraPermission, requestMediaLibraryPermission, proceedWithCamera, proceedWithLibrary, requestNotificationPermissions, showError]);

  const handleOpenSettings = useCallback(() => {
    openSettings();
    setPermissionModal(null);
  }, [openSettings]);

  const handleClosePermissionModal = useCallback(() => {
    setPermissionModal(null);
  }, []);

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
      showError("Please select a category");
      return;
    }

    // If reminders are enabled, check/request notification permissions first
    if (formData.reminderEnabled && notificationPermissionStatus !== "granted") {
      setPermissionModal("notification");
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

      // Schedule notifications if reminders are enabled
      if (project.reminderTime && project.reminderDays?.length) {
        try {
          await syncProjectNotifications(project);
        } catch (notificationError) {
          // Log but don't fail project creation for notification errors
          console.warn("Failed to schedule notifications:", notificationError);
        }
      }

      // Store project ID for navigation after celebration
      setCreatedProjectId(project.id);

      // Show celebration animation
      setShowCelebration(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setError(message);
      showError(message);
      setIsCreating(false);
    }
  }, [formData, createProject, showError, notificationPermissionStatus, syncProjectNotifications]);

  // Effect to trigger project creation after notification permission is granted
  useEffect(() => {
    if (pendingCreateAfterPermission) {
      setPendingCreateAfterPermission(false);
      handleCreateProject();
    }
  }, [pendingCreateAfterPermission, handleCreateProject]);

  const handleCelebrationComplete = useCallback(() => {
    setShowCelebration(false);

    // Reset wizard state
    resetWizard();

    // Navigate to the new project's detail screen
    if (createdProjectId) {
      router.replace(`/project/${createdProjectId}` as Href);
    } else {
      router.replace("/");
    }
  }, [resetWizard, router, createdProjectId]);

  const handleRetry = useDebouncedPress(
    useCallback(() => {
      setError(null);
      handleCreateProject();
    }, [handleCreateProject]),
    300
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <IconButton
          icon="←"
          variant="default"
          size="md"
          onPress={handleBack}
          accessibilityLabel="Go back to previous step"
          disabled={isCreating}
        />
        <Text
          className="text-lg font-semibold text-text-primary"
          accessibilityRole="header"
        >
          New Project
        </Text>
        <IconButton
          icon="×"
          variant="default"
          size="md"
          onPress={handleClose}
          accessibilityLabel="Cancel and discard project"
          disabled={isCreating}
        />
      </View>

      {/* Progress Indicator */}
      <View className="px-4 py-3" accessibilityLabel="Step 3 of 3, Cover Image">
        <View className="flex-row items-center justify-center">
          <View className="flex-row items-center">
            <View
              className="w-8 h-8 rounded-full bg-primary items-center justify-center"
              accessibilityLabel="Step 1 complete"
            >
              <Text className="text-white font-semibold">✓</Text>
            </View>
            <View className="w-12 h-0.5 bg-primary mx-2" />
            <View
              className="w-8 h-8 rounded-full bg-primary items-center justify-center"
              accessibilityLabel="Step 2 complete"
            >
              <Text className="text-white font-semibold">✓</Text>
            </View>
            <View className="w-12 h-0.5 bg-primary mx-2" />
            <View
              className="w-8 h-8 rounded-full bg-primary items-center justify-center"
              accessibilityLabel="Current step: 3"
            >
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
          <Text
            className="text-text-primary text-base font-semibold mb-3"
            accessibilityRole="header"
          >
            Cover Image (Optional)
          </Text>

          <View
            className="bg-surface rounded-xl overflow-hidden aspect-video"
            accessibilityLabel={
              formData.coverImageUri
                ? "Cover image selected"
                : "No cover image selected"
            }
          >
            {isLoadingImage ? (
              <View
                className="flex-1 items-center justify-center bg-surface"
                accessibilityRole="progressbar"
                accessibilityLabel="Processing image"
              >
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
                accessibilityLabel="Selected cover image"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="flex-1 items-center justify-center"
              >
                <Text className="text-6xl" accessibilityElementsHidden>
                  {categoryIcon}
                </Text>
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
            accessibilityLabel="Take a photo for cover image"
            accessibilityState={{ disabled: isLoadingImage || isCreating }}
            style={{ minHeight: 80 }}
          >
            <Text className="text-2xl mb-1" accessibilityElementsHidden>
              📷
            </Text>
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
            accessibilityLabel="Choose photo from library"
            accessibilityState={{ disabled: isLoadingImage || isCreating }}
            style={{ minHeight: 80 }}
          >
            <Text className="text-2xl mb-1" accessibilityElementsHidden>
              🖼️
            </Text>
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
            accessibilityRole="button"
            accessibilityLabel="Remove cover image"
            style={{ minHeight: 44 }}
          >
            <Text className="text-error text-center text-sm">
              Remove Image
            </Text>
          </Pressable>
        )}

        {/* Error Message */}
        {error && (
          <View className="mt-4">
            <ErrorView
              compact
              title="Error"
              message={error}
              icon="⚠️"
              onRetry={error.includes("Failed to create") ? handleRetry : undefined}
            />
          </View>
        )}

        {/* Project Summary */}
        <View
          className="mt-6 bg-surface rounded-xl p-4"
          accessibilityLabel={`Project summary: ${formData.name}, ${formData.category} category${formData.reminderEnabled ? ", reminders enabled" : ""}`}
        >
          <Text className="text-text-secondary text-xs uppercase tracking-wide mb-2">
            Project Summary
          </Text>
          <Text
            className="text-text-primary text-base font-semibold"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formData.name}
          </Text>
          {formData.description && (
            <Text
              className="text-text-secondary text-sm mt-1"
              numberOfLines={2}
              ellipsizeMode="tail"
            >
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
          accessibilityLabel={isCreating ? "Creating project, please wait" : "Create project"}
        />
      </View>

      {/* Success Celebration */}
      <SuccessCelebration
        visible={showCelebration}
        message="Project Created!"
        onComplete={handleCelebrationComplete}
      />

      {/* Permission Modal */}
      <Modal
        visible={permissionModal !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClosePermissionModal}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center px-6"
          onPress={handleClosePermissionModal}
        >
          <Pressable onPress={() => {}}>
            {permissionModal !== null && permissionModal !== "notification" && (
              permissions[permissionModal] === "denied" ? (
                <PermissionDenied
                  permissionType={permissionModal}
                  onOpenSettings={handleOpenSettings}
                  onCancel={handleClosePermissionModal}
                  compact
                />
              ) : (
                <PermissionRequest
                  permissionType={permissionModal}
                  onRequestPermission={handleRequestPermission}
                  loading={isRequestingPermission}
                  compact
                />
              )
            )}
            {permissionModal === "notification" && (
              notificationPermissionStatus === "denied" ? (
                <PermissionDenied
                  permissionType="notification"
                  onOpenSettings={handleOpenSettings}
                  onCancel={handleClosePermissionModal}
                  compact
                />
              ) : (
                <PermissionRequest
                  permissionType="notification"
                  onRequestPermission={handleRequestPermission}
                  loading={isRequestingPermission}
                  compact
                />
              )
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
