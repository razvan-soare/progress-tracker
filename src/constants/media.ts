/**
 * Media capture and processing configuration constants
 */

// Video recording limits
export const MAX_VIDEO_DURATION_MS = 180000; // 180 seconds (3 minutes)
export const MAX_VIDEO_DURATION_SECONDS = 180;
export const MIN_VIDEO_DURATION_SECONDS = 1;

// File size limits (in bytes)
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Compression quality levels (0-1 scale)
export const COMPRESSION_QUALITY = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
} as const;

// Default compression quality for different use cases
export const DEFAULT_IMAGE_COMPRESSION = COMPRESSION_QUALITY.MEDIUM;
export const DEFAULT_THUMBNAIL_COMPRESSION = COMPRESSION_QUALITY.LOW;

// Thumbnail dimensions
export const THUMBNAIL_WIDTH = 300;
export const THUMBNAIL_HEIGHT = 300;

// Thumbnail generation settings
export const THUMBNAIL_TIME_MS = 500; // Time position to capture frame (0.5 seconds)

// Image dimensions for compressed images
export const COMPRESSED_IMAGE_MAX_WIDTH = 1920;
export const COMPRESSED_IMAGE_MAX_HEIGHT = 1080;

// Supported media formats
export const SUPPORTED_IMAGE_FORMATS = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;

export const SUPPORTED_VIDEO_FORMATS = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/webm",
] as const;

// File extensions
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"] as const;
export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"] as const;

// Camera settings
export const CAMERA_RATIO = "16:9";
export const DEFAULT_CAMERA_FACING = "back" as const;

// Video recording quality
export const VIDEO_QUALITY = {
  HIGH: "1080p",
  MEDIUM: "720p",
  LOW: "480p",
} as const;

export const DEFAULT_VIDEO_QUALITY = VIDEO_QUALITY.HIGH;

// Audio settings for video recording
export const AUDIO_SETTINGS = {
  SAMPLE_RATE: 44100,
  CHANNELS: 2,
  BIT_RATE: 128000,
} as const;

// Types
export type CompressionQuality = (typeof COMPRESSION_QUALITY)[keyof typeof COMPRESSION_QUALITY];
export type VideoQuality = (typeof VIDEO_QUALITY)[keyof typeof VIDEO_QUALITY];
export type SupportedImageFormat = (typeof SUPPORTED_IMAGE_FORMATS)[number];
export type SupportedVideoFormat = (typeof SUPPORTED_VIDEO_FORMATS)[number];
export type CameraFacing = "front" | "back";
