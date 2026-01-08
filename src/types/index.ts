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
  syncedAt?: string;
  uploadStatus: UploadStatus;
  isDeleted: boolean;
}

export interface Report {
  id: string;
  projectId: string;
  month: string;
  summaryText?: string;
  firstEntryId?: string;
  lastEntryId?: string;
  totalEntries: number;
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
