import { AppState, type AppStateStatus } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getDatabase } from "@/lib/db/database";
import { useSyncSettingsStore } from "@/lib/store/sync-settings-store";
import { addSyncHistoryEntry, formatBytes } from "./sync-stats-service";

/**
 * Configuration for the MediaCleanupService
 */
export interface MediaCleanupServiceConfig {
  /** How often to check for cleanup in milliseconds (default: 24 hours) */
  cleanupIntervalMs?: number;
  /** Delay before starting cleanup on app launch (default: 30 seconds) */
  startupDelayMs?: number;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Number of media files deleted */
  mediaFilesDeleted: number;
  /** Number of thumbnail files deleted */
  thumbnailsDeleted: number;
  /** Total bytes freed */
  bytesFreed: number;
  /** Number of entries updated */
  entriesUpdated: number;
  /** Entries that were skipped (within retention period) */
  entriesSkipped: number;
}

/**
 * Entry eligible for cleanup
 */
interface CleanupEligibleEntry {
  id: string;
  media_uri: string | null;
  thumbnail_uri: string | null;
  synced_at: string | null;
  upload_status: string;
}

/**
 * Statistics about cleanable media
 */
export interface CleanupStats {
  /** Number of entries eligible for cleanup */
  eligibleCount: number;
  /** Total bytes that can be freed */
  eligibleBytes: number;
  /** Number of entries within retention period */
  retainedCount: number;
  /** Bytes retained (within retention period) */
  retainedBytes: number;
}

/**
 * Event types emitted by the cleanup service
 */
export type MediaCleanupEvent =
  | { type: "cleanupStarted" }
  | { type: "cleanupCompleted"; result: CleanupResult }
  | { type: "cleanupFailed"; error: string }
  | { type: "cleanupSkipped"; reason: string }
  | { type: "serviceStarted" }
  | { type: "serviceStopped" };

export type MediaCleanupEventListener = (event: MediaCleanupEvent) => void;

