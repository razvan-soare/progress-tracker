import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { setupNotificationChannels, NotificationChannels } from './channels';

export { NotificationChannels } from './channels';
export type { NotificationChannelId } from './channels';

export {
  NotificationScheduler,
  getNotificationScheduler,
  resetNotificationScheduler,
} from './notification-scheduler';
export type {
  NotificationSchedulerConfig,
  NotificationSchedulerState,
  NotificationSchedulerEvent,
  NotificationSchedulerEventListener,
} from './notification-scheduler';

export {
  AlertsScheduler,
  getAlertsScheduler,
  resetAlertsScheduler,
} from './alerts-scheduler';
export type {
  AlertsSchedulerConfig,
  AlertsSchedulerState,
  AlertsSchedulerEvent,
  AlertsSchedulerEventListener,
  ProjectStreakInfo,
  WeeklySummaryStats,
} from './alerts-scheduler';

export {
  parseNotificationData,
  validateProjectExists,
  getNavigationTarget,
  buildRoutePath,
  extractNotificationData,
  storePendingIntent,
  consumePendingIntent,
  hasPendingIntent,
  clearPendingIntent,
  getLastNotificationResponse,
  processNotificationResponse,
} from './navigation';
export type {
  NotificationType,
  NavigationTarget,
  ParsedNotificationData,
  NavigationIntent,
} from './navigation';

/**
 * Configure default notification behavior
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Request notification permissions from the user
 * @returns Whether permissions were granted
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status === 'granted';
}

/**
 * Check if notification permissions are granted
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Initialize the notification system
 * Should be called once when the app starts
 */
export async function initializeNotifications(): Promise<void> {
  // Set up Android notification channels
  await setupNotificationChannels();

  // Request permissions
  await requestNotificationPermissions();
}

/**
 * Schedule a local notification
 */
export async function scheduleNotification(options: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  trigger?: Notifications.NotificationTriggerInput;
}): Promise<string> {
  const { title, body, data = {}, channelId, trigger } = options;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      ...(Platform.OS === 'android' && channelId
        ? { channelId }
        : {}),
    },
    trigger: trigger ?? null,
  });
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Dismiss all displayed notifications
 */
export async function dismissAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Set the badge count (iOS only)
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Get the badge count (iOS only)
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}
