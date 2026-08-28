import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

interface DebouncedSearchBoxProps {
  placeholder?: string;
  onDebouncedChange: (query: string) => void;
  delay?: number;
  className?: string;
}

// Self-contained debounced text input — the caller only ever hears the
// settled value, `delay` ms after typing stops, so a screen filtering a
// list on every change doesn't re-run that filter (or re-render a big
// list) on every keystroke. Local `value` state keeps the input itself
// responsive regardless of the debounce.
export function DebouncedSearchBox({ placeholder = "Search", onDebouncedChange, delay = 300, className }: DebouncedSearchBoxProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onDebouncedChange(value.trim()), delay);
    return () => clearTimeout(timer);
    // onDebouncedChange deliberately excluded — an inline arrow function
    // passed by the caller gets a new reference every render, which would
    // otherwise reset this timer before it ever fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return (
    <View className={`flex-row items-center gap-2 rounded-full border border-border bg-card px-3 ${className ?? ""}`}>
      <Ionicons name="search-outline" size={16} color="#8A8578" />
      <TextInput
        className="min-h-[40px] flex-1 font-sans text-sm text-primary"
        placeholder={placeholder}
        placeholderTextColor="#8A8578"
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => setValue("")} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color="#8A8578" />
        </Pressable>
      ) : null}
    </View>
  );
}
