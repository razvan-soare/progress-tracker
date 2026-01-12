import { AppState, type AppStateStatus } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import { getDatabase } from "@/lib/db/database";
import { entryRowToModel } from "@/lib/db/mappers";
import type { Entry, EntryRow, UploadStatus } from "@/types";
import {
  chunkedUpload,
  resumeChunkedUpload,
  shouldUseChunkedUpload,
  uploadFile,
  type ChunkedUploadController,
  type ChunkedUploadProgress,
} from "@/lib/supabase";
import {
  saveUploadState,
  loadUploadState,
  removeUploadState,
} from "@/lib/supabase/upload-state";
import { useSyncSettingsStore } from "@/lib/store/sync-settings-store";

/**
 * Configuration for the BackgroundUploadProcessor
 */
export interface BackgroundUploadProcessorConfig {
  /** Polling interval in milliseconds (default: 5000) */
  pollIntervalMs?: number;
  /** Maximum retry attempts before marking as failed (default: 5) */
  maxRetryAttempts?: number;
  /** Minimum time (ms) to wait after connection becomes stable before starting uploads (default: 2000) */
  connectionStabilityDelayMs?: number;
  /** Interval (ms) to save upload state for resume capability (default: 5000) */
  saveStateIntervalMs?: number;
}

/**
 * State of the background upload processor
 */
export interface BackgroundUploadProcessorState {
  /** Whether the processor is currently running */
  isRunning: boolean;
  /** Whether uploads are currently paused (due to network/app state) */
  isPaused: boolean;
  /** Number of pending uploads */
  pendingCount: number;
  /** Number of failed uploads */
  failedCount: number;
  /** ID of the entry currently being uploaded (null if none) */
  currentEntryId: string | null;
  /** Progress of the current upload */
  currentProgress: ChunkedUploadProgress | null;
}

/**
 * Event types emitted by the processor
 */
export type BackgroundUploadEvent =
  | { type: "stateChange"; state: BackgroundUploadProcessorState }
  | { type: "uploadStarted"; entryId: string }
  | { type: "uploadProgress"; entryId: string; progress: ChunkedUploadProgress }
  | { type: "uploadCompleted"; entryId: string; objectKey: string }
  | { type: "uploadFailed"; entryId: string; error: string }
  | { type: "processorStarted" }
  | { type: "processorStopped" }
  | { type: "processorPaused"; reason: "network" | "appState" }
  | { type: "processorResumed" };

export type BackgroundUploadEventListener = (event: BackgroundUploadEvent) => void;

const DEFAULT_CONFIG: Required<BackgroundUploadProcessorConfig> = {
  pollIntervalMs: 5000,
  maxRetryAttempts: 5,
  connectionStabilityDelayMs: 2000,
  saveStateIntervalMs: 5000,
};

/**
 * Determines the content type for a given file URI and entry type
 */
function getContentType(fileUri: string, entryType: "video" | "photo"): string {
  const extension = fileUri.split(".").pop()?.toLowerCase();

  if (entryType === "video") {
    switch (extension) {
      case "mp4":
        return "video/mp4";
      case "mov":
        return "video/quicktime";
      case "m4v":
        return "video/x-m4v";
      case "webm":
        return "video/webm";
      default:
        return "video/mp4";
    }
  } else {
    switch (extension) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "webp":
        return "image/webp";
      case "heic":
        return "image/heic";
      case "heif":
        return "image/heif";
      default:
        return "image/jpeg";
    }
  }
}

/**
 * Check if a network state represents a stable connection suitable for uploads
 * @param state - The current network state
 * @param allowCellular - Whether to allow cellular connections (from user settings)
 */
function isConnectionStable(state: NetInfoState, allowCellular: boolean = false): boolean {
  if (!state.isConnected || !state.isInternetReachable) {
    return false;
  }

  if (state.type === "cellular") {
    // Only allow cellular if user has enabled it
    if (!allowCellular) {
      return false;
    }

    // Also check for good cellular quality (4G/5G)
    if (state.details) {
      const cellularDetails = state.details as { cellularGeneration?: string };
      const generation = cellularDetails.cellularGeneration;
      return generation === "4g" || generation === "5g";
    }
    return false;
  }

  if (state.type === "wifi") {
    return true;
  }

  return false;
}

/**
 * Get the current cellular sync setting from the store
 */
function getSyncOnCellularSetting(): boolean {
  return useSyncSettingsStore.getState().syncOnCellular;
}

