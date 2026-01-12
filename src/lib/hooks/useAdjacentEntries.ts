import { useState, useEffect, useCallback } from "react";
import { getDatabase } from "@/lib/db/database";
import { entryRowToModel } from "@/lib/db/mappers";
import type { Entry, EntryRow } from "@/types";

interface AdjacentEntriesResult {
  previousEntry: Entry | null;
  nextEntry: Entry | null;
  isLoading: boolean;
}

/**
 * Hook to get adjacent entries in the timeline (previous and next).
 * Useful for prefetching media for smoother navigation.
 *
 * @param currentEntryId - The ID of the current entry
 * @param projectId - The project ID to search within
 * @returns Previous and next entries relative to the current entry
 */
export function useAdjacentEntries(
  currentEntryId: string | undefined,
  projectId: string | undefined
): AdjacentEntriesResult {
  const [previousEntry, setPreviousEntry] = useState<Entry | null>(null);
  const [nextEntry, setNextEntry] = useState<Entry | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAdjacent = useCallback(async () => {
    if (!currentEntryId || !projectId) {
      setPreviousEntry(null);
      setNextEntry(null);
      return;
    }

    setIsLoading(true);

    try {
      const db = await getDatabase();

      // Get the current entry's created_at timestamp
      const currentEntry = await db.getFirstAsync<{ created_at: string }>(
        `SELECT created_at FROM entries WHERE id = ? AND is_deleted = 0`,
        [currentEntryId]
      );

      if (!currentEntry) {
        setPreviousEntry(null);
        setNextEntry(null);
        setIsLoading(false);
        return;
      }

      const currentCreatedAt = currentEntry.created_at;

      // Get the previous entry (older, sorted by created_at DESC)
      const prevRow = await db.getFirstAsync<EntryRow>(
        `SELECT * FROM entries
         WHERE project_id = ?
           AND is_deleted = 0
           AND created_at < ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [projectId, currentCreatedAt]
      );

      // Get the next entry (newer, sorted by created_at ASC)
      const nextRow = await db.getFirstAsync<EntryRow>(
        `SELECT * FROM entries
         WHERE project_id = ?
           AND is_deleted = 0
           AND created_at > ?
         ORDER BY created_at ASC
         LIMIT 1`,
        [projectId, currentCreatedAt]
      );

      setPreviousEntry(prevRow ? entryRowToModel(prevRow) : null);
      setNextEntry(nextRow ? entryRowToModel(nextRow) : null);
    } catch (error) {
      console.error("Failed to fetch adjacent entries:", error);
      setPreviousEntry(null);
      setNextEntry(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentEntryId, projectId]);

  useEffect(() => {
    fetchAdjacent();
  }, [fetchAdjacent]);

  return {
    previousEntry,
    nextEntry,
    isLoading,
  };
}

/**
 * Get adjacent entries as an array (for prefetching)
 */
export function useAdjacentEntriesArray(
  currentEntryId: string | undefined,
  projectId: string | undefined
): Entry[] {
  const { previousEntry, nextEntry } = useAdjacentEntries(currentEntryId, projectId);

  const entries: Entry[] = [];
  if (previousEntry) entries.push(previousEntry);
  if (nextEntry) entries.push(nextEntry);

  return entries;
}
