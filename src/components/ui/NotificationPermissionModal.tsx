import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { Button } from "./Button";

export interface NotificationPermissionModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when user wants to request permission */
  onRequestPermission: () => Promise<boolean>;
  /** Called when user dismisses the modal without requesting permission */
  onDismiss: () => void;
  /** Called after permission is granted or denied */
  onComplete: (granted: boolean) => void;
}

/**
 * Pre-permission explanation modal for notifications
 *
 * Shows before the system permission dialog to explain why notifications
 * are valuable, increasing the likelihood of permission being granted.
 */
export function NotificationPermissionModal({
  visible,
  onRequestPermission,
  onDismiss,
  onComplete,
}: NotificationPermissionModalProps) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await onRequestPermission();
      onComplete(granted);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    if (!isRequesting) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View className="flex-1 bg-black/80 justify-center items-center px-4">
        <View className="bg-background w-full max-w-md rounded-2xl overflow-hidden">
          {/* Header */}
          <View className="bg-surface px-5 py-4 flex-row items-center justify-between border-b border-border">
            <View className="flex-row items-center">
              <Text className="text-2xl mr-2">🔔</Text>
              <Text className="text-white text-lg font-bold">
                Stay on Track
              </Text>
            </View>
            <Pressable
              onPress={handleDismiss}
              disabled={isRequesting}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="p-2"
            >
              <Text
                className={`text-xl ${isRequesting ? "opacity-50" : ""}`}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          <ScrollView className="max-h-96">
            <View className="p-5">
              {/* Main illustration/icon */}
              <View className="items-center mb-5">
                <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-4xl">📱</Text>
                </View>
              </View>

              {/* Main message */}
              <Text className="text-white text-lg font-semibold text-center mb-3">
                Never Miss a Progress Update
              </Text>

              <Text className="text-textSecondary text-base text-center mb-5 leading-6">
                Enable notifications to get gentle reminders for your projects
                and celebrate your streaks.
              </Text>

              {/* Benefits list */}
              <View className="bg-surface rounded-xl p-4 mb-4">
                <BenefitItem
                  icon="⏰"
                  title="Daily Reminders"
                  description="Get notified at your preferred time to log progress"
                />
                <BenefitItem
                  icon="🔥"
                  title="Streak Alerts"
                  description="Celebrate milestones and protect your streaks"
                />
                <BenefitItem
                  icon="📊"
                  title="Weekly Reports"
                  description="Receive summaries of your progress each week"
                />
              </View>

              {/* Privacy note */}
              <View className="flex-row items-start bg-surface/50 rounded-lg p-3 mb-4">
                <Text className="text-base mr-2">🔒</Text>
                <Text className="text-textSecondary text-xs flex-1 leading-5">
                  Notifications are processed locally on your device. We respect
                  your privacy and you can customize or disable them anytime in
                  settings.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View className="p-5 pt-0">
            <Button
              title="Enable Notifications"
              onPress={handleRequestPermission}
              loading={isRequesting}
              accessibilityLabel="Enable notifications"
              accessibilityHint="Opens system permission dialog"
              className="mb-3"
            />
            <Button
              title="Maybe Later"
              variant="secondary"
              onPress={handleDismiss}
              disabled={isRequesting}
              accessibilityLabel="Maybe later"
              accessibilityHint="Dismiss this dialog without enabling notifications"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface BenefitItemProps {
  icon: string;
  title: string;
  description: string;
}

function BenefitItem({ icon, title, description }: BenefitItemProps) {
  return (
    <View className="flex-row items-start mb-3 last:mb-0">
      <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
        <Text className="text-base">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-white font-medium text-sm">{title}</Text>
        <Text className="text-textSecondary text-xs mt-0.5">{description}</Text>
      </View>
    </View>
  );
}

export interface NotificationPermissionDeniedModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when user wants to open settings */
  onOpenSettings: () => Promise<void>;
  /** Called when user dismisses the modal */
  onDismiss: () => void;
}

/**
 * Modal shown when notification permissions are denied
 *
 * Provides guidance on how to enable notifications in device settings
 */
export function NotificationPermissionDeniedModal({
  visible,
  onOpenSettings,
  onDismiss,
}: NotificationPermissionDeniedModalProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenSettings = async () => {
    setIsOpening(true);
    try {
      await onOpenSettings();
    } finally {
      setIsOpening(false);
      onDismiss();
    }
  };

  const getSettingsInstructions = () => {
    if (Platform.OS === "ios") {
      return 'Tap "Open Settings" below, then enable Notifications for this app.';
    }
    return 'Tap "Open Settings" below, then find this app and enable notifications.';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View className="flex-1 bg-black/80 justify-center items-center px-4">
        <View className="bg-background w-full max-w-md rounded-2xl overflow-hidden">
          {/* Header */}
          <View className="bg-surface px-5 py-4 flex-row items-center justify-between border-b border-border">
            <View className="flex-row items-center">
              <Text className="text-2xl mr-2">🔕</Text>
              <Text className="text-white text-lg font-bold">
                Notifications Disabled
              </Text>
            </View>
            <Pressable
              onPress={onDismiss}
              disabled={isOpening}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="p-2"
            >
              <Text className={`text-xl ${isOpening ? "opacity-50" : ""}`}>
                ✕
              </Text>
            </Pressable>
          </View>

          <View className="p-5">
            {/* Icon */}
            <View className="items-center mb-5">
              <View className="w-20 h-20 rounded-full bg-warning/20 items-center justify-center">
                <Text className="text-4xl">⚙️</Text>
              </View>
            </View>

            {/* Message */}
            <Text className="text-white text-lg font-semibold text-center mb-3">
              Enable in Settings
            </Text>

            <Text className="text-textSecondary text-base text-center mb-4 leading-6">
              Notification permissions were previously denied. To receive
              reminders and updates, you&apos;ll need to enable them in your
              device settings.
            </Text>

            {/* Instructions */}
            <View className="bg-surface rounded-xl p-4 mb-5">
              <View className="flex-row items-start">
                <Text className="text-base mr-2">💡</Text>
                <Text className="text-textSecondary text-sm flex-1 leading-5">
                  {getSettingsInstructions()}
                </Text>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View className="p-5 pt-0">
            <Button
              title="Open Settings"
              onPress={handleOpenSettings}
              loading={isOpening}
              accessibilityLabel="Open device settings"
              accessibilityHint="Opens your device settings to enable notifications"
              className="mb-3"
            />
            <Button
              title="Not Now"
              variant="secondary"
              onPress={onDismiss}
              disabled={isOpening}
              accessibilityLabel="Not now"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
