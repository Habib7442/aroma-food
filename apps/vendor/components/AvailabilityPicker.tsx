import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "./Button";

// null = "Indefinitely" (today's plain pause, kept so vendors don't lose
// the ability to permanently 86 a dish — see plan §2's "Indefinitely"
// option).
type Preset = { label: string; minutesFromNow: number | null };

const PRESETS: Preset[] = [
  { label: "In 15 minutes", minutesFromNow: 15 },
  { label: "In 30 minutes", minutesFromNow: 30 },
  { label: "In 1 hour", minutesFromNow: 60 },
  { label: "In 2 hours", minutesFromNow: 120 },
  { label: "In 4 hours", minutesFromNow: 240 },
];

const CUSTOM_KEY = "custom";
const INDEFINITE_KEY = "indefinite";

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AvailabilityPicker({
  visible,
  itemName,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  itemName: string;
  onCancel: () => void;
  onConfirm: (unavailableUntil: string | null) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string>("15");
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Captured once per time the picker opens (Modal's onShow, below) rather
  // than read fresh during render (`Date.now()` is impure — the preset
  // list needs a stable "now" for its whole render pass, not one that
  // could drift between the 15-minute row and the 4-hour row).
  const [nowMs, setNowMs] = useState(() => Date.now());
  const now = new Date(nowMs);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 7);

  const resolveSelection = (): string | null | undefined => {
    if (selectedKey === INDEFINITE_KEY) return null;
    if (selectedKey === CUSTOM_KEY) return customDate ? customDate.toISOString() : undefined;
    const preset = PRESETS.find((p) => String(p.minutesFromNow) === selectedKey);
    if (!preset || preset.minutesFromNow === null) return undefined;
    return new Date(Date.now() + preset.minutesFromNow * 60_000).toISOString();
  };

  const onConfirmPress = () => {
    const resolved = resolveSelection();
    if (resolved === undefined) return; // custom selected but no date chosen yet
    onConfirm(resolved);
  };

  const radioRow = (key: string, label: string, sublabel?: string) => {
    const isSelected = selectedKey === key;
    return (
      <Pressable
        key={key}
        onPress={() => setSelectedKey(key)}
        className={`flex-row items-center justify-between rounded-2xl border p-4 ${
          isSelected ? "border-primary bg-emerald-50" : "border-border bg-card"
        }`}
      >
        <View className="flex-1 gap-0.5">
          <Text className="font-rubik-semibold text-base text-primary">{label}</Text>
          {sublabel ? <Text className="font-sans text-xs text-[#5A6357]">{sublabel}</Text> : null}
        </View>
        <View
          className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
            isSelected ? "border-primary" : "border-border"
          }`}
        >
          {isSelected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      onShow={() => setNowMs(Date.now())}
    >
      <View className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
          <Pressable onPress={onCancel} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#1D4626" />
          </Pressable>
          <Text className="font-rubik-bold text-lg text-primary">Confirm Item Availability</Text>
        </View>

        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20, gap: 12 }}>
          <View className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <Text className="font-sans text-sm text-amber-900">
              <Text className="font-rubik-semibold">{itemName}</Text> will be marked out-of-stock for your
              customers.
            </Text>
          </View>

          <Text className="mt-2 font-rubik-bold text-base text-primary">When will it come back in-stock again?</Text>

          {PRESETS.map((preset) => {
            const at = new Date(nowMs + (preset.minutesFromNow ?? 0) * 60_000);
            return radioRow(String(preset.minutesFromNow), preset.label, `At ${formatClockTime(at)} today`);
          })}

          {radioRow(
            CUSTOM_KEY,
            "Custom Date (Upto 7 Days)",
            customDate ? `Back on ${customDate.toLocaleDateString()}` : "Please select a custom date",
          )}
          {selectedKey === CUSTOM_KEY ? (
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <Text className="font-sans text-sm text-primary">
                {customDate ? customDate.toLocaleDateString() : "Choose a date"}
              </Text>
            </Pressable>
          ) : null}

          {radioRow(INDEFINITE_KEY, "Indefinitely", "No scheduled return — turn it back on manually")}
        </ScrollView>

        {showDatePicker ? (
          <DateTimePicker
            value={customDate ?? tomorrow}
            mode="date"
            display="default"
            minimumDate={tomorrow}
            maximumDate={maxDate}
            onValueChange={(_event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setCustomDate(selectedDate);
            }}
          />
        ) : null}

        <View className="border-t border-border px-5 py-4">
          <Button
            label="Mark Out of Stock"
            onPress={onConfirmPress}
            disabled={selectedKey === CUSTOM_KEY && !customDate}
          />
        </View>
      </View>
    </Modal>
  );
}
