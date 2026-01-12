import { useState, useEffect, useCallback } from "react";
import { useBackgroundUpload } from "./useBackgroundUpload";
import type { UploadStatus } from "@/types";

export interface EntryUploadState {
  status: UploadStatus;
  progress: number | null;
  isCurrentlyUploading: boolean;
}

export interface UseEntryUploadStatusReturn extends EntryUploadState {
  retryUpload: () => Promise<void>;
}

/**
 * Hook to track upload status for a specific entry.
 * Combines entry's uploadStatus with real-time progress from BackgroundUploadProcessor.
 */
export function useEntryUploadStatus(
  entryId: string,
  initialStatus: UploadStatus
): UseEntryUploadStatusReturn {
  const [status, setStatus] = useState<UploadStatus>(initialStatus);
  const [progress, setProgress] = useState<number | null>(null);

  const {
    currentEntryId,
    currentProgress,
    checkPendingUploads,
  } = useBackgroundUpload({
    autoStart: false,
    onUploadStarted: useCallback(
      (uploadedEntryId: string) => {
        if (uploadedEntryId === entryId) {
          setStatus("uploading");
          setProgress(0);
        }
      },
      [entryId]
    ),
    onUploadCompleted: useCallback(
      (uploadedEntryId: string) => {
        if (uploadedEntryId === entryId) {
          setStatus("uploaded");
          setProgress(null);
        }
      },
      [entryId]
    ),
    onUploadFailed: useCallback(
      (uploadedEntryId: string) => {
        if (uploadedEntryId === entryId) {
          setStatus("failed");
          setProgress(null);
        }
      },
      [entryId]
    ),
  });

  // Update status when initial status changes
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // Track progress for this specific entry
  useEffect(() => {
    if (currentEntryId === entryId && currentProgress != null) {
      setProgress(currentProgress);
    } else if (currentEntryId !== entryId) {
      setProgress(null);
    }
  }, [currentEntryId, currentProgress, entryId]);

  const retryUpload = useCallback(async () => {
    setStatus("pending");
    await checkPendingUploads();
  }, [checkPendingUploads]);

  const isCurrentlyUploading = currentEntryId === entryId && status === "uploading";

  return {
    status,
    progress,
    isCurrentlyUploading,
    retryUpload,
  };
}

/**
 * Hook to get upload progress for multiple entries.
 * More efficient for lists as it uses a single subscription.
 */
export function useEntriesUploadStatus(entryIds: string[]): Map<string, EntryUploadState> {
  const [statusMap, setStatusMap] = useState<Map<string, EntryUploadState>>(new Map());

  const {
    currentEntryId,
    currentProgress,
  } = useBackgroundUpload({
    autoStart: false,
    onUploadStarted: useCallback(
      (entryId: string) => {
        if (entryIds.includes(entryId)) {
          setStatusMap((prev) => {
            const next = new Map(prev);
            next.set(entryId, {
              status: "uploading",
              progress: 0,
              isCurrentlyUploading: true,
            });
            return next;
          });
        }
      },
      [entryIds]
    ),
    onUploadCompleted: useCallback(
      (entryId: string) => {
        if (entryIds.includes(entryId)) {
          setStatusMap((prev) => {
            const next = new Map(prev);
            next.set(entryId, {
              status: "uploaded",
              progress: null,
              isCurrentlyUploading: false,
            });
            return next;
          });
        }
      },
      [entryIds]
    ),
    onUploadFailed: useCallback(
      (entryId: string) => {
        if (entryIds.includes(entryId)) {
          setStatusMap((prev) => {
            const next = new Map(prev);
            next.set(entryId, {
              status: "failed",
              progress: null,
              isCurrentlyUploading: false,
            });
            return next;
          });
        }
      },
      [entryIds]
    ),
  });

  // Update progress for current uploading entry
  useEffect(() => {
    if (currentEntryId && entryIds.includes(currentEntryId) && currentProgress != null) {
      setStatusMap((prev) => {
        const existing = prev.get(currentEntryId);
        if (existing?.progress !== currentProgress) {
          const next = new Map(prev);
          next.set(currentEntryId, {
            status: "uploading",
            progress: currentProgress,
            isCurrentlyUploading: true,
          });
          return next;
        }
        return prev;
      });
    }
  }, [currentEntryId, currentProgress, entryIds]);

  return statusMap;
}
