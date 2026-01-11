import { View, Image, Pressable, Text, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";

interface PhotoPreviewProps {
  photoUri: string;
  onRetake: () => void;
  onUsePhoto: () => void;
  isLoading?: boolean;
}

export function PhotoPreview({
  photoUri,
  onRetake,
  onUsePhoto,
  isLoading = false,
}: PhotoPreviewProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {/* Photo preview container */}
        <View className="flex-1 items-center justify-center">
          <Image
            source={{ uri: photoUri }}
            style={{
              width: screenWidth,
              height: screenHeight * 0.75,
            }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Captured photo preview"
          />
        </View>

        {/* Bottom controls */}
        <View className="px-4 pb-6">
          <View className="flex-row gap-4">
            {/* Retake button */}
            <View className="flex-1">
              <Pressable
                onPress={onRetake}
                disabled={isLoading}
                className={`py-4 rounded-xl bg-white/10 items-center justify-center ${
                  isLoading ? "opacity-50" : "active:opacity-70"
                }`}
                accessibilityRole="button"
                accessibilityLabel="Retake photo"
                accessibilityHint="Discard this photo and return to camera"
                accessibilityState={{ disabled: isLoading }}
              >
                <Text className="text-white font-semibold text-base">
                  Retake
                </Text>
              </Pressable>
            </View>

            {/* Use Photo button */}
            <View className="flex-1">
              <Button
                title="Use Photo"
                variant="primary"
                onPress={onUsePhoto}
                loading={isLoading}
                disabled={isLoading}
                className="py-4"
                accessibilityHint="Proceed with this photo"
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
