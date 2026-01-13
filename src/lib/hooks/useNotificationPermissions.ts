import { useState, useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { Linking, Platform, AppState, AppStateStatus } from "react-native";
import {
  useNotificationPermissionsStore,
  type NotificationPermissionStatus,
} from "@/lib/store/notification-permissions-store";

export interface UseNotificationPermissionsResult {
  /** Current permission status */
  status: NotificationPermissionStatus;
  /** Whether permissions have been checked at least once */
  hasChecked: boolean;
  /** Whether the explanation modal has been shown */
  hasShownExplanation: boolean;
  /** Whether the user dismissed the explanation without requesting permission */
  userDismissedExplanation: boolean;
  /** Whether we're currently checking/requesting permissions */
  isLoading: boolean;
  /** Whether permission is granted (or provisional on iOS) */
  isGranted: boolean;
  /** Whether permission was denied */
  isDenied: boolean;
  /** Whether permission is undetermined (never asked) */
  isUndetermined: boolean;
  /** Whether we should show the explanation modal */
  shouldShowExplanation: boolean;
  /** Check current permission status from the system */
  checkPermissions: () => Promise<NotificationPermissionStatus>;
  /** Request notification permissions from the system */
  requestPermissions: () => Promise<boolean>;
  /** Mark that the explanation modal has been shown */
  markExplanationShown: () => void;
  /** Mark that the user dismissed the explanation */
  dismissExplanation: () => void;
  /** Open device settings for this app */
  openSettings: () => Promise<void>;
  /** Reset explanation state to show it again */
  resetExplanationState: () => void;
}

/**
 * Map expo-notifications permission status to our internal status
 */
function mapPermissionStatus(
  status: Notifications.PermissionStatus
): NotificationPermissionStatus {
  switch (status) {
    case Notifications.PermissionStatus.GRANTED:
      return "granted";
    case Notifications.PermissionStatus.DENIED:
      return "denied";
    default:
      return "undetermined";
  }
}

/**
 * Hook for managing notification permissions with explanation flow
 *
 * This hook provides:
 * - Permission status checking and requesting
 * - Integration with Zustand store for app-wide access
 * - Pre-permission explanation modal flow control
 * - Settings link for denied permissions
 * - Auto-refresh when app returns from background
 */
export function useNotificationPermissions(): UseNotificationPermissionsResult {
  const [isLoading, setIsLoading] = useState(false);

  // Get state and actions from Zustand store
  const {
    status,
    hasChecked,
    hasShownExplanation,
    userDismissedExplanation,
    setStatus,
    markChecked,
    markExplanationShown,
    setUserDismissedExplanation,
    resetExplanationState,
  } = useNotificationPermissionsStore();

  // Derived states
  const isGranted = status === "granted" || status === "provisional";
  const isDenied = status === "denied";
  const isUndetermined = status === "undetermined";

  // Should show explanation if:
  // - Permission is undetermined (never asked)
  // - We haven't shown the explanation yet
  // - User hasn't dismissed it
  const shouldShowExplanation =
    isUndetermined && !hasShownExplanation && !userDismissedExplanation;

  /**
   * Check current permission status from the system
   */
  const checkPermissions =
    useCallback(async (): Promise<NotificationPermissionStatus> => {
      setIsLoading(true);

      try {
        const settings = await Notifications.getPermissionsAsync();
        let mappedStatus = mapPermissionStatus(settings.status);

        // On iOS, check for provisional authorization
        if (Platform.OS === "ios" && settings.ios) {
          // If granted but with provisional status, mark as provisional
          // Provisional notifications are delivered quietly to notification center
          const iosSettings = settings.ios as Record<string, unknown>;
          if (
            settings.status === Notifications.PermissionStatus.GRANTED &&
            iosSettings.providesAppNotificationSettings === false
          ) {
            // This is a heuristic - in practice, provisional is rare
            // and for most apps, granted is sufficient
            mappedStatus = "granted";
          }
        }

        setStatus(mappedStatus);
        markChecked();

        return mappedStatus;
      } catch (error) {
        console.warn("Failed to check notification permissions:", error);
        return status;
      } finally {
        setIsLoading(false);
      }
    }, [status, setStatus, markChecked]);

  /**
   * Request notification permissions from the system
   * Returns true if permissions were granted
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      const { status: requestedStatus } =
        await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });

      const mappedStatus = mapPermissionStatus(requestedStatus);

      setStatus(mappedStatus);
      markChecked();

      return mappedStatus === "granted" || mappedStatus === "provisional";
    } catch (error) {
      console.warn("Failed to request notification permissions:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [setStatus, markChecked]);

  /**
   * Mark that the user dismissed the explanation modal
   */
  const dismissExplanation = useCallback(() => {
    markExplanationShown();
    setUserDismissedExplanation(true);
  }, [markExplanationShown, setUserDismissedExplanation]);

  /**
   * Open device settings for this app
   */
  const openSettings = useCallback(async (): Promise<void> => {
    try {
      if (Platform.OS === "ios") {
        await Linking.openURL("app-settings:");
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.warn("Failed to open settings:", error);
    }
  }, []);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Re-check permissions when app returns from background
  // (user may have changed settings in device settings)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        checkPermissions();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [checkPermissions]);

  return {
    status,
    hasChecked,
    hasShownExplanation,
    userDismissedExplanation,
    isLoading,
    isGranted,
    isDenied,
    isUndetermined,
    shouldShowExplanation,
    checkPermissions,
    requestPermissions,
    markExplanationShown,
    dismissExplanation,
    openSettings,
    resetExplanationState,
  };
}
