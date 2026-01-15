import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { TextInput, Button, IconButton, LoadingSpinner, CompressionOverlay } from "@/components/ui";
import { useProjectsStore, useEntriesStore } from "@/lib/store";
import { useBackHandler } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { useNetwork } from "@/lib/network/NetworkContext";
import { useBackgroundUpload } from "@/lib/sync/useBackgroundUpload";
import {
  pickMediaFromLibrary,
  compressPhoto,
  compressVideo,
  generateVideoThumbnailSafe,
  deleteImage,
} from "@/lib/utils";
import { deleteAsync } from "expo-file-system/legacy";
import type { EntryType } from "@/types";

const MAX_CAPTION_LENGTH = 500;

type MediaState = {
  uri: string;
  type: EntryType;
  thumbnailUri?: string;
  durationSeconds?: number;
};

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
  const { isOnline } = useNetwork();
  const { checkPendingUploads } = useBackgroundUpload({ autoStart: true });

  const [caption, setCaption] = useState("");
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Preparing media...");

  // Local media state (from URL params or user selection)
  const [localMedia, setLocalMedia] = useState<MediaState | null>(() => {
    if (mediaUri && mediaType) {
      return {
        uri: mediaUri,
        type: mediaType,
        thumbnailUri: thumbnailUri,
        durationSeconds: durationSeconds ? parseInt(durationSeconds, 10) : undefined,
      };
    }
    return null;
  });

  const project = projectId ? projectsById[projectId] : null;
  const hasMedia = Boolean(localMedia);
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

  const handlePickMedia = useCallback(async () => {
    setIsProcessingMedia(true);
    setProcessingMessage("Selecting media...");

    try {
      const result = await pickMediaFromLibrary();

      if (!result.success) {
        if (!result.cancelled) {
          showError(result.error);
        }
        setIsProcessingMedia(false);
        return;
      }

      const { uri, type, duration } = result;

      // Process the media (compress and generate thumbnail if needed)
      setProcessingMessage(type === "photo" ? "Compressing photo..." : "Processing video...");

      if (type === "photo") {
        const compressionResult = await compressPhoto(uri);

        if (!compressionResult.success) {
          showError(`Failed to compress photo: ${compressionResult.error}`);
          // Clean up the original file
          await deleteImage(uri);
          setIsProcessingMedia(false);
          return;
        }

        // Clean up original file if compression created a new file
        if (compressionResult.uri !== uri) {
          await deleteImage(uri);
        }

        setLocalMedia({
          uri: compressionResult.uri,
          type: "photo",
        });
      } else {
        // Video processing
        setProcessingMessage("Copying video...");
        const compressionResult = await compressVideo(uri);

        if (!compressionResult.success) {
          showError(`Failed to process video: ${compressionResult.error}`);
          // Clean up the original file
          try {
            await deleteAsync(uri, { idempotent: true });
          } catch {
            // Ignore cleanup errors
          }
          setIsProcessingMedia(false);
          return;
        }

        // Generate thumbnail
        setProcessingMessage("Generating thumbnail...");
        const thumbnailResult = await generateVideoThumbnailSafe(compressionResult.uri);

        // Clean up original file if it's different from compressed
        if (compressionResult.uri !== uri) {
          try {
            await deleteAsync(uri, { idempotent: true });
          } catch {
            // Ignore cleanup errors
          }
        }

        setLocalMedia({
          uri: compressionResult.uri,
          type: "video",
          thumbnailUri: thumbnailResult.success ? thumbnailResult.uri : undefined,
          durationSeconds: duration,
        });
      }

      showSuccess(type === "photo" ? "Photo added!" : "Video added!");
    } catch (error) {
      console.error("Failed to pick media:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      showError(`Failed to add media: ${errorMessage}`);
    } finally {
      setIsProcessingMedia(false);
    }
  }, [showError, showSuccess]);

  const handleRemoveMedia = useCallback(async () => {
    if (!localMedia) return;

    Alert.alert(
      "Remove Media?",
      "Are you sure you want to remove this media?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // Clean up files
            try {
              if (localMedia.uri) {
                await deleteAsync(localMedia.uri, { idempotent: true });
              }
              if (localMedia.thumbnailUri) {
                await deleteAsync(localMedia.thumbnailUri, { idempotent: true });
              }
            } catch {
              // Ignore cleanup errors
            }

            setLocalMedia(null);
          },
        },
      ]
    );
  }, [localMedia]);

  const handleSave = useCallback(async (mode: "now" | "later" = "now") => {
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
      const entryType: EntryType = isTextEntry ? "text" : localMedia!.type;

      const newEntry = await createEntry({
        projectId,
        entryType,
        contentText: caption.trim() || undefined,
        mediaUri: hasMedia ? localMedia!.uri : undefined,
        thumbnailUri: entryType === "video" ? localMedia?.thumbnailUri : undefined,
        durationSeconds: entryType === "video" ? localMedia?.durationSeconds : undefined,
      });

      // If "Upload Now" is selected and we're online, trigger immediate upload check
      if (mode === "now" && isOnline && hasMedia) {
        // Trigger background upload processor to pick up the new entry
        await checkPendingUploads();
        showSuccess(isTextEntry ? "Text entry saved!" : "Entry saved! Upload started.");
      } else if (mode === "later" || !isOnline) {
        showSuccess(
          isTextEntry
            ? "Text entry saved!"
            : isOnline
            ? "Entry saved! It will upload later."
            : "Entry saved! Will upload when online."
        );
      } else {
        showSuccess(isTextEntry ? "Text entry saved!" : "Entry saved!");
      }

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
    localMedia,
    caption,
    hasMedia,
    createEntry,
    showSuccess,
    showError,
    router,
    isOnline,
    checkPendingUploads,
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
      {isProcessingMedia && <CompressionOverlay message={processingMessage} />}

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
              New Entry
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
          {/* Media Section */}
          {hasMedia ? (
            /* Media Thumbnail */
            <View className="mt-4 items-center">
              <View className="rounded-xl overflow-hidden bg-surface relative">
                <Image
                  source={{ uri: localMedia!.type === "video" && localMedia!.thumbnailUri ? localMedia!.thumbnailUri : localMedia!.uri }}
                  className="w-64 h-64"
                  resizeMode="cover"
                  accessibilityLabel={
                    localMedia!.type === "photo" ? "Selected photo" : "Selected video thumbnail"
                  }
                />
                {/* Video overlay indicator */}
                {localMedia!.type === "video" && (
                  <>
                    {/* Play icon overlay */}
                    <View className="absolute inset-0 items-center justify-center">
                      <View className="w-12 h-12 bg-black/60 rounded-full items-center justify-center">
                        <Text className="text-white text-lg ml-0.5">▶</Text>
                      </View>
                    </View>
                    {/* Duration badge */}
                    {localMedia!.durationSeconds && (
                      <View className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded">
                        <Text className="text-white text-sm font-medium">
                          {formatDuration(localMedia!.durationSeconds)}
                        </Text>
                      </View>
                    )}
                  </>
                )}
                {/* Remove button */}
                <TouchableOpacity
                  onPress={handleRemoveMedia}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full items-center justify-center"
                  accessibilityLabel="Remove media"
                  accessibilityHint="Tap to remove the selected media"
                >
                  <Text className="text-white text-lg font-bold">×</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-text-secondary text-sm mt-2">
                {localMedia!.type === "photo" ? "Photo" : "Video"} preview
              </Text>
            </View>
          ) : (
            /* Add Media / Text Entry Options */
            <View className="mt-6 items-center">
              <TouchableOpacity
                onPress={handlePickMedia}
                className="w-32 h-32 bg-surface rounded-xl items-center justify-center border-2 border-dashed border-border"
                accessibilityLabel="Add photo or video"
                accessibilityHint="Tap to select a photo or video from your library"
              >
                <Text className="text-4xl mb-2">📷</Text>
                <Text className="text-text-secondary text-sm text-center">
                  Add Photo{"\n"}or Video
                </Text>
              </TouchableOpacity>
              <Text className="text-text-secondary text-sm mt-4">
                Or write a text-only entry below
              </Text>
            </View>
          )}

          {/* Caption/Text Input */}
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

        {/* Bottom Buttons */}
        <View className="px-4 py-4 border-t border-border">
          {/* Network status indicator for media entries */}
          {hasMedia && (
            <View className="mb-3">
              <View className="flex-row items-center justify-center mb-2">
                <View
                  className={`w-2 h-2 rounded-full mr-2 ${
                    isOnline ? "bg-success" : "bg-error"
                  }`}
                />
                <Text className="text-text-secondary text-sm">
                  {isOnline ? "Online - Ready to upload" : "Offline - Will upload later"}
                </Text>
              </View>
            </View>
          )}

          {/* Upload mode buttons for media entries */}
          {hasMedia && isOnline ? (
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  title="Upload Later"
                  onPress={() => handleSave("later")}
                  disabled={!canSave || isSaving}
                  loading={false}
                  variant="secondary"
                  accessibilityLabel="Save and upload later"
                  accessibilityHint="Saves your entry and queues it for upload later"
                />
              </View>
              <View className="flex-1">
                <Button
                  title="Upload Now"
                  onPress={() => handleSave("now")}
                  disabled={!canSave || isSaving}
                  loading={isSaving}
                  variant="primary"
                  accessibilityLabel="Save and upload now"
                  accessibilityHint="Saves your entry and starts uploading immediately"
                />
              </View>
            </View>
          ) : (
            <Button
              title={hasMedia && !isOnline ? "Save (Upload when online)" : "Save Entry"}
              onPress={() => handleSave("now")}
              disabled={!canSave}
              loading={isSaving || isCreatingEntry}
              variant="primary"
              accessibilityLabel="Save entry"
              accessibilityHint={
                isTextEntry
                  ? "Saves your text entry to the project"
                  : hasMedia && !isOnline
                  ? "Saves your entry and will upload when back online"
                  : "Saves your media entry with optional caption to the project"
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
