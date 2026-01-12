import { getDatabase } from "@/lib/db/database";
import { syncQueueItemRowToModel } from "@/lib/db/mappers";
import { generateId, formatDateTime } from "@/lib/utils";
import type { SyncQueueItem, SyncQueueItemRow } from "@/types";

const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000; // 1 second base for exponential backoff

export interface AddToSyncQueueInput {
  tableName: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  payload?: string;
}

/**
 * Calculate exponential backoff delay based on attempt count.
 * Uses formula: baseDelay * 2^(attempts - 1)
 * Example: 1s, 2s, 4s, 8s, 16s for attempts 1-5
 */
export function calculateBackoffDelay(attempts: number): number {
  if (attempts <= 0) return 0;
  return BASE_BACKOFF_MS * Math.pow(2, attempts - 1);
}

/**
 * Check if an item is ready for retry based on backoff timing.
 * Returns true if enough time has passed since the last attempt.
 */
export function isReadyForRetry(item: SyncQueueItem): boolean {
  if (!item.lastAttemptAt) return true;

  const lastAttempt = new Date(item.lastAttemptAt).getTime();
  const backoffDelay = calculateBackoffDelay(item.attempts);
  const now = Date.now();

  return now >= lastAttempt + backoffDelay;
}

/**
 * Add an operation to the sync queue.
 * Creates a new queue item with the given table, record, and operation details.
 */
export async function addToSyncQueue(
  input: AddToSyncQueueInput
): Promise<SyncQueueItem> {
  const db = await getDatabase();
  const now = formatDateTime(new Date());
  const id = generateId();

  await db.runAsync(
    `INSERT INTO sync_queue (id, table_name, record_id, operation, payload, created_at, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.tableName, input.recordId, input.operation, input.payload ?? null, now, 0]
  );

  return {
    id,
    tableName: input.tableName,
    recordId: input.recordId,
    operation: input.operation,
    payload: input.payload,
    createdAt: now,
    attempts: 0,
    lastAttemptAt: undefined,
    errorMessage: undefined,
  };
}

/**
 * Get the next pending item from the sync queue in FIFO order.
 * Only returns items that:
 * - Have not exceeded max retry attempts
 * - Are ready for retry based on exponential backoff timing
 * Returns null if no eligible items are available.
 */
export async function getNextPendingItem(
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<SyncQueueItem | null> {
  const db = await getDatabase();

  // Get all pending items (those under max attempts) ordered by creation time
  const rows = await db.getAllAsync<SyncQueueItemRow>(
    `SELECT * FROM sync_queue
     WHERE attempts < ?
     ORDER BY created_at ASC`,
    [maxAttempts]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  // Find the first item that is ready for retry
  for (const row of rows) {
    const item = syncQueueItemRowToModel(row);
    if (isReadyForRetry(item)) {
      return item;
    }
  }

  return null;
}

/**
 * Mark a sync queue item as complete and remove it from the queue.
 */
export async function markItemComplete(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

/**
 * Mark a sync queue item as failed with an error message.
 * Updates the attempt count and records the error.
 */
export async function markItemFailed(
  id: string,
  errorMessage: string
): Promise<void> {
  const db = await getDatabase();
  const now = formatDateTime(new Date());

  await db.runAsync(
    `UPDATE sync_queue
     SET attempts = attempts + 1,
         last_attempt_at = ?,
         error_message = ?
     WHERE id = ?`,
    [now, errorMessage, id]
  );
}

/**
 * Increment the attempt count for a sync queue item.
 * Updates last_attempt_at timestamp for backoff calculation.
 */
export async function incrementAttempts(id: string): Promise<void> {
  const db = await getDatabase();
  const now = formatDateTime(new Date());

  await db.runAsync(
    `UPDATE sync_queue
     SET attempts = attempts + 1,
         last_attempt_at = ?
     WHERE id = ?`,
    [now, id]
  );
}

/**
 * Get the count of pending items in the sync queue.
 * Only counts items that haven't exceeded max attempts.
 */
export async function getPendingCount(
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE attempts < ?`,
    [maxAttempts]
  );
  return result?.count ?? 0;
}

/**
 * Get the count of failed items (those that have exceeded max attempts).
 */
export async function getFailedCount(
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE attempts >= ?`,
    [maxAttempts]
  );
  return result?.count ?? 0;
}

/**
 * Clear all completed items from the sync queue.
 * Since completed items are deleted immediately via markItemComplete,
 * this clears items that have exceeded max retry attempts (failed items).
 */
export async function clearCompletedItems(
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `DELETE FROM sync_queue WHERE attempts >= ?`,
    [maxAttempts]
  );
  return result.changes;
}

/**
 * Get all pending items in the sync queue.
 */
export async function getAllPendingItems(
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SyncQueueItemRow>(
    `SELECT * FROM sync_queue
     WHERE attempts < ?
     ORDER BY created_at ASC`,
    [maxAttempts]
  );
  return rows.map(syncQueueItemRowToModel);
}

/**
 * Get a sync queue item by ID.
 */
export async function getItemById(id: string): Promise<SyncQueueItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SyncQueueItemRow>(
    `SELECT * FROM sync_queue WHERE id = ?`,
    [id]
  );
  return row ? syncQueueItemRowToModel(row) : null;
}

/**
 * Remove a specific item from the sync queue by record ID and operation.
 * Useful for canceling pending operations (e.g., when restoring a deleted entry).
 */
export async function removeByRecordAndOperation(
  tableName: string,
  recordId: string,
  operation: "create" | "update" | "delete"
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM sync_queue
     WHERE table_name = ? AND record_id = ? AND operation = ?`,
    [tableName, recordId, operation]
  );
}

/**
 * Check if a specific record has a pending operation in the queue.
 */
export async function hasPendingOperation(
  tableName: string,
  recordId: string,
  operation?: "create" | "update" | "delete"
): Promise<boolean> {
  const db = await getDatabase();

  let query = `SELECT COUNT(*) as count FROM sync_queue WHERE table_name = ? AND record_id = ?`;
  const params: (string | number)[] = [tableName, recordId];

  if (operation) {
    query += ` AND operation = ?`;
    params.push(operation);
  }

  const result = await db.getFirstAsync<{ count: number }>(query, params);
  return (result?.count ?? 0) > 0;
}
