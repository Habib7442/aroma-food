import { formatPaise, type DietType } from "@zaavo/shared";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { DebouncedSearchBox } from "../../../components/DebouncedSearchBox";
import { DietBadge } from "../../../components/DietBadge";
import { DietFilterChips } from "../../../components/DietFilterChips";
import { QuantityStepper } from "../../../components/QuantityStepper";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { useCartItemQuantity, useCartStore } from "../../../lib/useCart";
import { supabase } from "../../../lib/supabase";

interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  packaging_charge_paise: number;
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

interface DayHoursRow {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

// Sentinel for the always-present "Other" rail entry — items with no
// category_id would otherwise have no tab to live under.
const UNCATEGORIZED_ID = "uncategorized";

// day_of_week follows Postgres's EXTRACT(DOW ...) / JS's Date.getDay()
// convention: 0 = Sunday .. 6 = Saturday. Same convention/labels as
// apps/vendor/lib/useRestaurantHours.ts — kept as a local copy rather than
// a shared import since it's a 7-string constant, not worth a cross-app
// dependency for.
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHour(time: string | null): string {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${minuteStr} ${period}`;
}

// Its own component (not inlined in renderItem) because it needs
// useCartItemQuantity — a hook, which only works from an actual component,
// not a plain callback function called once per row.
function MenuItemCard({
  item,
  restaurantId,
  restaurantName,
}: {
  item: MenuItemRow;
  restaurantId: string;
  restaurantName: string;
}) {
  const quantity = useCartItemQuantity(item.id);
  const addItem = useCartStore((state) => state.addItem);
  const clearCartAndAddItem = useCartStore((state) => state.clearCartAndAddItem);
  const incrementQuantity = useCartStore((state) => state.incrementQuantity);
  const decrementQuantity = useCartStore((state) => state.decrementQuantity);

  const cartItem = {
    menuItemId: item.id,
    name: item.name,
    pricePaise: item.price_paise,
    packagingChargePaise: item.packaging_charge_paise,
    dietType: item.diet_type,
    thumbnailUrl: item.thumbnail_url,
  };

  const onAdd = () => {
    const result = addItem(restaurantId, restaurantName, cartItem);
    if (result === "conflict") {
      const currentRestaurantName = useCartStore.getState().restaurantName;
      Alert.alert(
        "Start a new cart?",
        `Your cart has items from ${currentRestaurantName}. Clear the cart and add this item instead?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear cart",
            style: "destructive",
            onPress: () => clearCartAndAddItem(restaurantId, restaurantName, cartItem),
          },
        ],
      );
    }
  };

  return (
    <View className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
      <View className="relative">
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} className="aspect-square w-full bg-background" resizeMode="cover" />
        ) : (
          <View className="aspect-square w-full items-center justify-center bg-background">
            <Ionicons name="restaurant-outline" size={28} color="#C1C9BE" />
          </View>
        )}
        {quantity === 0 ? (
          <Pressable
            onPress={onAdd}
            hitSlop={6}
            className="absolute bottom-2 right-2 h-8 w-8 items-center justify-center rounded-full bg-veg active:opacity-80"
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View className="absolute bottom-2 right-2">
            <QuantityStepper
              quantity={quantity}
              onIncrement={() => incrementQuantity(item.id)}
              onDecrement={() => decrementQuantity(item.id)}
              size="compact"
            />
          </View>
        )}
      </View>
      <View className="gap-1 p-2.5">
        <DietBadge dietType={item.diet_type} />
        <Text numberOfLines={2} className="font-headline-semibold text-sm text-primary">
          {item.name}
        </Text>
        <Text className="font-headline-semibold text-sm text-primary">{formatPaise(item.price_paise)}</Text>
      </View>
    </View>
  );
}

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [explicitCategoryId, setExplicitCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dietFilter, setDietFilter] = useState<DietType | null>(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [expandedBannerUrl, setExpandedBannerUrl] = useState<string | null>(null);

  const {
    data: restaurant,
    isLoading: isRestaurantLoading,
    error: restaurantError,
  } = useQuery({
    queryKey: ["restaurant", id],
    queryFn: async () => {
      // A customer deciding where to order from is entitled to the same
      // address/contact/hours info they'd see on a storefront — fetched
      // here (not lazily behind the details modal) since it's a single
      // cheap row, not worth a second round trip just to defer it.
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, description, is_pure_veg, is_open, address, landmark, pincode, contact_phone")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: hours } = useQuery({
    queryKey: ["restaurant-hours", "public", id],
    queryFn: async (): Promise<DayHoursRow[]> => {
      const { data, error } = await supabase
        .from("restaurant_hours")
        .select("day_of_week, is_closed, open_time, close_time")
        .eq("restaurant_id", id)
        .order("day_of_week");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurant,
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
        .select("id, name, description, price_paise, packaging_charge_paise, diet_type, category_id, thumbnail_url")
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
  const addressLine = [restaurant.landmark, restaurant.address].filter(Boolean).join(", ");
  const today = new Date().getDay();

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
          <Pressable
            onPress={() => setIsDetailsVisible(true)}
            hitSlop={8}
            className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <Ionicons name="information-circle-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View className="pl-12">
          {restaurant.description ? (
            <Text className="font-sans text-sm text-white/70">{restaurant.description}</Text>
          ) : null}
          {addressLine ? (
            <Pressable onPress={() => setIsDetailsVisible(true)} className="mt-1 flex-row items-center gap-1.5">
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
              <Text numberOfLines={1} className="flex-1 font-sans text-xs text-white/70">
                {addressLine}
              </Text>
            </Pressable>
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

      <Modal
        visible={isDetailsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsDetailsVisible(false)}
      >
        <Pressable
          onPress={() => setIsDetailsVisible(false)}
          className="flex-1 justify-end bg-black/40"
        >
          <Pressable className="max-h-[80%] rounded-t-3xl bg-card p-5" onPress={(event) => event.stopPropagation()}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-headline text-xl text-primary">Restaurant Details</Text>
              <Pressable onPress={() => setIsDetailsVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#1D4626" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="font-headline-semibold text-lg text-primary">{restaurant.name}</Text>
              {restaurant.description ? (
                <Text className="mt-1 font-sans text-sm text-primary-dark">{restaurant.description}</Text>
              ) : null}

              {addressLine || restaurant.pincode ? (
                <View className="mt-4 flex-row items-start gap-2.5">
                  <Ionicons name="location-outline" size={16} color="#5A6357" style={{ marginTop: 2 }} />
                  <Text className="flex-1 font-sans text-sm text-primary-dark">
                    {[addressLine, restaurant.pincode].filter(Boolean).join(" - ")}
                  </Text>
                </View>
              ) : null}

              {restaurant.contact_phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${restaurant.contact_phone}`)}
                  className="mt-3 flex-row items-center gap-2.5"
                >
                  <Ionicons name="call-outline" size={16} color="#5A6357" />
                  <Text className="font-sans text-sm text-primary underline">{restaurant.contact_phone}</Text>
                </Pressable>
              ) : null}

              <Text className="mb-2 mt-5 font-headline-semibold text-sm text-primary">Opening Hours</Text>
              {hours && hours.length > 0 ? (
                DAY_LABELS.map((label, dayOfWeek) => {
                  const row = hours.find((h) => h.day_of_week === dayOfWeek);
                  const isToday = dayOfWeek === today;
                  return (
                    <View
                      key={dayOfWeek}
                      className={`flex-row items-center justify-between border-b border-border py-2 ${
                        isToday ? "px-2 rounded-lg bg-veg/10" : ""
                      }`}
                    >
                      <Text
                        className={`font-sans text-sm ${isToday ? "font-headline-semibold text-veg" : "text-primary-dark"}`}
                      >
                        {label}
                      </Text>
                      <Text
                        className={`font-sans text-sm ${isToday ? "font-headline-semibold text-veg" : "text-primary-dark"}`}
                      >
                        {row && !row.is_closed ? `${formatHour(row.open_time)} - ${formatHour(row.close_time)}` : "Closed"}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text className="font-sans text-sm text-primary-dark">Hours not set yet.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!expandedBannerUrl}
        animationType="fade"
        transparent
        onRequestClose={() => setExpandedBannerUrl(null)}
      >
        <Pressable onPress={() => setExpandedBannerUrl(null)} className="flex-1 items-center justify-center bg-black/90 px-4">
          {expandedBannerUrl ? (
            <Image
              source={{ uri: expandedBannerUrl }}
              style={{ width: "100%", aspectRatio: 3 }}
              resizeMode="contain"
            />
          ) : null}
          <Pressable
            onPress={() => setExpandedBannerUrl(null)}
            hitSlop={8}
            className="absolute right-5 top-14 h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>

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
                    // Sized to the exact 1200x400 (3:1) ratio the vendor
                    // upload UI recommends, so "cover" fills the box without
                    // cropping any of the banner's design off the sides —
                    // a narrower box (the old h-28 w-72) was cutting edges.
                    <Pressable onPress={() => setExpandedBannerUrl(banner.image_url)} className="active:opacity-90">
                      <Image
                        source={{ uri: banner.image_url }}
                        style={{ height: 120, width: 360 }}
                        className="rounded-xl bg-background"
                        resizeMode="cover"
                      />
                    </Pressable>
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
            <MenuItemCard item={item} restaurantId={restaurant.id} restaurantName={restaurant.name} />
          )}
        />
        </View>
      </View>
    </ScreenContainer>
  );
}