/**
 * BackgroundUploadProcessor processes pending media uploads in the background.
 *
 * Features:
 * - Automatically processes entries with pending uploads
 * - Uses chunked uploads for large videos (>10MB)
 * - Pauses when network drops or app backgrounds
 * - Resumes automatically when conditions improve
 * - Supports upload resumption for interrupted uploads
 * - Updates entry status throughout the upload lifecycle
 *
 * @example
 * ```typescript
 * const processor = new BackgroundUploadProcessor();
 *
 * processor.addListener((event) => {
 *   console.log('Upload event:', event);
 * });
 *
 * processor.start();
 *
 * // Later...
 * processor.stop();
 * ```
 */
export class BackgroundUploadProcessor {
  private config: Required<BackgroundUploadProcessorConfig>;
  private state: BackgroundUploadProcessorState;
  private listeners: Set<BackgroundUploadEventListener> = new Set();

  // Timers and subscriptions
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private saveStateTimer: ReturnType<typeof setInterval> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  // Upload state
  private currentUploadController: ChunkedUploadController | null = null;
  private isProcessing: boolean = false;
  private lastNetworkState: NetInfoState | null = null;
  private connectionStabilityTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: BackgroundUploadProcessorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isRunning: false,
      isPaused: true,
      pendingCount: 0,
      failedCount: 0,
      currentEntryId: null,
      currentProgress: null,
    };
  }

  /**
   * Start the background upload processor
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;
    this.emitEvent({ type: "processorStarted" });

    // Subscribe to network changes
    this.networkUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange);

    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange
    );

    // Check initial conditions
    const networkState = await NetInfo.fetch();
    this.lastNetworkState = networkState;
    const appState = AppState.currentState;
    const allowCellular = getSyncOnCellularSetting();

    if (isConnectionStable(networkState, allowCellular) && appState === "active") {
      // Delay start to ensure connection is truly stable
      this.connectionStabilityTimeout = setTimeout(() => {
        this.resumeProcessing();
      }, this.config.connectionStabilityDelayMs);
    }

    // Update counts
    await this.updateCounts();
    this.emitStateChange();
  }

  /**
   * Stop the background upload processor
   */
  stop(): void {
    if (!this.state.isRunning) {
      return;
    }

    // Abort current upload if any
    if (this.currentUploadController) {
      this.currentUploadController.abort();
      this.currentUploadController = null;
    }

    // Clear timers
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.saveStateTimer) {
      clearInterval(this.saveStateTimer);
      this.saveStateTimer = null;
    }

    if (this.connectionStabilityTimeout) {
      clearTimeout(this.connectionStabilityTimeout);
      this.connectionStabilityTimeout = null;
    }

    // Unsubscribe from network changes
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    // Unsubscribe from app state changes
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.state.isRunning = false;
    this.state.isPaused = true;
    this.state.currentEntryId = null;
    this.state.currentProgress = null;
    this.isProcessing = false;

    this.emitEvent({ type: "processorStopped" });
    this.emitStateChange();
  }

  /**
   * Get the current processor state
   */
  getState(): BackgroundUploadProcessorState {
    return { ...this.state };
  }

  /**
   * Add an event listener
   */
  addListener(listener: BackgroundUploadEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove an event listener
   */
  removeListener(listener: BackgroundUploadEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Force a check for pending uploads (useful for triggering after new entry creation)
   */
  async checkPendingUploads(): Promise<void> {
    await this.updateCounts();
    this.emitStateChange();

    if (!this.state.isPaused && !this.isProcessing) {
      this.processNextEntry();
    }
  }

  private emitEvent(event: BackgroundUploadEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn("Error in BackgroundUploadProcessor listener:", error);
      }
    }
  }

  private emitStateChange(): void {
    this.emitEvent({ type: "stateChange", state: this.getState() });
  }

  private handleNetworkChange = (state: NetInfoState): void => {
    const allowCellular = getSyncOnCellularSetting();
    const isStable = isConnectionStable(state, allowCellular);
    this.lastNetworkState = state;

    // Clear any pending stability timeout
    if (this.connectionStabilityTimeout) {
      clearTimeout(this.connectionStabilityTimeout);
      this.connectionStabilityTimeout = null;
    }

    if (!isStable && !this.state.isPaused) {
      // Connection became unstable, pause processing
      this.pauseProcessing("network");
    } else if (isStable && this.state.isPaused && this.state.isRunning) {
      // Connection became stable, wait a bit then resume
      const appState = AppState.currentState;
      if (appState === "active") {
        this.connectionStabilityTimeout = setTimeout(() => {
          this.resumeProcessing();
        }, this.config.connectionStabilityDelayMs);
      }
    }
  };

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState !== "active" && !this.state.isPaused) {
      // App went to background, pause processing
      this.pauseProcessing("appState");
    } else if (nextAppState === "active" && this.state.isPaused && this.state.isRunning) {
      // App came to foreground, check network and potentially resume
      const allowCellular = getSyncOnCellularSetting();
      if (this.lastNetworkState && isConnectionStable(this.lastNetworkState, allowCellular)) {
        // Clear any pending stability timeout
        if (this.connectionStabilityTimeout) {
          clearTimeout(this.connectionStabilityTimeout);
        }
        // Wait a bit for connection to stabilize
        this.connectionStabilityTimeout = setTimeout(() => {
          this.resumeProcessing();
        }, this.config.connectionStabilityDelayMs);
      }
    }
  };

  private pauseProcessing(reason: "network" | "appState"): void {
    if (this.state.isPaused) {
      return;
    }

    // Stop polling
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Don't abort the current upload, just pause getting new ones
    // The upload will fail naturally if network drops

    this.state.isPaused = true;
    this.emitEvent({ type: "processorPaused", reason });
    this.emitStateChange();
  }

  private resumeProcessing(): void {
    if (!this.state.isPaused || !this.state.isRunning) {
      return;
    }

    this.state.isPaused = false;
    this.emitEvent({ type: "processorResumed" });
    this.emitStateChange();

    // Start polling for pending uploads
    this.pollTimer = setInterval(() => {
      if (!this.isProcessing) {
        this.processNextEntry();
      }
    }, this.config.pollIntervalMs);

    // Immediately check for pending uploads
    if (!this.isProcessing) {
      this.processNextEntry();
    }
  }

  private async updateCounts(): Promise<void> {
    try {
      const db = await getDatabase();

      // Count pending uploads (entries with media that haven't been uploaded)
      const pendingResult = await db.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count FROM entries
        WHERE media_uri IS NOT NULL
          AND (media_remote_url IS NULL OR media_remote_url = '')
          AND upload_status IN ('pending', 'uploading')
          AND is_deleted = 0
          AND entry_type IN ('video', 'photo')
      `);

      // Count failed uploads
      const failedResult = await db.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count FROM entries
        WHERE media_uri IS NOT NULL
          AND (media_remote_url IS NULL OR media_remote_url = '')
          AND upload_status = 'failed'
          AND is_deleted = 0
          AND entry_type IN ('video', 'photo')
      `);

      this.state.pendingCount = pendingResult?.count ?? 0;
      this.state.failedCount = failedResult?.count ?? 0;
    } catch (error) {
      console.warn("Failed to update upload counts:", error);
    }
  }

  private async getNextPendingEntry(): Promise<Entry | null> {
    try {
      const db = await getDatabase();

      // Get the oldest pending entry that needs upload
      const row = await db.getFirstAsync<EntryRow>(`
        SELECT * FROM entries
        WHERE media_uri IS NOT NULL
          AND (media_remote_url IS NULL OR media_remote_url = '')
          AND upload_status IN ('pending', 'uploading')
          AND is_deleted = 0
          AND entry_type IN ('video', 'photo')
        ORDER BY created_at ASC
        LIMIT 1
      `);

      if (!row) {
        return null;
      }

      return entryRowToModel(row);
    } catch (error) {
      console.warn("Failed to get next pending entry:", error);
      return null;
    }
  }

  private async updateEntryStatus(
    entryId: string,
    status: UploadStatus,
    mediaRemoteUrl?: string
  ): Promise<void> {
    try {
      const db = await getDatabase();

      if (mediaRemoteUrl !== undefined) {
        await db.runAsync(
          `UPDATE entries SET upload_status = ?, media_remote_url = ? WHERE id = ?`,
          [status, mediaRemoteUrl, entryId]
        );
      } else {
        await db.runAsync(
          `UPDATE entries SET upload_status = ? WHERE id = ?`,
          [status, entryId]
        );
      }
    } catch (error) {
      console.warn("Failed to update entry status:", error);
    }
  }

  private async processNextEntry(): Promise<void> {
    if (this.isProcessing || this.state.isPaused) {
      return;
    }

    this.isProcessing = true;

    try {
      const entry = await this.getNextPendingEntry();

      if (!entry) {
        // No pending entries
        this.isProcessing = false;
        await this.updateCounts();
        this.emitStateChange();
        return;
      }

      if (!entry.mediaUri) {
        // Entry has no media, skip it
        this.isProcessing = false;
        return;
      }

      // Check if the file exists
      const fileInfo = await FileSystem.getInfoAsync(entry.mediaUri);
      if (!fileInfo.exists) {
        console.warn(`Media file not found for entry ${entry.id}: ${entry.mediaUri}`);
        await this.updateEntryStatus(entry.id, "failed");
        this.emitEvent({
          type: "uploadFailed",
          entryId: entry.id,
          error: "Media file not found",
        });
        this.isProcessing = false;
        await this.updateCounts();
        this.emitStateChange();
        // Try next entry
        if (!this.state.isPaused) {
          setTimeout(() => this.processNextEntry(), 100);
        }
        return;
      }

      // Update state
      this.state.currentEntryId = entry.id;
      this.state.currentProgress = null;
      this.emitEvent({ type: "uploadStarted", entryId: entry.id });
      this.emitStateChange();

      // Update entry status to uploading
      await this.updateEntryStatus(entry.id, "uploading");

      // Perform the upload
      const objectKey = await this.uploadEntry(entry);

      // Upload succeeded
      await this.updateEntryStatus(entry.id, "uploaded", objectKey);
      await removeUploadState(entry.id);

      this.emitEvent({
        type: "uploadCompleted",
        entryId: entry.id,
        objectKey,
      });

      // Clear current upload state
      this.state.currentEntryId = null;
      this.state.currentProgress = null;
      this.currentUploadController = null;

      await this.updateCounts();
      this.emitStateChange();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const entryId = this.state.currentEntryId;

      // Don't mark as failed if upload was aborted (paused)
      if (!errorMessage.includes("aborted") && entryId) {
        await this.updateEntryStatus(entryId, "failed");
        this.emitEvent({
          type: "uploadFailed",
          entryId,
          error: errorMessage,
        });
      }

      // Clear current upload state
      this.state.currentEntryId = null;
      this.state.currentProgress = null;
      this.currentUploadController = null;

      await this.updateCounts();
      this.emitStateChange();
    } finally {
      this.isProcessing = false;

      // Continue processing if not paused
      if (!this.state.isPaused && this.state.isRunning) {
        setTimeout(() => this.processNextEntry(), 100);
      }
    }
  }

  private async uploadEntry(entry: Entry): Promise<string> {
    if (!entry.mediaUri) {
      throw new Error("Entry has no media URI");
    }

    const entryType = entry.entryType as "video" | "photo";
    const contentType = getContentType(entry.mediaUri, entryType);

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(entry.mediaUri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    const fileSize = (fileInfo as { size: number }).size;

    // Handle progress updates
    const handleProgress = (progress: ChunkedUploadProgress) => {
      this.state.currentProgress = progress;
      this.emitEvent({
        type: "uploadProgress",
        entryId: entry.id,
        progress,
      });
      this.emitStateChange();
    };

    // Check for existing upload state to resume
    const existingState = await loadUploadState(entry.id);

    if (shouldUseChunkedUpload(fileSize) || existingState) {
      // Use chunked upload for large files or if we have existing state
      const controller = existingState
        ? resumeChunkedUpload(existingState, handleProgress)
        : chunkedUpload(entry.mediaUri, {
            fileType: entryType,
            contentType,
            onProgress: handleProgress,
          });

      this.currentUploadController = controller;

      // Periodically save state for resume capability
      this.saveStateTimer = setInterval(async () => {
        const currentState = controller.getState();
        if (currentState) {
          await saveUploadState(entry.id, currentState);
        }
      }, this.config.saveStateIntervalMs);

      try {
        const result = await controller.promise;
        return result.objectKey;
      } finally {
        if (this.saveStateTimer) {
          clearInterval(this.saveStateTimer);
          this.saveStateTimer = null;
        }
      }
    } else {
      // Use regular upload for small files
      const base64 = await FileSystem.readAsStringAsync(entry.mediaUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Blob
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: contentType });

      const objectKey = await uploadFile(
        entryType,
        blob,
        contentType,
        undefined,
        (percentage) => {
          const progress: ChunkedUploadProgress = {
            percentage,
            currentChunk: 1,
            totalChunks: 1,
            bytesUploaded: Math.round((percentage / 100) * fileSize),
            totalBytes: fileSize,
          };
          handleProgress(progress);
        }
      );

      return objectKey;
    }
  }
}

// Singleton instance for app-wide use
let processorInstance: BackgroundUploadProcessor | null = null;

/**
 * Get or create the singleton BackgroundUploadProcessor instance
 */
export function getBackgroundUploadProcessor(
  config?: BackgroundUploadProcessorConfig
): BackgroundUploadProcessor {
  if (!processorInstance) {
    processorInstance = new BackgroundUploadProcessor(config);
  }
  return processorInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetBackgroundUploadProcessor(): void {
  if (processorInstance) {
    processorInstance.stop();
    processorInstance = null;
  }
}
