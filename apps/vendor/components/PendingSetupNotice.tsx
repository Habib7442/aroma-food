import { Text, View } from "react-native";

export function PendingSetupNotice() {
  return (
    <View className="rounded-card border border-border bg-card p-4">
      <Text className="text-base font-rubik-semibold text-primary">Restaurant record pending setup</Text>
      <Text className="font-sans mt-1 text-sm text-primary">
        Your account is signed up, but your restaurant record hasn&apos;t been created on our side
        yet. Menu and profile editing will be available once that finishes — check back shortly.
      </Text>
    </View>
  );
}
