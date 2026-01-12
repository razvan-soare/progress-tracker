import { useEffect, useRef } from "react";
import { getBackgroundUploadProcessor } from "./background-upload-processor";
import { getMediaCleanupService } from "./media-cleanup-service";

/**
 * Options for the useBackgroundServices hook
 */
export interface UseBackgroundServicesOptions {
  /** Whether to start the upload processor (default: true) */
  enableUploadProcessor?: boolean;
  /** Whether to start the cleanup service (default: true) */
  enableCleanupService?: boolean;
}

/**
 * Hook that initializes and manages background services.
 * Call this in your root layout to start services on app startup.
 *
 * Services started:
 * - BackgroundUploadProcessor: Processes pending media uploads
 * - MediaCleanupService: Automatically cleans up synced local media
 *
 * @example
 * ```tsx
 * // In your root layout
 * function RootLayout() {
 *   useBackgroundServices();
 *
 *   return (
 *     <Stack>
 *       ...
 *     </Stack>
 *   );
 * }
 * ```
 */
export function useBackgroundServices(
  options: UseBackgroundServicesOptions = {}
): void {
  const {
    enableUploadProcessor = true,
    enableCleanupService = true,
  } = options;

  const uploadProcessorStarted = useRef(false);
  const cleanupServiceStarted = useRef(false);

  // Start/stop upload processor based on enableUploadProcessor
  useEffect(() => {
    if (!enableUploadProcessor) {
      return;
    }

    if (uploadProcessorStarted.current) {
      return;
    }

    uploadProcessorStarted.current = true;
    const uploadProcessor = getBackgroundUploadProcessor();
    uploadProcessor.start();

    return () => {
      const processor = getBackgroundUploadProcessor();
      processor.stop();
      uploadProcessorStarted.current = false;
    };
  }, [enableUploadProcessor]);

  // Start/stop cleanup service based on enableCleanupService
  useEffect(() => {
    if (!enableCleanupService) {
      return;
    }

    if (cleanupServiceStarted.current) {
      return;
    }

    cleanupServiceStarted.current = true;
    const cleanupService = getMediaCleanupService();
    cleanupService.start();

    return () => {
      const service = getMediaCleanupService();
      service.stop();
      cleanupServiceStarted.current = false;
    };
  }, [enableCleanupService]);
}
