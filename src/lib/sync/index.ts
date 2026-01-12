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

// Test utilities (for development testing)
export { runSyncQueueTests } from "./__tests__/sync-queue-service.test";
