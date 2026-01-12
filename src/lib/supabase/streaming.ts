import { supabase } from "./client";

/**
 * Response from the generate-download-url edge function
 */
export interface GenerateDownloadUrlResponse {
  downloadUrl: string;
  expiresIn: number;
}

/**
 * Error response from the edge function
 */
export interface StreamingError {
  error: string;
  code: string;
}

/**
 * Cached URL entry with expiration tracking
 */
interface CachedUrl {
  url: string;
  expiresAt: number;
}

// In-memory cache for signed URLs to avoid redundant API calls
// URLs are cached for slightly less than their expiration time
const urlCache = new Map<string, CachedUrl>();

// Cache URLs for 55 minutes (URLs expire after 60 minutes)
const URL_CACHE_DURATION_MS = 55 * 60 * 1000;

/**
 * Cleans up expired URLs from the cache
 */
function cleanupExpiredUrls(): void {
  const now = Date.now();
  for (const [key, cached] of urlCache.entries()) {
    if (cached.expiresAt < now) {
      urlCache.delete(key);
    }
  }
}

/**
 * Gets a cached URL if available and not expired
 */
function getCachedUrl(objectKey: string): string | null {
  const cached = urlCache.get(objectKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  if (cached) {
    urlCache.delete(objectKey);
  }
  return null;
}

/**
 * Caches a URL with expiration
 */
function cacheUrl(objectKey: string, url: string): void {
  urlCache.set(objectKey, {
    url,
    expiresAt: Date.now() + URL_CACHE_DURATION_MS,
  });

  // Periodically clean up expired URLs
  if (urlCache.size > 100) {
    cleanupExpiredUrls();
  }
}

/**
 * Generates a pre-signed download URL for streaming media from R2
 *
 * @param objectKey - The R2 object key (from entry.mediaRemoteUrl)
 * @returns The signed download URL or throws an error
 *
 * @example
 * ```typescript
 * const downloadUrl = await generateStreamingUrl(entry.mediaRemoteUrl);
 * // Use downloadUrl with expo-av Video component
 * ```
 */
export async function generateStreamingUrl(
  objectKey: string
): Promise<string> {
  // Check cache first
  const cachedUrl = getCachedUrl(objectKey);
  if (cachedUrl) {
    return cachedUrl;
  }

  // Get the current session for authentication
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Not authenticated. Please sign in to stream media.");
  }

  // Call the edge function
  const { data, error } = await supabase.functions.invoke<
    GenerateDownloadUrlResponse | StreamingError
  >("generate-download-url", {
    body: { objectKey },
  });

  if (error) {
    throw new Error(`Failed to generate streaming URL: ${error.message}`);
  }

  if (!data) {
    throw new Error("No response from streaming URL generator");
  }

  // Check if the response is an error
  if ("code" in data && "error" in data) {
    throw new Error(data.error);
  }

  const response = data as GenerateDownloadUrlResponse;

  // Cache the URL
  cacheUrl(objectKey, response.downloadUrl);

  return response.downloadUrl;
}

/**
 * Prefetches streaming URLs for multiple object keys
 * Useful for preloading adjacent entries in a timeline
 *
 * @param objectKeys - Array of R2 object keys to prefetch
 * @returns Map of object key to download URL (failed fetches are excluded)
 */
export async function prefetchStreamingUrls(
  objectKeys: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Filter out already cached keys
  const uncachedKeys = objectKeys.filter((key) => !getCachedUrl(key));

  if (uncachedKeys.length === 0) {
    // All keys are cached, return from cache
    for (const key of objectKeys) {
      const cached = getCachedUrl(key);
      if (cached) {
        results.set(key, cached);
      }
    }
    return results;
  }

  // Fetch URLs in parallel (batch of up to 5 at a time to avoid rate limiting)
  const batchSize = 5;
  for (let i = 0; i < uncachedKeys.length; i += batchSize) {
    const batch = uncachedKeys.slice(i, i + batchSize);
    const promises = batch.map(async (key) => {
      try {
        const url = await generateStreamingUrl(key);
        return { key, url };
      } catch (error) {
        console.warn(`Failed to prefetch URL for ${key}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    for (const result of batchResults) {
      if (result) {
        results.set(result.key, result.url);
      }
    }
  }

  // Add cached keys that were already available
  for (const key of objectKeys) {
    if (!results.has(key)) {
      const cached = getCachedUrl(key);
      if (cached) {
        results.set(key, cached);
      }
    }
  }

  return results;
}

/**
 * Clears the URL cache (useful for testing or when user logs out)
 */
export function clearStreamingUrlCache(): void {
  urlCache.clear();
}

/**
 * Gets cache statistics for debugging
 */
export function getStreamingCacheStats(): { size: number; keys: string[] } {
  return {
    size: urlCache.size,
    keys: Array.from(urlCache.keys()),
  };
}
