import { formatPaise, type DietType } from "@zaavo/shared";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";

import { DebouncedSearchBox } from "../../../components/DebouncedSearchBox";
import { DietBadge } from "../../../components/DietBadge";
import { DietFilterChips } from "../../../components/DietFilterChips";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { supabase } from "../../../lib/supabase";

interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  diet_type: DietType;
  category_id: string | null;
  thumbnail_url: string | null;
}

interface MenuCategoryRow {
  id: string;
  name: string;
  sort_order: number;
  thumbnail_url: string | null;
}

interface BannerRow {
  id: string;
  image_url: string;
  sort_order: number;
}

// Sentinel for the always-present "Other" rail entry — items with no
// category_id would otherwise have no tab to live under.
const UNCATEGORIZED_ID = "uncategorized";

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [explicitCategoryId, setExplicitCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dietFilter, setDietFilter] = useState<DietType | null>(null);

  const {
    data: restaurant,
    isLoading: isRestaurantLoading,
    error: restaurantError,
  } = useQuery({
    queryKey: ["restaurant", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, description, is_pure_veg, is_open")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["menu-categories", "public", id],
    queryFn: async (): Promise<MenuCategoryRow[]> => {
      // Same public policy shape as menu_items below — menu_categories_select_public.
      // thumbnail_url (not the full image_url) for the rail — a 400px crop
      // is plenty for the small icon shown there.
      const { data, error } = await supabase
        .from("menu_categories")
        .select("id, name, sort_order, thumbnail_url")
        .eq("restaurant_id", id)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurant,
  });

  // Left rail defaults to the first real category once it loads — derived
  // straight from the query result rather than synced into state via an
  // effect, so there's no extra render cycle and the right pane never sits
  // empty on entry.
  const defaultCategoryId = categories ? (categories.length > 0 ? categories[0].id : UNCATEGORIZED_ID) : null;
  const selectedCategoryId = explicitCategoryId ?? defaultCategoryId;

  // Small and capped at 5 per restaurant_banners' vendor-side quota — fetched
  // in full, unlike the menu itself, since there's nothing to page through.
  const { data: banners } = useQuery({
    queryKey: ["restaurant-banners", "public", id],
    queryFn: async (): Promise<BannerRow[]> => {
      const { data, error } = await supabase
        .from("restaurant_banners")
        .select("id, image_url, sort_order")
        .eq("restaurant_id", id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurant,
  });

  // The actual "lazy loading" — only the selected category's dishes are
  // fetched, not the whole menu up front. Switching categories fires a new
  // (react-query-cached-after-first-view) request instead of filtering an
  // already-downloaded full menu client-side.
  const {
    data: menuItems,
    isLoading: isMenuLoading,
    error: menuError,
  } = useQuery({
    queryKey: ["menu-items", "public", id, selectedCategoryId],
    queryFn: async (): Promise<MenuItemRow[]> => {
      // Public policy (menu_items_select_public_available) is OR'd with the
      // vendor's own-restaurant policy — an explicit filter here matters for
      // the same reason it does in the vendor app's menu list. Mirrors that
      // policy's effective-availability formula (a scheduled pause whose
      // unavailable_until has already passed counts as available) rather
      // than a plain is_available check, or a dish would stay hidden here
      // even once the RLS policy itself already allows it through.
      let query = supabase
        .from("menu_items")
        .select("id, name, description, price_paise, diet_type, category_id, thumbnail_url")
        .eq("restaurant_id", id)
        .or(`is_available.eq.true,unavailable_until.lte.${new Date().toISOString()}`);
      query = selectedCategoryId === UNCATEGORIZED_ID ? query.is("category_id", null) : query.eq("category_id", selectedCategoryId!);
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurant && !!selectedCategoryId,
  });

  // Search and diet filter both operate on the already-fetched category's
  // items, client-side — the lazy per-category fetch above is about not
  // downloading the whole menu up front, not about avoiding a filter pass
  // over the handful of dishes already in memory for one category.
  const filteredMenuItems = useMemo(() => {
    if (!menuItems) return menuItems;
    const query = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (dietFilter && item.diet_type !== dietFilter) return false;
      if (query && !item.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [menuItems, searchQuery, dietFilter]);

  if (isRestaurantLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1D4626" size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (restaurantError) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-5">
          <Text className="font-sans text-sm text-primary-dark">Couldn&apos;t load this restaurant.</Text>
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

  const rail = [
    ...(categories ?? []),
    { id: UNCATEGORIZED_ID, name: "Other", sort_order: Number.MAX_SAFE_INTEGER, thumbnail_url: null },
  ];
  const selectedCategoryName = rail.find((category) => category.id === selectedCategoryId)?.name ?? "";

  return (
    <ScreenContainer>
      <View className="gap-3 bg-primary px-5 py-4 pb-5">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </Pressable>
          <Text numberOfLines={1} className="flex-1 font-headline text-2xl text-white">
            {restaurant.name}
          </Text>
          {restaurant.is_pure_veg ? (
            <View className="shrink-0 rounded-full bg-white/15 px-2 py-0.5">
              <Text className="font-inter-medium text-[10px] text-white">PURE VEG</Text>
            </View>
          ) : null}
        </View>
        <View className="pl-12">
          {restaurant.description ? (
            <Text className="font-sans text-sm text-white/70">{restaurant.description}</Text>
          ) : null}
          <View
            className={`mt-2 flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${
              restaurant.is_open ? "bg-white/15" : "bg-non-veg/25"
            }`}
          >
            <View className={`h-1.5 w-1.5 rounded-full ${restaurant.is_open ? "bg-veg" : "bg-non-veg"}`} />
            <Text className="font-inter-medium text-xs text-white">{restaurant.is_open ? "Open now" : "Closed"}</Text>
          </View>
        </View>
      </View>

      <View className="flex-1 flex-row">
        {/* Left rail: categories only — no items, so this never waits on the
            lazy per-category fetch below. Wrapped in a plain View for the
            same reason as the right pane below — a width className directly
            on a FlatList isn't reliably honored here, and without it this
            column was sizing itself to its widest wrapped category name
            (~50% of the screen) instead of the intended 10%. */}
        <View className="w-[24%] shrink-0 border-r border-border bg-veg/5">
        <FlatList
          data={rail}
          keyExtractor={(category) => category.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: category }) => {
            const isSelected = category.id === selectedCategoryId;
            return (
              <Pressable
                onPress={() => setExplicitCategoryId(category.id)}
                className={`items-center gap-1.5 border-l-2 px-1.5 py-3 ${
                  isSelected ? "border-veg bg-veg/10" : "border-transparent"
                }`}
              >
                {category.thumbnail_url ? (
                  <Image
                    source={{ uri: category.thumbnail_url }}
                    className={`h-14 w-14 rounded-2xl bg-background ${isSelected ? "border-2 border-veg" : ""}`}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className={`h-14 w-14 items-center justify-center rounded-2xl bg-background ${
                      isSelected ? "border-2 border-veg" : ""
                    }`}
                  >
                    <Ionicons name="fast-food-outline" size={22} color={isSelected ? "#1F8A3B" : "#C1C9BE"} />
                  </View>
                )}
                <Text
                  numberOfLines={2}
                  className={`text-center text-xs ${
                    isSelected ? "font-headline-semibold text-veg" : "font-sans text-primary-dark"
                  }`}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          }}
        />
        </View>

        {/* Right pane: promo banners on top, then the selected category's
            dishes — the FlatList's ListHeaderComponent keeps both in one
            scroll instead of nesting a second vertical scroller. Wrapped in
            a plain View rather than putting flex-1 directly on the FlatList
            — NativeWind doesn't reliably size a FlatList itself, which was
            collapsing this pane's width down to the row content's minimum
            and forcing every dish name to wrap one character per line. */}
        <View className="flex-1">
        <FlatList
          key="menu-grid"
          data={filteredMenuItems ?? []}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {banners && banners.length > 0 ? (
                <FlatList
                  horizontal
                  data={banners}
                  keyExtractor={(banner) => banner.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, padding: 12 }}
                  renderItem={({ item: banner }) => (
                    <Image
                      source={{ uri: banner.image_url }}
                      className="h-28 w-72 rounded-xl bg-background"
                      resizeMode="cover"
                    />
                  )}
                />
              ) : null}
              {menuItems && menuItems.length > 0 ? (
                <View className="gap-2 pb-1 pt-2">
                  <DebouncedSearchBox
                    placeholder={`Search in ${selectedCategoryName}`}
                    onDebouncedChange={setSearchQuery}
                    className="mx-3"
                  />
                  <DietFilterChips value={dietFilter} onChange={setDietFilter} />
                  <Text className="px-3 pb-1 pt-1 font-headline-semibold text-base text-primary">
                    {filteredMenuItems?.length ?? 0} {filteredMenuItems?.length === 1 ? "item" : "items"} in{" "}
                    <Text className="text-primary-dark">{selectedCategoryName}</Text>
                  </Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            menuError ? (
              <View className="items-center py-16">
                <Text className="font-sans text-sm text-primary-dark">Couldn&apos;t load the menu.</Text>
              </View>
            ) : isMenuLoading ? (
              <View className="items-center py-16">
                <ActivityIndicator color="#1D4626" />
              </View>
            ) : menuItems && menuItems.length > 0 ? (
              <View className="items-center py-16">
                <Text className="font-sans text-sm text-primary-dark">No dishes match your search/filter.</Text>
              </View>
            ) : (
              <View className="items-center py-16">
                <Text className="font-sans text-sm text-primary-dark">No items in this category yet.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
              {item.thumbnail_url ? (
                <Image source={{ uri: item.thumbnail_url }} className="aspect-square w-full bg-background" resizeMode="cover" />
              ) : (
                <View className="aspect-square w-full items-center justify-center bg-background">
                  <Ionicons name="restaurant-outline" size={28} color="#C1C9BE" />
                </View>
              )}
              <View className="gap-1 p-2.5">
                <DietBadge dietType={item.diet_type} />
                <Text numberOfLines={2} className="font-headline-semibold text-sm text-primary">
                  {item.name}
                </Text>
                <Text className="font-headline-semibold text-sm text-primary">{formatPaise(item.price_paise)}</Text>
              </View>
            </View>
          )}
        />
        </View>
      </View>
    </ScreenContainer>
  );
}
