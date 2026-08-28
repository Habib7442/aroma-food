import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { formatPaise } from "@zaavo/shared";
import { router } from "expo-router";
import { Alert, Image, Pressable, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { DietBadge } from "../../components/DietBadge";
import { QuantityStepper } from "../../components/QuantityStepper";
import { ScreenContainer } from "../../components/ScreenContainer";
import { cartItemSubtotalPaise, cartPackagingTotalPaise, useCartStore } from "../../lib/useCart";

export default function CartScreen() {
  const restaurantName = useCartStore((state) => state.restaurantName);
  const items = useCartStore((state) => state.items);
  const incrementQuantity = useCartStore((state) => state.incrementQuantity);
  const decrementQuantity = useCartStore((state) => state.decrementQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  if (items.length === 0) {
    return (
      <ScreenContainer center centerVertical>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/5">
          <Ionicons name="cart-outline" size={28} color="#1D4626" />
        </View>
        <Text className="mt-4 font-headline-semibold text-lg text-primary">Your cart is empty</Text>
        <Text className="mt-1 max-w-[280px] text-center font-sans text-sm text-primary-dark">
          Add dishes from a restaurant to get started.
        </Text>
        <View className="mt-6 w-full max-w-[280px]">
          <Button label="Browse restaurants" onPress={() => router.push("/home")} />
        </View>
      </ScreenContainer>
    );
  }

  const onClearCart = () => {
    Alert.alert("Clear cart?", "This removes every item from your cart. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear cart", style: "destructive", onPress: () => clearCart() },
    ]);
  };

  const onCheckout = () => {
    Alert.alert("Checkout", "Checkout isn't built yet — coming in a later update.");
  };

  const itemSubtotal = cartItemSubtotalPaise(items);
  const packagingTotal = cartPackagingTotalPaise(items);

  return (
    <ScreenContainer>
      <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
        <View className="flex-1">
          <Text className="font-sans text-xs text-primary-dark">Ordering from</Text>
          <Text numberOfLines={1} className="font-headline text-lg text-primary">
            {restaurantName}
          </Text>
        </View>
        <Pressable onPress={onClearCart} hitSlop={8}>
          <Text className="font-headline-semibold text-sm text-non-veg">Clear cart</Text>
        </Pressable>
      </View>

      <View className="flex-1">
        <FlashList
          data={items}
          keyExtractor={(item) => item.menuItemId}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3">
              {item.thumbnailUrl ? (
                <Image source={{ uri: item.thumbnailUrl }} className="h-16 w-16 rounded-xl bg-background" resizeMode="cover" />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-xl bg-background">
                  <Ionicons name="restaurant-outline" size={22} color="#C1C9BE" />
                </View>
              )}
              <View className="min-w-0 flex-1 gap-1">
                <DietBadge dietType={item.dietType} />
                <Text numberOfLines={2} className="font-headline-semibold text-sm text-primary">
                  {item.name}
                </Text>
                <Text className="font-sans text-xs text-primary-dark">{formatPaise(item.pricePaise)} each</Text>
              </View>
              <View className="items-end gap-2">
                <Pressable onPress={() => removeItem(item.menuItemId)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color="#A52A2A" />
                </Pressable>
                <QuantityStepper
                  quantity={item.quantity}
                  onIncrement={() => incrementQuantity(item.menuItemId)}
                  onDecrement={() => decrementQuantity(item.menuItemId)}
                />
              </View>
            </View>
          )}
        />
      </View>

      {/* No GST line here, deliberately: packages/shared's calculateOrderTotals
          takes one flat order-wide GST rate, but menu_items.gst_rate_bps is
          per-item (500 or 4000) — a cart can have mixed rates that function
          can't correctly express. Rather than hack an inline GST calculation
          into this app (CLAUDE.md: all money math lives in packages/shared),
          this shows item subtotal + packaging (a plain per-item sum, not
          proportional/BPS math) and defers taxes to checkout, once that
          engine is extended for per-item rates. */}
      <View className="gap-2 border-t border-border px-5 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans text-sm text-primary-dark">Item subtotal</Text>
          <Text className="font-headline-semibold text-sm text-primary">{formatPaise(itemSubtotal)}</Text>
        </View>
        {packagingTotal > 0 ? (
          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-sm text-primary-dark">Packaging charge</Text>
            <Text className="font-headline-semibold text-sm text-primary">{formatPaise(packagingTotal)}</Text>
          </View>
        ) : null}
        <Text className="font-sans text-xs text-primary-dark">Taxes & delivery calculated at checkout</Text>
        <View className="mt-2">
          <Button label="Proceed to Checkout" onPress={onCheckout} />
        </View>
      </View>
    </ScreenContainer>
  );
}
