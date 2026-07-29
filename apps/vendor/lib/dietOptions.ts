import type { DietType } from "@zaavo/shared";
import type { Ionicons } from "@expo/vector-icons";

export const DIET_OPTIONS: {
  value: DietType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  activeIconColor: string;
}[] = [
  {
    value: "veg",
    label: "Veg",
    icon: "leaf-outline",
    activeBg: "bg-emerald-600",
    activeBorder: "border-emerald-600",
    activeText: "text-white",
    activeIconColor: "#FFFFFF",
  },
  {
    value: "egg",
    label: "Egg",
    icon: "egg-outline",
    activeBg: "bg-amber-500",
    activeBorder: "border-amber-500",
    activeText: "text-white",
    activeIconColor: "#FFFFFF",
  },
  {
    value: "non_veg",
    label: "Non-Veg",
    icon: "restaurant-outline",
    activeBg: "bg-rose-600",
    activeBorder: "border-rose-600",
    activeText: "text-white",
    activeIconColor: "#FFFFFF",
  },
];

// Confirmed intentional (not the usual 5%/18%) — see the menu_categories_gst_packaging migration.
export const GST_OPTIONS: { value: number; label: string }[] = [
  { value: 500, label: "5%" },
  { value: 4000, label: "40%" },
];
