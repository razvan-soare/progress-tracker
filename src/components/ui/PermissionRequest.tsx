import { View, Text, ViewProps, ActivityIndicator } from "react-native";
import { Button } from "./Button";
import { colors } from "@/constants/colors";

export type PermissionType = "camera" | "microphone" | "mediaLibrary" | "cameraAndMicrophone" | "notification";

interface PermissionRequestProps extends ViewProps {
  permissionType: PermissionType;
  onRequestPermission: () => void;
  loading?: boolean;
  compact?: boolean;
}

const PERMISSION_CONTENT: Record<
  PermissionType,
  { icon: string; title: string; description: string; buttonLabel: string }
> = {
  camera: {
    icon: "📷",
    title: "Camera Access Needed",
    description:
      "To capture photos and videos for your progress entries, we need access to your camera. Your media stays on your device.",
    buttonLabel: "Allow Camera Access",
  },
  microphone: {
    icon: "🎤",
    title: "Microphone Access Needed",
    description:
      "To record audio for your video entries, we need access to your microphone. Your recordings stay on your device.",
    buttonLabel: "Allow Microphone Access",
  },
  mediaLibrary: {
    icon: "🖼️",
    title: "Photo Library Access Needed",
    description:
      "To choose photos from your library for your progress entries, we need access to your photos. We only access photos you select.",
    buttonLabel: "Allow Photo Access",
  },
  cameraAndMicrophone: {
    icon: "🎬",
    title: "Camera & Microphone Access Needed",
    description:
      "To record videos for your progress entries, we need access to your camera and microphone. Your media stays on your device.",
    buttonLabel: "Allow Access",
  },
  notification: {
    icon: "🔔",
    title: "Notification Access Needed",
    description:
      "To send you reminders to update your progress, we need permission to send notifications. You can customize when and how often you receive them.",
    buttonLabel: "Allow Notifications",
  },
};

export function PermissionRequest({
  permissionType,
  onRequestPermission,
  loading = false,
  compact = false,
  className = "",
  ...props
}: PermissionRequestProps) {
  const content = PERMISSION_CONTENT[permissionType];

  if (compact) {
    return (
      <View
        className={`bg-surface rounded-xl p-4 ${className}`}
        accessibilityRole="alert"
        accessibilityLabel={`${content.title}. ${content.description}`}
        {...props}
      >
        <View className="flex-row items-center mb-3">
          <Text className="text-2xl mr-3" accessibilityElementsHidden>
            {content.icon}
          </Text>
          <View className="flex-1">
            <Text className="text-text-primary text-base font-semibold">
              {content.title}
            </Text>
          </View>
        </View>
        <Text className="text-text-secondary text-sm mb-4">
          {content.description}
        </Text>
        <Button
          title={content.buttonLabel}
          onPress={onRequestPermission}
          loading={loading}
          accessibilityLabel={content.buttonLabel}
        />
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
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          <View className="w-24 h-24 rounded-full bg-surface items-center justify-center mb-6">
            <Text className="text-5xl" accessibilityElementsHidden>
              {content.icon}
            </Text>
          </View>
          <Text className="text-text-primary text-xl font-semibold text-center mb-3">
            {content.title}
          </Text>
          <Text className="text-text-secondary text-base text-center mb-8 leading-6">
            {content.description}
          </Text>
          <Button
            title={content.buttonLabel}
            onPress={onRequestPermission}
            accessibilityLabel={content.buttonLabel}
            className="w-full"
          />
        </>
      )}
    </View>
  );
}
