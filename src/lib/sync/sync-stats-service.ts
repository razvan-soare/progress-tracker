import * as FileSystem from "expo-file-system/legacy";
import { getDatabase } from "@/lib/db/database";
import { syncHistoryRowToModel, entryRowToModel } from "@/lib/db/mappers";
import { generateId, formatDateTime } from "@/lib/utils";
import type {
  SyncHistoryEntry,
  SyncHistoryEntryRow,
  SyncOperationType,
  SyncEntityType,
  SyncHistoryStatus,
  Entry,
  EntryRow,
} from "@/types";

const MAX_HISTORY_ENTRIES = 50;

export interface SyncStats {
  /** Total entries that have been synced (uploaded) */
  syncedCount: number;
  /** Total entries pending sync */
  pendingCount: number;
  /** Total entries that failed to sync */
  failedCount: number;
  /** Total local storage used in bytes */
  localStorageBytes: number;
  /** Estimated cloud storage used in bytes */
  cloudStorageBytes: number;
}

export interface FailedUpload {
  entry: Entry;
  errorMessage?: string;
}

/**
 * Get sync statistics including entry counts and storage usage
 */
export async function getSyncStats(): Promise<SyncStats> {
  const db = await getDatabase();

  // Get synced count (entries with media_remote_url set)
  const syncedResult = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) as count FROM entries
    WHERE upload_status = 'uploaded'
      AND is_deleted = 0
      AND entry_type IN ('video', 'photo')
  `);

  // Get pending count
  const pendingResult = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) as count FROM entries
    WHERE upload_status IN ('pending', 'uploading')
      AND is_deleted = 0
      AND entry_type IN ('video', 'photo')
      AND media_uri IS NOT NULL
  `);

  // Get failed count
  const failedResult = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) as count FROM entries
    WHERE upload_status = 'failed'
      AND is_deleted = 0
      AND entry_type IN ('video', 'photo')
  `);

  // Calculate local storage: sum of all local media files
  const localStorageBytes = await calculateLocalStorage();

  // Estimate cloud storage: based on uploaded entries
  const cloudStorageBytes = await estimateCloudStorage();

  return {
    syncedCount: syncedResult?.count ?? 0,
    pendingCount: pendingResult?.count ?? 0,
    failedCount: failedResult?.count ?? 0,
    localStorageBytes,
    cloudStorageBytes,
  };
}

/**
 * Calculate total local storage used by media files
 */
async function calculateLocalStorage(): Promise<number> {
  const db = await getDatabase();

  // Get all local media URIs
  const entries = await db.getAllAsync<{ media_uri: string | null; thumbnail_uri: string | null }>(`
    SELECT media_uri, thumbnail_uri FROM entries
    WHERE is_deleted = 0
      AND (media_uri IS NOT NULL OR thumbnail_uri IS NOT NULL)
  `);

  let totalBytes = 0;

  for (const entry of entries) {
    // Check media file
    if (entry.media_uri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.media_uri);
        if (fileInfo.exists && "size" in fileInfo) {
          totalBytes += fileInfo.size ?? 0;
        }
      } catch {
        // File might not exist, ignore
      }
    }

    // Check thumbnail file
    if (entry.thumbnail_uri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.thumbnail_uri);
        if (fileInfo.exists && "size" in fileInfo) {
          totalBytes += fileInfo.size ?? 0;
        }
      } catch {
        // File might not exist, ignore
      }
    }
  }

  return totalBytes;
}

/**
 * Estimate cloud storage based on total bytes transferred in history
 */
async function estimateCloudStorage(): Promise<number> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ total: number | null }>(`
    SELECT SUM(bytes_transferred) as total FROM sync_history
    WHERE status = 'success'
      AND operation_type = 'upload'
  `);

  return result?.total ?? 0;
}

/**
 * Get list of failed uploads with error messages
 */
export async function getFailedUploads(): Promise<FailedUpload[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<EntryRow>(`
    SELECT * FROM entries
    WHERE upload_status = 'failed'
      AND is_deleted = 0
      AND entry_type IN ('video', 'photo')
    ORDER BY updated_at DESC
  `);

  // Get error messages from sync_queue if available
  const failedUploads: FailedUpload[] = [];

  for (const row of rows) {
    const entry = entryRowToModel(row);

    // Try to get error message from sync_queue
    const queueItem = await db.getFirstAsync<{ error_message: string | null }>(`
      SELECT error_message FROM sync_queue
      WHERE record_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [entry.id]);

    failedUploads.push({
      entry,
      errorMessage: queueItem?.error_message ?? undefined,
    });
  }

  return failedUploads;
}

/**
 * Add an entry to sync history
 */
export async function addSyncHistoryEntry(
  operationType: SyncOperationType,
  entityType: SyncEntityType,
  status: SyncHistoryStatus,
  options?: {
    entityId?: string;
    message?: string;
    bytesTransferred?: number;
  }
): Promise<SyncHistoryEntry> {
  const db = await getDatabase();
  const now = formatDateTime(new Date());
  const id = generateId();

  const entry: SyncHistoryEntry = {
    id,
    operationType,
    entityType,
    entityId: options?.entityId,
    status,
    message: options?.message,
    bytesTransferred: options?.bytesTransferred ?? 0,
    createdAt: now,
  };

  await db.runAsync(
    `INSERT INTO sync_history (id, operation_type, entity_type, entity_id, status, message, bytes_transferred, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.operationType,
      entry.entityType,
      entry.entityId ?? null,
      entry.status,
      entry.message ?? null,
      entry.bytesTransferred,
      entry.createdAt,
    ]
  );

  // Cleanup old entries (keep only last MAX_HISTORY_ENTRIES)
  await db.runAsync(`
    DELETE FROM sync_history
    WHERE id NOT IN (
      SELECT id FROM sync_history
      ORDER BY created_at DESC
      LIMIT ?
    )
  `, [MAX_HISTORY_ENTRIES]);

  return entry;
}

/**
 * Get sync history log (last 50 entries)
 */
export async function getSyncHistory(limit: number = MAX_HISTORY_ENTRIES): Promise<SyncHistoryEntry[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<SyncHistoryEntryRow>(`
    SELECT * FROM sync_history
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit]);

  return rows.map(syncHistoryRowToModel);
}

