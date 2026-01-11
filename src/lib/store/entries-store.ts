import { create } from "zustand";
import { deleteAsync, getInfoAsync } from "expo-file-system/legacy";
import type { Entry, EntryRow, EntryType, UploadStatus } from "@/types";
import { getDatabase } from "@/lib/db/database";
import { entryRowToModel, entryModelToRow } from "@/lib/db/mappers";
import { generateId, formatDateTime } from "@/lib/utils";

/**
 * Adds an entry to the sync queue for future cloud upload.
 * This is a non-blocking operation - sync queue failures should not block entry creation.
 */
async function addEntryToSyncQueue(
  entryId: string,
  operation: "create" | "update" | "delete"
): Promise<void> {
  try {
    const db = await getDatabase();
    const now = formatDateTime(new Date());
    await db.runAsync(
      `INSERT INTO sync_queue (id, table_name, record_id, operation, created_at, attempts)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), "entries", entryId, operation, now, 0]
    );
  } catch (error) {
    // Sync queue failure should NOT block entry operations
    console.warn("Failed to add entry to sync queue:", error);
  }
}

/**
 * Cleans up media files associated with a failed entry save.
 * Used for rollback when entry creation fails after media files have been created.
 */
async function cleanupMediaFiles(
  mediaUri?: string,
  thumbnailUri?: string
): Promise<void> {
  const cleanupFile = async (uri: string | undefined) => {
    if (!uri) return;
    try {
      const info = await getInfoAsync(uri);
      if (info.exists) {
        await deleteAsync(uri, { idempotent: true });
      }
    } catch (error) {
      console.warn("Failed to cleanup file:", uri, error);
    }
  };

  await Promise.all([cleanupFile(mediaUri), cleanupFile(thumbnailUri)]);
}

export interface EntryFilter {
  projectId: string;
  entryTypes?: EntryType[];
  startDate?: string;
  endDate?: string;
}

export type SortOrder = "asc" | "desc";

export interface CreateEntryInput {
  projectId: string;
  entryType: EntryType;
  contentText?: string;
  mediaUri?: string;
  thumbnailUri?: string;
  durationSeconds?: number;
}

export interface UpdateEntryInput {
  contentText?: string;
  mediaUri?: string;
  mediaRemoteUrl?: string;
  thumbnailUri?: string;
  durationSeconds?: number;
  uploadStatus?: UploadStatus;
}

interface EntriesState {
  entries: Entry[];
  entriesByProject: Record<string, Entry[]>;
  entriesById: Record<string, Entry>;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchEntries: (filter: EntryFilter, sortOrder?: SortOrder) => Promise<Entry[]>;
  fetchEntryById: (id: string) => Promise<Entry | null>;
  createEntry: (input: CreateEntryInput) => Promise<Entry>;
  updateEntry: (id: string, input: UpdateEntryInput) => Promise<Entry>;
  deleteEntry: (id: string) => Promise<void>;
  clearProjectEntries: (projectId: string) => void;
  clearError: () => void;
}

export const useEntriesStore = create<EntriesState>((set, get) => ({
  entries: [],
  entriesByProject: {},
  entriesById: {},
  isLoading: false,
  error: null,

  fetchEntries: async (filter: EntryFilter, sortOrder: SortOrder = "desc") => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();

      // Build query with filters
      const conditions: string[] = ["project_id = ?", "is_deleted = 0"];
      const params: (string | number)[] = [filter.projectId];

      if (filter.entryTypes && filter.entryTypes.length > 0) {
        const placeholders = filter.entryTypes.map(() => "?").join(", ");
        conditions.push(`entry_type IN (${placeholders})`);
        params.push(...filter.entryTypes);
      }

      if (filter.startDate) {
        conditions.push("date(created_at) >= ?");
        params.push(filter.startDate);
      }

      if (filter.endDate) {
        conditions.push("date(created_at) <= ?");
        params.push(filter.endDate);
      }

      const query = `
        SELECT * FROM entries
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at ${sortOrder.toUpperCase()}
      `;

      const rows = await db.getAllAsync<EntryRow>(query, params);
      const entries = rows.map(entryRowToModel);

      // Update state with fetched entries
      const entriesById = entries.reduce(
        (acc, entry) => {
          acc[entry.id] = entry;
          return acc;
        },
        {} as Record<string, Entry>
      );

      set((state) => ({
        entries,
        entriesByProject: {
          ...state.entriesByProject,
          [filter.projectId]: entries,
        },
        entriesById: { ...state.entriesById, ...entriesById },
        isLoading: false,
      }));

      return entries;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch entries",
        isLoading: false,
      });
      return [];
    }
  },

  fetchEntryById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<EntryRow>(
        "SELECT * FROM entries WHERE id = ? AND is_deleted = 0",
        [id]
      );

      if (!row) {
        set({ isLoading: false });
        return null;
      }

      const entry = entryRowToModel(row);
      set((state) => ({
        entriesById: { ...state.entriesById, [id]: entry },
        isLoading: false,
      }));
      return entry;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch entry",
        isLoading: false,
      });
      return null;
    }
  },

  createEntry: async (input: CreateEntryInput) => {
    set({ isLoading: true, error: null });

    const entry: Entry = {
      id: generateId(),
      projectId: input.projectId,
      entryType: input.entryType,
      contentText: input.contentText,
      mediaUri: input.mediaUri,
      thumbnailUri: input.thumbnailUri,
      durationSeconds: input.durationSeconds,
      createdAt: formatDateTime(new Date()),
      uploadStatus: "pending",
      isDeleted: false,
    };

    try {
      const db = await getDatabase();
      const row = entryModelToRow(entry);

      // Insert entry record into database
      await db.runAsync(
        `INSERT INTO entries (
          id, project_id, entry_type, content_text, media_uri, media_remote_url,
          thumbnail_uri, duration_seconds, created_at, synced_at, upload_status, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.project_id,
          row.entry_type,
          row.content_text,
          row.media_uri,
          row.media_remote_url,
          row.thumbnail_uri,
          row.duration_seconds ?? null,
          row.created_at,
          row.synced_at,
          row.upload_status,
          row.is_deleted ?? 0,
        ]
      );

      // Update project's updated_at timestamp
      await db.runAsync(
        "UPDATE projects SET updated_at = ? WHERE id = ?",
        [entry.createdAt, input.projectId]
      );

      // Add to sync queue for future cloud upload (non-blocking)
      await addEntryToSyncQueue(entry.id, "create");

      // Update Zustand store with new entry
      set((state) => {
        const projectEntries = state.entriesByProject[input.projectId] ?? [];
        return {
          entries: [entry, ...state.entries],
          entriesByProject: {
            ...state.entriesByProject,
            [input.projectId]: [entry, ...projectEntries],
          },
          entriesById: { ...state.entriesById, [entry.id]: entry },
          isLoading: false,
        };
      });

      return entry;
    } catch (error) {
      // Clean up media files if entry creation failed
      // This prevents orphaned files from accumulating
      await cleanupMediaFiles(input.mediaUri, input.thumbnailUri);

      const errorMessage = error instanceof Error ? error.message : "Failed to create entry";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  updateEntry: async (id: string, input: UpdateEntryInput) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();

      // Get existing entry
      let existingEntry = get().entriesById[id];
      if (!existingEntry) {
        const fetched = await get().fetchEntryById(id);
        if (!fetched) {
          throw new Error("Entry not found");
        }
        existingEntry = fetched;
      }

      const updatedEntry: Entry = {
        ...existingEntry,
        contentText: input.contentText !== undefined ? input.contentText : existingEntry.contentText,
        mediaUri: input.mediaUri !== undefined ? input.mediaUri : existingEntry.mediaUri,
        mediaRemoteUrl: input.mediaRemoteUrl !== undefined ? input.mediaRemoteUrl : existingEntry.mediaRemoteUrl,
        thumbnailUri: input.thumbnailUri !== undefined ? input.thumbnailUri : existingEntry.thumbnailUri,
        durationSeconds: input.durationSeconds !== undefined ? input.durationSeconds : existingEntry.durationSeconds,
        uploadStatus: input.uploadStatus ?? existingEntry.uploadStatus,
      };

      const row = entryModelToRow(updatedEntry);
      await db.runAsync(
        `UPDATE entries SET
          content_text = ?, media_uri = ?, media_remote_url = ?,
          thumbnail_uri = ?, duration_seconds = ?, upload_status = ?
        WHERE id = ?`,
        [
          row.content_text,
          row.media_uri,
          row.media_remote_url,
          row.thumbnail_uri,
          row.duration_seconds,
          row.upload_status,
          id,
        ]
      );

      // Add to sync queue for future cloud sync (non-blocking)
      await addEntryToSyncQueue(id, "update");

      set((state) => {
        const projectEntries = state.entriesByProject[updatedEntry.projectId] ?? [];
        return {
          entries: state.entries.map((e) => (e.id === id ? updatedEntry : e)),
          entriesByProject: {
            ...state.entriesByProject,
            [updatedEntry.projectId]: projectEntries.map((e) =>
              e.id === id ? updatedEntry : e
            ),
          },
          entriesById: { ...state.entriesById, [id]: updatedEntry },
          isLoading: false,
        };
      });

      return updatedEntry;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update entry",
        isLoading: false,
      });
      throw error;
    }
  },

  deleteEntry: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const entry = get().entriesById[id];

      // Soft delete the entry
      await db.runAsync(
        "UPDATE entries SET is_deleted = 1 WHERE id = ?",
        [id]
      );

      // Add to sync queue for future cloud sync (non-blocking)
      await addEntryToSyncQueue(id, "delete");

      set((state) => {
        const newEntriesById = { ...state.entriesById };
        delete newEntriesById[id];

        const newEntriesByProject = { ...state.entriesByProject };
        if (entry && newEntriesByProject[entry.projectId]) {
          newEntriesByProject[entry.projectId] = newEntriesByProject[
            entry.projectId
          ].filter((e) => e.id !== id);
        }

        return {
          entries: state.entries.filter((e) => e.id !== id),
          entriesByProject: newEntriesByProject,
          entriesById: newEntriesById,
          isLoading: false,
        };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete entry",
        isLoading: false,
      });
      throw error;
    }
  },

  clearProjectEntries: (projectId: string) => {
    set((state) => {
      const newEntriesByProject = { ...state.entriesByProject };
      delete newEntriesByProject[projectId];

      return {
        entriesByProject: newEntriesByProject,
      };
    });
  },

  clearError: () => set({ error: null }),
}));
