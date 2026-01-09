import { View, Text, TextInput as RNTextInput, TextInputProps as RNTextInputProps } from "react-native";

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
}

export function TextInput({
  label,
  error,
  className = "",
  ...props
}: TextInputProps) {
  const hasError = Boolean(error);

  return (
    <View className="w-full">
      {label && (
        <Text className="text-text-secondary text-sm mb-2">{label}</Text>
      )}
      <RNTextInput
        className={`bg-surface text-text-primary px-4 py-3 rounded-lg text-base ${
          hasError ? "border border-error" : "border border-transparent"
        } ${className}`}
        placeholderTextColor="#71717a"
        {...props}
      />
      {hasError && (
        <Text className="text-error text-sm mt-1">{error}</Text>
      )}
    </View>
  );
}
