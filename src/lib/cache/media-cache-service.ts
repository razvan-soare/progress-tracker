import * as FileSystem from "expo-file-system/legacy";

/**
 * Configuration for the MediaCacheService
 */
export interface MediaCacheConfig {
  /** Maximum cache size in bytes (default: 500MB) */
  maxSizeBytes?: number;
  /** Directory name within document directory (default: 'media-cache') */
  cacheDirectoryName?: string;
}

/**
 * Metadata for a cached media file
 */
interface CacheEntry {
  /** Original object key from R2 */
  objectKey: string;
  /** Local file path */
  localPath: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Last access timestamp (ms since epoch) */
  lastAccessedAt: number;
  /** When the file was cached */
  cachedAt: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of cached files */
  fileCount: number;
  /** Total size of cached files in bytes */
  totalSizeBytes: number;
  /** Maximum cache size in bytes */
  maxSizeBytes: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Oldest file timestamp */
  oldestFileAt: number | null;
  /** Newest file timestamp */
  newestFileAt: number | null;
}

const DEFAULT_CONFIG: Required<MediaCacheConfig> = {
  maxSizeBytes: 500 * 1024 * 1024, // 500MB
  cacheDirectoryName: "media-cache",
};

// Metadata file name for persisting cache state
const METADATA_FILE = "cache-metadata.json";

/**
 * LRU (Least Recently Used) cache service for media files.
 *
 * Features:
 * - Stores recently viewed remote media locally for fast access
 * - Automatically evicts least recently used files when cache is full
 * - Persists metadata across app restarts
 * - Thread-safe operations
 *
 * @example
 * ```typescript
 * const cache = new MediaCacheService({ maxSizeBytes: 500 * 1024 * 1024 });
 * await cache.initialize();
 *
 * // Check if media is cached
 * const localPath = await cache.getCachedPath(objectKey);
 * if (localPath) {
 *   // Use local path
 * } else {
 *   // Download from R2 and cache
 *   const path = await cache.cacheMedia(objectKey, downloadUrl);
 * }
 * ```
 */
export class MediaCacheService {
  private config: Required<MediaCacheConfig>;
  private cacheDirectory: string;
  private entries: Map<string, CacheEntry> = new Map();
  private currentSizeBytes: number = 0;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private operationLock: Promise<void> = Promise.resolve();

  constructor(config: MediaCacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cacheDirectory = `${FileSystem.documentDirectory}${this.config.cacheDirectoryName}/`;
  }

  /**
   * Initialize the cache service.
   * Must be called before using other methods.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInitialization();
    await this.initPromise;
    this.isInitialized = true;
  }

  private async performInitialization(): Promise<void> {
    // Ensure cache directory exists
    const dirInfo = await FileSystem.getInfoAsync(this.cacheDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.cacheDirectory, {
        intermediates: true,
      });
    }

    // Load metadata if exists
    await this.loadMetadata();

    // Validate cached files still exist
    await this.validateCache();
  }

  /**
   * Check if a media file is cached and return its local path
   *
   * @param objectKey - The R2 object key
   * @returns Local file path if cached, null otherwise
   */
  async getCachedPath(objectKey: string): Promise<string | null> {
    await this.initialize();

    const entry = this.entries.get(objectKey);
    if (!entry) {
      return null;
    }

    // Verify file still exists
    try {
      const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
      if (!fileInfo.exists) {
        this.entries.delete(objectKey);
        this.currentSizeBytes -= entry.sizeBytes;
        await this.saveMetadata();
        return null;
      }
    } catch {
      this.entries.delete(objectKey);
      this.currentSizeBytes -= entry.sizeBytes;
      await this.saveMetadata();
      return null;
    }

    // Update last accessed time
    entry.lastAccessedAt = Date.now();
    await this.saveMetadata();

    return entry.localPath;
  }

