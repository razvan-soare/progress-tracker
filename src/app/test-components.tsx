import { useState } from "react";
import { View, ScrollView, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Card,
  Button,
  TextInput,
  IconButton,
  EmptyState,
  LoadingSpinner,
} from "@/components/ui";

export default function TestComponentsScreen() {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  const handleValidate = () => {
    if (!inputValue.trim()) {
      setInputError("This field is required");
    } else {
      setInputError("");
      Alert.alert("Success", `Input value: ${inputValue}`);
    }
  };

  const handleLoadingDemo = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  if (showLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-4 py-2">
          <IconButton icon="←" onPress={() => setShowLoading(false)} />
          <Text className="text-text-primary text-lg ml-4">Loading Spinner</Text>
        </View>
        <LoadingSpinner message="Loading data..." />
      </SafeAreaView>
    );
  }

  if (showEmptyState) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-4 py-2">
          <IconButton icon="←" onPress={() => setShowEmptyState(false)} />
          <Text className="text-text-primary text-lg ml-4">Empty State</Text>
        </View>
        <EmptyState
          icon="📦"
          title="No Projects Yet"
          description="Create your first project to start tracking your progress."
          actionLabel="Create Project"
          onAction={() => Alert.alert("Action", "Create project clicked!")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center py-4">
          <IconButton icon="←" onPress={() => router.back()} />
          <Text className="text-2xl font-bold text-text-primary ml-4">
            UI Components Test
          </Text>
        </View>

        {/* Card Component */}
        <Text className="text-text-secondary text-sm uppercase mb-2 mt-4">
          Card Component
        </Text>
        <Card className="mb-2">
          <Text className="text-text-primary font-semibold">Basic Card</Text>
          <Text className="text-text-secondary mt-1">
            A simple card with dark surface background.
          </Text>
        </Card>
        <Card onPress={() => Alert.alert("Card", "Pressed!")} className="mb-4">
          <Text className="text-text-primary font-semibold">Pressable Card</Text>
          <Text className="text-text-secondary mt-1">
            Tap me to see the press handler in action.
          </Text>
        </Card>

        {/* Button Component */}
        <Text className="text-text-secondary text-sm uppercase mb-2 mt-4">
          Button Component
        </Text>
        <View className="gap-3 mb-4">
          <Button
            title="Primary Button"
            onPress={() => Alert.alert("Button", "Primary pressed!")}
          />
          <Button
            title="Secondary Button"
            variant="secondary"
            onPress={() => Alert.alert("Button", "Secondary pressed!")}
          />
          <Button title="Disabled Button" disabled />
          <Button title="Loading Button" loading={isLoading} onPress={handleLoadingDemo} />
        </View>

        {/* TextInput Component */}
        <Text className="text-text-secondary text-sm uppercase mb-2 mt-4">
          TextInput Component
        </Text>
        <View className="gap-3 mb-4">
          <TextInput
            label="Project Name"
            placeholder="Enter project name..."
            value={inputValue}
            onChangeText={setInputValue}
            error={inputError}
          />
          <Button title="Validate Input" variant="secondary" onPress={handleValidate} />
        </View>

        {/* IconButton Component */}
        <Text className="text-text-secondary text-sm uppercase mb-2 mt-4">
          IconButton Component
        </Text>
        <View className="flex-row gap-3 mb-4 flex-wrap">
          <IconButton icon="←" onPress={() => Alert.alert("IconButton", "Back")} />
          <IconButton
            icon="✏️"
            variant="primary"
            onPress={() => Alert.alert("IconButton", "Edit")}
          />
          <IconButton
            icon="🗑️"
            variant="danger"
            onPress={() => Alert.alert("IconButton", "Delete")}
          />
          <IconButton icon="+" size="sm" onPress={() => {}} />
          <IconButton icon="+" size="md" onPress={() => {}} />
          <IconButton icon="+" size="lg" onPress={() => {}} />
        </View>

        {/* Navigation to EmptyState and LoadingSpinner */}
        <Text className="text-text-secondary text-sm uppercase mb-2 mt-4">
          Full Screen Components
        </Text>
        <View className="gap-3 mb-8">
          <Button
            title="Show Empty State"
            variant="secondary"
            onPress={() => setShowEmptyState(true)}
          />
          <Button
            title="Show Loading Spinner"
            variant="secondary"
            onPress={() => setShowLoading(true)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
