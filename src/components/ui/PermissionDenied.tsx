import { View, Text, ViewProps, Platform } from "react-native";
import { Button } from "./Button";

export type DeniedPermissionType = "camera" | "microphone" | "mediaLibrary" | "cameraAndMicrophone" | "notification";

interface PermissionDeniedProps extends ViewProps {
  permissionType: DeniedPermissionType;
  onOpenSettings: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

const PERMISSION_CONTENT: Record<
  DeniedPermissionType,
  { icon: string; title: string; description: string }
> = {
  camera: {
    icon: "📷",
    title: "Camera Access Denied",
    description:
      "Camera access was denied. To capture photos and videos, please enable camera access in your device settings.",
  },
  microphone: {
    icon: "🎤",
    title: "Microphone Access Denied",
    description:
      "Microphone access was denied. To record audio, please enable microphone access in your device settings.",
  },
  mediaLibrary: {
    icon: "🖼️",
    title: "Photo Library Access Denied",
    description:
      "Photo library access was denied. To choose photos from your library, please enable photo access in your device settings.",
  },
  cameraAndMicrophone: {
    icon: "🎬",
    title: "Camera & Microphone Access Denied",
    description:
      "Camera and microphone access was denied. To record videos, please enable both permissions in your device settings.",
  },
  notification: {
    icon: "🔔",
    title: "Notification Access Denied",
    description:
      "Notification access was denied. To receive reminders to update your progress, please enable notifications in your device settings.",
  },
};

function getSettingsInstructions(): string {
  if (Platform.OS === "ios") {
    return 'Tap "Open Settings" below, then enable the permission under Privacy settings.';
  }
  return 'Tap "Open Settings" below, then find this app and enable the required permissions.';
}

export function PermissionDenied({
  permissionType,
  onOpenSettings,
  onCancel,
  compact = false,
  className = "",
  ...props
}: PermissionDeniedProps) {
  const content = PERMISSION_CONTENT[permissionType];
  const instructions = getSettingsInstructions();

  if (compact) {
    return (
      <View
        className={`bg-surface rounded-xl p-4 ${className}`}
        accessibilityRole="alert"
        accessibilityLabel={`${content.title}. ${content.description}`}
        {...props}
      >
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 rounded-full bg-error/10 items-center justify-center mr-3">
            <Text className="text-xl" accessibilityElementsHidden>
              {content.icon}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-text-primary text-base font-semibold">
              {content.title}
            </Text>
          </View>
        </View>
        <Text className="text-text-secondary text-sm mb-2">
          {content.description}
        </Text>
        <Text className="text-text-secondary text-sm mb-4 italic">
          {instructions}
        </Text>
        <View className="flex-row gap-3">
          {onCancel && (
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              className="flex-1"
              accessibilityLabel="Cancel"
            />
          )}
          <Button
            title="Open Settings"
            onPress={onOpenSettings}
            className={onCancel ? "flex-1" : "w-full"}
            accessibilityLabel="Open device settings"
          />
        </View>
      </View>
    );
  }

  return (
    <View
      className={`flex-1 items-center justify-center px-8 ${className}`}
      accessibilityRole="alert"
      accessibilityLabel={`${content.title}. ${content.description}`}
      {...props}
    >
      <View className="w-24 h-24 rounded-full bg-error/10 items-center justify-center mb-6">
        <Text className="text-5xl" accessibilityElementsHidden>
          {content.icon}
        </Text>
      </View>
      <Text className="text-text-primary text-xl font-semibold text-center mb-3">
        {content.title}
      </Text>
      <Text className="text-text-secondary text-base text-center mb-4 leading-6">
        {content.description}
      </Text>
      <Text className="text-text-secondary text-sm text-center mb-8 italic">
        {instructions}
      </Text>
      <Button
        title="Open Settings"
        onPress={onOpenSettings}
        accessibilityLabel="Open device settings"
        className="w-full mb-3"
      />
      {onCancel && (
        <Button
          title="Cancel"
          variant="secondary"
          onPress={onCancel}
          accessibilityLabel="Cancel"
          className="w-full"
        />
      )}
    </View>
  );
}
