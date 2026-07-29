import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";
import { supabase } from "../lib/supabase";

interface RestaurantCard {
  id: string;
  name: string;
  description: string | null;
  is_pure_veg: boolean;
  is_open: boolean;
}

export default function HomeScreen() {
  const { data: restaurants, isLoading, error } = useQuery({
    queryKey: ["restaurants", "feed"],
    queryFn: async (): Promise<RestaurantCard[]> => {
      // RLS (restaurants_select_public_approved) already restricts anon
      // reads to status = 'approved' — this is just the column list this
      // screen actually renders, not a second filter on top of that.
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, description, is_pure_veg, is_open")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1D4626" size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="border-b border-border px-5 py-4">
        <Text className="font-headline text-2xl text-primary">Zaavo</Text>
        <Text className="mt-0.5 font-sans text-sm text-primary-dark">Restaurants in Silchar</Text>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-center font-sans text-sm text-non-veg">Couldn&apos;t load restaurants.</Text>
        </View>
      ) : (
        <FlashList
          data={restaurants ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="font-sans text-sm text-primary-dark">No restaurants yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: "/restaurant/[id]", params: { id: item.id } }} asChild>
              <Pressable className="rounded-card border border-border bg-card p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 font-headline-semibold text-base text-primary" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.is_pure_veg ? (
                    <View className="ml-2 rounded-full bg-veg/10 px-2 py-0.5">
                      <Text className="font-inter-medium text-[10px] text-veg">PURE VEG</Text>
                    </View>
                  ) : null}
                </View>
                {item.description ? (
                  <Text className="mt-1 font-sans text-sm text-primary-dark" numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <Text className={`mt-2 font-inter-medium text-xs ${item.is_open ? "text-veg" : "text-non-veg"}`}>
                  {item.is_open ? "Open now" : "Closed"}
                </Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </ScreenContainer>
  );
}
