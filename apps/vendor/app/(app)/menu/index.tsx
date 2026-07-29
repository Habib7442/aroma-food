import { formatPaise, type DietType } from "@zaavo/shared";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "../../../components/Button";
import { DietBadge } from "../../../components/DietBadge";
import { PendingSetupNotice } from "../../../components/PendingSetupNotice";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { useMenuCategories } from "../../../lib/useMenuCategories";
import { useRestaurant } from "../../../lib/useRestaurant";
import { useSupabase } from "../../../lib/supabase";

interface MenuItemRow {
  id: string;
  name: string;
  price_paise: number;
  diet_type: DietType;
  is_available: boolean;
  category_id: string | null;
}

interface MenuSection {
  id: string;
  title: string;
  data: MenuItemRow[];
}

const UNCATEGORIZED_SECTION_ID = "uncategorized";

// Memoized so scrolling/refreshing/re-rendering the list doesn't re-render
// every mounted row — only rows whose own item data actually changed.
// Two more per-row costs cut here since a plain "large list" warning turns
// into a real bottleneck at a few hundred rows: `transition-all` (NativeWind
// implements Tailwind transitions via Reanimated — reading a shared value
// per row adds up), and `Link asChild` (resolves against the router's state
// on every mount; a plain Pressable + imperative router.push() skips that
// entirely). `shadow-sm` is also gone — Android's elevation-based shadow is
// genuinely expensive to composite per view, and border-only still reads
// fine here for a list row.
const MenuItemRowCard = memo(function MenuItemRowCard({ item }: { item: MenuItemRow }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(app)/menu/[id]", params: { id: item.id } })}
      className={`w-full flex-row items-center justify-between rounded-2xl border p-4 ${
        item.is_available ? "bg-card border-border active:bg-gray-50" : "bg-red-50 border-red-300 active:bg-red-100"
      }`}
    >
      <View className="flex-1 pr-3 gap-1.5">
        <Text numberOfLines={1} className="text-base font-rubik-semibold text-primary">
          {item.name}
        </Text>
        <View className="flex-row items-center gap-2">
          <DietBadge dietType={item.diet_type} />
          <View
            className={`rounded-full px-2 py-0.5 border ${
              item.is_available ? "bg-emerald-50 border-emerald-200" : "bg-red-100 border-red-300"
            }`}
          >
            <Text
              className={`text-[10px] font-rubik-bold ${
                item.is_available ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {item.is_available ? "LIVE" : "PAUSED"}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        <View className="rounded-xl bg-emerald-50/70 border border-emerald-200 px-3 py-1.5">
          <Text className="font-mono text-sm font-rubik-bold text-emerald-900">
            {formatPaise(item.price_paise)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8A8578" />
      </View>
    </Pressable>
  );
});

function useSkeletonPulse() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

function SkeletonRow() {
  return (
    <View className="w-full rounded-2xl border border-border bg-card p-4 flex-row items-center justify-between">
      <View className="flex-1 pr-3 gap-2">
        <View className="h-4 w-3/4 rounded-md bg-gray-200" />
        <View className="h-4 w-20 rounded-full bg-gray-200" />
      </View>
      <View className="h-8 w-16 rounded-xl bg-gray-200" />
    </View>
  );
}

function MenuSkeletonList() {
  const opacity = useSkeletonPulse();
  return (
    <Animated.View style={{ opacity }} className="w-full gap-3">
      <View className="h-3 w-24 rounded-md bg-gray-200 mb-1" />
      <SkeletonRow />
      <SkeletonRow />
      <View className="h-3 w-28 rounded-md bg-gray-200 mb-1 mt-2" />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </Animated.View>
  );
}

export default function MenuListScreen() {
  const supabase = useSupabase();
  const { data: restaurant, isLoading: isRestaurantLoading } = useRestaurant();
  const restaurantId = restaurant?.id;
  const { data: categories, refetch: refetchCategories } = useMenuCategories(restaurantId);

  // Restaurants realistically top out in the low hundreds of dishes — with
  // only 6 narrow columns selected, even 300+ rows is a tiny (~20-30KB),
  // cheap-for-Postgres payload. True server-side pagination would also fight
  // the category grouping below (you'd need every page loaded to group
  // correctly), so a single fetch + client-side virtualization (SectionList
  // below only renders what's on screen) is the simpler, still-safe choice.
  const {
    data: items,
    isLoading,
    isRefetching,
    error,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ["menu-items", restaurantId],
    queryFn: async (): Promise<MenuItemRow[]> => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, price_paise, diet_type, is_available, category_id")
        .eq("restaurant_id", restaurantId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  const onRefresh = () => {
    refetchItems();
    refetchCategories();
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Filtering is client-side (everything's already in memory), so the
  // debounce isn't about cutting network calls — it's about not re-running
  // the filter + SectionList re-render on every single keystroke across a
  // few hundred items, which is exactly the kind of per-keystroke jank the
  // earlier VirtualizedList perf work was fixing.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Grouped by category and virtualized (SectionList only renders what's on
  // screen) — a single flat ScrollView.map() of a few hundred imported
  // dishes would mount every row at once and lag or crash on-device.
  const sections = useMemo<MenuSection[]>(() => {
    if (!items || items.length === 0) return [];

    const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const query = debouncedSearchQuery;
    const filteredItems = query
      ? items.filter((item) => {
          const categoryName = item.category_id ? (categoryNameById.get(item.category_id) ?? "") : "uncategorized";
          return item.name.toLowerCase().includes(query) || categoryName.toLowerCase().includes(query);
        })
      : items;

    const byCategory = new Map<string, MenuItemRow[]>();
    for (const item of filteredItems) {
      const key = item.category_id ?? UNCATEGORIZED_SECTION_ID;
      const bucket = byCategory.get(key);
      if (bucket) bucket.push(item);
      else byCategory.set(key, [item]);
    }

    // Unavailable dishes surface at the top of their own category so a
    // vendor scanning the list spots what's paused first — Array.sort is
    // stable, so the alphabetical order from the query is preserved within
    // each availability group.
    for (const bucket of byCategory.values()) {
      bucket.sort((a, b) => Number(a.is_available) - Number(b.is_available));
    }

    const result: MenuSection[] = [];
    for (const category of categories ?? []) {
      const bucket = byCategory.get(category.id);
      if (bucket && bucket.length > 0) {
        result.push({ id: category.id, title: category.name, data: bucket });
      }
    }
    const uncategorized = byCategory.get(UNCATEGORIZED_SECTION_ID);
    if (uncategorized && uncategorized.length > 0) {
      result.push({ id: UNCATEGORIZED_SECTION_ID, title: "Uncategorized", data: uncategorized });
    }
    return result;
  }, [items, categories, debouncedSearchQuery]);

  // Stable references so SectionList/VirtualizedList doesn't treat every
  // render as a reason to re-evaluate already-mounted rows and headers.
  const keyExtractor = useCallback((item: MenuItemRow) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: MenuItemRow }) => (
      <View className="pb-3">
        <MenuItemRowCard item={item} />
      </View>
    ),
    [],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: MenuSection }) => (
      <View className="w-full flex-row items-center justify-between bg-background pb-2 pt-1">
        <Text className="font-rubik-bold text-xs uppercase tracking-wider text-primary">{section.title}</Text>
        <View className="rounded-full bg-emerald-100 px-2 py-0.5 border border-emerald-300">
          <Text className="text-[10px] font-rubik-bold text-emerald-900">{section.data.length}</Text>
        </View>
      </View>
    ),
    [],
  );

  if (isRestaurantLoading) {
    return (
      <ScreenContainer center centerVertical>
        <ActivityIndicator color="#1D4626" size="large" />
      </ScreenContainer>
    );
  }

  if (!restaurant) {
    return (
      <ScreenContainer center centerVertical>
        <PendingSetupNotice />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer center>
      <View className="w-full max-w-[480px] flex-1">
        <View className="w-full mb-5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
              <Ionicons name="restaurant" size={20} color="#1D4626" />
            </View>
            <View>
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl font-rubik-bold text-primary">Menu Catalog</Text>
                {!isLoading ? (
                  <View className="rounded-full bg-emerald-100 px-2 py-0.5 border border-emerald-300">
                    <Text className="text-xs font-rubik-bold text-emerald-900">{items?.length || 0}</Text>
                  </View>
                ) : null}
              </View>
              <Text className="font-sans text-xs text-[#5A6357]">Manage dishes, pricing and availability</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/(app)/menu/categories")}
            className="w-10 h-10 rounded-full bg-card border border-border shadow-sm items-center justify-center active:opacity-70"
          >
            <Ionicons name="pricetags-outline" size={18} color="#1D4626" />
          </Pressable>
        </View>

        <View className="w-full mb-4 gap-2">
          <Button
            label="Add New Menu Item"
            onPress={() => router.push("/(app)/menu/new")}
            icon={<Ionicons name="add-circle" size={20} color="#FFFFFF" />}
          />
          <Button
            label="Import from PDF"
            onPress={() => router.push("/(app)/menu/import")}
            variant="secondary"
            icon={<Ionicons name="document-attach-outline" size={20} color="#1D4626" />}
          />
        </View>

        {!isLoading && (items?.length ?? 0) > 0 ? (
          <View className="w-full mb-4 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-1">
            <Ionicons name="search-outline" size={18} color="#8A8578" />
            <TextInput
              className="flex-1 min-h-[44px] font-sans text-sm text-primary"
              placeholder="Search by dish name or category"
              placeholderTextColor="#8A8578"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#8A8578" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <View className="w-full rounded-xl bg-red-50 p-4 border border-red-200 mb-4">
            <Text className="font-sans text-xs text-non-veg text-center">Couldn&apos;t load your menu items.</Text>
          </View>
        ) : null}

        {isLoading ? (
          <MenuSkeletonList />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            // Rows are cheap now (memoized, no transition-*, no Link, no
            // shadow — see MenuItemRowCard), so there's room for a wider
            // buffer around the viewport instead of squeezing windowSize
            // down: a small window makes fast scrolling outrun the render
            // batches, which shows up as a blank flash instead of a card.
            // removeClippedSubviews is deliberately left off: it's a known
            // source of exactly that blank/disappearing-item bug on Android.
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={12}
            updateCellsBatchingPeriod={30}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#1D4626" colors={["#1D4626"]} />
            }
            ListEmptyComponent={
              !error ? (
                debouncedSearchQuery ? (
                  <View className="w-full rounded-2xl border border-border bg-card p-8 items-center justify-center gap-3 shadow-sm">
                    <View className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200 items-center justify-center">
                      <Ionicons name="search-outline" size={28} color="#8A8578" />
                    </View>
                    <Text className="text-lg font-rubik-semibold text-primary text-center">No matching dishes</Text>
                    <Text className="font-sans text-xs text-[#5A6357] text-center max-w-[260px]">
                      Nothing matches &quot;{searchQuery}&quot; by name or category.
                    </Text>
                    <Button
                      label="Clear Search"
                      onPress={() => setSearchQuery("")}
                      variant="secondary"
                      icon={<Ionicons name="close" size={18} color="#1D4626" />}
                    />
                  </View>
                ) : (
                  <View className="w-full rounded-2xl border border-border bg-card p-8 items-center justify-center gap-3 shadow-sm">
                    <View className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
                      <Ionicons name="restaurant-outline" size={28} color="#1D4626" />
                    </View>
                    <Text className="text-lg font-rubik-semibold text-primary text-center">
                      No dishes in your menu yet
                    </Text>
                    <Text className="font-sans text-xs text-[#5A6357] text-center max-w-[260px]">
                      Create your first dish to start serving customers on the platform.
                    </Text>
                    <Button
                      label="Add Your First Dish"
                      onPress={() => router.push("/(app)/menu/new")}
                      variant="secondary"
                      icon={<Ionicons name="add" size={18} color="#1D4626" />}
                    />
                  </View>
                )
              ) : null
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}
