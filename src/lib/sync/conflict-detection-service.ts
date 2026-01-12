import { getDatabase } from "@/lib/db/database";
import { entryRowToModel, entryModelToRow } from "@/lib/db/mappers";
import { generateId, formatDateTime } from "@/lib/utils";
import { logConflict } from "./conflict-log-service";
import type {
  Entry,
  EntryRow,
  SyncConflict,
  ConflictType,
  ConflictResolution,
} from "@/types";

/**
 * Result of comparing local and remote entries for conflicts.
 */
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflict?: SyncConflict;
}

/**
 * Check if there is a conflict between local and remote entry versions.
 * A conflict exists when:
 * 1. Both local and remote have been modified (concurrent_edit)
 * 2. Remote has been deleted but local has been modified (delete_edit)
 */
export function detectConflict(
  localEntry: Entry,
  remoteEntry: Entry | null,
  remoteDeleted: boolean = false
): ConflictCheckResult {
  // If remote doesn't exist or is deleted, but local has been modified
  if (remoteDeleted && localEntry) {
    // Check if local was modified after it was last synced
    const localModifiedAfterSync =
      !localEntry.syncedAt ||
      new Date(localEntry.updatedAt) > new Date(localEntry.syncedAt);

    if (localModifiedAfterSync) {
      return {
        hasConflict: true,
        conflict: {
          id: generateId(),
          tableName: "entries",
          recordId: localEntry.id,
          conflictType: "delete_edit",
          localEntry,
          remoteEntry: undefined,
          localUpdatedAt: localEntry.updatedAt,
          remoteUpdatedAt: undefined,
        },
      };
    }
    return { hasConflict: false };
  }

  // If remote doesn't exist, no conflict
  if (!remoteEntry) {
    return { hasConflict: false };
  }

  // Compare timestamps to detect concurrent edits
  const localUpdatedTime = new Date(localEntry.updatedAt).getTime();
  const remoteUpdatedTime = new Date(remoteEntry.updatedAt).getTime();
  const localSyncedTime = localEntry.syncedAt
    ? new Date(localEntry.syncedAt).getTime()
    : 0;

  // Conflict exists if:
  // - Remote was updated after our last sync
  // - AND local was also updated after our last sync
  const remoteUpdatedAfterSync = remoteUpdatedTime > localSyncedTime;
  const localUpdatedAfterSync = localUpdatedTime > localSyncedTime;

  if (remoteUpdatedAfterSync && localUpdatedAfterSync) {
    return {
      hasConflict: true,
      conflict: {
        id: generateId(),
        tableName: "entries",
        recordId: localEntry.id,
        conflictType: "concurrent_edit",
        localEntry,
        remoteEntry,
        localUpdatedAt: localEntry.updatedAt,
        remoteUpdatedAt: remoteEntry.updatedAt,
      },
    };
  }

  return { hasConflict: false };
}

/**
 * Determine if remote version is newer than local version.
 * Uses last-write-wins based on updatedAt timestamp.
 */
export function isRemoteNewer(localEntry: Entry, remoteEntry: Entry): boolean {
  const localTime = new Date(localEntry.updatedAt).getTime();
  const remoteTime = new Date(remoteEntry.updatedAt).getTime();
  return remoteTime > localTime;
}

/**
 * Apply conflict resolution to local database.
 */
