import { useNotificationDeepLink } from "@/lib/hooks";
import type { NavigationIntent } from "@/lib/notifications";

/**
 * Props for NotificationDeepLinkProvider
 */
export interface NotificationDeepLinkProviderProps {
  /** Children components */
  children: React.ReactNode;
  /** Whether deep linking is enabled (default: true) */
  enabled?: boolean;
  /** Callback when navigation occurs */
  onNavigate?: (intent: NavigationIntent) => void;
  /** Callback when navigation fails */
  onNavigationError?: (error: Error, intent: NavigationIntent) => void;
}

/**
 * Provider component that handles notification deep linking.
 *
 * This component sets up listeners for notification taps and handles
 * navigation to the appropriate screens. It supports both warm start
 * (app backgrounded) and cold start (app closed) scenarios.
 *
 * Usage:
 * Place this component inside your navigation provider (Expo Router Stack)
 * but after all other necessary providers (QueryClient, Auth, etc.)
 * are initialized.
 *
 * @example
 * ```tsx
 * function RootLayout() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <Stack>
 *         <NotificationDeepLinkProvider />
 *       </Stack>
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 */
export function NotificationDeepLinkProvider({
  children,
  enabled = true,
  onNavigate,
  onNavigationError,
}: NotificationDeepLinkProviderProps): React.ReactElement {
  // Set up the deep link hook - it handles all the heavy lifting
  useNotificationDeepLink({
    enabled,
    onNavigate: (intent) => {
      console.log(
        `[NotificationDeepLink] Navigated to ${intent.target.route}`,
        intent.notificationData
      );
      onNavigate?.(intent);
    },
    onNavigationError: (error, intent) => {
      console.error(
        `[NotificationDeepLink] Navigation failed for ${intent.target.route}:`,
        error
      );
      onNavigationError?.(error, intent);
    },
  });

  // This component doesn't render anything itself, just provides the hook context
  return <>{children}</>;
}
