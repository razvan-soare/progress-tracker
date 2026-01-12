import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPendingCount,
  getFailedCount,
  getAllPendingItems,
  clearCompletedItems,
} from "./sync-queue-service";
import type { SyncQueueItem } from "@/types";

export interface SyncQueueStatus {
  pendingCount: number;
  failedCount: number;
  isProcessing: boolean;
  lastError: string | null;
  pendingItems: SyncQueueItem[];
}

export interface UseSyncQueueOptions {
  maxAttempts?: number;
  pollInterval?: number; // in milliseconds, 0 to disable polling
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_POLL_INTERVAL = 0; // Polling disabled by default

/**
 * Hook for accessing sync queue status and operations.
 * Provides real-time queue status including pending count, processing state, and errors.
 */
export function useSyncQueue(options: UseSyncQueueOptions = {}) {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    pollInterval = DEFAULT_POLL_INTERVAL,
  } = options;

  const [status, setStatus] = useState<SyncQueueStatus>({
    pendingCount: 0,
    failedCount: 0,
    isProcessing: false,
    lastError: null,
    pendingItems: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const [pendingCount, failedCount, pendingItems] = await Promise.all([
        getPendingCount(maxAttempts),
        getFailedCount(maxAttempts),
        getAllPendingItems(maxAttempts),
      ]);

      if (isMountedRef.current) {
        setStatus((prev) => ({
          ...prev,
          pendingCount,
          failedCount,
          pendingItems,
        }));
      }
    } catch (error) {
      if (isMountedRef.current) {
        setStatus((prev) => ({
          ...prev,
          lastError:
            error instanceof Error ? error.message : "Failed to fetch queue status",
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [maxAttempts]);

  // Set processing state
  const setProcessing = useCallback((isProcessing: boolean) => {
    if (isMountedRef.current) {
      setStatus((prev) => ({ ...prev, isProcessing }));
    }
  }, []);

  // Set error state
  const setError = useCallback((error: string | null) => {
    if (isMountedRef.current) {
      setStatus((prev) => ({ ...prev, lastError: error }));
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    if (isMountedRef.current) {
      setStatus((prev) => ({ ...prev, lastError: null }));
    }
  }, []);

  // Clear failed items from queue
  const clearFailed = useCallback(async () => {
    try {
      await clearCompletedItems(maxAttempts);
      await fetchStatus();
    } catch (error) {
      if (isMountedRef.current) {
        setStatus((prev) => ({
          ...prev,
          lastError:
            error instanceof Error ? error.message : "Failed to clear failed items",
        }));
      }
    }
  }, [maxAttempts, fetchStatus]);

  // Refetch queue status
  const refetch = useCallback(() => {
    return fetchStatus();
  }, [fetchStatus]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchStatus();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchStatus]);

  // Optional polling
  useEffect(() => {
    if (pollInterval <= 0) return;

    const intervalId = setInterval(() => {
      fetchStatus();
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [pollInterval, fetchStatus]);

  return {
    ...status,
    isLoading,
    refetch,
    setProcessing,
    setError,
    clearError,
    clearFailed,
  };
}
