import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  AppState,
  AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { CameraView, CameraType } from "expo-camera";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  deleteAsync,
  documentDirectory,
  makeDirectoryAsync,
  copyAsync,
  getInfoAsync,
} from "expo-file-system/legacy";
import { CameraPermissionGate, LoadingSpinner } from "@/components/ui";
import { PhotoPreview, VideoPreview } from "@/components/camera";
import { useDebouncedPress } from "@/lib/hooks";
import { useToast } from "@/lib/toast/ToastContext";
import { generateId, generateVideoThumbnailSafe } from "@/lib/utils";

type CaptureMode = "photo" | "video";

const IMAGES_DIRECTORY = `${documentDirectory}images/`;
const VIDEOS_DIRECTORY = `${documentDirectory}videos/`;
const MAX_RECORDING_DURATION = 180; // 3 minutes in seconds

async function ensureImagesDirectory(): Promise<void> {
  const dirInfo = await getInfoAsync(IMAGES_DIRECTORY);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(IMAGES_DIRECTORY, { intermediates: true });
  }
}

async function ensureVideosDirectory(): Promise<void> {
  const dirInfo = await getInfoAsync(VIDEOS_DIRECTORY);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(VIDEOS_DIRECTORY, { intermediates: true });
  }
}

async function savePhotoToDocuments(sourceUri: string): Promise<string> {
  await ensureImagesDirectory();
  const fileExtension = sourceUri.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${generateId()}.${fileExtension}`;
  const destinationUri = `${IMAGES_DIRECTORY}${fileName}`;
  await copyAsync({ from: sourceUri, to: destinationUri });
  return destinationUri;
}

async function saveVideoToDocuments(sourceUri: string): Promise<string> {
  await ensureVideosDirectory();
  const fileExtension = sourceUri.split(".").pop()?.toLowerCase() || "mp4";
  const fileName = `${generateId()}.${fileExtension}`;
  const destinationUri = `${VIDEOS_DIRECTORY}${fileName}`;
  await copyAsync({ from: sourceUri, to: destinationUri });
  return destinationUri;
}

function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function CameraScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const cameraRef = useRef<CameraView>(null);
  const { showError } = useToast();
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const [facing, setFacing] = useState<CameraType>("back");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [capturedVideoUri, setCapturedVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Lock orientation to portrait on mount
  useEffect(() => {
    const lockOrientation = async () => {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    };

    lockOrientation();

    // Cleanup: unlock orientation when leaving
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  // Pulsing animation for recording indicator
  useEffect(() => {
    let pulseAnimation: Animated.CompositeAnimation | null = null;

    if (isRecording) {
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    } else {
      pulseOpacity.setValue(1);
    }

    return () => {
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
    };
  }, [isRecording, pulseOpacity]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingElapsed(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingElapsed((prev) => {
          const next = prev + 1;
          // Auto-stop recording at max duration
          if (next >= MAX_RECORDING_DURATION) {
            cameraRef.current?.stopRecording();
          }
          return next;
        });
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isRecording]);

  // Handle app state changes (backgrounding, interruptions)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current === "active" &&
        nextAppState.match(/inactive|background/)
      ) {
        // App is going to background - stop recording if active
        if (isRecording && cameraRef.current) {
          cameraRef.current.stopRecording();
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isRecording]);

  const handleClose = useDebouncedPress(
    useCallback(() => {
      router.back();
    }, [router]),
    300
  );

  const handleFlipCamera = useCallback(() => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }, []);

  const handleModeChange = useCallback((mode: CaptureMode) => {
    // Don't allow mode change while recording
    if (!isRecording) {
      setCaptureMode(mode);
    }
  }, [isRecording]);

  // Flash animation for photo capture
  const triggerFlashAnimation = useCallback(() => {
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [flashOpacity]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || isCapturing) return;

    if (captureMode === "photo") {
      setIsCapturing(true);
      try {
        // Trigger flash animation
        triggerFlashAnimation();

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });

        if (photo?.uri) {
          setCapturedPhotoUri(photo.uri);
        } else {
          showError("Failed to capture photo. Please try again.");
        }
      } catch (error) {
        console.error("Failed to capture photo:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        showError(`Photo capture failed: ${errorMessage}`);
      } finally {
        setIsCapturing(false);
      }
    } else {
      // Video mode
      if (isRecording) {
        // Stop recording - the recordAsync promise will resolve
        cameraRef.current.stopRecording();
      } else {
        // Start recording
        setIsRecording(true);
        try {
          const video = await cameraRef.current.recordAsync({
            maxDuration: MAX_RECORDING_DURATION,
          });
          // Recording completed - show preview
          if (video?.uri) {
            setVideoDuration(recordingElapsed);
            setCapturedVideoUri(video.uri);
          } else {
            showError("Failed to record video. Please try again.");
          }
        } catch (error) {
          console.error("Failed to record video:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          showError(`Video recording failed: ${errorMessage}`);
        } finally {
          setIsRecording(false);
        }
      }
    }
  }, [captureMode, isRecording, isCameraReady, isCapturing, recordingElapsed, triggerFlashAnimation, showError]);

  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  // Handle retake - discard the captured photo and return to camera view
  const handleRetake = useCallback(async () => {
    if (capturedPhotoUri) {
      try {
        // Delete the temporary photo file
        await deleteAsync(capturedPhotoUri, { idempotent: true });
      } catch (error) {
        // Ignore deletion errors - the file might already be gone
        console.warn("Failed to delete temporary photo:", error);
      }
    }
    setCapturedPhotoUri(null);
  }, [capturedPhotoUri]);

  // Handle video retake - discard the captured video and return to camera view
  const handleVideoRetake = useCallback(async () => {
    if (capturedVideoUri) {
      try {
        // Delete the temporary video file
        await deleteAsync(capturedVideoUri, { idempotent: true });
      } catch (error) {
        // Ignore deletion errors - the file might already be gone
        console.warn("Failed to delete temporary video:", error);
      }
    }
    setCapturedVideoUri(null);
    setVideoDuration(0);
  }, [capturedVideoUri]);

  // Handle use photo - save to documents and navigate to entry creation form
  const handleUsePhoto = useCallback(async () => {
    if (!capturedPhotoUri || !projectId) return;

    setIsProcessing(true);
    try {
      // Save photo to persistent storage
      const savedUri = await savePhotoToDocuments(capturedPhotoUri);

      // Delete the temporary capture file
      try {
        await deleteAsync(capturedPhotoUri, { idempotent: true });
      } catch {
        // Ignore deletion errors
      }

      // Navigate to entry creation form with media details
      const params = new URLSearchParams({
        mediaUri: savedUri,
        mediaType: "photo",
      });
      router.replace(`/entry/create/${projectId}?${params.toString()}` as Href);
    } catch (error) {
      console.error("Failed to process photo:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      showError(`Failed to process photo: ${errorMessage}`);
      setIsProcessing(false);
    }
  }, [capturedPhotoUri, projectId, router, showError]);

  // Handle use video - save to documents, generate thumbnail, and navigate to entry creation form
  const handleUseVideo = useCallback(async () => {
    if (!capturedVideoUri || !projectId) return;

    setIsProcessing(true);
    try {
      // Save video to persistent storage
      const savedUri = await saveVideoToDocuments(capturedVideoUri);

      // Generate thumbnail from the saved video
      // This happens before showing the preview for a better user experience
      const thumbnailResult = await generateVideoThumbnailSafe(savedUri);
      const thumbnailUri = thumbnailResult.success ? thumbnailResult.uri : undefined;

      if (!thumbnailResult.success) {
        // Log the error but don't fail - we'll use a fallback placeholder
        console.warn("Failed to generate thumbnail:", thumbnailResult.error);
      }

      // Delete the temporary capture file
      try {
        await deleteAsync(capturedVideoUri, { idempotent: true });
      } catch {
        // Ignore deletion errors
      }

      // Navigate to entry creation form with media details
      const params = new URLSearchParams({
        mediaUri: savedUri,
        mediaType: "video",
        durationSeconds: videoDuration.toString(),
      });

      // Add thumbnail URI if available
      if (thumbnailUri) {
        params.set("thumbnailUri", thumbnailUri);
      }

      router.replace(`/entry/create/${projectId}?${params.toString()}` as Href);
    } catch (error) {
      console.error("Failed to process video:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      showError(`Failed to process video: ${errorMessage}`);
      setIsProcessing(false);
    }
  }, [capturedVideoUri, videoDuration, projectId, router, showError]);

  // Determine required permissions based on mode
  const requiredPermissions: ("camera" | "microphone")[] =
    captureMode === "video" ? ["camera", "microphone"] : ["camera"];

  // If video is captured, show video preview
  if (capturedVideoUri) {
    return (
      <VideoPreview
        videoUri={capturedVideoUri}
        durationSeconds={videoDuration}
        onRetake={handleVideoRetake}
        onUseVideo={handleUseVideo}
        isLoading={isProcessing}
      />
    );
  }

  // If photo is captured, show preview instead of camera
  if (capturedPhotoUri) {
    return (
      <PhotoPreview
        photoUri={capturedPhotoUri}
        onRetake={handleRetake}
        onUsePhoto={handleUsePhoto}
        isLoading={isProcessing}
      />
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraPermissionGate
        requiredPermissions={requiredPermissions}
        onCancel={handleClose}
      >
        {/* Full-screen camera preview */}
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode={captureMode === "video" ? "video" : "picture"}
          onCameraReady={handleCameraReady}
        >
          <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
            {/* Top controls overlay */}
            <View className="flex-row items-center justify-between px-4 pt-2">
              {/* Close button */}
              <Pressable
                onPress={handleClose}
                className="w-11 h-11 bg-black/50 rounded-full items-center justify-center active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Close camera"
              >
                <Text className="text-white text-2xl font-light">×</Text>
              </Pressable>

              {/* Camera flip button */}
              <Pressable
                onPress={handleFlipCamera}
                disabled={isRecording}
                className={`w-11 h-11 bg-black/50 rounded-full items-center justify-center ${
                  isRecording ? "opacity-50" : "active:opacity-70"
                }`}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${facing === "back" ? "front" : "back"} camera`}
                accessibilityState={{ disabled: isRecording }}
              >
                <Text className="text-white text-lg">🔄</Text>
              </Pressable>
            </View>

            {/* Spacer to push bottom controls down */}
            <View className="flex-1" />

            {/* Bottom controls overlay */}
            <View className="pb-6 px-4">
              {/* Mode toggle */}
              <View className="flex-row justify-center mb-6">
                <View className="flex-row bg-black/60 rounded-full p-1">
                  <Pressable
                    onPress={() => handleModeChange("photo")}
                    disabled={isRecording}
                    className={`px-6 py-2 rounded-full ${
                      captureMode === "photo" ? "bg-white" : "bg-transparent"
                    } ${isRecording ? "opacity-50" : ""}`}
                    accessibilityRole="button"
                    accessibilityLabel="Photo mode"
                    accessibilityState={{
                      selected: captureMode === "photo",
                      disabled: isRecording
                    }}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        captureMode === "photo" ? "text-black" : "text-white"
                      }`}
                    >
                      Photo
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleModeChange("video")}
                    disabled={isRecording}
                    className={`px-6 py-2 rounded-full ${
                      captureMode === "video" ? "bg-white" : "bg-transparent"
                    } ${isRecording ? "opacity-50" : ""}`}
                    accessibilityRole="button"
                    accessibilityLabel="Video mode"
                    accessibilityState={{
                      selected: captureMode === "video",
                      disabled: isRecording
                    }}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        captureMode === "video" ? "text-black" : "text-white"
                      }`}
                    >
                      Video
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Capture button row */}
              <View className="flex-row items-center justify-center">
                {/* Capture button */}
                <Pressable
                  onPress={handleCapture}
                  disabled={!isCameraReady || isCapturing}
                  className={`w-20 h-20 rounded-full items-center justify-center ${
                    !isCameraReady || isCapturing ? "opacity-50" : "active:scale-95"
                  }`}
                  style={[
                    styles.captureButton,
                    captureMode === "video" && styles.captureButtonVideo,
                    isRecording && styles.captureButtonRecording,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    captureMode === "photo"
                      ? "Take photo"
                      : isRecording
                        ? "Stop recording"
                        : "Start recording"
                  }
                  accessibilityState={{ disabled: !isCameraReady || isCapturing }}
                >
                  {captureMode === "video" && isRecording ? (
                    // Recording indicator - red square
                    <View className="w-6 h-6 bg-white rounded-sm" />
                  ) : captureMode === "video" ? (
                    // Video mode - red circle inside
                    <View className="w-14 h-14 rounded-full bg-red-500" />
                  ) : (
                    // Photo mode - white filled circle
                    <View className="w-16 h-16 rounded-full bg-white" />
                  )}
                </Pressable>
              </View>

              {/* Recording indicator with timer and progress */}
              {isRecording && (
                <View className="items-center mt-4">
                  {/* Timer and pulsing indicator */}
                  <View className="flex-row items-center justify-center mb-3">
                    <Animated.View
                      style={[
                        styles.pulsingDot,
                        { opacity: pulseOpacity },
                      ]}
                    />
                    <Text className="text-white text-lg font-semibold ml-2">
                      {formatRecordingTime(recordingElapsed)}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min((recordingElapsed / MAX_RECORDING_DURATION) * 100, 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text className="text-white/60 text-xs mt-1">
                    {formatRecordingTime(MAX_RECORDING_DURATION - recordingElapsed)} remaining
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </CameraView>

        {/* Flash animation overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "white",
              opacity: flashOpacity,
            },
          ]}
          pointerEvents="none"
        />

        {/* Loading overlay when camera is not ready */}
        {!isCameraReady && (
          <View
            className="absolute inset-0 bg-black items-center justify-center"
            accessibilityRole="progressbar"
            accessibilityLabel="Camera loading"
          >
            <LoadingSpinner message="Initializing camera..." />
          </View>
        )}
      </CameraPermissionGate>
    </View>
  );
}

const styles = StyleSheet.create({
  captureButton: {
    borderWidth: 4,
    borderColor: "white",
    backgroundColor: "transparent",
  },
  captureButtonVideo: {
    borderColor: "white",
  },
  captureButtonRecording: {
    backgroundColor: "rgba(239, 68, 68, 0.3)",
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ef4444",
  },
  progressBarContainer: {
    width: 200,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#ef4444",
    borderRadius: 2,
  },
});
