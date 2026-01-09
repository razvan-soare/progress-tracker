import { View, ActivityIndicator, Text } from "react-native";
import { colors } from "@/constants/colors";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  message?: string;
}

export function LoadingSpinner({
  size = "large",
  message,
}: LoadingSpinnerProps) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size={size} color={colors.primary} />
      {message && (
        <Text className="text-text-secondary mt-4">{message}</Text>
      )}
    </View>
  );
}