const DEFAULT_CONFIG: Required<MediaCleanupServiceConfig> = {
  cleanupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
  startupDelayMs: 30 * 1000, // 30 seconds
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * MediaCleanupService automatically removes local media files after successful cloud sync.
 *
 * Features:
 * - Respects configurable retention period (default: 7 days after sync)
 * - Optionally keeps thumbnails locally for fast UI loading
 * - Runs on app startup and periodically (daily)
 * - Tracks storage savings
 * - Can be disabled via user settings
 *
 * @example
 * ```typescript
 * const service = new MediaCleanupService();
 *
 * service.addListener((event) => {
 *   if (event.type === 'cleanupCompleted') {
 *     console.log(`Freed ${formatBytes(event.result.bytesFreed)}`);
 *   }
 * });
 *
 * service.start();
 * ```
 */
export class MediaCleanupService {
  private config: Required<MediaCleanupServiceConfig>;
  private listeners: Set<MediaCleanupEventListener> = new Set();
  private isRunning: boolean = false;
  private isCleanupInProgress: boolean = false;

  // Timers
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;

  // App state subscription
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private lastAppState: AppStateStatus = "active";

  constructor(config: MediaCleanupServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the media cleanup service
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.emitEvent({ type: "serviceStarted" });

    // Subscribe to app state changes for running on app resume
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange
    );
    this.lastAppState = AppState.currentState;

    // Schedule initial cleanup after startup delay
    this.startupTimer = setTimeout(() => {
      this.runCleanupIfNeeded();
    }, this.config.startupDelayMs);

    // Schedule periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.runCleanupIfNeeded();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop the media cleanup service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    // Clear timers
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Unsubscribe from app state changes
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.isRunning = false;
    this.emitEvent({ type: "serviceStopped" });
  }

  /**
   * Add an event listener
   */
  addListener(listener: MediaCleanupEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove an event listener
   */
  removeListener(listener: MediaCleanupEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Force a cleanup run (ignores last cleanup time check)
   */
  async forceCleanup(): Promise<CleanupResult> {
    return this.performCleanup();
  }

  /**
   * Get statistics about what can be cleaned up
   */
  async getCleanupStats(): Promise<CleanupStats> {
    const settings = useSyncSettingsStore.getState();
    const retentionDays = settings.autoCleanupRetentionDays;
    const keepThumbnails = settings.keepThumbnailsLocally;

    const cutoffDate = new Date(Date.now() - retentionDays * MILLISECONDS_PER_DAY);
    const cutoffDateStr = cutoffDate.toISOString();

    const db = await getDatabase();

    // Get all uploaded entries with local files
    const entries = await db.getAllAsync<CleanupEligibleEntry>(`
      SELECT id, media_uri, thumbnail_uri, synced_at, upload_status FROM entries
      WHERE upload_status = 'uploaded'
        AND media_remote_url IS NOT NULL
        AND media_remote_url != ''
        AND is_deleted = 0
        AND (media_uri IS NOT NULL OR thumbnail_uri IS NOT NULL)
    `);

    let eligibleCount = 0;
    let eligibleBytes = 0;
    let retainedCount = 0;
    let retainedBytes = 0;

    for (const entry of entries) {
      const syncedAt = entry.synced_at;
      const isPastRetention = syncedAt ? syncedAt < cutoffDateStr : false;

      let entryBytes = 0;

      // Calculate media file size
      if (entry.media_uri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(entry.media_uri);
          if (fileInfo.exists && "size" in fileInfo) {
            entryBytes += fileInfo.size ?? 0;
          }
        } catch {
          // Ignore
        }
      }

      // Calculate thumbnail size (only if not keeping thumbnails)
      if (entry.thumbnail_uri && !keepThumbnails) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(entry.thumbnail_uri);
          if (fileInfo.exists && "size" in fileInfo) {
            entryBytes += fileInfo.size ?? 0;
          }
        } catch {
          // Ignore
        }
      }

      if (isPastRetention) {
        eligibleCount++;
        eligibleBytes += entryBytes;
      } else {
        retainedCount++;
        retainedBytes += entryBytes;
      }
    }

    return {
      eligibleCount,
      eligibleBytes,
      retainedCount,
      retainedBytes,
    };
  }

  /**
   * Check if cleanup is currently enabled
   */
  isEnabled(): boolean {
    return useSyncSettingsStore.getState().autoCleanupEnabled;
  }

  private emitEvent(event: MediaCleanupEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn("Error in MediaCleanupService listener:", error);
      }
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    // Run cleanup check when app comes to foreground
    if (
      this.lastAppState.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      this.runCleanupIfNeeded();
    }
    this.lastAppState = nextAppState;
  };

  private async runCleanupIfNeeded(): Promise<void> {
    // Check if cleanup is enabled
    const settings = useSyncSettingsStore.getState();
    if (!settings.autoCleanupEnabled) {
      this.emitEvent({ type: "cleanupSkipped", reason: "disabled" });
      return;
    }

    // Check if enough time has passed since last cleanup
    const lastCleanup = settings.lastAutoCleanup;
    if (lastCleanup) {
      const timeSinceLastCleanup = Date.now() - new Date(lastCleanup).getTime();
      if (timeSinceLastCleanup < this.config.cleanupIntervalMs) {
        this.emitEvent({ type: "cleanupSkipped", reason: "too_recent" });
        return;
      }
    }

    await this.performCleanup();
  }

  private async performCleanup(): Promise<CleanupResult> {
    if (this.isCleanupInProgress) {
      return {
        mediaFilesDeleted: 0,
        thumbnailsDeleted: 0,
        bytesFreed: 0,
        entriesUpdated: 0,
        entriesSkipped: 0,
      };
    }

    this.isCleanupInProgress = true;
    this.emitEvent({ type: "cleanupStarted" });

    const result: CleanupResult = {
      mediaFilesDeleted: 0,
      thumbnailsDeleted: 0,
      bytesFreed: 0,
      entriesUpdated: 0,
      entriesSkipped: 0,
    };

    try {
      const settings = useSyncSettingsStore.getState();
      const retentionDays = settings.autoCleanupRetentionDays;
      const keepThumbnails = settings.keepThumbnailsLocally;

      // Calculate cutoff date
      const cutoffDate = new Date(Date.now() - retentionDays * MILLISECONDS_PER_DAY);
      const cutoffDateStr = cutoffDate.toISOString();

      const db = await getDatabase();

      // Get entries eligible for cleanup:
      // - upload_status = 'uploaded'
      // - media_remote_url is set
      // - synced_at is before the cutoff date
      // - has local media_uri or thumbnail_uri
      const entries = await db.getAllAsync<CleanupEligibleEntry>(`
        SELECT id, media_uri, thumbnail_uri, synced_at, upload_status FROM entries
        WHERE upload_status = 'uploaded'
          AND media_remote_url IS NOT NULL
          AND media_remote_url != ''
          AND is_deleted = 0
          AND (media_uri IS NOT NULL OR thumbnail_uri IS NOT NULL)
      `);

      for (const entry of entries) {
        // Check if entry is past retention period
        const syncedAt = entry.synced_at;
        if (!syncedAt || syncedAt >= cutoffDateStr) {
          result.entriesSkipped++;
          continue;
        }

        let entryUpdated = false;
        let clearMediaUri = false;
        let clearThumbnailUri = false;

        // Delete media file
        if (entry.media_uri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(entry.media_uri);
            if (fileInfo.exists && "size" in fileInfo) {
              result.bytesFreed += fileInfo.size ?? 0;
              await FileSystem.deleteAsync(entry.media_uri, { idempotent: true });
              result.mediaFilesDeleted++;
              clearMediaUri = true;
              entryUpdated = true;
            }
          } catch (error) {
            // File might already be deleted or inaccessible
            console.warn(`Failed to delete media file for entry ${entry.id}:`, error);
          }
        }

        // Delete thumbnail file (unless keeping thumbnails locally)
        if (entry.thumbnail_uri && !keepThumbnails) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(entry.thumbnail_uri);
            if (fileInfo.exists && "size" in fileInfo) {
              result.bytesFreed += fileInfo.size ?? 0;
              await FileSystem.deleteAsync(entry.thumbnail_uri, { idempotent: true });
              result.thumbnailsDeleted++;
              clearThumbnailUri = true;
              entryUpdated = true;
            }
          } catch (error) {
            console.warn(`Failed to delete thumbnail for entry ${entry.id}:`, error);
          }
        }

        // Update database to clear local URIs
        if (entryUpdated) {
          if (clearMediaUri && clearThumbnailUri) {
            await db.runAsync(
              `UPDATE entries SET media_uri = NULL, thumbnail_uri = NULL WHERE id = ?`,
              [entry.id]
            );
          } else if (clearMediaUri) {
            await db.runAsync(
              `UPDATE entries SET media_uri = NULL WHERE id = ?`,
              [entry.id]
            );
          } else if (clearThumbnailUri) {
            await db.runAsync(
              `UPDATE entries SET thumbnail_uri = NULL WHERE id = ?`,
              [entry.id]
            );
          }
          result.entriesUpdated++;
        }
      }

      // Update settings with cleanup info
      if (result.bytesFreed > 0) {
        useSyncSettingsStore.getState().addBytesFreed(result.bytesFreed);
      }
      useSyncSettingsStore.getState().setLastAutoCleanup(new Date().toISOString());

      // Add sync history entry
      await addSyncHistoryEntry("cache_clear", "media", "success", {
        message: `Auto-cleanup: ${result.mediaFilesDeleted} files, freed ${formatBytes(result.bytesFreed)}`,
        bytesTransferred: result.bytesFreed,
      });

      this.emitEvent({ type: "cleanupCompleted", result });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Media cleanup failed:", error);
      this.emitEvent({ type: "cleanupFailed", error: errorMessage });

      // Add failure to sync history
      await addSyncHistoryEntry("cache_clear", "media", "failed", {
        message: `Auto-cleanup failed: ${errorMessage}`,
      });
    } finally {
      this.isCleanupInProgress = false;
    }

    return result;
  }
}

// Singleton instance for app-wide use
let cleanupServiceInstance: MediaCleanupService | null = null;

/**
 * Get or create the singleton MediaCleanupService instance
 */
export function getMediaCleanupService(
  config?: MediaCleanupServiceConfig
): MediaCleanupService {
  if (!cleanupServiceInstance) {
    cleanupServiceInstance = new MediaCleanupService(config);
  }
  return cleanupServiceInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetMediaCleanupService(): void {
  if (cleanupServiceInstance) {
    cleanupServiceInstance.stop();
    cleanupServiceInstance = null;
  }
}
