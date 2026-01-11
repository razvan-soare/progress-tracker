import { useEffect, useCallback } from "react";
import { BackHandler, Platform, Alert } from "react-native";
import { useRouter, usePathname } from "expo-router";

interface UseBackHandlerOptions {
  enabled?: boolean;
  onBack?: () => boolean | void;
  confirmExit?: boolean;
  confirmMessage?: string;
  confirmTitle?: string;
}

export function useBackHandler({
  enabled = true,
  onBack,
  confirmExit = false,
  confirmMessage = "You have unsaved changes. Are you sure you want to leave?",
  confirmTitle = "Discard Changes?",
}: UseBackHandlerOptions = {}) {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "android" || !enabled) return;

    const handleBackPress = () => {
      if (onBack) {
        const result = onBack();
        if (result === true) {
          return true; // Prevents default back action
        }
      }

      if (confirmExit) {
        Alert.alert(confirmTitle, confirmMessage, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]);
        return true; // Prevents default back action
      }

      return false; // Uses default back action
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => subscription.remove();
  }, [enabled, onBack, confirmExit, confirmMessage, confirmTitle, router]);
}

export function useExitConfirmation(
  isDirty: boolean,
  options?: Omit<UseBackHandlerOptions, "confirmExit">
) {
  useBackHandler({
    ...options,
    enabled: isDirty,
    confirmExit: true,
  });
}
