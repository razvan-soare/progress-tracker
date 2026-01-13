export {
  addToSyncQueue,
  getNextPendingItem,
  markItemComplete,
  markItemFailed,
  incrementAttempts,
  getPendingCount,
  getFailedCount,
  clearCompletedItems,
  getAllPendingItems,
  getItemById,
  removeByRecordAndOperation,
  hasPendingOperation,
  calculateBackoffDelay,
  isReadyForRetry,
  type AddToSyncQueueInput,
} from "./sync-queue-service";

export { useSyncQueue, type SyncQueueStatus, type UseSyncQueueOptions } from "./useSyncQueue";

// Background upload processor
export {
  BackgroundUploadProcessor,
  getBackgroundUploadProcessor,
  resetBackgroundUploadProcessor,
  type BackgroundUploadProcessorConfig,
  type BackgroundUploadProcessorState,
  type BackgroundUploadEvent,
  type BackgroundUploadEventListener,
} from "./background-upload-processor";

export {
  useBackgroundUpload,
  type UseBackgroundUploadReturn,
  type UseBackgroundUploadOptions,
} from "./useBackgroundUpload";

export {
  useEntryUploadStatus,
  useEntriesUploadStatus,
  type EntryUploadState,
  type UseEntryUploadStatusReturn,
} from "./useEntryUploadStatus";

// Conflict detection and resolution
export {
  detectConflict,
  isRemoteNewer,
  applyConflictResolution,
  getLocalEntry,
  checkEntriesForConflicts,
  autoResolveConflicts,
  type ConflictCheckResult,
} from "./conflict-detection-service";

export {
  logConflict,
  getConflictLogs,
  getConflictLogsForRecord,
  clearOldConflictLogs,
  getConflictStats,
  type LogConflictInput,
} from "./conflict-log-service";

export {
  useConflictResolution,
  type ConflictResolutionState,
  type UseConflictResolutionReturn,
} from "./useConflictResolution";

// Sync stats and history
export {
  getSyncStats,
  getFailedUploads,
  getSyncHistory,
  addSyncHistoryEntry,
  clearSyncHistory,
  retryFailedUpload,
  retryAllFailedUploads,
  clearLocalCache,
  getClearableCacheSize,
  formatBytes,
  type SyncStats,
  type FailedUpload,
} from "./sync-stats-service";

// Media cleanup service
export {
  MediaCleanupService,
  getMediaCleanupService,
  resetMediaCleanupService,
  type MediaCleanupServiceConfig,
  type CleanupResult,
  type CleanupStats,
  type MediaCleanupEvent,
  type MediaCleanupEventListener,
} from "./media-cleanup-service";

export {
  useMediaCleanup,
  type UseMediaCleanupOptions,
  type UseMediaCleanupReturn,
} from "./useMediaCleanup";

// Background services initialization
export {
  useBackgroundServices,
  type UseBackgroundServicesOptions,
} from "./useBackgroundServices";
