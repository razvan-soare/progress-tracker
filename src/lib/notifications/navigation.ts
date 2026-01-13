import * as Notifications from "expo-notifications";
import { getDatabase } from "@/lib/db/database";

/**
 * Types of notifications that support deep linking
 */
export type NotificationType =
  | "project_reminder"
  | "streak_alert"
  | "monthly_report";

/**
 * Deep link navigation target
 */
export interface NavigationTarget {
  /** The route to navigate to */
  route: string;
  /** Parameters for the route */
  params?: Record<string, string>;
}

/**
 * Parsed notification data for navigation
 */
export interface ParsedNotificationData {
  /** The type of notification */
  type: NotificationType;
  /** The project ID (if applicable) */
  projectId?: string;
  /** The project name (if applicable) */
  projectName?: string;
  /** Report month for monthly reports (YYYY-MM) */
  reportMonth?: string;
  /** Additional data from the notification */
  extra?: Record<string, unknown>;
}

/**
 * Pending navigation intent for cold start scenarios
 */
export interface NavigationIntent {
  /** The target to navigate to */
  target: NavigationTarget;
  /** Timestamp when the intent was created */
  createdAt: number;
  /** The original notification data */
  notificationData: ParsedNotificationData;
}

/**
 * Storage for navigation intent during cold start
 */
let pendingNavigationIntent: NavigationIntent | null = null;

/**
 * Maximum age of a pending navigation intent (30 seconds)
 */
const INTENT_MAX_AGE_MS = 30000;

/**
 * Parse notification data to extract navigation information
 */
export function parseNotificationData(
  data: Record<string, unknown> | null | undefined
): ParsedNotificationData | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const type = data.type as string | undefined;

  // Handle project reminder notifications
  if (type === "project_reminder") {
    const projectId = data.projectId as string | undefined;
    const projectName = data.projectName as string | undefined;

    if (!projectId) {
      return null;
    }

    return {
      type: "project_reminder",
      projectId,
      projectName,
      extra: data,
    };
  }

  // Handle streak alert notifications
  if (type === "streak_alert") {
    const projectId = data.projectId as string | undefined;
    const projectName = data.projectName as string | undefined;

    if (!projectId) {
      return null;
    }

    return {
      type: "streak_alert",
      projectId,
      projectName,
      extra: data,
    };
  }

  // Handle monthly report notifications
  if (type === "monthly_report") {
    const projectId = data.projectId as string | undefined;
    const reportMonth = data.reportMonth as string | undefined;

    return {
      type: "monthly_report",
      projectId,
      reportMonth,
      extra: data,
    };
  }

  return null;
}

/**
 * Check if a project exists in the database
 */
export async function validateProjectExists(projectId: string): Promise<boolean> {
  try {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM projects WHERE id = ? AND is_deleted = 0",
      [projectId]
    );
    return (result?.count ?? 0) > 0;
  } catch (error) {
    console.warn("Failed to validate project:", error);
    return false;
  }
}

/**
 * Get the navigation target for a parsed notification
 */
export async function getNavigationTarget(
  data: ParsedNotificationData
): Promise<NavigationTarget> {
  // Default fallback to home screen
  const homeTarget: NavigationTarget = { route: "/(tabs)" };

  switch (data.type) {
    case "project_reminder": {
      if (!data.projectId) {
        return homeTarget;
      }

      // Validate project exists
      const exists = await validateProjectExists(data.projectId);
      if (!exists) {
        console.warn(
          `Project ${data.projectId} not found, navigating to home`
        );
        return homeTarget;
      }

      // Navigate to entry creation screen for daily reminders
      return {
        route: "/entry/create/[projectId]",
        params: { projectId: data.projectId },
      };
    }

    case "streak_alert": {
      if (!data.projectId) {
        return homeTarget;
      }

      // Validate project exists
      const exists = await validateProjectExists(data.projectId);
      if (!exists) {
        console.warn(
          `Project ${data.projectId} not found, navigating to home`
        );
        return homeTarget;
      }

      // Navigate to project detail screen for streak alerts
      return {
        route: "/project/[id]",
        params: { id: data.projectId },
      };
    }

    case "monthly_report": {
      // For monthly reports, navigate to project detail (report view not yet implemented)
      // When report view is implemented, this should navigate to /project/[id]/report
      if (data.projectId) {
        const exists = await validateProjectExists(data.projectId);
        if (exists) {
          return {
            route: "/project/[id]",
            params: { id: data.projectId },
          };
        }
      }
      return homeTarget;
    }

    default:
      return homeTarget;
  }
}

/**
 * Build a route path from a navigation target
 */
export function buildRoutePath(target: NavigationTarget): string {
  let path = target.route;

  // Replace dynamic segments with actual values
  if (target.params) {
    for (const [key, value] of Object.entries(target.params)) {
      // Handle both [param] and :param patterns
      path = path.replace(`[${key}]`, value);
      path = path.replace(`:${key}`, value);
    }
  }

  return path;
}

/**
 * Extract notification response data from expo-notifications
 */
export function extractNotificationData(
  response: Notifications.NotificationResponse
): Record<string, unknown> | null {
  const content = response.notification.request.content;
  return (content.data as Record<string, unknown>) ?? null;
}

/**
 * Store a navigation intent for cold start scenarios
 */
export function storePendingIntent(intent: NavigationIntent): void {
  pendingNavigationIntent = intent;
}

/**
 * Get and clear the pending navigation intent
 */
export function consumePendingIntent(): NavigationIntent | null {
  const intent = pendingNavigationIntent;
  pendingNavigationIntent = null;

  // Check if intent is still valid (not expired)
  if (intent && Date.now() - intent.createdAt > INTENT_MAX_AGE_MS) {
    console.log("Pending navigation intent expired");
    return null;
  }

  return intent;
}

/**
 * Check if there's a pending navigation intent
 */
export function hasPendingIntent(): boolean {
  if (!pendingNavigationIntent) {
    return false;
  }

  // Check if intent is still valid
  if (Date.now() - pendingNavigationIntent.createdAt > INTENT_MAX_AGE_MS) {
    pendingNavigationIntent = null;
    return false;
  }

  return true;
}

/**
 * Clear any pending navigation intent
 */
export function clearPendingIntent(): void {
  pendingNavigationIntent = null;
}

/**
 * Get the last notification response (for cold start handling)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (error) {
    console.warn("Failed to get last notification response:", error);
    return null;
  }
}

/**
 * Process a notification response and create a navigation intent
 */
export async function processNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<NavigationIntent | null> {
  const data = extractNotificationData(response);
  const parsedData = parseNotificationData(data);

  if (!parsedData) {
    console.log("Notification data could not be parsed for navigation");
    return null;
  }

  const target = await getNavigationTarget(parsedData);

  return {
    target,
    createdAt: Date.now(),
    notificationData: parsedData,
  };
}
