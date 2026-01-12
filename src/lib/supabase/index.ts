export { supabase } from "./client";
export { secureStorageAdapter } from "./storage";
export type { Database } from "./types";
export {
  generateUploadUrl,
  uploadToR2,
  uploadFile,
  validateFileForUpload,
  FILE_SIZE_LIMITS,
  ALLOWED_CONTENT_TYPES,
} from "./upload";
export type {
  UploadFileType,
  GenerateUploadUrlRequest,
  GenerateUploadUrlResponse,
  UploadError,
} from "./upload";

// Chunked upload utilities
export {
  chunkedUpload,
  resumeChunkedUpload,
  shouldUseChunkedUpload,
  CHUNK_SIZE,
  MAX_CHUNK_RETRIES,
} from "./chunked-upload";
export type {
  MultipartUploadState,
  CompletedPart,
  ChunkedUploadProgress,
  ChunkedUploadOptions,
  ChunkedUploadResult,
  ChunkedUploadController,
} from "./chunked-upload";

// Upload state persistence
export {
  saveUploadState,
  loadUploadState,
  removeUploadState,
  getAllUploadStates,
  cleanupStaleUploadStates,
  hasResumableUpload,
  getUploadProgress,
} from "./upload-state";

// Media streaming from R2
export {
  generateStreamingUrl,
  prefetchStreamingUrls,
  clearStreamingUrlCache,
  getStreamingCacheStats,
} from "./streaming";
export type {
  GenerateDownloadUrlResponse,
  StreamingError,
} from "./streaming";
