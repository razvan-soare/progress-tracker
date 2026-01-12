import { useEffect, useState, useCallback } from "react";
import {
  getMediaCleanupService,
  type CleanupResult,
  type CleanupStats,
  type MediaCleanupEvent,
} from "./media-cleanup-service";

/**
 * Options for the useMediaCleanup hook
 */
export interface UseMediaCleanupOptions {
  /** Whether to auto-start the service (default: false) */
  autoStart?: boolean;
  /** Callback when cleanup completes */
  onCleanupCompleted?: (result: CleanupResult) => void;
  /** Callback when cleanup fails */
  onCleanupFailed?: (error: string) => void;
}

/**
 * Return type of the useMediaCleanup hook
 */
export interface UseMediaCleanupReturn {
  /** Whether the cleanup service is running */
  isRunning: boolean;
  /** Statistics about what can be cleaned up */
  stats: CleanupStats | null;
  /** Whether cleanup is currently in progress */
  isCleanupInProgress: boolean;
  /** Last cleanup result */
  lastResult: CleanupResult | null;
  /** Force a cleanup to run immediately */
  forceCleanup: () => Promise<CleanupResult>;
  /** Refresh cleanup statistics */
  refreshStats: () => Promise<void>;
  /** Start the cleanup service */
  startService: () => void;
  /** Stop the cleanup service */
  stopService: () => void;
}

/**
 * Hook for using the MediaCleanupService in React components
 *
 * @example
 * ```tsx
 * function CleanupSettings() {
 *   const {
 *     isRunning,
 *     stats,
 *     forceCleanup,
 *     refreshStats,
 *   } = useMediaCleanup({
 *     autoStart: true,
 *     onCleanupCompleted: (result) => {
 *       console.log(`Freed ${formatBytes(result.bytesFreed)}`);
 *     },
 *   });
 *
 *   return (
 *     <View>
 *       <Text>Eligible for cleanup: {stats?.eligibleCount ?? 0} entries</Text>
 *       <Button onPress={forceCleanup} title="Clean Now" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useMediaCleanup(
  options: UseMediaCleanupOptions = {}
): UseMediaCleanupReturn {
  const { autoStart = false, onCleanupCompleted, onCleanupFailed } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [isCleanupInProgress, setIsCleanupInProgress] = useState(false);
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);

  const service = getMediaCleanupService();

  useEffect(() => {
    const handleEvent = (event: MediaCleanupEvent) => {
      switch (event.type) {
        case "serviceStarted":
          setIsRunning(true);
          break;
        case "serviceStopped":
          setIsRunning(false);
          break;
        case "cleanupStarted":
          setIsCleanupInProgress(true);
          break;
        case "cleanupCompleted":
          setIsCleanupInProgress(false);
          setLastResult(event.result);
          onCleanupCompleted?.(event.result);
          // Refresh stats after cleanup
          service.getCleanupStats().then(setStats).catch(console.warn);
          break;
        case "cleanupFailed":
          setIsCleanupInProgress(false);
          onCleanupFailed?.(event.error);
          break;
      }
    };

    const removeListener = service.addListener(handleEvent);

    // Load initial stats
    service.getCleanupStats().then(setStats).catch(console.warn);

    // Auto-start if requested
    if (autoStart) {
      service.start();
      setIsRunning(true);
    }

    return () => {
      removeListener();
    };
  }, [service, autoStart, onCleanupCompleted, onCleanupFailed]);

  const forceCleanup = useCallback(async (): Promise<CleanupResult> => {
    return service.forceCleanup();
  }, [service]);

  const refreshStats = useCallback(async (): Promise<void> => {
    const newStats = await service.getCleanupStats();
    setStats(newStats);
  }, [service]);

  const startService = useCallback((): void => {
    service.start();
  }, [service]);

  const stopService = useCallback((): void => {
    service.stop();
  }, [service]);

  return {
    isRunning,
    stats,
    isCleanupInProgress,
    lastResult,
    forceCleanup,
    refreshStats,
    startService,
    stopService,
  };
}
