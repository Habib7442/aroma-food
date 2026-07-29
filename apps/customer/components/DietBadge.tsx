import { View } from "react-native";
import type { DietType } from "@zaavo/shared";

const COLOR: Record<DietType, string> = {
  veg: "#0F8A4D",
  egg: "#E8A33D",
  non_veg: "#A52A2A",
};

/**
 * FSSAI-style marker per docs/DESIGN.md: a small square inside a circle
 * outline, colored by diet type — not a text pill. Meant to sit at the
 * top-left of a food item's title/image.
 */
export function DietBadge({ dietType }: { dietType: DietType }) {
  const color = COLOR[dietType];
  return (
    <View className="h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: color }}>
      <View className="h-1.5 w-1.5" style={{ backgroundColor: color }} />
    </View>
  );
}