export async function applyConflictResolution(
  conflict: SyncConflict,
  resolution: ConflictResolution
): Promise<Entry> {
  const db = await getDatabase();
  const now = formatDateTime(new Date());

  // Log the conflict resolution
  await logConflict({
    tableName: conflict.tableName,
    recordId: conflict.recordId,
    conflictType: conflict.conflictType,
    localEntry: conflict.localEntry,
    remoteEntry: conflict.remoteEntry,
    resolution,
  });

  switch (resolution) {
    case "keep_local": {
      // Keep local version, update syncedAt to mark as synced
      await db.runAsync(
        `UPDATE entries SET synced_at = ? WHERE id = ?`,
        [now, conflict.recordId]
      );
      return {
        ...conflict.localEntry,
        syncedAt: now,
      };
    }

    case "keep_remote": {
      if (!conflict.remoteEntry) {
        // Remote is deleted, soft delete local
        await db.runAsync(
          `UPDATE entries SET is_deleted = 1, synced_at = ? WHERE id = ?`,
          [now, conflict.recordId]
        );
        return {
          ...conflict.localEntry,
          isDeleted: true,
          syncedAt: now,
        };
      }

      // Update local with remote data
      const remoteRow = entryModelToRow(conflict.remoteEntry);
      await db.runAsync(
        `UPDATE entries SET
          content_text = ?, media_uri = ?, media_remote_url = ?,
          thumbnail_uri = ?, duration_seconds = ?, upload_status = ?,
          updated_at = ?, synced_at = ?, is_deleted = ?
        WHERE id = ?`,
        [
          remoteRow.content_text,
          conflict.localEntry.mediaUri ?? null, // Keep local media URI
          remoteRow.media_remote_url,
          conflict.localEntry.thumbnailUri ?? null, // Keep local thumbnail
          remoteRow.duration_seconds,
          remoteRow.upload_status,
          conflict.remoteEntry.updatedAt,
          now,
          remoteRow.is_deleted ?? 0,
          conflict.recordId,
        ]
      );

      return {
        ...conflict.remoteEntry,
        mediaUri: conflict.localEntry.mediaUri,
        thumbnailUri: conflict.localEntry.thumbnailUri,
        syncedAt: now,
      };
    }

    case "keep_both": {
      // Create a duplicate of the local entry with a new ID
      const newId = generateId();
      const duplicateEntry: Entry = {
        ...conflict.localEntry,
        id: newId,
        createdAt: now,
        updatedAt: now,
        syncedAt: undefined,
        uploadStatus: "pending",
      };

      const duplicateRow = entryModelToRow(duplicateEntry);
      await db.runAsync(
        `INSERT INTO entries (
          id, project_id, entry_type, content_text, media_uri, media_remote_url,
          thumbnail_uri, duration_seconds, created_at, updated_at, synced_at, upload_status, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          duplicateRow.id,
          duplicateRow.project_id,
          duplicateRow.entry_type,
          duplicateRow.content_text,
          duplicateRow.media_uri,
          duplicateRow.media_remote_url,
          duplicateRow.thumbnail_uri,
          duplicateRow.duration_seconds,
          duplicateRow.created_at,
          duplicateRow.updated_at,
          duplicateRow.synced_at,
          duplicateRow.upload_status,
          duplicateRow.is_deleted ?? 0,
        ]
      );

      // Update original entry with remote data if available
      if (conflict.remoteEntry) {
        const remoteRow = entryModelToRow(conflict.remoteEntry);
        await db.runAsync(
          `UPDATE entries SET
            content_text = ?, media_remote_url = ?,
            duration_seconds = ?, upload_status = ?,
            updated_at = ?, synced_at = ?
          WHERE id = ?`,
          [
            remoteRow.content_text,
            remoteRow.media_remote_url,
            remoteRow.duration_seconds,
            remoteRow.upload_status,
            conflict.remoteEntry.updatedAt,
            now,
            conflict.recordId,
          ]
        );
      }

      // Return the duplicate (local copy)
      return duplicateEntry;
    }

    default:
      throw new Error(`Unknown conflict resolution: ${resolution}`);
  }
}

/**
 * Get entry by ID from local database.
 */
export async function getLocalEntry(id: string): Promise<Entry | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<EntryRow>(
    `SELECT * FROM entries WHERE id = ?`,
    [id]
  );
  return row ? entryRowToModel(row) : null;
}

/**
 * Check multiple entries for conflicts with their remote versions.
 * Returns a list of conflicts that need user resolution.
 */
export async function checkEntriesForConflicts(
  localEntries: Entry[],
  remoteEntries: Map<string, Entry>,
  deletedRemoteIds: Set<string>
): Promise<SyncConflict[]> {
  const conflicts: SyncConflict[] = [];

  for (const localEntry of localEntries) {
    const remoteEntry = remoteEntries.get(localEntry.id);
    const isRemoteDeleted = deletedRemoteIds.has(localEntry.id);

    const result = detectConflict(localEntry, remoteEntry ?? null, isRemoteDeleted);

    if (result.hasConflict && result.conflict) {
      conflicts.push(result.conflict);
    }
  }

  return conflicts;
}

/**
 * Auto-resolve conflicts using last-write-wins strategy.
 * Returns conflicts that could not be auto-resolved (require user input).
 */
export async function autoResolveConflicts(
  conflicts: SyncConflict[]
): Promise<{ resolved: SyncConflict[]; needsUserInput: SyncConflict[] }> {
  const resolved: SyncConflict[] = [];
  const needsUserInput: SyncConflict[] = [];

  for (const conflict of conflicts) {
    // Delete conflicts always need user input
    if (conflict.conflictType === "delete_edit") {
      needsUserInput.push(conflict);
      continue;
    }

    // For concurrent edits, check if we can auto-resolve with last-write-wins
    if (conflict.remoteEntry && isRemoteNewer(conflict.localEntry, conflict.remoteEntry)) {
      // Remote is newer, but we still want user confirmation
      // for concurrent edits to avoid silent data loss
      needsUserInput.push(conflict);
    } else {
      // Local is newer, keep local
      await applyConflictResolution(conflict, "keep_local");
      resolved.push(conflict);
    }
  }

  return { resolved, needsUserInput };
}
