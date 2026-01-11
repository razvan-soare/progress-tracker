import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { colors } from "@/constants/colors";

interface ErrorViewProps {
  title?: string;
  message: string;
  icon?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  compact?: boolean;
}

export function ErrorView({
  title = "Something went wrong",
  message,
  icon = "😕",
  onRetry,
  retryLabel = "Try Again",
  isRetrying = false,
  compact = false,
}: ErrorViewProps) {
  if (compact) {
    return (
      <View
        className="bg-error/10 rounded-xl p-4"
        accessibilityRole="alert"
        accessibilityLabel={`Error: ${message}`}
      >
        <View className="flex-row items-center">
          <Text className="text-xl mr-3">{icon}</Text>
          <View className="flex-1">
            <Text className="text-error text-sm font-medium">{title}</Text>
            <Text className="text-error/80 text-xs mt-0.5">{message}</Text>
          </View>
          {onRetry && (
            <Pressable
              onPress={onRetry}
              disabled={isRetrying}
              className="ml-3 px-4 py-2 rounded-lg bg-error/20 active:opacity-80"
              style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}
              accessibilityRole="button"
              accessibilityLabel={isRetrying ? `${retryLabel}, loading` : retryLabel}
              accessibilityState={{ disabled: isRetrying }}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text className="text-error text-xs font-medium">{retryLabel}</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center px-6"
      accessibilityRole="alert"
      accessibilityLabel={`Error: ${message}`}
    >
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-text-primary text-xl font-semibold text-center mb-2">
        {title}
      </Text>
      <Text className="text-text-secondary text-center mb-6">{message}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          disabled={isRetrying}
          className="bg-primary px-6 py-3 rounded-lg active:opacity-80 flex-row items-center"
          style={{ minHeight: 48 }}
          accessibilityRole="button"
          accessibilityLabel={isRetrying ? `${retryLabel}, loading` : retryLabel}
          accessibilityState={{ disabled: isRetrying }}
        >
          {isRetrying ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text className="text-white font-semibold ml-2">Retrying...</Text>
            </>
          ) : (
            <Text className="text-white font-semibold">{retryLabel}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
