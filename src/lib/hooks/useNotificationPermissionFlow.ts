import { useState, useCallback } from "react";
import { useNotificationPermissions } from "./useNotificationPermissions";

export interface UseNotificationPermissionFlowResult {
  /** Whether the explanation modal should be shown */
  showExplanationModal: boolean;
  /** Whether the denied modal should be shown */
  showDeniedModal: boolean;
  /** Permission status from the underlying hook */
  status: ReturnType<typeof useNotificationPermissions>["status"];
  /** Whether permission is granted */
  isGranted: boolean;
  /** Whether permission is denied */
  isDenied: boolean;
  /** Whether the permission flow is currently loading */
  isLoading: boolean;
  /** Start the permission request flow (shows explanation modal if needed) */
  startPermissionFlow: () => void;
  /** Handle the request permission action from the explanation modal */
  handleRequestPermission: () => Promise<boolean>;
  /** Handle dismissing the explanation modal */
  handleDismissExplanation: () => void;
  /** Handle completion of the permission request */
  handlePermissionComplete: (granted: boolean) => void;
  /** Handle opening settings from the denied modal */
  handleOpenSettings: () => Promise<void>;
  /** Handle dismissing the denied modal */
  handleDismissDenied: () => void;
  /** Show the denied modal manually (e.g., when trying to enable reminders) */
  showDeniedPrompt: () => void;
  /** Check and potentially trigger the permission flow based on current state */
  checkAndTriggerFlow: () => void;
}

/**
 * Hook that manages the complete notification permission flow
 *
 * This hook orchestrates:
 * 1. Showing the explanation modal before system permission dialog
 * 2. Requesting system permissions
 * 3. Handling denied state with settings link
 *
 * Usage:
 * ```tsx
 * const {
 *   showExplanationModal,
 *   showDeniedModal,
 *   isGranted,
 *   startPermissionFlow,
 *   handleRequestPermission,
 *   handleDismissExplanation,
 *   handlePermissionComplete,
 *   handleOpenSettings,
 *   handleDismissDenied,
 * } = useNotificationPermissionFlow();
 *
 * // Render modals based on state
 * <NotificationPermissionModal
 *   visible={showExplanationModal}
 *   onRequestPermission={handleRequestPermission}
 *   onDismiss={handleDismissExplanation}
 *   onComplete={handlePermissionComplete}
 * />
 * <NotificationPermissionDeniedModal
 *   visible={showDeniedModal}
 *   onOpenSettings={handleOpenSettings}
 *   onDismiss={handleDismissDenied}
 * />
 * ```
 */
export function useNotificationPermissionFlow(): UseNotificationPermissionFlowResult {
  const {
    status,
    isGranted,
    isDenied,
    isUndetermined,
    isLoading,
    shouldShowExplanation,
    hasShownExplanation,
    requestPermissions,
    markExplanationShown,
    dismissExplanation,
    openSettings,
    checkPermissions,
  } = useNotificationPermissions();

  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [showDeniedModal, setShowDeniedModal] = useState(false);

  /**
   * Start the permission request flow
   * Shows explanation modal if needed, or requests permission directly
   */
  const startPermissionFlow = useCallback(() => {
    if (isGranted) {
      // Already granted, nothing to do
      return;
    }

    if (isDenied) {
      // Already denied, show settings prompt
      setShowDeniedModal(true);
      return;
    }

    if (isUndetermined) {
      // Show explanation modal first
      setShowExplanationModal(true);
    }
  }, [isGranted, isDenied, isUndetermined]);

  /**
   * Check permissions and trigger flow if appropriate
   * Used on app startup to show explanation for fresh installs
   */
  const checkAndTriggerFlow = useCallback(async () => {
    await checkPermissions();

    // If we should show explanation (fresh install, undetermined status)
    // This is controlled by the shouldShowExplanation flag from the hook
    if (shouldShowExplanation) {
      setShowExplanationModal(true);
    }
  }, [checkPermissions, shouldShowExplanation]);

  /**
   * Handle the request permission action from the explanation modal
   */
  const handleRequestPermission = useCallback(async (): Promise<boolean> => {
    markExplanationShown();
    const granted = await requestPermissions();
    return granted;
  }, [requestPermissions, markExplanationShown]);

  /**
   * Handle dismissing the explanation modal without requesting permission
   */
  const handleDismissExplanation = useCallback(() => {
    dismissExplanation();
    setShowExplanationModal(false);
  }, [dismissExplanation]);

  /**
   * Handle completion of the permission request
   */
  const handlePermissionComplete = useCallback((granted: boolean) => {
    setShowExplanationModal(false);

    if (!granted) {
      // Permission was denied, show the denied modal after a short delay
      setTimeout(() => {
        setShowDeniedModal(true);
      }, 300);
    }
  }, []);

  /**
   * Handle opening settings from the denied modal
   */
  const handleOpenSettings = useCallback(async (): Promise<void> => {
    await openSettings();
    // Modal will be dismissed by the modal component
  }, [openSettings]);

  /**
   * Handle dismissing the denied modal
   */
  const handleDismissDenied = useCallback(() => {
    setShowDeniedModal(false);
  }, []);

  /**
   * Show the denied modal manually
   * Useful when user tries to enable a feature that requires notifications
   */
  const showDeniedPrompt = useCallback(() => {
    if (isDenied) {
      setShowDeniedModal(true);
    }
  }, [isDenied]);

  return {
    showExplanationModal,
    showDeniedModal,
    status,
    isGranted,
    isDenied,
    isLoading,
    startPermissionFlow,
    handleRequestPermission,
    handleDismissExplanation,
    handlePermissionComplete,
    handleOpenSettings,
    handleDismissDenied,
    showDeniedPrompt,
    checkAndTriggerFlow,
  };
}
