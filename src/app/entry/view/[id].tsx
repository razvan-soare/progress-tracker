import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Dimensions,
  StyleSheet,
  Alert,
  ScrollView,
  GestureResponderEvent,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { useEntry, useEntryMutations } from "@/lib/store/hooks";
import { IconButton, LoadingSpinner, ErrorView } from "@/components/ui";
import { useToast } from "@/lib/toast";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface VideoViewerProps {
  videoUri: string;
  durationSeconds: number;
}

function VideoViewer({ videoUri, durationSeconds }: VideoViewerProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [actualDuration, setActualDuration] = useState(durationSeconds);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrubberWidth, setScrubberWidth] = useState(0);

  const handlePlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (status.isLoaded) {
        setHasError(false);
        setErrorMessage(null);
        setIsPlaying(status.isPlaying);

        if (status.durationMillis) {
          setActualDuration(Math.floor(status.durationMillis / 1000));
        }

        if (!isSeeking) {
          setCurrentPosition(Math.floor((status.positionMillis || 0) / 1000));
        }

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
    },
    [isSeeking]
  );

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

  const progressPercentage =
    actualDuration > 0 ? (currentPosition / actualDuration) * 100 : 0;

  return (
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
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT * 0.6,
          }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          isLooping={false}
          usePoster={true}
          posterStyle={{
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT * 0.6,
            resizeMode: "contain",
          }}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          accessibilityLabel="Video entry"
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

      {/* Playback controls */}
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
  );
}

interface PhotoViewerProps {
  photoUri: string;
}

function PhotoViewer({ photoUri }: PhotoViewerProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Respond to pan if we're zoomed in or if there are two touches
        return (
          lastScale.current > 1 ||
          Math.abs(gestureState.dx) > 5 ||
          Math.abs(gestureState.dy) > 5
        );
      },
      onPanResponderGrant: (event) => {
        // Check for pinch gesture
        if (event.nativeEvent.touches.length === 2) {
          const touch1 = event.nativeEvent.touches[0];
          const touch2 = event.nativeEvent.touches[1];
          initialDistance.current = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
              Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          initialScale.current = lastScale.current;
        }
      },
      onPanResponderMove: (event, gestureState) => {
        if (event.nativeEvent.touches.length === 2) {
          // Pinch to zoom
          const touch1 = event.nativeEvent.touches[0];
          const touch2 = event.nativeEvent.touches[1];
          const currentDistance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
              Math.pow(touch2.pageY - touch1.pageY, 2)
          );

          if (initialDistance.current > 0) {
            const scaleChange = currentDistance / initialDistance.current;
            const newScale = Math.min(
              Math.max(initialScale.current * scaleChange, 1),
              4
            );
            scale.setValue(newScale);
            lastScale.current = newScale;
          }
        } else if (lastScale.current > 1) {
          // Pan when zoomed
          const newTranslateX = lastTranslateX.current + gestureState.dx;
          const newTranslateY = lastTranslateY.current + gestureState.dy;

          // Constrain panning based on zoom level
          const maxTranslateX = ((lastScale.current - 1) * SCREEN_WIDTH) / 2;
          const maxTranslateY = ((lastScale.current - 1) * SCREEN_HEIGHT) / 4;

          translateX.setValue(
            Math.min(Math.max(newTranslateX, -maxTranslateX), maxTranslateX)
          );
          translateY.setValue(
            Math.min(Math.max(newTranslateY, -maxTranslateY), maxTranslateY)
          );
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Save last position
        lastTranslateX.current += gestureState.dx;
        lastTranslateY.current += gestureState.dy;

        // Reset to normal if scale is close to 1
        if (lastScale.current < 1.1) {
          Animated.parallel([
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start();
          lastScale.current = 1;
          lastTranslateX.current = 0;
          lastTranslateY.current = 0;
        }
      },
    })
  ).current;

  // Double tap to zoom
  const lastTap = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap detected
      if (lastScale.current > 1) {
        // Reset zoom
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
        lastScale.current = 1;
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
      } else {
        // Zoom in to 2x
        Animated.spring(scale, {
          toValue: 2,
          useNativeDriver: true,
        }).start();
        lastScale.current = 2;
      }
    }
    lastTap.current = now;
  }, [scale, translateX, translateY]);

  return (
    <View className="flex-1 items-center justify-center">
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ scale }, { translateX }, { translateY }],
        }}
      >
        <Pressable onPress={handleDoubleTap}>
          <Image
            source={{ uri: photoUri }}
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT * 0.7,
            }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Photo entry"
          />
        </Pressable>
      </Animated.View>
      <Text className="text-text-secondary text-xs mt-4">
        Pinch to zoom • Double tap to zoom in/out
      </Text>
    </View>
  );
}

