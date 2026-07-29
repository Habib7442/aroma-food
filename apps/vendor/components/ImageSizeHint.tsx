import { Text, View } from "react-native";

/** Bold, high-contrast size/aspect-ratio hint shown under every image upload
 * box, so a vendor knows what to crop/shoot before they pick a file. */
export function ImageSizeHint({ label }: { label: string }) {
  return (
    <View className="self-start rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1">
      <Text className="font-rubik-bold text-[11px] text-amber-800">{label}</Text>
    </View>
  );
}
