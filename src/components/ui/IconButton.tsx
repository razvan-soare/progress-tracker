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
  ...props
}: IconButtonProps) {
  const baseStyles = "items-center justify-center rounded-full";

  const sizeStyles: Record<IconButtonSize, string> = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
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
      {...props}
    >
      <Text className={`${iconSizeStyles[size]} ${iconColorStyles[variant]}`}>
        {icon}
      </Text>
    </Pressable>
  );
}
