import { useState, useEffect, useCallback, useRef } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { generateStreamingUrl, prefetchStreamingUrls } from "@/lib/supabase/streaming";
import { getMediaCacheService } from "@/lib/cache";
import { useNetwork } from "@/lib/network/NetworkContext";
import type { Entry } from "@/types";

/**
 * State for remote media loading
 */
export type RemoteMediaState =
  | { status: "idle" }
  | { status: "loading"; progress: number }
  | { status: "ready"; uri: string; isFromCache: boolean }
  | { status: "error"; error: string; isOffline: boolean };

/**
 * Result from the useRemoteMedia hook
 */
export interface UseRemoteMediaResult {
  /** Current state of the media loading */
  state: RemoteMediaState;
  /** Retry loading the media */
  retry: () => void;
  /** Whether the media is currently loading */
  isLoading: boolean;
  /** The media URI if available (local or remote) */
  mediaUri: string | null;
  /** Whether the media is being streamed from remote */
  isStreaming: boolean;
  /** Whether the media is from local cache */
  isFromCache: boolean;
}

/**
 * Options for useRemoteMedia hook
 */
export interface UseRemoteMediaOptions {
  /** Whether to cache the media locally after streaming */
  enableCaching?: boolean;
  /** Skip loading (useful when media is not needed yet) */
  skip?: boolean;
}

/**
 * Hook to load media from R2 when local file is not available.
 *
 * This hook:
 * 1. Checks if local media file exists
 * 2. If not, checks the media cache
 * 3. If not cached, generates a streaming URL from R2
 * 4. Optionally downloads and caches the media
 *
 * @param entry - The entry containing media information
 * @param options - Configuration options
 * @returns Media loading state and controls
 *
 * @example
 * ```typescript
 * const { state, mediaUri, isLoading, retry } = useRemoteMedia(entry);
 *
 * if (state.status === 'error' && state.isOffline) {
 *   return <OfflineMessage onRetry={retry} />;
 * }
 *
 * if (mediaUri) {
 *   return <Video source={{ uri: mediaUri }} />;
 * }
 * ```
 */
export function useRemoteMedia(
  entry: Entry | null | undefined,
  options: UseRemoteMediaOptions = {}
): UseRemoteMediaResult {
  const { enableCaching = true, skip = false } = options;
  const { isOnline } = useNetwork();
  const [state, setState] = useState<RemoteMediaState>({ status: "idle" });
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  const loadMedia = useCallback(async () => {
    if (!entry || skip) {
      setState({ status: "idle" });
      return;
    }

    // Text entries don't have media
    if (entry.entryType === "text") {
      setState({ status: "idle" });
      return;
    }

    // Check if local file exists first
    if (entry.mediaUri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.mediaUri);
        if (fileInfo.exists) {
          if (mountedRef.current) {
            setState({
              status: "ready",
              uri: entry.mediaUri,
              isFromCache: false,
            });
          }
          return;
        }
      } catch {
        // Local file check failed, continue to remote loading
      }
    }

    // No local file, check if we have a remote URL
    if (!entry.mediaRemoteUrl) {
      if (mountedRef.current) {
        setState({
          status: "error",
          error: "No media available for this entry",
          isOffline: false,
        });
      }
      return;
    }

    // Check if offline
    if (!isOnline) {
      // Check cache even when offline
      const cacheService = getMediaCacheService();
      try {
        await cacheService.initialize();
        const cachedPath = await cacheService.getCachedPath(entry.mediaRemoteUrl);
        if (cachedPath) {
          if (mountedRef.current) {
            setState({
              status: "ready",
              uri: cachedPath,
              isFromCache: true,
            });
          }
          return;
        }
      } catch {
        // Cache check failed
      }

      if (mountedRef.current) {
        setState({
          status: "error",
          error: "You are offline. Connect to the internet to view this media.",
          isOffline: true,
        });
      }
      return;
    }

    // Start loading
    if (mountedRef.current) {
      setState({ status: "loading", progress: 0 });
    }

    try {
      const cacheService = getMediaCacheService();
      await cacheService.initialize();

      // Check cache first
      const cachedPath = await cacheService.getCachedPath(entry.mediaRemoteUrl);
      if (cachedPath) {
        if (mountedRef.current) {
          setState({
            status: "ready",
            uri: cachedPath,
            isFromCache: true,
          });
        }
        return;
      }

      // Generate streaming URL
      if (mountedRef.current) {
        setState({ status: "loading", progress: 10 });
      }

      const streamingUrl = await generateStreamingUrl(entry.mediaRemoteUrl);

      if (enableCaching) {
        // Download and cache the media
        if (mountedRef.current) {
          setState({ status: "loading", progress: 20 });
        }

        const localPath = await cacheService.cacheMedia(
          entry.mediaRemoteUrl,
          streamingUrl,
          (progress) => {
            if (mountedRef.current) {
              // Map 0-100 to 20-100 since we're at 20% after URL generation
              setState({ status: "loading", progress: 20 + progress * 0.8 });
            }
          }
        );

        if (mountedRef.current) {
          setState({
            status: "ready",
            uri: localPath,
            isFromCache: true,
          });
        }
      } else {
        // Use streaming URL directly without caching
        if (mountedRef.current) {
          setState({
            status: "ready",
            uri: streamingUrl,
            isFromCache: false,
          });
        }
      }

      retryCountRef.current = 0;
    } catch (error) {
      console.error("Failed to load remote media:", error);
      if (mountedRef.current) {
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Failed to load media",
          isOffline: !isOnline,
        });
      }
    }
  }, [entry, skip, isOnline, enableCaching]);

  const retry = useCallback(() => {
    retryCountRef.current += 1;
    loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    mountedRef.current = true;
    loadMedia();

    return () => {
      mountedRef.current = false;
    };
  }, [loadMedia]);

  // Re-try when coming back online
  useEffect(() => {
    if (isOnline && state.status === "error" && state.isOffline) {
      loadMedia();
    }
  }, [isOnline, state, loadMedia]);

  return {
    state,
    retry,
    isLoading: state.status === "loading",
    mediaUri: state.status === "ready" ? state.uri : null,
    isStreaming: state.status === "ready" && !state.isFromCache && !entry?.mediaUri,
    isFromCache: state.status === "ready" && state.isFromCache,
  };
}

