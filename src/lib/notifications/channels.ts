import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Notification channel IDs for Android
 */
export const NotificationChannels = {
  REMINDERS: 'reminders',
  STREAKS: 'streaks',
  REPORTS: 'reports',
  DEFAULT: 'default',
} as const;

export type NotificationChannelId = typeof NotificationChannels[keyof typeof NotificationChannels];

/**
 * Channel configuration for different notification types
 */
interface ChannelConfig {
  id: NotificationChannelId;
  name: string;
  description: string;
  importance: Notifications.AndroidImportance;
  sound: string | null;
  vibrationPattern: number[];
  enableVibrate: boolean;
  enableLights: boolean;
  lightColor: string;
}

const channelConfigs: ChannelConfig[] = [
  {
    id: NotificationChannels.REMINDERS,
    name: 'Daily Reminders',
    description: 'Notifications to remind you to track your progress',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#6366f1',
  },
  {
    id: NotificationChannels.STREAKS,
    name: 'Streak Alerts',
    description: 'Notifications about your progress streaks',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 500, 250, 500],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#f59e0b',
  },
  {
    id: NotificationChannels.REPORTS,
    name: 'Monthly Reports',
    description: 'Monthly summary reports of your progress',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 250],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#10b981',
  },
  {
    id: NotificationChannels.DEFAULT,
    name: 'General',
    description: 'General notifications from Progress Tracker',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0, 250],
    enableVibrate: true,
    enableLights: false,
    lightColor: '#6366f1',
  },
];

/**
 * Set up Android notification channels
 * This should be called once when the app starts
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  for (const config of channelConfigs) {
    await Notifications.setNotificationChannelAsync(config.id, {
      name: config.name,
      description: config.description,
      importance: config.importance,
      sound: config.sound,
      vibrationPattern: config.vibrationPattern,
      enableVibrate: config.enableVibrate,
      enableLights: config.enableLights,
      lightColor: config.lightColor,
    });
  }
}

/**
 * Delete a notification channel (useful for cleanup or migration)
 */
export async function deleteNotificationChannel(channelId: NotificationChannelId): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.deleteNotificationChannelAsync(channelId);
}

/**
 * Get all configured notification channels
 */
export async function getNotificationChannels(): Promise<Notifications.NotificationChannel[] | null> {
  if (Platform.OS !== 'android') {
    return null;
  }

  return Notifications.getNotificationChannelsAsync();
}
