import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, IconButton } from "@/components/ui";
import { useWizardStore } from "@/lib/store";

export default function CategorySelectionScreen() {
  const router = useRouter();
  const { previousStep, resetWizard } = useWizardStore();

  const handleBack = () => {
    previousStep();
    router.back();
  };

  const handleClose = () => {
    resetWizard();
    router.replace("/");
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <IconButton
          icon="←"
          variant="default"
          size="md"
          onPress={handleBack}
          accessibilityLabel="Back"
        />
        <Text className="text-lg font-semibold text-text-primary">
          New Project
        </Text>
        <IconButton
          icon="×"
          variant="default"
          size="md"
          onPress={handleClose}
          accessibilityLabel="Close"
        />
      </View>

      {/* Progress Indicator */}
      <View className="px-4 py-3">
        <View className="flex-row items-center justify-center">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
              <Text className="text-white font-semibold">✓</Text>
            </View>
            <View className="w-12 h-0.5 bg-primary mx-2" />
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
              <Text className="text-white font-semibold">2</Text>
            </View>
            <View className="w-12 h-0.5 bg-border mx-2" />
            <View className="w-8 h-8 rounded-full bg-surface items-center justify-center">
              <Text className="text-text-secondary font-semibold">3</Text>
            </View>
          </View>
        </View>
        <Text className="text-text-secondary text-center mt-2 text-sm">
          Step 2 of 3 - Category
        </Text>
      </View>

      {/* Placeholder Content */}
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-text-secondary text-center">
          Category selection step will be implemented here.
        </Text>
      </View>

      {/* Bottom Buttons */}
      <View className="px-4 py-4 border-t border-border">
        <Button
          title="Next"
          onPress={() => {}}
          disabled
          variant="primary"
        />
      </View>
    </SafeAreaView>
  );
}
