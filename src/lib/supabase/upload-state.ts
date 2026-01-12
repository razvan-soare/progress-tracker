import * as FileSystem from "expo-file-system/legacy";
import type { MultipartUploadState } from "./chunked-upload";

/**
 * Directory for storing upload states
 */
const UPLOAD_STATES_DIR = `${FileSystem.documentDirectory}upload_states/`;

/**
 * Maximum age for stored upload states (24 hours)
 * After this time, states are considered stale and can be cleaned up
 */
const MAX_STATE_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Ensure the upload states directory exists
 */
async function ensureDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(UPLOAD_STATES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(UPLOAD_STATES_DIR, { intermediates: true });
  }
}

/**
 * Get the file path for an upload state
 */
function getStatePath(entryId: string): string {
  // Sanitize entryId to be a safe filename
  const safeId = entryId.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${UPLOAD_STATES_DIR}${safeId}.json`;
}

/**
 * Save the upload state for an entry
 * This allows resuming interrupted uploads
 *
 * @param entryId - The entry ID this upload is associated with
 * @param state - The multipart upload state to save
 */
export async function saveUploadState(
  entryId: string,
  state: MultipartUploadState
): Promise<void> {
  await ensureDirectory();
  const filePath = getStatePath(entryId);
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(state));
}

/**
 * Load the upload state for an entry
 *
 * @param entryId - The entry ID to load state for
 * @returns The saved state or null if not found
 */
export async function loadUploadState(
  entryId: string
): Promise<MultipartUploadState | null> {
  const filePath = getStatePath(entryId);
  const fileInfo = await FileSystem.getInfoAsync(filePath);

  if (!fileInfo.exists) {
    return null;
  }

  try {
    const content = await FileSystem.readAsStringAsync(filePath);
    const state = JSON.parse(content) as MultipartUploadState;

    // Check if the state is too old
    const createdAt = new Date(state.createdAt).getTime();
    if (Date.now() - createdAt > MAX_STATE_AGE_MS) {
      // State is stale, remove it
      await removeUploadState(entryId);
      return null;
    }

    return state;
  } catch {
    // Invalid JSON or read error, remove it
    await removeUploadState(entryId);
    return null;
  }
}

/**
 * Remove the upload state for an entry
 * Call this when an upload completes or is permanently cancelled
 *
 * @param entryId - The entry ID to remove state for
 */
export async function removeUploadState(entryId: string): Promise<void> {
  const filePath = getStatePath(entryId);
  const fileInfo = await FileSystem.getInfoAsync(filePath);

  if (fileInfo.exists) {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  }
}

/**
 * Get all pending upload states
 * Useful for showing resumable uploads in the UI
 *
 * @returns Array of [entryId, state] pairs
 */
export async function getAllUploadStates(): Promise<
  Array<[string, MultipartUploadState]>
> {
  await ensureDirectory();

  const files = await FileSystem.readDirectoryAsync(UPLOAD_STATES_DIR);
  const states: Array<[string, MultipartUploadState]> = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const entryId = file.replace(".json", "");
    const filePath = `${UPLOAD_STATES_DIR}${file}`;

    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      const state = JSON.parse(content) as MultipartUploadState;

      // Check if the state is too old
      const createdAt = new Date(state.createdAt).getTime();
      if (Date.now() - createdAt > MAX_STATE_AGE_MS) {
        // State is stale, skip it (will be cleaned up later)
        continue;
      }

      states.push([entryId, state]);
    } catch {
      // Invalid JSON or read error, skip
    }
  }

  return states;
}

/**
 * Clean up stale upload states
 * Call this periodically to remove old states
 *
 * @returns Number of states cleaned up
 */
export async function cleanupStaleUploadStates(): Promise<number> {
  await ensureDirectory();

  const files = await FileSystem.readDirectoryAsync(UPLOAD_STATES_DIR);
  let cleanedCount = 0;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = `${UPLOAD_STATES_DIR}${file}`;

    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      const state = JSON.parse(content) as MultipartUploadState;
      const createdAt = new Date(state.createdAt).getTime();

      if (Date.now() - createdAt > MAX_STATE_AGE_MS) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        cleanedCount++;
      }
    } catch {
      // Invalid JSON, remove
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Check if an entry has a resumable upload
 *
 * @param entryId - The entry ID to check
 * @returns true if a valid upload state exists
 */
export async function hasResumableUpload(entryId: string): Promise<boolean> {
  const state = await loadUploadState(entryId);
  return state !== null;
}

/**
 * Get upload progress from saved state
 *
 * @param entryId - The entry ID to get progress for
 * @returns Progress percentage (0-100) or null if no state exists
 */
export async function getUploadProgress(entryId: string): Promise<number | null> {
  const state = await loadUploadState(entryId);
  if (!state) {
    return null;
  }

  const completedChunks = state.completedParts.length;
  return Math.round((completedChunks / state.totalChunks) * 100);
}
