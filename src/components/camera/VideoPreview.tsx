import { useState, useRef, useCallback } from "react";
import {
  View,
  Pressable,
  Text,
  Dimensions,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Button } from "@/components/ui";

interface VideoPreviewProps {
  videoUri: string;
  durationSeconds: number;
  onRetake: () => void;
  onUseVideo: () => void;
  isLoading?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function VideoPreview({
  videoUri,
  durationSeconds,
  onRetake,
  onUseVideo,
  isLoading = false,
}: VideoPreviewProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const videoRef = useRef<Video>(null);
  const scrubberRef = useRef<View>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [actualDuration, setActualDuration] = useState(durationSeconds);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrubberWidth, setScrubberWidth] = useState(0);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setHasError(false);
      setErrorMessage(null);
      setIsPlaying(status.isPlaying);

      // Update duration from actual video metadata if available
      if (status.durationMillis) {
        setActualDuration(Math.floor(status.durationMillis / 1000));
      }

      // Only update position if not currently seeking
      if (!isSeeking) {
        setCurrentPosition(Math.floor((status.positionMillis || 0) / 1000));
      }

      // Reset to beginning when video ends
      if (status.didJustFinish) {
        videoRef.current?.setPositionAsync(0);
        setIsPlaying(false);
        setCurrentPosition(0);
      }
    } else if ("error" in status && status.error) {
      setHasError(true);
      setErrorMessage(status.error);
      setIsPlaying(false);
    }
  }, [isSeeking]);

  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current || hasError) return;

    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error("Playback error:", error);
      setHasError(true);
      setErrorMessage(
        error instanceof Error ? error.message : "Playback failed"
      );
    }
  }, [isPlaying, hasError]);

  const handleSeek = useCallback(
    async (event: GestureResponderEvent) => {
      if (!videoRef.current || hasError || scrubberWidth <= 0) return;

      // Get touch position relative to the scrubber
      const touchX = event.nativeEvent.locationX;
      const progress = Math.max(0, Math.min(1, touchX / scrubberWidth));
      const seekPosition = Math.floor(progress * actualDuration);

      setIsSeeking(true);
      setCurrentPosition(seekPosition);

      try {
        await videoRef.current.setPositionAsync(seekPosition * 1000);
      } catch (error) {
        console.error("Seek error:", error);
      } finally {
        setIsSeeking(false);
      }
    },
    [hasError, scrubberWidth, actualDuration]
  );

  const handleScrubberMove = useCallback(
    async (event: GestureResponderEvent) => {
      if (!videoRef.current || hasError || scrubberWidth <= 0) return;

      const touchX = event.nativeEvent.locationX;
      const progress = Math.max(0, Math.min(1, touchX / scrubberWidth));
      const seekPosition = Math.floor(progress * actualDuration);

      setCurrentPosition(seekPosition);

      try {
        await videoRef.current.setPositionAsync(seekPosition * 1000);
      } catch (error) {
        console.error("Seek error:", error);
      }
    },
    [hasError, scrubberWidth, actualDuration]
  );

  const handleScrubberLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      setScrubberWidth(event.nativeEvent.layout.width);
    },
    []
  );

  const handleRetry = useCallback(async () => {
    if (!videoRef.current) return;

    setHasError(false);
    setErrorMessage(null);
    setCurrentPosition(0);

    try {
      await videoRef.current.setPositionAsync(0);
    } catch (error) {
      console.error("Retry error:", error);
    }
  }, []);

  // Calculate progress percentage for scrubber
  const progressPercentage =
    actualDuration > 0 ? (currentPosition / actualDuration) * 100 : 0;

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {/* Video preview container */}
        <View className="flex-1 items-center justify-center">
          <Pressable
            onPress={handlePlayPause}
            disabled={hasError}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
            accessibilityState={{ disabled: hasError }}
          >
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={{
                width: screenWidth,
                height: screenHeight * 0.55,
              }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              isLooping={false}
              usePoster={true}
              posterStyle={{
                width: screenWidth,
                height: screenHeight * 0.55,
                resizeMode: "contain",
              }}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              accessibilityLabel="Recorded video preview"
            />

            {/* Play/Pause overlay */}
            {!hasError && (
              <View
                style={[StyleSheet.absoluteFill, styles.playOverlay]}
                pointerEvents="none"
              >
                {!isPlaying ? (
                  <View style={styles.playButton}>
                    <Text style={styles.playIcon}>▶</Text>
                  </View>
                ) : (
                  <View style={styles.pauseButton}>
                    <View style={styles.pauseBar} />
                    <View style={styles.pauseBar} />
                  </View>
                )}
              </View>
            )}

            {/* Error overlay */}
            {hasError && (
              <View
                style={[StyleSheet.absoluteFill, styles.errorOverlay]}
                pointerEvents="box-none"
              >
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠</Text>
                  <Text style={styles.errorText}>
                    {errorMessage || "Unable to play video"}
                  </Text>
                  <Pressable
                    onPress={handleRetry}
                    style={styles.retryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Retry playing video"
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>

          {/* Playback controls section */}
          <View className="w-full px-6 mt-4">
            {/* Time display */}
            <View className="flex-row items-center justify-between mb-2">
              <Text
                className="text-white text-sm font-medium"
                accessibilityLabel={`Current position: ${formatTime(currentPosition)}`}
              >
                {formatTime(currentPosition)}
              </Text>
              <Text
                className="text-white/60 text-sm"
                accessibilityLabel={`Total duration: ${formatTime(actualDuration)}`}
              >
                {formatTime(actualDuration)}
              </Text>
            </View>

            {/* Progress scrubber */}
            <View
              ref={scrubberRef}
              onLayout={handleScrubberLayout}
              onStartShouldSetResponder={() => !hasError}
              onMoveShouldSetResponder={() => !hasError}
              onResponderGrant={(e) => {
                setIsSeeking(true);
                handleSeek(e);
              }}
              onResponderMove={handleScrubberMove}
              onResponderRelease={() => setIsSeeking(false)}
              onResponderTerminate={() => setIsSeeking(false)}
              style={styles.scrubberContainer}
              accessibilityRole="adjustable"
              accessibilityLabel="Video progress scrubber"
              accessibilityHint="Drag to seek through the video"
              accessibilityValue={{
                min: 0,
                max: actualDuration,
                now: currentPosition,
                text: `${formatTime(currentPosition)} of ${formatTime(actualDuration)}`,
              }}
            >
              {/* Track background */}
              <View style={styles.scrubberTrack}>
                {/* Progress fill */}
                <View
                  style={[
                    styles.scrubberProgress,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>

              {/* Scrubber thumb */}
              <View
                style={[
                  styles.scrubberThumb,
                  {
                    left: `${progressPercentage}%`,
                    transform: [{ translateX: -8 }],
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Bottom controls */}
        <View className="px-4 pb-6">
          <View className="flex-row gap-4">
            {/* Retake button */}
            <View className="flex-1">
              <Pressable
                onPress={onRetake}
                disabled={isLoading}
                className={`py-4 rounded-xl bg-white/10 items-center justify-center ${
                  isLoading ? "opacity-50" : "active:opacity-70"
                }`}
                accessibilityRole="button"
                accessibilityLabel="Retake video"
                accessibilityHint="Discard this video and return to camera"
                accessibilityState={{ disabled: isLoading }}
              >
                <Text className="text-white font-semibold text-base">
                  Retake
                </Text>
              </Pressable>
            </View>

            {/* Use Video button */}
            <View className="flex-1">
              <Button
                title="Use Video"
                variant="primary"
                onPress={onUseVideo}
                loading={isLoading}
                disabled={isLoading}
                className="py-4"
                accessibilityHint="Save this video to your project"
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  playOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    fontSize: 28,
    color: "#000",
    marginLeft: 4,
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pauseBar: {
    width: 6,
    height: 24,
    backgroundColor: "#000",
    borderRadius: 2,
  },
  errorOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  errorContainer: {
    alignItems: "center",
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    maxWidth: 280,
  },
  retryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrubberContainer: {
    height: 40,
    justifyContent: "center",
    paddingVertical: 8,
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  scrubberProgress: {
    height: "100%",
    backgroundColor: "#6366f1", // Primary color
    borderRadius: 2,
  },
  scrubberThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    top: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
