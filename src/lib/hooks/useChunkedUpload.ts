import { useState, useCallback, useRef } from "react";
import {
  chunkedUpload,
  resumeChunkedUpload,
  shouldUseChunkedUpload,
  uploadFile,
  type ChunkedUploadController,
  type ChunkedUploadProgress,
  type ChunkedUploadResult,
  type MultipartUploadState,
  type UploadFileType,
} from "@/lib/supabase";
import {
  saveUploadState,
  loadUploadState,
  removeUploadState,
} from "@/lib/supabase/upload-state";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Upload status
 */
export type ChunkedUploadStatus =
  | "idle"
  | "uploading"
  | "paused"
  | "completed"
  | "error";

/**
 * Hook state for chunked uploads
 */
export interface UseChunkedUploadState {
  /** Current upload status */
  status: ChunkedUploadStatus;
  /** Progress information (null if not uploading) */
  progress: ChunkedUploadProgress | null;
  /** Error message if status is 'error' */
  error: string | null;
  /** Object key of the uploaded file (set when completed) */
  objectKey: string | null;
}

/**
 * Hook return type
 */
export interface UseChunkedUploadReturn extends UseChunkedUploadState {
  /** Start a new upload */
  upload: (
    fileUri: string,
    options: {
      fileType: UploadFileType;
      contentType: string;
      entryId: string;
      fileName?: string;
    }
  ) => Promise<string>;
  /** Resume an interrupted upload */
  resume: (entryId: string) => Promise<string>;
  /** Abort the current upload */
  abort: () => void;
  /** Reset the hook state */
  reset: () => void;
  /** Check if an upload can be resumed */
  canResume: (entryId: string) => Promise<boolean>;
}

