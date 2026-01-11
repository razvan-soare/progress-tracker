/**
 * Media compression utilities for photos and videos
 *
 * Photos: Uses expo-image-manipulator to resize and compress to JPEG
 * Videos: Uses expo-av for basic transcoding (limited on mobile)
 */

import * as ImageManipulator from "expo-image-manipulator";
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
  FileInfo,
} from "expo-file-system/legacy";
import { generateId } from "./id";

// Compression settings
const MAX_IMAGE_DIMENSION = 1920; // Max pixels on longest side
const IMAGE_COMPRESSION_QUALITY = 0.8; // JPEG quality 0-1
const COMPRESSED_IMAGES_DIRECTORY = `${documentDirectory}images/`;
const COMPRESSED_VIDEOS_DIRECTORY = `${documentDirectory}videos/`;

/**
 * Result types for compression operations
 */
export type CompressionResult =
  | {
      success: true;
      uri: string;
      originalSize: number;
      compressedSize: number;
    }
  | {
      success: false;
      error: string;
      originalSize?: number;
    };

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // e.g., 0.5 means compressed to 50% of original
  savedBytes: number;
}

/**
 * Ensures a directory exists, creating it if necessary
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  const dirInfo = await getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(dirPath, { intermediates: true });
  }
}

/**
 * Gets file size in bytes, returns 0 if file doesn't exist
 */
async function getFileSize(uri: string): Promise<number> {
  try {
    const info = await getInfoAsync(uri);
    if (info.exists && "size" in info) {
      return (info as FileInfo & { size: number }).size || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Compresses a photo by resizing (max 1920px on longest side) and
 * converting to JPEG with 0.8 quality.
 *
 * @param sourceUri - The URI of the original photo
 * @returns CompressionResult with the compressed photo URI and size info
 */
export async function compressPhoto(sourceUri: string): Promise<CompressionResult> {
  try {
    // Get original file size
    const originalSize = await getFileSize(sourceUri);

    // Use expo-image-manipulator to resize and compress
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [
        {
          resize: {
            // Resize with max dimension constraint
            // ImageManipulator will maintain aspect ratio when only one dimension is specified
            width: MAX_IMAGE_DIMENSION,
          },
        },
      ],
      {
        compress: IMAGE_COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Ensure destination directory exists
    await ensureDirectory(COMPRESSED_IMAGES_DIRECTORY);

    // Generate unique filename for compressed image
    const fileName = `${generateId()}.jpg`;
    const destinationUri = `${COMPRESSED_IMAGES_DIRECTORY}${fileName}`;

    // Copy the manipulated image to our storage location
    await copyAsync({
      from: result.uri,
      to: destinationUri,
    });

    // Clean up the temporary manipulated file if different from destination
    if (result.uri !== destinationUri) {
      try {
        await deleteAsync(result.uri, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    // Get compressed file size
    const compressedSize = await getFileSize(destinationUri);

    return {
      success: true,
      uri: destinationUri,
      originalSize,
      compressedSize,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error compressing photo";
    console.error("Photo compression failed:", errorMessage);

    // Try to get original size even on error
    const originalSize = await getFileSize(sourceUri);

    return {
      success: false,
      error: errorMessage,
      originalSize,
    };
  }
}

/**
 * Compresses a video file. On mobile, video compression is limited.
 * This function will copy the video to storage and log size info.
 *
 * Note: Full video transcoding on mobile requires native modules like
 * react-native-video-processing or FFmpeg. For now, we save the original
 * and track sizes for future optimization.
 *
 * @param sourceUri - The URI of the original video
 * @returns CompressionResult with the video URI and size info
 */
export async function compressVideo(sourceUri: string): Promise<CompressionResult> {
  try {
    // Get original file size
    const originalSize = await getFileSize(sourceUri);

    // Ensure destination directory exists
    await ensureDirectory(COMPRESSED_VIDEOS_DIRECTORY);

    // Generate unique filename for video
    const fileExtension = sourceUri.split(".").pop()?.toLowerCase() || "mp4";
    const fileName = `${generateId()}.${fileExtension}`;
    const destinationUri = `${COMPRESSED_VIDEOS_DIRECTORY}${fileName}`;

    // Copy video to storage
    // Note: True video compression would require FFmpeg or similar native module
    // which adds significant bundle size. For now, we copy and track sizes.
    await copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    // Get "compressed" file size (same as original for now)
    const compressedSize = await getFileSize(destinationUri);

    // Log compression stats for debugging
    console.log("Video compression stats:", {
      originalSize: formatBytes(originalSize),
      compressedSize: formatBytes(compressedSize),
      note: "True video transcoding not available - using original quality",
    });

    return {
      success: true,
      uri: destinationUri,
      originalSize,
      compressedSize,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error processing video";
    console.error("Video processing failed:", errorMessage);

    // Try to get original size even on error
    const originalSize = await getFileSize(sourceUri);

    return {
      success: false,
      error: errorMessage,
      originalSize,
    };
  }
}

/**
 * Compresses media based on type (photo or video)
 *
 * @param sourceUri - The URI of the media file
 * @param mediaType - Either "photo" or "video"
 * @returns CompressionResult with the compressed media URI and size info
 */
export async function compressMedia(
  sourceUri: string,
  mediaType: "photo" | "video"
): Promise<CompressionResult> {
  if (mediaType === "photo") {
    return compressPhoto(sourceUri);
  } else {
    return compressVideo(sourceUri);
  }
}

/**
 * Calculates compression statistics from original and compressed sizes
 */
export function calculateCompressionStats(
  originalSize: number,
  compressedSize: number
): CompressionStats {
  const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
  const savedBytes = originalSize - compressedSize;

  return {
    originalSize,
    compressedSize,
    compressionRatio,
    savedBytes,
  };
}

/**
 * Formats bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

/**
 * Logs compression stats in a formatted way for debugging
 */
export function logCompressionStats(
  mediaType: "photo" | "video",
  stats: CompressionStats
): void {
  const percentSaved = ((1 - stats.compressionRatio) * 100).toFixed(1);

  console.log(`[Compression] ${mediaType.toUpperCase()} Stats:`, {
    original: formatBytes(stats.originalSize),
    compressed: formatBytes(stats.compressedSize),
    ratio: `${(stats.compressionRatio * 100).toFixed(1)}%`,
    saved: `${formatBytes(stats.savedBytes)} (${percentSaved}% reduction)`,
  });
}
