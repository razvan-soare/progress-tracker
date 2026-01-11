import { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CameraView, CameraType } from "expo-camera";
import * as ScreenOrientation from "expo-screen-orientation";
import { CameraPermissionGate, LoadingSpinner } from "@/components/ui";
import { useDebouncedPress } from "@/lib/hooks";

type CaptureMode = "photo" | "video";

export default function CameraScreen() {
  const router = useRouter();
  const { projectId: _projectId } = useLocalSearchParams<{ projectId: string }>();
  const cameraRef = useRef<CameraView>(null);

  const [facing, setFacing] = useState<CameraType>("back");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

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

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady) return;

    if (captureMode === "photo") {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });
        // TODO: Navigate to preview screen with captured photo
        console.log("Photo captured:", photo?.uri);
      } catch (error) {
        console.error("Failed to capture photo:", error);
      }
    } else {
      // Video mode
      if (isRecording) {
        // Stop recording
        cameraRef.current.stopRecording();
        setIsRecording(false);
      } else {
        // Start recording
        setIsRecording(true);
        try {
          const video = await cameraRef.current.recordAsync({
            maxDuration: 180, // 3 minutes max
          });
          // TODO: Navigate to preview screen with recorded video
          console.log("Video recorded:", video?.uri);
        } catch (error) {
          console.error("Failed to record video:", error);
        } finally {
          setIsRecording(false);
        }
      }
    }
  }, [captureMode, isRecording, isCameraReady]);

  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  // Determine required permissions based on mode
  const requiredPermissions: ("camera" | "microphone")[] =
    captureMode === "video" ? ["camera", "microphone"] : ["camera"];

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
                  disabled={!isCameraReady}
                  className={`w-20 h-20 rounded-full items-center justify-center ${
                    !isCameraReady ? "opacity-50" : "active:scale-95"
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
                  accessibilityState={{ disabled: !isCameraReady }}
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

              {/* Recording indicator text */}
              {isRecording && (
                <View className="flex-row items-center justify-center mt-4">
                  <View className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                  <Text className="text-white text-sm font-medium">
                    Recording...
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </CameraView>

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
});
