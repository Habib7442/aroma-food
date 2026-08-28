import { Ionicons } from "@expo/vector-icons";
import { Wordmark } from "@zaavo/ui";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from "react-native";

import { DebouncedSearchBox } from "../../components/DebouncedSearchBox";
import { PromoCarousel } from "../../components/PromoCarousel";
import { ScreenContainer } from "../../components/ScreenContainer";
import { useProfileCompletion } from "../../lib/useProfile";
import { supabase } from "../../lib/supabase";

interface RestaurantCard {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_pure_veg: boolean;
  is_open: boolean;
  address: string | null;
  landmark: string | null;
}

// Light tints cycled per card by index so the feed doesn't read as a wall
// of identical white cards — derived from existing brand tokens (opacity
// variants), not new arbitrary colors. Cover image and OPEN/PURE VEG badges
// are unaffected; only the card body picks up the tint.
const CARD_TINTS = ["bg-primary/5", "bg-secondary/10", "bg-egg/10", "bg-veg/8"];

export default function HomeScreen() {
  const { data: completion } = useProfileCompletion();
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: restaurants, isLoading, error } = useQuery({
    queryKey: ["restaurants", "feed"],
    queryFn: async (): Promise<RestaurantCard[]> => {
      // RLS (restaurants_select_public_approved) already restricts anon
      // reads to status = 'approved' — this is just the column list this
      // screen actually renders, not a second filter on top of that.
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, description, cover_url, is_pure_veg, is_open, address, landmark")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // "biryani" should surface a restaurant whose menu has a biryani dish,
  // not just one named "Biryani House" — a name-only match on `restaurants`
  // misses that entirely. menu_items_select_public_available already scopes
  // this to approved restaurants and effectively-available dishes (RLS),
  // same as the restaurants query above doesn't need to re-check `status`.
  const trimmedSearchQuery = searchQuery.trim();
  const { data: dishMatches } = useQuery({
    queryKey: ["menu-items-search", "public", trimmedSearchQuery],
    queryFn: async (): Promise<{ restaurant_id: string }[]> => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("restaurant_id")
        .ilike("name", `%${trimmedSearchQuery}%`)
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: trimmedSearchQuery.length > 0,
  });
  const dishMatchRestaurantIds = useMemo(() => new Set((dishMatches ?? []).map((m) => m.restaurant_id)), [dishMatches]);

  // Search filters the already-loaded feed client-side — the restaurant
  // count here is small enough (single city) that a client-side pass beats
  // a network round trip per keystroke. Open restaurants sort first;
  // Array.sort is stable, so the underlying alphabetical order (from the
  // query) is preserved within each group.
  const filteredRestaurants = useMemo(() => {
    if (!restaurants) return restaurants;
    const query = trimmedSearchQuery.toLowerCase();
    return restaurants
      .filter((restaurant) => {
        if (query && !restaurant.name.toLowerCase().includes(query) && !dishMatchRestaurantIds.has(restaurant.id)) return false;
        return true;
      })
      .sort((a, b) => Number(b.is_open) - Number(a.is_open));
  }, [restaurants, trimmedSearchQuery, dishMatchRestaurantIds]);

  // Pull-to-refresh re-fetches the restaurant feed and the promo carousel
  // together — both are the kind of thing that can genuinely change between
  // app opens (a new restaurant approved, a new admin promo), unlike the
  // search-scoped dish-match query, which only matters while there's an
  // active search.
  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["restaurants", "feed"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-banners", "public"] }),
    ]);
    setIsRefreshing(false);
  };

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
      <View className="flex-row items-center justify-between bg-primary px-5 pb-3 pt-4">
        <Wordmark height={24} color="#FAF8F5" />
        <Pressable
          onPress={() => Alert.alert("Notifications", "Nothing here yet — this is coming in a later update.")}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-white/15"
        >
          <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="border-b border-border pb-3 pt-3">
        <DebouncedSearchBox placeholder="Search restaurants or dishes" onDebouncedChange={setSearchQuery} className="mx-5" />
      </View>

      {/* PRD §6.6's "promo banner carousel" — admin-managed via apps/admin's
          Promos page (platform_banners), distinct from a restaurant's own
          banners. A finished marketing graphic with its own logo/text baked
          in, so it's its own rounded card (with pagination dots) rather
          than a background other UI sits on top of. Renders nothing at all
          when there are no active promos, so a fresh install isn't left
          with a blank gap here. */}
      <PromoCarousel />

      {/* Nudge banner — same completion calc as app/(app)/profile.tsx's
          meter (lib/useProfile.ts's useProfileCompletion, shared so the two
          never disagree). Disappears entirely at 100%, not just hidden. */}
      {completion && completion.percent < 100 ? (
        <View className="mx-5 mt-4 gap-2 rounded-card border border-border bg-card p-4">
          <Text className="font-headline-semibold text-sm text-primary">Profile {completion.percent}% complete</Text>
          <View className="h-2 overflow-hidden rounded-full bg-border">
            <View className="h-full rounded-full bg-primary" style={{ width: `${completion.percent}%` }} />
          </View>
          <Text className="mt-1 font-sans text-xs text-primary-dark">
            {completion.missingPhone
              ? "Add your WhatsApp number to hear about offers first."
              : "Tap Profile to finish setting up your account."}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-center font-sans text-sm text-non-veg">Couldn&apos;t load restaurants.</Text>
        </View>
      ) : (
        <FlashList
          data={filteredRestaurants ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 }}
          ItemSeparatorComponent={() => <View className="h-4" />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="font-sans text-sm text-primary-dark">
                {restaurants && restaurants.length > 0 ? "No restaurants match your search." : "No restaurants yet."}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const location = item.landmark ?? item.address;
            const tint = CARD_TINTS[index % CARD_TINTS.length];
            return (
              <Link href={{ pathname: "/restaurant/[id]", params: { id: item.id } }} asChild>
                <Pressable className={`overflow-hidden rounded-card border border-border ${tint}`}>
                  <View className="h-36 w-full bg-background">
                    {item.cover_url ? (
                      <Image source={{ uri: item.cover_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Ionicons name="restaurant-outline" size={28} color="#C1C9BE" />
                      </View>
                    )}
                    <View className={`absolute left-3 top-3 rounded-full px-2.5 py-1 ${item.is_open ? "bg-veg" : "bg-non-veg"}`}>
                      <Text className="font-inter-semibold text-[10px] text-white">
                        {item.is_open ? "OPEN" : "CLOSED"}
                      </Text>
                    </View>
                    {item.is_pure_veg ? (
                      <View className="absolute right-3 top-3 rounded-full bg-card/90 px-2.5 py-1">
                        <Text className="font-inter-medium text-[10px] text-veg">PURE VEG</Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="gap-1.5 p-5">
                    <Text className="font-headline-semibold text-base text-primary" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.description ? (
                      <Text className="font-sans text-sm text-primary-dark" numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                    {location ? (
                      <View className="mt-1 flex-row items-center gap-1.5">
                        <Ionicons name="location-outline" size={13} color="#8A8578" />
                        <Text className="flex-1 font-sans text-xs text-primary-dark" numberOfLines={1}>
                          {location}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