/**
 * Hook for managing chunked video uploads with progress tracking,
 * abort capability, and resume support.
 *
 * @example
 * ```tsx
 * function UploadComponent() {
 *   const { upload, abort, status, progress, error } = useChunkedUpload();
 *
 *   const handleUpload = async () => {
 *     try {
 *       const objectKey = await upload('file:///path/to/video.mp4', {
 *         fileType: 'video',
 *         contentType: 'video/mp4',
 *         entryId: 'entry-123',
 *       });
 *       console.log('Uploaded to:', objectKey);
 *     } catch (error) {
 *       console.error('Upload failed:', error);
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       {status === 'uploading' && (
 *         <Text>Uploading: {progress?.percentage}%</Text>
 *       )}
 *       <Button onPress={handleUpload} title="Upload" />
 *       <Button onPress={abort} title="Cancel" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useChunkedUpload(): UseChunkedUploadReturn {
  const [state, setState] = useState<UseChunkedUploadState>({
    status: "idle",
    progress: null,
    error: null,
    objectKey: null,
  });

  const controllerRef = useRef<ChunkedUploadController | null>(null);
  const currentEntryIdRef = useRef<string | null>(null);

  /**
   * Handle progress updates
   */
  const handleProgress = useCallback((progress: ChunkedUploadProgress) => {
    setState((prev) => ({
      ...prev,
      progress,
    }));
  }, []);

  /**
   * Start a new upload
   */
  const upload = useCallback(
    async (
      fileUri: string,
      options: {
        fileType: UploadFileType;
        contentType: string;
        entryId: string;
        fileName?: string;
      }
    ): Promise<string> => {
      const { fileType, contentType, entryId, fileName } = options;

      // Reset state
      setState({
        status: "uploading",
        progress: null,
        error: null,
        objectKey: null,
      });

      currentEntryIdRef.current = entryId;

      try {
        // Get file info to determine if we need chunked upload
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          throw new Error("File does not exist");
        }

        const fileSize = (fileInfo as { size: number }).size;

        // Use chunked upload for large files, regular upload for small files
        if (shouldUseChunkedUpload(fileSize)) {
          // Check for existing state to resume
          const existingState = await loadUploadState(entryId);

          const controller = existingState
            ? resumeChunkedUpload(existingState, handleProgress)
            : chunkedUpload(fileUri, {
                fileType,
                contentType,
                fileName,
                onProgress: handleProgress,
              });

          controllerRef.current = controller;

          // Save state periodically for resume capability
          const saveInterval = setInterval(async () => {
            const currentState = controller.getState();
            if (currentState) {
              await saveUploadState(entryId, currentState);
            }
          }, 5000); // Save every 5 seconds

          try {
            const result = await controller.promise;

            // Clear interval and clean up state
            clearInterval(saveInterval);
            await removeUploadState(entryId);

            setState({
              status: "completed",
              progress: {
                percentage: 100,
                currentChunk: result.uploadState.totalChunks,
                totalChunks: result.uploadState.totalChunks,
                bytesUploaded: result.uploadState.fileSize,
                totalBytes: result.uploadState.fileSize,
              },
              error: null,
              objectKey: result.objectKey,
            });

            controllerRef.current = null;
            currentEntryIdRef.current = null;

            return result.objectKey;
          } catch (error) {
            clearInterval(saveInterval);

            // Save state for potential resume if not aborted
            const currentState = controller.getState();
            if (
              currentState &&
              !(error instanceof Error && error.message.includes("aborted"))
            ) {
              await saveUploadState(entryId, currentState);
            }

            throw error;
          }
        } else {
          // Use regular upload for small files
          // Read file as blob
          const base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Convert base64 to Blob
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: contentType });

          const objectKey = await uploadFile(
            fileType,
            blob,
            contentType,
            fileName,
            (percentage) => {
              setState((prev) => ({
                ...prev,
                progress: {
                  percentage,
                  currentChunk: 1,
                  totalChunks: 1,
                  bytesUploaded: Math.round((percentage / 100) * fileSize),
                  totalBytes: fileSize,
                },
              }));
            }
          );

          setState({
            status: "completed",
            progress: {
              percentage: 100,
              currentChunk: 1,
              totalChunks: 1,
              bytesUploaded: fileSize,
              totalBytes: fileSize,
            },
            error: null,
            objectKey,
          });

          currentEntryIdRef.current = null;

          return objectKey;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Don't set error state if aborted
        if (errorMessage.includes("aborted")) {
          setState((prev) => ({
            ...prev,
            status: "paused",
          }));
        } else {
          setState({
            status: "error",
            progress: state.progress,
            error: errorMessage,
            objectKey: null,
          });
        }

        throw error;
      }
    },
    [handleProgress, state.progress]
  );

  /**
   * Resume an interrupted upload
   */
  const resume = useCallback(
    async (entryId: string): Promise<string> => {
      const savedState = await loadUploadState(entryId);

      if (!savedState) {
        throw new Error("No saved upload state found for this entry");
      }

      currentEntryIdRef.current = entryId;

      setState({
        status: "uploading",
        progress: {
          percentage: Math.round(
            (savedState.completedParts.length / savedState.totalChunks) * 100
          ),
          currentChunk: savedState.completedParts.length,
          totalChunks: savedState.totalChunks,
          bytesUploaded:
            savedState.completedParts.length *
            (savedState.fileSize / savedState.totalChunks),
          totalBytes: savedState.fileSize,
        },
        error: null,
        objectKey: null,
      });

      const controller = resumeChunkedUpload(savedState, handleProgress);
      controllerRef.current = controller;

      // Save state periodically for resume capability
      const saveInterval = setInterval(async () => {
        const currentState = controller.getState();
        if (currentState) {
          await saveUploadState(entryId, currentState);
        }
      }, 5000);

      try {
        const result = await controller.promise;

        clearInterval(saveInterval);
        await removeUploadState(entryId);

        setState({
          status: "completed",
          progress: {
            percentage: 100,
            currentChunk: result.uploadState.totalChunks,
            totalChunks: result.uploadState.totalChunks,
            bytesUploaded: result.uploadState.fileSize,
            totalBytes: result.uploadState.fileSize,
          },
          error: null,
          objectKey: result.objectKey,
        });

        controllerRef.current = null;
        currentEntryIdRef.current = null;

        return result.objectKey;
      } catch (error) {
        clearInterval(saveInterval);

        const currentState = controller.getState();
        if (
          currentState &&
          !(error instanceof Error && error.message.includes("aborted"))
        ) {
          await saveUploadState(entryId, currentState);
        }

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        if (errorMessage.includes("aborted")) {
          setState((prev) => ({
            ...prev,
            status: "paused",
          }));
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: errorMessage,
          }));
        }

        throw error;
      }
    },
    [handleProgress]
  );

  /**
   * Abort the current upload
   */
  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }

    currentEntryIdRef.current = null;

    setState({
      status: "idle",
      progress: null,
      error: null,
      objectKey: null,
    });
  }, []);

  /**
   * Check if an upload can be resumed
   */
  const canResume = useCallback(async (entryId: string): Promise<boolean> => {
    const state = await loadUploadState(entryId);
    return state !== null;
  }, []);

  return {
    ...state,
    upload,
    resume,
    abort,
    reset,
    canResume,
  };
}
