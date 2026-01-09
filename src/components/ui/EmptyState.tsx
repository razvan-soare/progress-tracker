import { View, Text } from "react-native";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-text-primary text-xl font-semibold text-center mb-2">
        {title}
      </Text>
      <Text className="text-text-secondary text-base text-center mb-6">
        {description}
      </Text>
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} />
      )}
    </View>
  );
}
