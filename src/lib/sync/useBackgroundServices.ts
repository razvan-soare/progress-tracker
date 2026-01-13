import { useEffect, useRef } from "react";
import { getBackgroundUploadProcessor } from "./background-upload-processor";
import { getMediaCleanupService } from "./media-cleanup-service";
import { getNotificationScheduler } from "@/lib/notifications/notification-scheduler";
import { getAlertsScheduler } from "@/lib/notifications/alerts-scheduler";

/**
 * Options for the useBackgroundServices hook
 */
export interface UseBackgroundServicesOptions {
  /** Whether to start the upload processor (default: true) */
  enableUploadProcessor?: boolean;
  /** Whether to start the cleanup service (default: true) */
  enableCleanupService?: boolean;
  /** Whether to start the notification scheduler (default: true) */
  enableNotificationScheduler?: boolean;
  /** Whether to start the alerts scheduler (default: true) */
  enableAlertsScheduler?: boolean;
}

/**
 * Hook that initializes and manages background services.
 * Call this in your root layout to start services on app startup.
 *
 * Services started:
 * - BackgroundUploadProcessor: Processes pending media uploads
 * - MediaCleanupService: Automatically cleans up synced local media
 * - NotificationScheduler: Schedules project reminder notifications
 * - AlertsScheduler: Schedules streak alerts and weekly summaries
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
    enableNotificationScheduler = true,
    enableAlertsScheduler = true,
  } = options;

  const uploadProcessorStarted = useRef(false);
  const cleanupServiceStarted = useRef(false);
  const notificationSchedulerStarted = useRef(false);
  const alertsSchedulerStarted = useRef(false);

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

  // Start/stop notification scheduler based on enableNotificationScheduler
  useEffect(() => {
    if (!enableNotificationScheduler) {
      return;
    }

    if (notificationSchedulerStarted.current) {
      return;
    }

    notificationSchedulerStarted.current = true;
    const notificationScheduler = getNotificationScheduler();
    notificationScheduler.start();

    return () => {
      const scheduler = getNotificationScheduler();
      scheduler.stop();
      notificationSchedulerStarted.current = false;
    };
  }, [enableNotificationScheduler]);

  // Start/stop alerts scheduler based on enableAlertsScheduler
  useEffect(() => {
    if (!enableAlertsScheduler) {
      return;
    }

    if (alertsSchedulerStarted.current) {
      return;
    }

    alertsSchedulerStarted.current = true;
    const alertsScheduler = getAlertsScheduler();
    alertsScheduler.start();

    return () => {
      const scheduler = getAlertsScheduler();
      scheduler.stop();
      alertsSchedulerStarted.current = false;
    };
  }, [enableAlertsScheduler]);
}
