import { Pressable, View, ViewProps } from "react-native";

interface CardProps extends ViewProps {
  onPress?: () => void;
  children: React.ReactNode;
}

export function Card({ onPress, children, className = "", ...props }: CardProps) {
  const baseStyles = "bg-surface rounded-xl p-4";
  const combinedClassName = `${baseStyles} ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${combinedClassName} active:opacity-80`}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={combinedClassName} {...props}>
      {children}
    </View>
  );
}
