import { Pressable, Text, ActivityIndicator, PressableProps } from "react-native";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends Omit<PressableProps, "children"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyles = "px-6 py-3 rounded-lg items-center justify-center flex-row";

  const variantStyles: Record<ButtonVariant, string> = {
    primary: "bg-primary",
    secondary: "bg-surface border border-primary",
  };

  const textStyles: Record<ButtonVariant, string> = {
    primary: "text-white font-semibold text-base",
    secondary: "text-primary font-semibold text-base",
  };

  const disabledStyles = isDisabled ? "opacity-50" : "active:opacity-80";

  return (
    <Pressable
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles[variant]} ${disabledStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#ffffff" : "#6366f1"}
        />
      ) : (
        <Text className={textStyles[variant]}>{title}</Text>
      )}
    </Pressable>
  );
}
