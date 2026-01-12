import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./client";
import { validateFileForUpload, UploadFileType } from "./upload";

/**
 * Chunk size for multipart uploads (5MB)
 */
export const CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * Maximum retry attempts per chunk
 */
export const MAX_CHUNK_RETRIES = 3;

/**
 * Delay between retries (in ms) - uses exponential backoff
 */
const BASE_RETRY_DELAY = 1000;

/**
 * Multipart upload state for persistence/resumption
 */
export interface MultipartUploadState {
  uploadId: string;
  objectKey: string;
  fileUri: string;
  fileSize: number;
  contentType: string;
  fileType: UploadFileType;
  totalChunks: number;
  completedParts: CompletedPart[];
  createdAt: string;
}

/**
 * A completed part in a multipart upload
 */
export interface CompletedPart {
  partNumber: number;
  etag: string;
}

/**
 * Progress callback with detailed information
 */
export interface ChunkedUploadProgress {
  /** Overall progress percentage (0-100) */
  percentage: number;
  /** Current chunk being uploaded (1-indexed) */
  currentChunk: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Bytes uploaded so far */
  bytesUploaded: number;
  /** Total file size in bytes */
  totalBytes: number;
}

/**
 * Options for chunked upload
 */
export interface ChunkedUploadOptions {
  /** File type for validation */
  fileType: UploadFileType;
  /** Content type of the file */
  contentType: string;
  /** Optional filename */
  fileName?: string;
  /** Progress callback */
  onProgress?: (progress: ChunkedUploadProgress) => void;
  /** Existing upload state for resumption */
  resumeState?: MultipartUploadState;
}

/**
 * Result from a chunked upload
 */
export interface ChunkedUploadResult {
  /** Object key where the file was uploaded */
  objectKey: string;
  /** Upload state that can be used for resumption if interrupted */
  uploadState: MultipartUploadState;
}

/**
 * Controller for managing an in-progress chunked upload
 */
export interface ChunkedUploadController {
  /** Promise that resolves when upload completes */
  promise: Promise<ChunkedUploadResult>;
  /** Abort the upload */
  abort: () => void;
  /** Get current upload state for persistence */
  getState: () => MultipartUploadState | null;
}

/**
 * Response from initiate multipart upload edge function
 */
interface InitiateMultipartResponse {
  uploadId: string;
  objectKey: string;
}

/**
 * Response from generate part URL edge function
 */
interface GeneratePartUrlResponse {
  uploadUrl: string;
  partNumber: number;
}

/**
 * Response from complete multipart upload edge function
 */
interface CompleteMultipartResponse {
  success: boolean;
  objectKey: string;
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  return BASE_RETRY_DELAY * Math.pow(2, attempt);
}

/**
 * Wait for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read a chunk from a file as base64
 */
async function readChunk(
  fileUri: string,
  chunkIndex: number,
  chunkSize: number,
  fileSize: number
): Promise<string> {
  const start = chunkIndex * chunkSize;
  const length = Math.min(chunkSize, fileSize - start);

  const base64Data = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
    position: start,
    length,
  });

  return base64Data;
}

/**
 * Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Upload a single chunk with retry logic
 */
