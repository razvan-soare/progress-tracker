import type {
  Project,
  ProjectRow,
  Entry,
  EntryRow,
  Report,
  ReportRow,
  NotificationSettings,
  NotificationSettingsRow,
  SyncQueueItem,
  SyncQueueItemRow,
  ConflictLogEntry,
  ConflictLogEntryRow,
  EntryType,
  UploadStatus,
  ProjectCategory,
  ConflictType,
  ConflictResolution,
} from "@/types";

/**
 * Convert a database project row to a Project model.
 */
export function projectRowToModel(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category as ProjectCategory,
    coverImageUri: row.cover_image_uri ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    reminderTime: row.reminder_time ?? undefined,
    reminderDays: row.reminder_days ? JSON.parse(row.reminder_days) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at ?? undefined,
    isDeleted: row.is_deleted === 1,
  };
}

/**
 * Convert a Project model to database row format for insertion/update.
 */
export function projectModelToRow(
  model: Omit<Project, "isDeleted"> & { isDeleted?: boolean }
): Omit<ProjectRow, "is_deleted"> & { is_deleted?: number } {
  return {
    id: model.id,
    name: model.name,
    description: model.description ?? null,
    category: model.category,
    cover_image_uri: model.coverImageUri ?? null,
    start_date: model.startDate,
    end_date: model.endDate ?? null,
    reminder_time: model.reminderTime ?? null,
    reminder_days: model.reminderDays ? JSON.stringify(model.reminderDays) : null,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
    synced_at: model.syncedAt ?? null,
    is_deleted: model.isDeleted ? 1 : 0,
  };
}

/**
 * Convert a database entry row to an Entry model.
 */
export function entryRowToModel(row: EntryRow): Entry {
  return {
    id: row.id,
    projectId: row.project_id,
    entryType: row.entry_type as EntryType,
    contentText: row.content_text ?? undefined,
    mediaUri: row.media_uri ?? undefined,
    mediaRemoteUrl: row.media_remote_url ?? undefined,
    thumbnailUri: row.thumbnail_uri ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at ?? undefined,
    uploadStatus: row.upload_status as UploadStatus,
    isDeleted: row.is_deleted === 1,
  };
}

/**
 * Convert an Entry model to database row format for insertion/update.
 */
export function entryModelToRow(
  model: Omit<Entry, "isDeleted"> & { isDeleted?: boolean }
): Omit<EntryRow, "is_deleted"> & { is_deleted?: number } {
  return {
    id: model.id,
    project_id: model.projectId,
    entry_type: model.entryType,
    content_text: model.contentText ?? null,
    media_uri: model.mediaUri ?? null,
    media_remote_url: model.mediaRemoteUrl ?? null,
    thumbnail_uri: model.thumbnailUri ?? null,
    duration_seconds: model.durationSeconds ?? null,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
    synced_at: model.syncedAt ?? null,
    upload_status: model.uploadStatus,
    is_deleted: model.isDeleted ? 1 : 0,
  };
}

/**
 * Convert a database report row to a Report model.
 */
export function reportRowToModel(row: ReportRow): Report {
  return {
    id: row.id,
    projectId: row.project_id,
    month: row.month,
    summaryText: row.summary_text ?? undefined,
    entryIds: row.entry_ids ? JSON.parse(row.entry_ids) : undefined,
    firstEntryId: row.first_entry_id ?? undefined,
    lastEntryId: row.last_entry_id ?? undefined,
    totalEntries: row.total_entries,
    totalVideos: row.total_videos,
    totalPhotos: row.total_photos,
    totalTextEntries: row.total_text_entries,
    totalDurationSeconds: row.total_duration_seconds,
    generatedAt: row.generated_at,
  };
}

/**
 * Convert a Report model to database row format for insertion/update.
 */
export function reportModelToRow(model: Report): ReportRow {
  return {
    id: model.id,
    project_id: model.projectId,
    month: model.month,
    summary_text: model.summaryText ?? null,
    entry_ids: model.entryIds ? JSON.stringify(model.entryIds) : null,
    first_entry_id: model.firstEntryId ?? null,
    last_entry_id: model.lastEntryId ?? null,
    total_entries: model.totalEntries,
    total_videos: model.totalVideos,
    total_photos: model.totalPhotos,
    total_text_entries: model.totalTextEntries,
    total_duration_seconds: model.totalDurationSeconds,
    generated_at: model.generatedAt,
  };
}

/**
 * Convert a database notification settings row to a NotificationSettings model.
 */
export function notificationSettingsRowToModel(
  row: NotificationSettingsRow
): NotificationSettings {
  return {
    id: row.id,
    projectId: row.project_id,
    enabled: row.enabled === 1,
    time: row.time,
    days: JSON.parse(row.days),
    lastSentAt: row.last_sent_at ?? undefined,
  };
}

/**
 * Convert a NotificationSettings model to database row format for insertion/update.
 */
export function notificationSettingsModelToRow(
  model: NotificationSettings
): NotificationSettingsRow {
  return {
    id: model.id,
    project_id: model.projectId,
    enabled: model.enabled ? 1 : 0,
    time: model.time,
    days: JSON.stringify(model.days),
    last_sent_at: model.lastSentAt ?? null,
  };
}

/**
 * Convert a database sync queue item row to a SyncQueueItem model.
 */
export function syncQueueItemRowToModel(row: SyncQueueItemRow): SyncQueueItem {
  return {
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    operation: row.operation as "create" | "update" | "delete",
    payload: row.payload ?? undefined,
    createdAt: row.created_at,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

/**
 * Convert a SyncQueueItem model to database row format for insertion/update.
 */
export function syncQueueItemModelToRow(model: SyncQueueItem): SyncQueueItemRow {
  return {
    id: model.id,
    table_name: model.tableName,
    record_id: model.recordId,
    operation: model.operation,
    payload: model.payload ?? null,
    created_at: model.createdAt,
    attempts: model.attempts,
    last_attempt_at: model.lastAttemptAt ?? null,
    error_message: model.errorMessage ?? null,
  };
}

/**
 * Convert a database conflict log row to a ConflictLogEntry model.
 */
export function conflictLogRowToModel(row: ConflictLogEntryRow): ConflictLogEntry {
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

/**
 * Convert a ConflictLogEntry model to database row format for insertion.
 */
export function conflictLogModelToRow(model: ConflictLogEntry): ConflictLogEntryRow {
  return {
    id: model.id,
    table_name: model.tableName,
    record_id: model.recordId,
    conflict_type: model.conflictType,
    local_updated_at: model.localUpdatedAt,
    remote_updated_at: model.remoteUpdatedAt ?? null,
    local_data: model.localData ?? null,
    remote_data: model.remoteData ?? null,
    resolution: model.resolution,
    resolved_at: model.resolvedAt,
  };
}
