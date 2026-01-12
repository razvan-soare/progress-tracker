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

// Test utilities (for development testing)
export { runSyncQueueTests } from "./__tests__/sync-queue-service.test";
