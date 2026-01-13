import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSegments, useRootNavigationState } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  processNotificationResponse,
  getLastNotificationResponse,
  consumePendingIntent,
  storePendingIntent,
  hasPendingIntent,
  buildRoutePath,
  type NavigationIntent,
} from "@/lib/notifications/navigation";
import type { Href } from "expo-router";

/**
 * Hook options for notification deep linking
 */
export interface UseNotificationDeepLinkOptions {
  /** Whether deep linking is enabled (default: true) */
  enabled?: boolean;
  /** Callback when navigation occurs */
  onNavigate?: (intent: NavigationIntent) => void;
  /** Callback when navigation fails */
  onNavigationError?: (error: Error, intent: NavigationIntent) => void;
}

/**
 * Hook result for notification deep linking
 */
export interface UseNotificationDeepLinkResult {
  /** Whether the hook is ready (navigation is ready) */
  isReady: boolean;
  /** Whether there's a pending navigation intent */
  hasPendingNavigation: boolean;
  /** The last navigation intent that was processed */
  lastIntent: NavigationIntent | null;
  /** Manually trigger navigation for a pending intent */
  processPendingNavigation: () => Promise<void>;
}

/**
 * Hook to handle deep linking from notification taps.
 *
 * This hook:
 * - Listens for notification response events (user tapping notifications)
 * - Handles cold start scenarios by checking for initial notification
 * - Stores navigation intent if app needs to initialize first
 * - Navigates to appropriate screens based on notification type
 *
 * @example
 * ```tsx
 * function RootLayout() {
 *   const { isReady, hasPendingNavigation } = useNotificationDeepLink({
 *     onNavigate: (intent) => console.log('Navigated to:', intent.target.route),
 *   });
 *
 *   return <Stack />;
 * }
 * ```
 */
export function useNotificationDeepLink(
  options: UseNotificationDeepLinkOptions = {}
): UseNotificationDeepLinkResult {
  const { enabled = true, onNavigate, onNavigationError } = options;

  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const [isReady, setIsReady] = useState(false);
  const [lastIntent, setLastIntent] = useState<NavigationIntent | null>(null);
  const [hasPendingNavigationState, setHasPendingNavigationState] = useState(false);

  // Track if we've processed the initial notification
  const hasProcessedInitialRef = useRef(false);
  // Track the response listener subscription
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);
  // Track navigation attempts to prevent infinite loops
  const navigationAttemptRef = useRef(0);

  // Check if navigation is ready
  const isNavigationReady = navigationState?.key != null;

  /**
   * Navigate to a target route
   */
  const navigateToTarget = useCallback(
    async (intent: NavigationIntent) => {
      try {
        const path = buildRoutePath(intent.target);
        console.log(`[DeepLink] Navigating to: ${path}`);

        // Use router.push for navigation
        router.push(path as Href);

        setLastIntent(intent);
        onNavigate?.(intent);
      } catch (error) {
        console.error("[DeepLink] Navigation error:", error);
        const err = error instanceof Error ? error : new Error(String(error));
        onNavigationError?.(err, intent);
      }
    },
    [router, onNavigate, onNavigationError]
  );

  /**
   * Process a notification response and navigate
   */
  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      if (!enabled) {
        return;
      }

      console.log("[DeepLink] Processing notification response");
      const intent = await processNotificationResponse(response);

      if (!intent) {
        console.log("[DeepLink] No navigation intent from notification");
        return;
      }

      // If navigation is ready, navigate immediately
      if (isNavigationReady) {
        await navigateToTarget(intent);
      } else {
        // Store intent for later navigation
        console.log("[DeepLink] Navigation not ready, storing intent");
        storePendingIntent(intent);
        setHasPendingNavigationState(true);
      }
    },
    [enabled, isNavigationReady, navigateToTarget]
  );

  /**
   * Process pending navigation intent
   */
  const processPendingNavigation = useCallback(async () => {
    const intent = consumePendingIntent();
    if (intent) {
      console.log("[DeepLink] Processing pending navigation intent");
      setHasPendingNavigationState(false);
      await navigateToTarget(intent);
    }
  }, [navigateToTarget]);

  // Handle initial notification on cold start
  useEffect(() => {
    if (!enabled || hasProcessedInitialRef.current) {
      return;
    }

    const checkInitialNotification = async () => {
      try {
        const response = await getLastNotificationResponse();
        if (response) {
          console.log("[DeepLink] Found initial notification response");
          hasProcessedInitialRef.current = true;
          await handleNotificationResponse(response);
        }
      } catch (error) {
        console.warn("[DeepLink] Failed to check initial notification:", error);
      }
    };

    checkInitialNotification();
  }, [enabled, handleNotificationResponse]);

  // Set up notification response listener for warm start
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Listen for notification responses (user tapping notifications)
    responseListenerRef.current =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          console.log("[DeepLink] Notification response received (warm start)");
          await handleNotificationResponse(response);
        }
      );

    return () => {
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
        responseListenerRef.current = null;
      }
    };
  }, [enabled, handleNotificationResponse]);

  // Process pending navigation when navigation becomes ready
  useEffect(() => {
    if (!enabled || !isNavigationReady) {
      return;
    }

    // Mark as ready
    if (!isReady) {
      setIsReady(true);
    }

    // Check for pending intent
    if (hasPendingIntent()) {
      // Add small delay to ensure navigation is fully ready
      const timer = setTimeout(() => {
        navigationAttemptRef.current++;

        // Prevent infinite loop (max 3 attempts)
        if (navigationAttemptRef.current > 3) {
          console.warn("[DeepLink] Max navigation attempts reached");
          setHasPendingNavigationState(false);
          return;
        }

        processPendingNavigation();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [enabled, isNavigationReady, isReady, processPendingNavigation]);

  // Reset navigation attempts when segments change
  useEffect(() => {
    navigationAttemptRef.current = 0;
  }, [segments]);

  // Update pending state based on actual pending intent
  useEffect(() => {
    setHasPendingNavigationState(hasPendingIntent());
  }, []);

  return {
    isReady,
    hasPendingNavigation: hasPendingNavigationState,
    lastIntent,
    processPendingNavigation,
  };
}
