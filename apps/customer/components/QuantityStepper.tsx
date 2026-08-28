import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** "compact" for the grid card's thumbnail overlay, "default" for a cart row. */
  size?: "compact" | "default";
}

// Shared −  N  + control — used both as the grid card's overlay pill
// (restaurant/[id].tsx) and each cart-screen row, so the two never drift out
// of sync visually.
export function QuantityStepper({ quantity, onIncrement, onDecrement, size = "default" }: QuantityStepperProps) {
  const isCompact = size === "compact";
  const iconSize = isCompact ? 14 : 16;
  const buttonClass = isCompact ? "h-6 w-6" : "h-8 w-8";

  return (
    <View className={`flex-row items-center rounded-full bg-veg ${isCompact ? "gap-1 px-1 py-1" : "gap-2 px-1.5 py-1.5"}`}>
      <Pressable onPress={onDecrement} hitSlop={6} className={`${buttonClass} items-center justify-center`}>
        <Ionicons name="remove" size={iconSize} color="#FFFFFF" />
      </Pressable>
      <Text className={`font-headline-semibold text-white ${isCompact ? "text-xs" : "text-sm"}`}>{quantity}</Text>
      <Pressable onPress={onIncrement} hitSlop={6} className={`${buttonClass} items-center justify-center`}>
        <Ionicons name="add" size={iconSize} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
