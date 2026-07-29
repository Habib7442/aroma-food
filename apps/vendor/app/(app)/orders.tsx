import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { ScreenContainer } from "../../components/ScreenContainer";

export default function OrdersScreen() {
  return (
    <ScreenContainer scroll center>
      <View className="w-full max-w-[480px] items-center">
        {/* Custom Top Header */}
        <View className="w-full mb-5 flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
            <Ionicons name="receipt" size={20} color="#1D4626" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-rubik-bold text-primary">Live Orders</Text>
            <Text className="font-sans text-xs text-[#5A6357]">
              Real-time kitchen order feed
            </Text>
          </View>
        </View>

        {/* Live Orders Card Container */}
        <View className="w-full rounded-2xl border border-border bg-card p-8 items-center justify-center gap-4 shadow-sm">
          <View className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
            <Ionicons name="notifications-outline" size={32} color="#1D4626" />
          </View>

          <View className="items-center gap-1">
            <Text className="text-xl font-rubik-bold text-primary text-center">
              No Incoming Orders Yet
            </Text>
            <Text className="font-sans text-sm text-[#5A6357] text-center max-w-[300px]">
              When customers place orders from your restaurant, they will appear here live in real-time.
            </Text>
          </View>

          <View className="w-full rounded-xl bg-background p-4 border border-border mt-2 flex-row items-center gap-3">
            <Ionicons name="information-circle-outline" size={20} color="#1D4626" />
            <Text className="font-sans text-xs text-[#5A6357] flex-1">
              Ensure your restaurant profile is marked &apos;Open for orders&apos; to receive incoming orders.
            </Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}


