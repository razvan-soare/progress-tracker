import { supabase } from "./client";

/**
 * File types supported for upload
 */
export type UploadFileType = "video" | "photo";

/**
 * Request parameters for generating an upload URL
 */
export interface GenerateUploadUrlRequest {
  fileType: UploadFileType;
  fileSize: number;
  contentType: string;
  fileName?: string;
}

/**
 * Response from the generate-upload-url edge function
 */
export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
}

/**
 * Error response from the edge function
 */
export interface UploadError {
  error: string;
  code: string;
}

/**
 * File size limits for each file type (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  video: 500 * 1024 * 1024, // 500MB
  photo: 20 * 1024 * 1024, // 20MB
} as const;

/**
 * Allowed content types for each file type
 */
export const ALLOWED_CONTENT_TYPES = {
  video: ["video/mp4", "video/quicktime", "video/x-m4v", "video/webm"],
  photo: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
} as const;

/**
 * Validates file parameters before requesting an upload URL
 */
export function validateFileForUpload(
  fileType: UploadFileType,
  fileSize: number,
  contentType: string
): { valid: true } | { valid: false; error: string } {
  // Check file size
  const maxSize = FILE_SIZE_LIMITS[fileType];
  if (fileSize > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds maximum allowed for ${fileType} (${maxSizeMB}MB)`,
    };
  }

  // Check content type
  const allowedTypes = ALLOWED_CONTENT_TYPES[fileType] as readonly string[];
  if (!allowedTypes.includes(contentType)) {
    return {
      valid: false,
      error: `Invalid content type for ${fileType}. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Generates a pre-signed upload URL for uploading files to R2
 *
 * @param request - The upload request parameters
 * @returns The upload URL response or throws an error
 *
 * @example
 * ```typescript
 * const { uploadUrl, objectKey } = await generateUploadUrl({
 *   fileType: 'photo',
 *   fileSize: 1024000,
 *   contentType: 'image/jpeg',
 *   fileName: 'my-photo.jpg'
 * });
 *
 * // Use the uploadUrl to upload directly to R2
 * await fetch(uploadUrl, {
 *   method: 'PUT',
 *   body: fileBlob,
 *   headers: { 'Content-Type': 'image/jpeg' }
 * });
 * ```
 */
export async function generateUploadUrl(
  request: GenerateUploadUrlRequest
): Promise<GenerateUploadUrlResponse> {
  // Validate locally first to fail fast
  const validation = validateFileForUpload(
    request.fileType,
    request.fileSize,
    request.contentType
  );

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Get the current session for authentication
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Not authenticated. Please sign in to upload files.");
  }

  // Call the edge function
  const { data, error } = await supabase.functions.invoke<
    GenerateUploadUrlResponse | UploadError
  >("generate-upload-url", {
    body: request,
  });

  if (error) {
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }

  if (!data) {
    throw new Error("No response from upload URL generator");
  }

  // Check if the response is an error
  if ("code" in data && "error" in data) {
    throw new Error(data.error);
  }

  return data as GenerateUploadUrlResponse;
}

/**
 * Uploads a file directly to R2 using a pre-signed URL
 *
 * @param uploadUrl - The pre-signed upload URL from generateUploadUrl
 * @param file - The file blob to upload
 * @param contentType - The content type of the file
 * @param onProgress - Optional callback for upload progress
 * @returns Promise that resolves when upload is complete
 */
export async function uploadToR2(
  uploadUrl: string,
  file: Blob | ArrayBuffer,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed due to network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}

/**
 * Convenience function to generate an upload URL and upload a file in one step
 *
 * @param fileType - The type of file being uploaded
 * @param file - The file blob to upload
 * @param contentType - The content type of the file
 * @param fileName - Optional filename
 * @param onProgress - Optional callback for upload progress
 * @returns The object key where the file was uploaded
 */
export async function uploadFile(
  fileType: UploadFileType,
  file: Blob,
  contentType: string,
  fileName?: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Generate the upload URL
  const { uploadUrl, objectKey } = await generateUploadUrl({
    fileType,
    fileSize: file.size,
    contentType,
    fileName,
  });

  // Upload the file
  await uploadToR2(uploadUrl, file, contentType, onProgress);

  return objectKey;
}
