import { useState, useRef, useCallback } from "react";
import { View, Pressable, Text, Dimensions, StyleSheet } from "react-native";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setCurrentPosition(Math.floor((status.positionMillis || 0) / 1000));

      // Reset to beginning when video ends
      if (status.didJustFinish) {
        videoRef.current?.setPositionAsync(0);
        setIsPlaying(false);
      }
    }
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  }, [isPlaying]);

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {/* Video preview container */}
        <View className="flex-1 items-center justify-center">
          <Pressable
            onPress={handlePlayPause}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
          >
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={{
                width: screenWidth,
                height: screenHeight * 0.65,
              }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              isLooping={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              accessibilityLabel="Recorded video preview"
            />

            {/* Play/Pause overlay */}
            {!isPlaying && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.playOverlay,
                ]}
                pointerEvents="none"
              >
                <View style={styles.playButton}>
                  <Text style={styles.playIcon}>▶</Text>
                </View>
              </View>
            )}
          </Pressable>

          {/* Video progress info */}
          <View className="flex-row items-center justify-center mt-4 px-4">
            <Text className="text-white text-sm">
              {formatTime(currentPosition)} / {formatTime(durationSeconds)}
            </Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.3)",
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
});
