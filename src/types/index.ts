export type EntryType = "video" | "photo" | "text";
export type UploadStatus = "pending" | "uploading" | "uploaded" | "failed";
export type ProjectCategory = "fitness" | "learning" | "creative" | "custom";

export interface Project {
  id: string;
  name: string;
  description?: string;
  category: ProjectCategory;
  coverImageUri?: string;
  startDate: string;
  endDate?: string;
  reminderTime?: string;
  reminderDays?: string[];
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  isDeleted: boolean;
}

export interface Entry {
  id: string;
  projectId: string;
  entryType: EntryType;
  contentText?: string;
  mediaUri?: string;
  mediaRemoteUrl?: string;
  thumbnailUri?: string;
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  uploadStatus: UploadStatus;
  isDeleted: boolean;
}

export interface Report {
  id: string;
  projectId: string;
  month: string;
  summaryText?: string;
  entryIds?: string[];
  firstEntryId?: string;
  lastEntryId?: string;
  totalEntries: number;
  totalVideos: number;
  totalPhotos: number;
  totalTextEntries: number;
  totalDurationSeconds: number;
  generatedAt: string;
}

export interface NotificationSettings {
  id: string;
  projectId: string;
  enabled: boolean;
  time: string;
  days: string[];
  lastSentAt?: string;
}

export interface SyncQueueItem {
  id: string;
  tableName: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  payload?: string;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  errorMessage?: string;
}

// Database row types (snake_case as stored in SQLite)
export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  cover_image_uri: string | null;
  start_date: string;
  end_date: string | null;
  reminder_time: string | null;
  reminder_days: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  is_deleted: number;
}

export interface EntryRow {
  id: string;
  project_id: string;
  entry_type: string;
  content_text: string | null;
  media_uri: string | null;
  media_remote_url: string | null;
  thumbnail_uri: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  upload_status: string;
  is_deleted: number;
}

export interface ReportRow {
  id: string;
  project_id: string;
  month: string;
  summary_text: string | null;
  entry_ids: string | null;
  first_entry_id: string | null;
  last_entry_id: string | null;
  total_entries: number;
  total_videos: number;
  total_photos: number;
  total_text_entries: number;
  total_duration_seconds: number;
  generated_at: string;
}

export interface NotificationSettingsRow {
  id: string;
  project_id: string;
  enabled: number;
  time: string;
  days: string;
  last_sent_at: string | null;
}

export interface SyncQueueItemRow {
  id: string;
  table_name: string;
  record_id: string;
  operation: string;
  payload: string | null;
  created_at: string;
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
}

// Conflict resolution types
export type ConflictType = "concurrent_edit" | "delete_edit";
export type ConflictResolution = "keep_local" | "keep_remote" | "keep_both";

export interface SyncConflict {
  id: string;
  tableName: string;
  recordId: string;
  conflictType: ConflictType;
  localEntry: Entry;
  remoteEntry?: Entry;
  localUpdatedAt: string;
  remoteUpdatedAt?: string;
}

export interface ConflictLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  conflictType: ConflictType;
  localUpdatedAt: string;
  remoteUpdatedAt?: string;
  localData?: string;
  remoteData?: string;
  resolution: ConflictResolution;
  resolvedAt: string;
}

export interface ConflictLogEntryRow {
  id: string;
  table_name: string;
  record_id: string;
  conflict_type: string;
  local_updated_at: string;
  remote_updated_at: string | null;
  local_data: string | null;
  remote_data: string | null;
  resolution: string;
  resolved_at: string;
}

// Sync history types
export type SyncOperationType = "upload" | "download" | "sync" | "retry" | "cache_clear";
export type SyncEntityType = "entry" | "project" | "media" | "all";
export type SyncHistoryStatus = "success" | "failed" | "in_progress";

export interface SyncHistoryEntry {
  id: string;
  operationType: SyncOperationType;
  entityType: SyncEntityType;
  entityId?: string;
  status: SyncHistoryStatus;
  message?: string;
  bytesTransferred: number;
  createdAt: string;
}

export interface SyncHistoryEntryRow {
  id: string;
  operation_type: string;
  entity_type: string;
  entity_id: string | null;
  status: string;
  message: string | null;
  bytes_transferred: number;
  created_at: string;
}
