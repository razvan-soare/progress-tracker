import { Pressable, PressableProps, Text } from "react-native";

type IconButtonVariant = "default" | "primary" | "danger";
type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps extends Omit<PressableProps, "children"> {
  icon: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

export function IconButton({
  icon,
  variant = "default",
  size = "md",
  disabled,
  className = "",
  accessibilityLabel,
  ...props
}: IconButtonProps) {
  const baseStyles = "items-center justify-center rounded-full";

  // Visual size of the button - minimum 44pt for accessibility
  const sizeStyles: Record<IconButtonSize, string> = {
    sm: "w-9 h-9",
    md: "w-11 h-11",
    lg: "w-12 h-12",
  };

  const iconSizeStyles: Record<IconButtonSize, string> = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const variantStyles: Record<IconButtonVariant, string> = {
    default: "bg-surface",
    primary: "bg-primary",
    danger: "bg-error",
  };

  const iconColorStyles: Record<IconButtonVariant, string> = {
    default: "text-text-primary",
    primary: "text-white",
    danger: "text-white",
  };

  const disabledStyles = disabled ? "opacity-50" : "active:opacity-70";

  return (
    <Pressable
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabledStyles} ${className}`}
      style={{ minWidth: 44, minHeight: 44 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled ?? false }}
      {...props}
    >
      <Text
        className={`${iconSizeStyles[size]} ${iconColorStyles[variant]}`}
        accessibilityElementsHidden
      >
        {icon}
      </Text>
    </Pressable>
  );
}