/**
 * Hook to prefetch media for adjacent entries (for smoother browsing)
 *
 * @param entries - Array of entries to prefetch
 * @param currentIndex - Current entry index in the array
 * @param prefetchCount - Number of entries to prefetch before and after current (default: 1)
 */
export function usePrefetchAdjacentMedia(
  entries: Entry[],
  currentIndex: number,
  prefetchCount: number = 1
): void {
  const { isOnline } = useNetwork();
  const prefetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOnline || entries.length === 0) {
      return;
    }

    const prefetchEntries = async () => {
      // Get adjacent entries
      const startIndex = Math.max(0, currentIndex - prefetchCount);
      const endIndex = Math.min(entries.length - 1, currentIndex + prefetchCount);

      const objectKeys: string[] = [];

      for (let i = startIndex; i <= endIndex; i++) {
        if (i === currentIndex) continue; // Skip current entry

        const entry = entries[i];
        if (
          entry &&
          entry.mediaRemoteUrl &&
          entry.entryType !== "text" &&
          !entry.mediaUri && // No local file
          !prefetchedRef.current.has(entry.mediaRemoteUrl)
        ) {
          objectKeys.push(entry.mediaRemoteUrl);
        }
      }

      if (objectKeys.length === 0) {
        return;
      }

      // Prefetch streaming URLs (this caches them for later use)
      try {
        const urls = await prefetchStreamingUrls(objectKeys);

        // Optionally prefetch the actual media files
        const cacheService = getMediaCacheService();
        await cacheService.initialize();

        for (const [objectKey, url] of urls.entries()) {
          // Check if already cached
          if (cacheService.isCached(objectKey)) {
            prefetchedRef.current.add(objectKey);
            continue;
          }

          // Cache the media in background (don't wait)
          cacheService
            .cacheMedia(objectKey, url)
            .then(() => {
              prefetchedRef.current.add(objectKey);
            })
            .catch((error) => {
              console.warn(`Failed to prefetch media for ${objectKey}:`, error);
            });
        }
      } catch (error) {
        console.warn("Failed to prefetch adjacent media:", error);
      }
    };

    prefetchEntries();
  }, [entries, currentIndex, prefetchCount, isOnline]);
}

/**
 * Hook to resolve media URI for an entry (local or remote)
 * Returns the appropriate URI without full loading state management
 *
 * Useful for thumbnails and quick access where you just need the URI
 */
export function useResolvedMediaUri(
  entry: Entry | null | undefined
): { uri: string | null; isLoading: boolean; isRemote: boolean } {
  const [uri, setUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemote, setIsRemote] = useState(false);
  const { isOnline } = useNetwork();

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      if (!entry || entry.entryType === "text") {
        setUri(null);
        setIsLoading(false);
        setIsRemote(false);
        return;
      }

      // Check local file first
      if (entry.mediaUri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(entry.mediaUri);
          if (fileInfo.exists) {
            if (mounted) {
              setUri(entry.mediaUri);
              setIsRemote(false);
              setIsLoading(false);
            }
            return;
          }
        } catch {
          // Continue to remote
        }
      }

      // Check cache
      if (entry.mediaRemoteUrl) {
        setIsLoading(true);
        try {
          const cacheService = getMediaCacheService();
          await cacheService.initialize();
          const cachedPath = await cacheService.getCachedPath(entry.mediaRemoteUrl);
          if (cachedPath && mounted) {
            setUri(cachedPath);
            setIsRemote(false);
            setIsLoading(false);
            return;
          }
        } catch {
          // Continue to streaming
        }

        // Generate streaming URL if online
        if (isOnline) {
          try {
            const streamingUrl = await generateStreamingUrl(entry.mediaRemoteUrl);
            if (mounted) {
              setUri(streamingUrl);
              setIsRemote(true);
              setIsLoading(false);
            }
            return;
          } catch {
            // Fall through to null
          }
        }
      }

      if (mounted) {
        setUri(null);
        setIsLoading(false);
        setIsRemote(false);
      }
    };

    resolve();

    return () => {
      mounted = false;
    };
  }, [entry, isOnline]);

  return { uri, isLoading, isRemote };
}
