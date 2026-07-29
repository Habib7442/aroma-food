import type { DietType } from "@zaavo/shared";
import { Text, View } from "react-native";

const CONFIG: Record<
  DietType,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  veg: {
    label: "VEG",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-800",
    dot: "bg-emerald-600",
  },
  egg: {
    label: "EGG",
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    dot: "bg-amber-600",
  },
  non_veg: {
    label: "NON-VEG",
    bg: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-800",
    dot: "bg-rose-600",
  },
};

export function DietBadge({ dietType }: { dietType: DietType }) {
  const config = CONFIG[dietType] ?? CONFIG.veg;
  return (
    <View className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-0.5 ${config.bg} ${config.border}`}>
      <View className={`w-2 h-2 rounded-full ${config.dot}`} />
      <Text className={`text-[11px] font-rubik-bold tracking-wider ${config.text}`}>{config.label}</Text>
    </View>
  );
}