/**
 * Clear all sync history
 */
export async function clearSyncHistory(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_history`);
}

/**
 * Retry a failed upload by resetting its status to pending
 */
export async function retryFailedUpload(entryId: string): Promise<boolean> {
  const db = await getDatabase();

  // Reset the entry status to pending
  const result = await db.runAsync(
    `UPDATE entries SET upload_status = 'pending' WHERE id = ? AND upload_status = 'failed'`,
    [entryId]
  );

  if (result.changes > 0) {
    // Remove from sync_queue if exists
    await db.runAsync(
      `DELETE FROM sync_queue WHERE record_id = ?`,
      [entryId]
    );

    // Add history entry
    await addSyncHistoryEntry("retry", "entry", "in_progress", {
      entityId: entryId,
      message: "Retry initiated",
    });

    return true;
  }

  return false;
}

/**
 * Retry all failed uploads
 */
export async function retryAllFailedUploads(): Promise<number> {
  const db = await getDatabase();

  // Get failed entries
  const failedEntries = await db.getAllAsync<{ id: string }>(`
    SELECT id FROM entries
    WHERE upload_status = 'failed'
      AND is_deleted = 0
      AND entry_type IN ('video', 'photo')
  `);

  if (failedEntries.length === 0) {
    return 0;
  }

  // Reset all failed entries to pending
  await db.runAsync(`
    UPDATE entries
    SET upload_status = 'pending'
    WHERE upload_status = 'failed'
      AND is_deleted = 0
      AND entry_type IN ('video', 'photo')
  `);

  // Clear sync_queue entries for failed items
  const ids = failedEntries.map(e => e.id);
  await db.runAsync(
    `DELETE FROM sync_queue WHERE record_id IN (${ids.map(() => '?').join(',')})`,
    ids
  );

  // Add history entry
  await addSyncHistoryEntry("retry", "all", "in_progress", {
    message: `Retry initiated for ${failedEntries.length} entries`,
  });

  return failedEntries.length;
}

/**
 * Clear local cache for uploaded media (keeps cloud copy)
 */
export async function clearLocalCache(): Promise<{ deletedFiles: number; bytesFreed: number }> {
  const db = await getDatabase();

  // Get entries that are uploaded (have remote URL) and have local files
  const entries = await db.getAllAsync<{ id: string; media_uri: string | null; thumbnail_uri: string | null }>(`
    SELECT id, media_uri, thumbnail_uri FROM entries
    WHERE upload_status = 'uploaded'
      AND media_remote_url IS NOT NULL
      AND media_remote_url != ''
      AND is_deleted = 0
      AND (media_uri IS NOT NULL OR thumbnail_uri IS NOT NULL)
  `);

  let deletedFiles = 0;
  let bytesFreed = 0;

  for (const entry of entries) {
    // Delete media file
    if (entry.media_uri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.media_uri);
        if (fileInfo.exists && "size" in fileInfo) {
          bytesFreed += fileInfo.size ?? 0;
          await FileSystem.deleteAsync(entry.media_uri, { idempotent: true });
          deletedFiles++;
        }
      } catch {
        // File might not exist or already deleted
      }
    }

    // Delete thumbnail file
    if (entry.thumbnail_uri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.thumbnail_uri);
        if (fileInfo.exists && "size" in fileInfo) {
          bytesFreed += fileInfo.size ?? 0;
          await FileSystem.deleteAsync(entry.thumbnail_uri, { idempotent: true });
          deletedFiles++;
        }
      } catch {
        // File might not exist or already deleted
      }
    }

    // Clear local URIs in database (keep remote URL)
    await db.runAsync(
      `UPDATE entries SET media_uri = NULL, thumbnail_uri = NULL WHERE id = ?`,
      [entry.id]
    );
  }

  // Add history entry
  await addSyncHistoryEntry("cache_clear", "media", "success", {
    message: `Cleared ${deletedFiles} files, freed ${formatBytes(bytesFreed)}`,
    bytesTransferred: bytesFreed,
  });

  return { deletedFiles, bytesFreed };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get entries that can have their local cache cleared
 * (uploaded entries with local files)
 */
export async function getClearableCacheSize(): Promise<number> {
  const db = await getDatabase();

  const entries = await db.getAllAsync<{ media_uri: string | null; thumbnail_uri: string | null }>(`
    SELECT media_uri, thumbnail_uri FROM entries
    WHERE upload_status = 'uploaded'
      AND media_remote_url IS NOT NULL
      AND media_remote_url != ''
      AND is_deleted = 0
      AND (media_uri IS NOT NULL OR thumbnail_uri IS NOT NULL)
  `);

  let totalBytes = 0;

  for (const entry of entries) {
    if (entry.media_uri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.media_uri);
        if (fileInfo.exists && "size" in fileInfo) {
          totalBytes += fileInfo.size ?? 0;
        }
      } catch {
        // Ignore
      }
    }

    if (entry.thumbnail_uri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.thumbnail_uri);
        if (fileInfo.exists && "size" in fileInfo) {
          totalBytes += fileInfo.size ?? 0;
        }
      } catch {
        // Ignore
      }
    }
  }

  return totalBytes;
}
