import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CalendarScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4 pt-4">
        <Text className="text-3xl font-bold text-text-primary mb-4">
          Calendar
        </Text>
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary text-center">
            Your entries will appear here organized by date.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
