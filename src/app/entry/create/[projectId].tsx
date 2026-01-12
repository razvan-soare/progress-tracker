import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { TextInput, Button, IconButton, LoadingSpinner } from "@/components/ui";
import { useProjectsStore, useEntriesStore } from "@/lib/store";
import { useBackHandler } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import type { EntryType } from "@/types";

const MAX_CAPTION_LENGTH = 500;

export default function EntryCreateScreen() {
  const router = useRouter();
  const { projectId, mediaUri, mediaType, durationSeconds, thumbnailUri } = useLocalSearchParams<{
    projectId: string;
    mediaUri?: string;
    mediaType?: EntryType;
    durationSeconds?: string;
    thumbnailUri?: string;
  }>();

  const { showError, showSuccess } = useToast();
  const { projectsById, fetchProjectById } = useProjectsStore();
  const { createEntry, isLoading: isCreatingEntry } = useEntriesStore();

  const [caption, setCaption] = useState("");
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const project = projectId ? projectsById[projectId] : null;
  const hasMedia = Boolean(mediaUri && mediaType);
  const isTextEntry = !hasMedia;

  // For text-only entries, text is required (min 1 character)
  const isTextValid = isTextEntry ? caption.trim().length >= 1 : true;
  const canSave = isTextEntry ? isTextValid : true;

  // Check if form has unsaved data
  const hasUnsavedData = caption.trim().length > 0 || hasMedia;

  // Load project info
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        setIsLoadingProject(false);
        return;
      }

      if (!projectsById[projectId]) {
        await fetchProjectById(projectId);
      }
      setIsLoadingProject(false);
    };

    loadProject();
  }, [projectId, projectsById, fetchProjectById]);

  // Handle back button with discard warning
  const handleClose = useCallback(() => {
    if (hasUnsavedData) {
      Alert.alert(
        "Discard Entry?",
        "You have unsaved changes. Are you sure you want to discard this entry?",
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
  }, [hasUnsavedData, router]);

  // Handle hardware back button on Android
  useBackHandler({
    enabled: hasUnsavedData,
    onBack: () => {
      handleClose();
      return true; // Prevent default back action
    },
  });

  const handleCaptionChange = useCallback((text: string) => {
    // Limit to max length
    const trimmedText = text.slice(0, MAX_CAPTION_LENGTH);
    setCaption(trimmedText);
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectId) {
      showError("Invalid project");
      return;
    }

    if (isTextEntry && !isTextValid) {
      showError("Please enter some text for your entry");
      return;
    }

    setIsSaving(true);
    try {
      const entryType: EntryType = isTextEntry ? "text" : mediaType!;
      const duration = durationSeconds ? parseInt(durationSeconds, 10) : undefined;

      const newEntry = await createEntry({
        projectId,
        entryType,
        contentText: caption.trim() || undefined,
        mediaUri: hasMedia ? mediaUri : undefined,
        thumbnailUri: entryType === "video" ? thumbnailUri : undefined,
        durationSeconds: entryType === "video" ? duration : undefined,
      });

      showSuccess(isTextEntry ? "Text entry saved!" : "Entry saved!");

      // Navigate to entry view screen to preview the newly created entry
      // Use replace to avoid stacking create screen in navigation history
      // Pass projectId to enable "Go to Timeline" navigation
      router.replace(`/entry/view/${newEntry.id}?fromCreate=true&projectId=${projectId}` as Href);
    } catch (error) {
      console.error("Failed to save entry:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      showError(`Failed to save entry: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }, [
    projectId,
    isTextEntry,
    isTextValid,
    mediaType,
    mediaUri,
    thumbnailUri,
    durationSeconds,
    caption,
    hasMedia,
    createEntry,
    showSuccess,
    showError,
    router,
  ]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoadingProject) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner message="Loading..." />
        </View>
      </SafeAreaView>
    );
  }

  if (!projectId) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-error text-lg text-center">
            Invalid project. Please try again.
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="primary"
            className="mt-4"
          />
        </View>
      </SafeAreaView>
    );
  }

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
          <View className="flex-1 mx-4">
            <Text
              className="text-lg font-semibold text-text-primary text-center"
              numberOfLines={1}
            >
              {isTextEntry ? "New Text Entry" : "New Entry"}
            </Text>
            {project && (
              <Text
                className="text-sm text-text-secondary text-center"
                numberOfLines={1}
              >
                {project.name}
              </Text>
            )}
          </View>
          <View className="w-10" />
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {/* Media Thumbnail (if media entry) */}
          {hasMedia && (
            <View className="mt-4 items-center">
              <View className="rounded-xl overflow-hidden bg-surface relative">
                <Image
                  source={{ uri: mediaType === "video" && thumbnailUri ? thumbnailUri : mediaUri }}
                  className="w-64 h-64"
                  resizeMode="cover"
                  accessibilityLabel={
                    mediaType === "photo" ? "Captured photo" : "Captured video thumbnail"
                  }
                />
                {/* Video overlay indicator */}
                {mediaType === "video" && (
                  <>
                    {/* Play icon overlay */}
                    <View className="absolute inset-0 items-center justify-center">
                      <View className="w-12 h-12 bg-black/60 rounded-full items-center justify-center">
                        <Text className="text-white text-lg ml-0.5">▶</Text>
                      </View>
                    </View>
                    {/* Duration badge */}
                    {durationSeconds && (
                      <View className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded">
                        <Text className="text-white text-sm font-medium">
                          {formatDuration(parseInt(durationSeconds, 10))}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
              <Text className="text-text-secondary text-sm mt-2">
                {mediaType === "photo" ? "Photo" : "Video"} preview
              </Text>
            </View>
          )}

          {/* Text Entry Icon (if text-only) */}
          {isTextEntry && (
            <View className="mt-6 items-center">
              <View className="w-20 h-20 bg-surface rounded-full items-center justify-center">
                <Text className="text-4xl">📝</Text>
              </View>
              <Text className="text-text-secondary text-sm mt-2">
                Text Entry
              </Text>
            </View>
          )}

          {/* Caption Input */}
          <View className="mt-6">
            <TextInput
              label={isTextEntry ? "Entry Text *" : "Caption (optional)"}
              placeholder={isTextEntry ? "Write your entry..." : "Add a caption..."}
              value={caption}
              onChangeText={handleCaptionChange}
              maxLength={MAX_CAPTION_LENGTH}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              className="min-h-[150px]"
              error={
                isTextEntry && caption.trim().length === 0
                  ? undefined // Don't show error until they try to save
                  : undefined
              }
            />
            <Text className="text-text-secondary text-xs mt-1 text-right">
              {caption.length}/{MAX_CAPTION_LENGTH}
            </Text>
            {isTextEntry && (
              <Text className="text-text-secondary text-xs mt-1">
                Text is required for text entries
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View className="px-4 py-4 border-t border-border">
          <Button
            title="Save Entry"
            onPress={handleSave}
            disabled={!canSave}
            loading={isSaving || isCreatingEntry}
            variant="primary"
            accessibilityLabel="Save entry"
            accessibilityHint={
              isTextEntry
                ? "Saves your text entry to the project"
                : "Saves your media entry with optional caption to the project"
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
