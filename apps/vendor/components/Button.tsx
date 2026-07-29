import { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  iconPosition = "right",
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isDestructive = variant === "destructive";
  const isDisabled = disabled || loading;

  const bgClasses = isPrimary
    ? "bg-[#1D4626] active:bg-[#032F12]"
    : isDestructive
    ? "bg-rose-50 border border-rose-200 active:bg-rose-100"
    : "bg-card border border-border active:bg-[#F3F4EF]";

  const textClasses = isPrimary
    ? "text-white"
    : isDestructive
    ? "text-rose-700 font-rubik-semibold"
    : "text-primary";

  const spinnerColor = isPrimary ? "#FFFFFF" : isDestructive ? "#E11D48" : "#1D4626";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`min-h-[52px] w-full flex-row items-center justify-center rounded-xl px-6 ${bgClasses} ${
        isDisabled ? "opacity-50" : ""
      }`}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {icon && iconPosition === "left" ? icon : null}
          <Text className={`text-base font-rubik-semibold ${textClasses}`}>
            {label}
          </Text>
          {icon && iconPosition === "right" ? icon : null}
        </View>
      )}
    </Pressable>
  );
}


