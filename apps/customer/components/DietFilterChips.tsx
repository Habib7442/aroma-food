import type { DietType } from "@zaavo/shared";
import { Pressable, ScrollView, Text } from "react-native";

const OPTIONS: { label: string; value: DietType | null }[] = [
  { label: "All", value: null },
  { label: "Veg", value: "veg" },
  { label: "Egg", value: "egg" },
  { label: "Non-Veg", value: "non_veg" },
];

interface DietFilterChipsProps {
  value: DietType | null;
  onChange: (value: DietType | null) => void;
  className?: string;
}

// Reusable filter row — any screen listing DietType-tagged items (menu
// grids, search results) can drop this in rather than hand-rolling its own
// chip row. Filtering itself stays the caller's job; this just reports
// which chip is active.
export function DietFilterChips({ value, onChange, className }: DietFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={className}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
    >
      {OPTIONS.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.label}
            onPress={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1.5 ${isSelected ? "border-veg bg-veg/15" : "border-border bg-card"}`}
          >
            <Text className={`text-xs ${isSelected ? "font-headline-semibold text-veg" : "font-sans text-primary-dark"}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