async function uploadChunk(
  uploadUrl: string,
  chunkData: ArrayBuffer,
  contentType: string,
  abortSignal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Handle abort signal
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Get ETag from response headers
        const etag = xhr.getResponseHeader("ETag");
        if (etag) {
          resolve(etag.replace(/"/g, "")); // Remove quotes from ETag
        } else {
          // Some R2 configurations might not return ETag, generate a placeholder
          resolve(`part-${Date.now()}`);
        }
      } else {
        reject(new Error(`Chunk upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Chunk upload failed due to network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Chunk upload was aborted"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(chunkData);
  });
}

/**
 * Upload a chunk with retry logic
 */
async function uploadChunkWithRetry(
  uploadUrl: string,
  chunkData: ArrayBuffer,
  contentType: string,
  maxRetries: number,
  abortSignal?: AbortSignal
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if aborted before attempting
      if (abortSignal?.aborted) {
        throw new Error("Upload was aborted");
      }

      const etag = await uploadChunk(uploadUrl, chunkData, contentType, abortSignal);
      return etag;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if aborted
      if (lastError.message.includes("aborted")) {
        throw lastError;
      }

      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries - 1) {
        await delay(getRetryDelay(attempt));
      }
    }
  }

  throw lastError ?? new Error("Chunk upload failed after retries");
}

/**
 * Initiate a multipart upload
 */
async function initiateMultipartUpload(
  fileType: UploadFileType,
  fileSize: number,
  contentType: string,
  fileName?: string
): Promise<InitiateMultipartResponse> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Not authenticated. Please sign in to upload files.");
  }

  const { data, error } = await supabase.functions.invoke<InitiateMultipartResponse>(
    "multipart-upload",
    {
      body: {
        action: "initiate",
        fileType,
        fileSize,
        contentType,
        fileName,
      },
    }
  );

  if (error) {
    throw new Error(`Failed to initiate multipart upload: ${error.message}`);
  }

  if (!data || !data.uploadId || !data.objectKey) {
    throw new Error("Invalid response from multipart upload initiation");
  }

  return data;
}

/**
 * Get a pre-signed URL for uploading a specific part
 */
async function getPartUploadUrl(
  uploadId: string,
  objectKey: string,
  partNumber: number
): Promise<GeneratePartUrlResponse> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Not authenticated. Please sign in to upload files.");
  }

  const { data, error } = await supabase.functions.invoke<GeneratePartUrlResponse>(
    "multipart-upload",
    {
      body: {
        action: "getPartUrl",
        uploadId,
        objectKey,
        partNumber,
      },
    }
  );

  if (error) {
    throw new Error(`Failed to get part upload URL: ${error.message}`);
  }

  if (!data || !data.uploadUrl) {
    throw new Error("Invalid response from part URL generation");
  }

  return data;
}

/**
 * Complete a multipart upload
 */
async function completeMultipartUpload(
  uploadId: string,
  objectKey: string,
  parts: CompletedPart[]
): Promise<CompleteMultipartResponse> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Not authenticated. Please sign in to upload files.");
  }

  const { data, error } = await supabase.functions.invoke<CompleteMultipartResponse>(
    "multipart-upload",
    {
      body: {
        action: "complete",
        uploadId,
        objectKey,
        parts,
      },
    }
  );

  if (error) {
    throw new Error(`Failed to complete multipart upload: ${error.message}`);
  }

  if (!data || !data.success) {
    throw new Error("Failed to complete multipart upload");
  }

  return data;
}

/**
 * Abort a multipart upload
 */
async function abortMultipartUpload(
  uploadId: string,
  objectKey: string
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return; // Can't abort if not authenticated
    }

    await supabase.functions.invoke("multipart-upload", {
      body: {
        action: "abort",
        uploadId,
        objectKey,
      },
    });
  } catch {
    // Ignore errors during abort - best effort cleanup
    console.warn("Failed to abort multipart upload (cleanup will happen automatically)");
  }
}

/**
 * Create a chunked upload for a large file
 *
 * @param fileUri - Local file URI to upload
 * @param options - Upload options including file type, content type, and callbacks
 * @returns Controller object with promise, abort function, and state getter
 *
 * @example
 * ```typescript
 * const controller = chunkedUpload('file:///path/to/video.mp4', {
 *   fileType: 'video',
 *   contentType: 'video/mp4',
 *   onProgress: (progress) => {
 *     console.log(`Upload ${progress.percentage}% complete`);
 *   },
 * });
 *
 * // To abort the upload:
 * // controller.abort();
 *
 * // Wait for completion:
 * const result = await controller.promise;
 * console.log('Uploaded to:', result.objectKey);
 * ```
 */
export function chunkedUpload(
  fileUri: string,
  options: ChunkedUploadOptions
): ChunkedUploadController {
  const abortController = new AbortController();
  let currentState: MultipartUploadState | null = options.resumeState ?? null;
  let isAborted = false;

  const uploadPromise = async (): Promise<ChunkedUploadResult> => {
    const { fileType, contentType, fileName, onProgress, resumeState } = options;

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    // Type assertion for size since getInfoAsync returns it for existing files
    const fileSize = (fileInfo as { size: number }).size;

    // Validate file
    const validation = validateFileForUpload(fileType, fileSize, contentType);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    let uploadId: string;
    let objectKey: string;
    let completedParts: CompletedPart[] = [];

    // Check if we're resuming
    if (resumeState) {
      // Validate resume state matches the file
      if (resumeState.fileSize !== fileSize || resumeState.fileUri !== fileUri) {
        throw new Error("Resume state does not match the file being uploaded");
      }

      uploadId = resumeState.uploadId;
      objectKey = resumeState.objectKey;
      completedParts = [...resumeState.completedParts];
    } else {
      // Initiate new multipart upload
      const initResponse = await initiateMultipartUpload(
        fileType,
        fileSize,
        contentType,
        fileName
      );

      uploadId = initResponse.uploadId;
      objectKey = initResponse.objectKey;
    }

    // Create initial state
    currentState = {
      uploadId,
      objectKey,
      fileUri,
      fileSize,
      contentType,
      fileType,
      totalChunks,
      completedParts,
      createdAt: resumeState?.createdAt ?? new Date().toISOString(),
    };

    // Get completed part numbers for skipping
    const completedPartNumbers = new Set(completedParts.map((p) => p.partNumber));

    try {
      // Upload each chunk
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const partNumber = chunkIndex + 1; // Parts are 1-indexed

        // Check if aborted
        if (isAborted) {
          throw new Error("Upload was aborted");
        }

        // Skip already completed parts (for resume)
        if (completedPartNumbers.has(partNumber)) {
          // Report progress for skipped parts
          if (onProgress) {
            const bytesUploaded = Math.min((chunkIndex + 1) * CHUNK_SIZE, fileSize);
            onProgress({
              percentage: Math.round((bytesUploaded / fileSize) * 100),
              currentChunk: partNumber,
              totalChunks,
              bytesUploaded,
              totalBytes: fileSize,
            });
          }
          continue;
        }

        // Get pre-signed URL for this part
        const { uploadUrl } = await getPartUploadUrl(uploadId, objectKey, partNumber);

        // Read chunk data
        const base64Data = await readChunk(fileUri, chunkIndex, CHUNK_SIZE, fileSize);
        const chunkData = base64ToArrayBuffer(base64Data);

        // Upload chunk with retry
        const etag = await uploadChunkWithRetry(
          uploadUrl,
          chunkData,
          contentType,
          MAX_CHUNK_RETRIES,
          abortController.signal
        );

        // Record completed part
        const completedPart: CompletedPart = { partNumber, etag };
        completedParts.push(completedPart);

        // Update state
        currentState = {
          ...currentState,
          completedParts: [...completedParts],
        };

        // Report progress
        if (onProgress) {
          const bytesUploaded = Math.min((chunkIndex + 1) * CHUNK_SIZE, fileSize);
          onProgress({
            percentage: Math.round((bytesUploaded / fileSize) * 100),
            currentChunk: partNumber,
            totalChunks,
            bytesUploaded,
            totalBytes: fileSize,
          });
        }
      }

      // Complete the multipart upload
      await completeMultipartUpload(uploadId, objectKey, completedParts);

      return {
        objectKey,
        uploadState: currentState,
      };
    } catch (error) {
      // If aborted, clean up the multipart upload
      if (isAborted && currentState) {
        await abortMultipartUpload(uploadId, objectKey);
      }
      throw error;
    }
  };

  return {
    promise: uploadPromise(),
    abort: () => {
      isAborted = true;
      abortController.abort();
    },
    getState: () => currentState,
  };
}

/**
 * Resume an interrupted chunked upload
 *
 * @param state - The saved upload state from a previous upload
 * @param onProgress - Optional progress callback
 * @returns Controller object for the resumed upload
 */
export function resumeChunkedUpload(
  state: MultipartUploadState,
  onProgress?: (progress: ChunkedUploadProgress) => void
): ChunkedUploadController {
  return chunkedUpload(state.fileUri, {
    fileType: state.fileType,
    contentType: state.contentType,
    onProgress,
    resumeState: state,
  });
}

/**
 * Check if a file should use chunked upload based on size
 *
 * @param fileSize - Size of the file in bytes
 * @returns true if the file should use chunked upload
 */
export function shouldUseChunkedUpload(fileSize: number): boolean {
  // Use chunked upload for files larger than 10MB
  return fileSize > 10 * 1024 * 1024;
}
