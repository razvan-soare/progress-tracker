import { getDatabase } from "@/lib/db/database";
import { generateId, formatDateTime } from "@/lib/utils";
import type {
  ConflictLogEntry,
  ConflictLogEntryRow,
  ConflictType,
  ConflictResolution,
  Entry,
} from "@/types";

/**
 * Convert a conflict log row to model.
 */
function conflictLogRowToModel(row: ConflictLogEntryRow): ConflictLogEntry {
  return {
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    conflictType: row.conflict_type as ConflictType,
    localUpdatedAt: row.local_updated_at,
    remoteUpdatedAt: row.remote_updated_at ?? undefined,
    localData: row.local_data ?? undefined,
    remoteData: row.remote_data ?? undefined,
    resolution: row.resolution as ConflictResolution,
    resolvedAt: row.resolved_at,
  };
}

export interface LogConflictInput {
  tableName: string;
  recordId: string;
  conflictType: ConflictType;
  localEntry: Entry;
  remoteEntry?: Entry;
  resolution: ConflictResolution;
}

/**
 * Log a conflict resolution event for debugging and auditing.
 */
export async function logConflict(input: LogConflictInput): Promise<ConflictLogEntry> {
  const db = await getDatabase();
  const now = formatDateTime(new Date());
  const id = generateId();

  const localData = JSON.stringify(input.localEntry);
  const remoteData = input.remoteEntry ? JSON.stringify(input.remoteEntry) : null;

  await db.runAsync(
    `INSERT INTO conflict_log (
      id, table_name, record_id, conflict_type, local_updated_at, remote_updated_at,
      local_data, remote_data, resolution, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.tableName,
      input.recordId,
      input.conflictType,
      input.localEntry.updatedAt,
      input.remoteEntry?.updatedAt ?? null,
      localData,
      remoteData,
      input.resolution,
      now,
    ]
  );

  return {
    id,
    tableName: input.tableName,
    recordId: input.recordId,
    conflictType: input.conflictType,
    localUpdatedAt: input.localEntry.updatedAt,
    remoteUpdatedAt: input.remoteEntry?.updatedAt,
    localData,
    remoteData: remoteData ?? undefined,
    resolution: input.resolution,
    resolvedAt: now,
  };
}

/**
 * Get all conflict log entries, ordered by most recent first.
 */
export async function getConflictLogs(limit: number = 100): Promise<ConflictLogEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ConflictLogEntryRow>(
    `SELECT * FROM conflict_log ORDER BY resolved_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(conflictLogRowToModel);
}

/**
 * Get conflict logs for a specific record.
 */
export async function getConflictLogsForRecord(
  tableName: string,
  recordId: string
): Promise<ConflictLogEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ConflictLogEntryRow>(
    `SELECT * FROM conflict_log
     WHERE table_name = ? AND record_id = ?
     ORDER BY resolved_at DESC`,
    [tableName, recordId]
  );
  return rows.map(conflictLogRowToModel);
}

/**
 * Clear old conflict logs (older than specified days).
 * Useful for cleaning up storage.
 */
export async function clearOldConflictLogs(daysToKeep: number = 30): Promise<number> {
  const db = await getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffDateStr = formatDateTime(cutoffDate);

  const result = await db.runAsync(
    `DELETE FROM conflict_log WHERE resolved_at < ?`,
    [cutoffDateStr]
  );
  return result.changes;
}

/**
 * Get the count of conflicts by type within a date range.
 */
export async function getConflictStats(
  startDate?: string,
  endDate?: string
): Promise<{ conflictType: ConflictType; resolution: ConflictResolution; count: number }[]> {
  const db = await getDatabase();

  let query = `
    SELECT conflict_type, resolution, COUNT(*) as count
    FROM conflict_log
  `;
  const params: string[] = [];

  if (startDate || endDate) {
    const conditions: string[] = [];
    if (startDate) {
      conditions.push("resolved_at >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("resolved_at <= ?");
      params.push(endDate);
    }
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` GROUP BY conflict_type, resolution`;

  const rows = await db.getAllAsync<{
    conflict_type: string;
    resolution: string;
    count: number;
  }>(query, params);

  return rows.map((row) => ({
    conflictType: row.conflict_type as ConflictType,
    resolution: row.resolution as ConflictResolution,
    count: row.count,
  }));
}
