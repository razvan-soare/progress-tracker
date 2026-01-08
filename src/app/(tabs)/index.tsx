import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProjectsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4 pt-4">
        <Text className="text-3xl font-bold text-text-primary mb-4">
          Projects
        </Text>
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary text-center">
            No projects yet.{"\n"}Create your first project to start tracking
            progress!
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
