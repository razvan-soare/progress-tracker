import { useState, useEffect, useCallback, memo } from "react";
import { View, Image, ActivityIndicator, StyleSheet, ImageStyle, ViewStyle } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { generateStreamingUrl } from "@/lib/supabase/streaming";
import { getMediaCacheService } from "@/lib/cache";

export interface RemoteThumbnailProps {
  /** Local thumbnail URI */
  thumbnailUri?: string | null;
  /** Local media URI (fallback) */
  mediaUri?: string | null;
  /** Remote object key for streaming */
  remoteObjectKey?: string | null;
  /** Style for the image container */
  style?: ViewStyle;
  /** Style for the image */
  imageStyle?: ImageStyle;
  /** Fallback content when no image available */
  fallback?: React.ReactNode;
  /** Resize mode for the image */
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  /** Whether to show loading indicator */
  showLoadingIndicator?: boolean;
  /** Gradient colors for fallback */
  gradientColors?: [string, string];
}

/**
 * Thumbnail component that loads images from local storage or R2.
 *
 * Priority:
 * 1. Local thumbnail URI
 * 2. Local media URI
 * 3. Remote streaming URL from R2 (with caching)
 * 4. Fallback content
 *
 * This component is optimized for use in lists with memoization
 * and efficient loading states.
 */
function RemoteThumbnailComponent({
  thumbnailUri,
  mediaUri,
  remoteObjectKey,
  style,
  imageStyle,
  fallback,
  resizeMode = "cover",
  showLoadingIndicator = true,
  gradientColors = ["#3b82f6", "#6366f1"],
}: RemoteThumbnailProps) {
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadThumbnail = async () => {
      // Priority 1: Local thumbnail
      if (thumbnailUri) {
        try {
          const info = await FileSystem.getInfoAsync(thumbnailUri);
          if (info.exists && mounted) {
            setImageSource(thumbnailUri);
            setIsLoading(false);
            return;
          }
        } catch {
          // Continue to next source
        }
      }

      // Priority 2: Local media
      if (mediaUri) {
        try {
          const info = await FileSystem.getInfoAsync(mediaUri);
          if (info.exists && mounted) {
            setImageSource(mediaUri);
            setIsLoading(false);
            return;
          }
        } catch {
          // Continue to next source
        }
      }

      // Priority 3: Remote streaming (only for images, not videos)
      // For thumbnails, we can stream directly without caching for faster display
      if (remoteObjectKey) {
        if (mounted) {
          setIsLoading(true);
        }

        try {
          // Check cache first
          const cacheService = getMediaCacheService();
          await cacheService.initialize();
          const cachedPath = await cacheService.getCachedPath(remoteObjectKey);

          if (cachedPath && mounted) {
            setImageSource(cachedPath);
            setIsLoading(false);
            return;
          }

          // Generate streaming URL
          const streamingUrl = await generateStreamingUrl(remoteObjectKey);
          if (mounted) {
            setImageSource(streamingUrl);
            setIsLoading(false);
          }
        } catch (error) {
          console.warn("Failed to load remote thumbnail:", error);
          if (mounted) {
            setHasError(true);
            setIsLoading(false);
          }
        }
      } else {
        // No source available
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      mounted = false;
    };
  }, [thumbnailUri, mediaUri, remoteObjectKey]);

  const handleLoadError = useCallback(() => {
    setHasError(true);
  }, []);

  const handleLoadSuccess = useCallback(() => {
    setHasError(false);
  }, []);

  // Show loading state
  if (isLoading && showLoadingIndicator) {
    return (
      <View style={[styles.container, style]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
        <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
      </View>
    );
  }

  // Show fallback if no image source or error
  if (!imageSource || hasError) {
    if (fallback) {
      return <View style={style}>{fallback}</View>;
    }
    return (
      <View style={[styles.container, style]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
      </View>
    );
  }

  // Show image
  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: imageSource }}
        style={[styles.image, imageStyle]}
        resizeMode={resizeMode}
        onLoad={handleLoadSuccess}
        onError={handleLoadError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    borderRadius: 8,
  },
});

// Memoize to prevent unnecessary re-renders in lists
export const RemoteThumbnail = memo(RemoteThumbnailComponent);
