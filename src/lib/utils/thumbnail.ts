import * as VideoThumbnails from "expo-video-thumbnails";
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
} from "expo-file-system/legacy";
import { generateId } from "./id";

const THUMBNAILS_DIRECTORY = `${documentDirectory}thumbnails/`;
const DEFAULT_THUMBNAIL_TIME_MS = 500; // 0.5 seconds

export type ThumbnailResult =
  | { success: true; uri: string }
  | { success: false; error: string };

/**
 * Ensures the thumbnails directory exists
 */
async function ensureThumbnailsDirectory(): Promise<void> {
  const dirInfo = await getInfoAsync(THUMBNAILS_DIRECTORY);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(THUMBNAILS_DIRECTORY, { intermediates: true });
  }
}

/**
 * Generates a thumbnail from a video file
 *
 * @param videoUri - The URI of the video file
 * @param timeMs - The time position to capture the frame (in milliseconds)
 * @returns The result containing either the thumbnail URI or an error
 */
export async function generateVideoThumbnail(
  videoUri: string,
  timeMs: number = DEFAULT_THUMBNAIL_TIME_MS
): Promise<ThumbnailResult> {
  try {
    // Generate thumbnail using expo-video-thumbnails
    const { uri: tempThumbnailUri } = await VideoThumbnails.getThumbnailAsync(
      videoUri,
      {
        time: timeMs,
        quality: 0.5, // Match DEFAULT_THUMBNAIL_COMPRESSION from media constants
      }
    );

    // Ensure thumbnails directory exists
    await ensureThumbnailsDirectory();

    // Generate a unique filename for the thumbnail
    const thumbnailFileName = `${generateId()}.jpg`;
    const destinationUri = `${THUMBNAILS_DIRECTORY}${thumbnailFileName}`;

    // Copy the temporary thumbnail to our persistent storage
    await copyAsync({
      from: tempThumbnailUri,
      to: destinationUri,
    });

    // Clean up the temporary file
    try {
      await deleteAsync(tempThumbnailUri, { idempotent: true });
    } catch {
      // Ignore cleanup errors
    }

    return { success: true, uri: destinationUri };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error generating thumbnail";
    console.warn("Failed to generate video thumbnail:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Generates a thumbnail from a video, trying to extract a frame at 0.5 seconds.
 * If that fails (e.g., video is too short), tries to extract the first frame.
 *
 * @param videoUri - The URI of the video file
 * @returns The result containing either the thumbnail URI or an error
 */
export async function generateVideoThumbnailSafe(
  videoUri: string
): Promise<ThumbnailResult> {
  // First, try at 0.5 seconds
  const result = await generateVideoThumbnail(videoUri, DEFAULT_THUMBNAIL_TIME_MS);

  if (result.success) {
    return result;
  }

  // If that fails, try to get the first frame (at 0ms)
  console.log("Retrying thumbnail generation at first frame...");
  return generateVideoThumbnail(videoUri, 0);
}

/**
 * Deletes a thumbnail file
 *
 * @param thumbnailUri - The URI of the thumbnail to delete
 * @returns True if deletion was successful, false otherwise
 */
export async function deleteThumbnail(thumbnailUri: string): Promise<boolean> {
  try {
    const fileInfo = await getInfoAsync(thumbnailUri);
    if (fileInfo.exists) {
      await deleteAsync(thumbnailUri);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a thumbnail name linked to a video file
 * This creates a naming convention that links thumbnails to their source videos
 *
 * @param videoFileName - The video file name (without path)
 * @returns The thumbnail file name
 */
export function getThumbnailNameForVideo(videoFileName: string): string {
  // Remove extension and add thumbnail suffix
  const baseName = videoFileName.replace(/\.[^/.]+$/, "");
  return `${baseName}_thumb.jpg`;
}