  /**
   * Download and cache media from a URL
   *
   * @param objectKey - The R2 object key (used as cache key)
   * @param downloadUrl - The signed URL to download from
   * @param onProgress - Optional progress callback (0-100)
   * @returns Local file path of cached media
   */
  async cacheMedia(
    objectKey: string,
    downloadUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    await this.initialize();

    // Check if already cached
    const existingPath = await this.getCachedPath(objectKey);
    if (existingPath) {
      return existingPath;
    }

    // Use lock to prevent concurrent caching of same file
    return this.withLock(async () => {
      // Double-check after acquiring lock
      const doubleCheck = this.entries.get(objectKey);
      if (doubleCheck) {
        return doubleCheck.localPath;
      }

      // Generate local filename
      const localPath = this.generateLocalPath(objectKey);

      // Download the file
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        localPath,
        {
          md5: false,
        }
      );

      // Note: expo-file-system downloadAsync doesn't support progress for downloads
      // For progress tracking, we would need to use a different approach
      if (onProgress) {
        onProgress(100); // Report complete since downloadAsync doesn't support progress
      }

      if (downloadResult.status !== 200) {
        // Clean up partial download
        try {
          await FileSystem.deleteAsync(localPath, { idempotent: true });
        } catch {
          // Ignore cleanup errors
        }
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists || !("size" in fileInfo)) {
        throw new Error("Downloaded file not found or size unavailable");
      }

      const sizeBytes = fileInfo.size ?? 0;

      // Evict old entries if needed
      await this.evictIfNeeded(sizeBytes);

      // Add to cache
      const entry: CacheEntry = {
        objectKey,
        localPath,
        sizeBytes,
        lastAccessedAt: Date.now(),
        cachedAt: Date.now(),
      };

      this.entries.set(objectKey, entry);
      this.currentSizeBytes += sizeBytes;

      await this.saveMetadata();

      return localPath;
    });
  }

  /**
   * Remove a specific item from the cache
   *
   * @param objectKey - The R2 object key to remove
   */
  async remove(objectKey: string): Promise<void> {
    await this.initialize();

    const entry = this.entries.get(objectKey);
    if (!entry) {
      return;
    }

    try {
      await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
    } catch {
      // Ignore deletion errors
    }

    this.entries.delete(objectKey);
    this.currentSizeBytes -= entry.sizeBytes;
    await this.saveMetadata();
  }

  /**
   * Clear all cached media
   */
  async clearAll(): Promise<void> {
    await this.initialize();

    // Delete all cached files
    for (const entry of this.entries.values()) {
      try {
        await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
      } catch {
        // Ignore deletion errors
      }
    }

    this.entries.clear();
    this.currentSizeBytes = 0;
    await this.saveMetadata();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    await this.initialize();

    let oldestFileAt: number | null = null;
    let newestFileAt: number | null = null;

    for (const entry of this.entries.values()) {
      if (oldestFileAt === null || entry.cachedAt < oldestFileAt) {
        oldestFileAt = entry.cachedAt;
      }
      if (newestFileAt === null || entry.cachedAt > newestFileAt) {
        newestFileAt = entry.cachedAt;
      }
    }

    return {
      fileCount: this.entries.size,
      totalSizeBytes: this.currentSizeBytes,
      maxSizeBytes: this.config.maxSizeBytes,
      usagePercent: (this.currentSizeBytes / this.config.maxSizeBytes) * 100,
      oldestFileAt,
      newestFileAt,
    };
  }

  /**
   * Check if an object is cached (without updating access time)
   */
  isCached(objectKey: string): boolean {
    return this.entries.has(objectKey);
  }

  private generateLocalPath(objectKey: string): string {
    // Extract extension from object key
    const extension = objectKey.split(".").pop() || "bin";
    // Create a safe filename from the object key
    const safeKey = objectKey
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/_+/g, "_");
    const timestamp = Date.now();
    return `${this.cacheDirectory}${timestamp}_${safeKey.slice(-50)}.${extension}`;
  }

  private async evictIfNeeded(incomingBytes: number): Promise<void> {
    const targetSize = this.config.maxSizeBytes - incomingBytes;

    if (this.currentSizeBytes <= targetSize) {
      return;
    }

    // Sort entries by last accessed time (oldest first)
    const sortedEntries = Array.from(this.entries.entries()).sort(
      ([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt
    );

    // Evict entries until we have enough space
    for (const [key, entry] of sortedEntries) {
      if (this.currentSizeBytes <= targetSize) {
        break;
      }

      try {
        await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
      } catch {
        // Ignore deletion errors
      }

      this.entries.delete(key);
      this.currentSizeBytes -= entry.sizeBytes;
    }
  }

  private async loadMetadata(): Promise<void> {
    const metadataPath = `${this.cacheDirectory}${METADATA_FILE}`;

    try {
      const fileInfo = await FileSystem.getInfoAsync(metadataPath);
      if (!fileInfo.exists) {
        return;
      }

      const content = await FileSystem.readAsStringAsync(metadataPath);
      const data = JSON.parse(content) as {
        entries: [string, CacheEntry][];
        currentSizeBytes: number;
      };

      this.entries = new Map(data.entries);
      this.currentSizeBytes = data.currentSizeBytes;
    } catch (error) {
      console.warn("Failed to load cache metadata:", error);
      // Start fresh if metadata is corrupted
      this.entries = new Map();
      this.currentSizeBytes = 0;
    }
  }

  private async saveMetadata(): Promise<void> {
    const metadataPath = `${this.cacheDirectory}${METADATA_FILE}`;

    const data = {
      entries: Array.from(this.entries.entries()),
      currentSizeBytes: this.currentSizeBytes,
    };

    try {
      await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save cache metadata:", error);
    }
  }

  private async validateCache(): Promise<void> {
    const invalidKeys: string[] = [];

    for (const [key, entry] of this.entries.entries()) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
        if (!fileInfo.exists) {
          invalidKeys.push(key);
        }
      } catch {
        invalidKeys.push(key);
      }
    }

    // Remove invalid entries
    for (const key of invalidKeys) {
      const entry = this.entries.get(key);
      if (entry) {
        this.currentSizeBytes -= entry.sizeBytes;
        this.entries.delete(key);
      }
    }

    if (invalidKeys.length > 0) {
      await this.saveMetadata();
    }
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    // Simple mutex using promise chaining
    const previousLock = this.operationLock;
    let resolve: () => void;
    this.operationLock = new Promise<void>((r) => {
      resolve = r;
    });

    await previousLock;

    try {
      return await fn();
    } finally {
      resolve!();
    }
  }
}

// Singleton instance for app-wide use
let cacheServiceInstance: MediaCacheService | null = null;

/**
 * Get or create the singleton MediaCacheService instance
 */
export function getMediaCacheService(
  config?: MediaCacheConfig
): MediaCacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new MediaCacheService(config);
  }
  return cacheServiceInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetMediaCacheService(): void {
  cacheServiceInstance = null;
}
