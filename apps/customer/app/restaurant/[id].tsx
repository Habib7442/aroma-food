import { formatPaise, type DietType } from "@zaavo/shared";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { DietBadge } from "../../components/DietBadge";
import { ScreenContainer } from "../../components/ScreenContainer";
import { supabase } from "../../lib/supabase";

interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  diet_type: DietType;
}

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: restaurant, isLoading: isRestaurantLoading } = useQuery({
    queryKey: ["restaurant", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, description, is_pure_veg, is_open")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: menuItems, isLoading: isMenuLoading } = useQuery({
    queryKey: ["menu-items", "public", id],
    queryFn: async (): Promise<MenuItemRow[]> => {
      // Public policy (menu_items_select_public_available) is OR'd with the
      // vendor's own-restaurant policy — an explicit filter here matters for
      // the same reason it does in the vendor app's menu list.
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, description, price_paise, diet_type")
        .eq("restaurant_id", id)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurant,
  });

  if (isRestaurantLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1D4626" size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!restaurant) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-5">
          <Text className="font-sans text-sm text-primary-dark">Restaurant not found.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlashList
        data={menuItems ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="gap-3 border-b border-border px-5 py-4">
            <Pressable onPress={() => router.back()}>
              <Text className="font-inter-medium text-sm text-primary">‹ Back</Text>
            </Pressable>
            <View>
              <View className="flex-row items-center gap-2">
                <Text className="font-headline text-2xl text-primary">{restaurant.name}</Text>
                {restaurant.is_pure_veg ? (
                  <View className="rounded-full bg-veg/10 px-2 py-0.5">
                    <Text className="font-inter-medium text-[10px] text-veg">PURE VEG</Text>
                  </View>
                ) : null}
              </View>
              {restaurant.description ? (
                <Text className="mt-1 font-sans text-sm text-primary-dark">{restaurant.description}</Text>
              ) : null}
              <Text
                className={`mt-2 font-inter-medium text-xs ${
                  restaurant.is_open ? "text-veg" : "text-non-veg"
                }`}
              >
                {restaurant.is_open ? "Open now" : "Closed"}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          isMenuLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#1D4626" />
            </View>
          ) : (
            <View className="items-center py-16">
              <Text className="font-sans text-sm text-primary-dark">No items on the menu yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View className="flex-row items-start gap-3 border-b border-border px-5 py-4">
            <View className="mt-1">
              <DietBadge dietType={item.diet_type} />
            </View>
            <View className="flex-1">
              <Text className="font-headline-semibold text-base text-primary">{item.name}</Text>
              {item.description ? (
                <Text className="mt-0.5 font-sans text-sm text-primary-dark" numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <Text className="font-headline-semibold text-sm text-primary">{formatPaise(item.price_paise)}</Text>
          </View>
        )}
      />
    </ScreenContainer>
  );
}
