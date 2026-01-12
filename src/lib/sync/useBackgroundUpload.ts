import { useEffect, useState, useCallback, useRef } from "react";
import {
  BackgroundUploadProcessor,
  getBackgroundUploadProcessor,
  type BackgroundUploadProcessorConfig,
  type BackgroundUploadProcessorState,
  type BackgroundUploadEvent,
} from "./background-upload-processor";

/**
 * Hook return type for useBackgroundUpload
 */
export interface UseBackgroundUploadReturn {
  /** Current processor state */
  state: BackgroundUploadProcessorState;
  /** Whether the processor is currently running */
  isRunning: boolean;
  /** Whether uploads are paused */
  isPaused: boolean;
  /** Number of pending uploads */
  pendingCount: number;
  /** Number of failed uploads */
  failedCount: number;
  /** ID of the entry currently being uploaded */
  currentEntryId: string | null;
  /** Progress of the current upload (0-100) */
  currentProgress: number | null;
  /** Start the processor */
  start: () => Promise<void>;
  /** Stop the processor */
  stop: () => void;
  /** Manually trigger a check for pending uploads */
  checkPendingUploads: () => Promise<void>;
}

/**
 * Options for useBackgroundUpload hook
 */
export interface UseBackgroundUploadOptions extends BackgroundUploadProcessorConfig {
  /** Whether to automatically start the processor (default: true) */
  autoStart?: boolean;
  /** Callback when an upload starts */
  onUploadStarted?: (entryId: string) => void;
  /** Callback when an upload completes */
  onUploadCompleted?: (entryId: string, objectKey: string) => void;
  /** Callback when an upload fails */
  onUploadFailed?: (entryId: string, error: string) => void;
  /** Callback when processor is paused */
  onPaused?: (reason: "network" | "appState") => void;
  /** Callback when processor resumes */
  onResumed?: () => void;
}

/**
 * Hook for managing background uploads in React components.
 *
 * This hook provides access to the singleton BackgroundUploadProcessor and
 * handles lifecycle management, state updates, and event callbacks.
 *
 * @example
 * ```tsx
 * function UploadStatusBar() {
 *   const {
 *     isRunning,
 *     isPaused,
 *     pendingCount,
 *     currentProgress,
 *     start,
 *   } = useBackgroundUpload({
 *     autoStart: true,
 *     onUploadCompleted: (entryId, objectKey) => {
 *       console.log(`Entry ${entryId} uploaded to ${objectKey}`);
 *     },
 *   });
 *
 *   if (pendingCount === 0) {
 *     return null;
 *   }
 *
 *   return (
 *     <View>
 *       <Text>
 *         {isPaused ? 'Paused' : `Uploading: ${currentProgress ?? 0}%`}
 *       </Text>
 *       <Text>{pendingCount} uploads pending</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useBackgroundUpload(
  options: UseBackgroundUploadOptions = {}
): UseBackgroundUploadReturn {
  const {
    autoStart = true,
    onUploadStarted,
    onUploadCompleted,
    onUploadFailed,
    onPaused,
    onResumed,
    ...config
  } = options;

  const processorRef = useRef<BackgroundUploadProcessor | null>(null);
  const [state, setState] = useState<BackgroundUploadProcessorState>({
    isRunning: false,
    isPaused: true,
    pendingCount: 0,
    failedCount: 0,
    currentEntryId: null,
    currentProgress: null,
  });

  // Store callbacks in refs to avoid re-subscribing on every render
  const callbacksRef = useRef({
    onUploadStarted,
    onUploadCompleted,
    onUploadFailed,
    onPaused,
    onResumed,
  });

  // Update callback refs
  useEffect(() => {
    callbacksRef.current = {
      onUploadStarted,
      onUploadCompleted,
      onUploadFailed,
      onPaused,
      onResumed,
    };
  }, [onUploadStarted, onUploadCompleted, onUploadFailed, onPaused, onResumed]);

  // Event handler
  const handleEvent = useCallback((event: BackgroundUploadEvent) => {
    const callbacks = callbacksRef.current;

    switch (event.type) {
      case "stateChange":
        setState(event.state);
        break;
      case "uploadStarted":
        callbacks.onUploadStarted?.(event.entryId);
        break;
      case "uploadCompleted":
        callbacks.onUploadCompleted?.(event.entryId, event.objectKey);
        break;
      case "uploadFailed":
        callbacks.onUploadFailed?.(event.entryId, event.error);
        break;
      case "processorPaused":
        callbacks.onPaused?.(event.reason);
        break;
      case "processorResumed":
        callbacks.onResumed?.();
        break;
    }
  }, []);

  // Initialize processor and subscribe to events
  useEffect(() => {
    const processor = getBackgroundUploadProcessor(config);
    processorRef.current = processor;

    // Subscribe to events
    const unsubscribe = processor.addListener(handleEvent);

    // Get initial state
    setState(processor.getState());

    // Auto-start if configured
    if (autoStart) {
      processor.start();
    }

    // Cleanup on unmount (but don't stop the processor - it's a singleton)
    return () => {
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async () => {
    if (processorRef.current) {
      await processorRef.current.start();
    }
  }, []);

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.stop();
    }
  }, []);

  const checkPendingUploads = useCallback(async () => {
    if (processorRef.current) {
      await processorRef.current.checkPendingUploads();
    }
  }, []);

  return {
    state,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    pendingCount: state.pendingCount,
    failedCount: state.failedCount,
    currentEntryId: state.currentEntryId,
    currentProgress: state.currentProgress?.percentage ?? null,
    start,
    stop,
    checkPendingUploads,
  };
}
