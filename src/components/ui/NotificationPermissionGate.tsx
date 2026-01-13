import { useEffect, useRef } from "react";
import { useNotificationPermissionFlow } from "@/lib/hooks/useNotificationPermissionFlow";
import {
  NotificationPermissionModal,
  NotificationPermissionDeniedModal,
} from "./NotificationPermissionModal";

export interface NotificationPermissionGateProps {
  /**
   * Whether to automatically check and trigger the permission flow on mount
   * Default: true
   */
  autoTrigger?: boolean;
  /**
   * Delay in milliseconds before showing the permission modal
   * Allows the app to fully load before prompting
   * Default: 1500
   */
  delayMs?: number;
}

/**
 * Component that manages the notification permission flow
 *
 * Add this component to your root layout to automatically handle
 * notification permission requests with proper explanation modals.
 *
 * Usage:
 * ```tsx
 * <NotificationPermissionGate autoTrigger={true} delayMs={2000} />
 * ```
 */
export function NotificationPermissionGate({
  autoTrigger = true,
  delayMs = 1500,
}: NotificationPermissionGateProps) {
  const hasTriggeredRef = useRef(false);

  const {
    showExplanationModal,
    showDeniedModal,
    isGranted,
    isLoading,
    checkAndTriggerFlow,
    handleRequestPermission,
    handleDismissExplanation,
    handlePermissionComplete,
    handleOpenSettings,
    handleDismissDenied,
  } = useNotificationPermissionFlow();

  // Auto-trigger permission flow on mount with delay
  useEffect(() => {
    if (!autoTrigger || hasTriggeredRef.current || isLoading) {
      return;
    }

    // Don't trigger if already granted
    if (isGranted) {
      hasTriggeredRef.current = true;
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        checkAndTriggerFlow();
      }
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [autoTrigger, delayMs, isGranted, isLoading, checkAndTriggerFlow]);

  return (
    <>
      <NotificationPermissionModal
        visible={showExplanationModal}
        onRequestPermission={handleRequestPermission}
        onDismiss={handleDismissExplanation}
        onComplete={handlePermissionComplete}
      />
      <NotificationPermissionDeniedModal
        visible={showDeniedModal}
        onOpenSettings={handleOpenSettings}
        onDismiss={handleDismissDenied}
      />
    </>
  );
}