interface TextViewerProps {
  text: string;
}

function TextViewer({ text }: TextViewerProps) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        className="text-text-primary text-lg leading-7"
        selectable
        accessibilityRole="text"
      >
        {text}
      </Text>
    </ScrollView>
  );
}

const UNDO_TIMEOUT_MS = 5000;

export default function EntryViewScreen() {
  const router = useRouter();
  const { id, fromCreate, projectId: passedProjectId } = useLocalSearchParams<{
    id: string;
    fromCreate?: string;
    projectId?: string;
  }>();
  const { entry, isLoading, error, refetch } = useEntry(id);

  // Determine if we should show the "Go to Timeline" button
  const showTimelineButton = fromCreate === "true" && (passedProjectId || entry?.projectId);
  const { deleteEntry, restoreEntry } = useEntryMutations();
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Swipe down to dismiss
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes from near the top
        return gestureState.dy > 10 && gestureState.moveY < 150;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Dismiss
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            router.back();
          });
        } else {
          // Reset
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleGoToTimeline = useCallback(() => {
    const targetProjectId = passedProjectId || entry?.projectId;
    if (targetProjectId) {
      // Replace current screen to avoid stacking entry view in navigation
      router.replace(`/project/timeline/${targetProjectId}` as Href);
    }
  }, [router, passedProjectId, entry?.projectId]);

  const handleEdit = useCallback(() => {
    setShowActions(false);
    showToast("Edit feature coming soon", "info");
  }, [showToast]);

  const handleShare = useCallback(() => {
    setShowActions(false);
    showToast("Share feature coming soon", "info");
  }, [showToast]);

  const handleDelete = useCallback(() => {
    setShowActions(false);
    Alert.alert(
      "Delete Entry",
      "Delete this entry? This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            setIsDeleting(true);
            try {
              const deletedEntry = await deleteEntry(id);
              setIsDeleting(false);

              // Navigate back immediately
              router.back();

              // Show toast with undo action
              if (deletedEntry) {
                // Clear any existing undo timeout
                if (undoTimeoutRef.current) {
                  clearTimeout(undoTimeoutRef.current);
                }

                showToast("Entry deleted", "success", {
                  label: "Undo",
                  onPress: async () => {
                    // Clear the timeout since user clicked undo
                    if (undoTimeoutRef.current) {
                      clearTimeout(undoTimeoutRef.current);
                      undoTimeoutRef.current = null;
                    }
                    try {
                      await restoreEntry(deletedEntry);
                      showToast("Entry restored", "success");
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : "Failed to restore entry",
                        "error"
                      );
                    }
                  },
                });

                // Set timeout to finalize deletion (toast auto-dismisses)
                undoTimeoutRef.current = setTimeout(() => {
                  undoTimeoutRef.current = null;
                  // Entry is already soft-deleted in DB, no additional action needed
                }, UNDO_TIMEOUT_MS);
              } else {
                showToast("Entry deleted", "success");
              }
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : "Failed to delete entry",
                "error"
              );
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [id, deleteEntry, restoreEntry, showToast, router]);

  const toggleActions = useCallback(() => {
    setShowActions((prev) => !prev);
  }, []);

  // Loading state
  if (isLoading && !entry) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  // Error state
  if (error && !entry) {
    return (
      <View className="flex-1 bg-black">
        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
          <View className="flex-row items-center px-4 py-3">
            <IconButton
              icon="←"
              variant="default"
              size="md"
              onPress={handleBack}
              accessibilityLabel="Go back"
            />
          </View>
          <ErrorView
            title="Failed to load entry"
            message={error}
            icon="📋"
            onRetry={refetch}
          />
        </SafeAreaView>
      </View>
    );
  }

  // Entry not found
  if (!entry) {
    return (
      <View className="flex-1 bg-black">
        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
          <View className="flex-row items-center px-4 py-3">
            <IconButton
              icon="←"
              variant="default"
              size="md"
              onPress={handleBack}
              accessibilityLabel="Go back"
            />
          </View>
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-5xl mb-4">📋</Text>
            <Text className="text-text-primary text-xl font-semibold mb-2">
              Entry not found
            </Text>
            <Text className="text-text-secondary text-center">
              This entry may have been deleted.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <Animated.View
      className="flex-1 bg-black"
      style={{ transform: [{ translateY }] }}
      {...panResponder.panHandlers}
    >
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <IconButton
            icon="✕"
            variant="default"
            size="md"
            onPress={handleBack}
            accessibilityLabel="Close"
          />
          <View className="relative">
            <IconButton
              icon="⋯"
              variant="default"
              size="md"
              onPress={toggleActions}
              accessibilityLabel="More actions"
            />
            {/* Actions dropdown */}
            {showActions && (
              <View
                className="absolute top-12 right-0 bg-surface rounded-xl overflow-hidden z-50"
                style={styles.actionsDropdown}
              >
                <Pressable
                  onPress={handleEdit}
                  className="flex-row items-center px-4 py-3 active:bg-white/10"
                  accessibilityRole="button"
                  accessibilityLabel="Edit entry"
                >
                  <Text className="text-lg mr-3">✏️</Text>
                  <Text className="text-text-primary">Edit</Text>
                </Pressable>
                <View className="h-px bg-border" />
                <Pressable
                  onPress={handleShare}
                  className="flex-row items-center px-4 py-3 active:bg-white/10"
                  accessibilityRole="button"
                  accessibilityLabel="Share entry"
                >
                  <Text className="text-lg mr-3">↗️</Text>
                  <Text className="text-text-primary">Share</Text>
                </Pressable>
                <View className="h-px bg-border" />
                <Pressable
                  onPress={handleDelete}
                  disabled={isDeleting}
                  className={`flex-row items-center px-4 py-3 active:bg-white/10 ${isDeleting ? "opacity-50" : ""}`}
                  accessibilityRole="button"
                  accessibilityLabel="Delete entry"
                >
                  <Text className="text-lg mr-3">🗑️</Text>
                  <Text className="text-error">Delete</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Close dropdown on tap outside */}
        {showActions && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowActions(false)}
          />
        )}

        {/* Content based on entry type */}
        <View className="flex-1">
          {entry.entryType === "video" && entry.mediaUri && (
            <VideoViewer
              videoUri={entry.mediaUri}
              durationSeconds={entry.durationSeconds || 0}
            />
          )}
          {entry.entryType === "photo" && entry.mediaUri && (
            <PhotoViewer photoUri={entry.mediaUri} />
          )}
          {entry.entryType === "text" && (
            <TextViewer text={entry.contentText || ""} />
          )}
        </View>

        {/* Metadata footer */}
        <View className="px-6 py-4 border-t border-border/30">
          {/* Caption */}
          {entry.contentText && entry.entryType !== "text" && (
            <Text
              className="text-text-primary text-base mb-3"
              numberOfLines={2}
            >
              {entry.contentText}
            </Text>
          )}

          {/* Date and duration */}
          <View className="flex-row items-center justify-between">
            <Text className="text-text-secondary text-sm">
              {formatDateTime(entry.createdAt)}
            </Text>
            {entry.entryType === "video" && entry.durationSeconds && (
              <View className="flex-row items-center">
                <Text className="text-text-secondary text-sm mr-1">⏱</Text>
                <Text className="text-text-secondary text-sm">
                  {formatTime(entry.durationSeconds)}
                </Text>
              </View>
            )}
          </View>

          {/* Go to Timeline button - shown after creating a new entry */}
          {showTimelineButton && (
            <Pressable
              onPress={handleGoToTimeline}
              className="mt-4 bg-primary rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="View entry in timeline"
            >
              <Text className="text-white text-lg mr-2">📋</Text>
              <Text className="text-white text-base font-semibold">
                Go to Timeline
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {/* Loading overlay for delete */}
      {isDeleting && (
        <View
          style={StyleSheet.absoluteFill}
          className="bg-black/70 items-center justify-center"
        >
          <LoadingSpinner size="large" />
          <Text className="text-text-primary mt-4">Deleting...</Text>
        </View>
      )}
    </Animated.View>
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
    backgroundColor: "#6366f1",
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
  actionsDropdown: {
    minWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
