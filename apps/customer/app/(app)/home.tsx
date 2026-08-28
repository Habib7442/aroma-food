import { Ionicons } from "@expo/vector-icons";
import { Wordmark } from "@zaavo/ui";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

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
      {/* Full-bleed hero block — deliberately edge-to-edge, no side margins
          or rounding (per the reference sketch): this stands in for PRD
          §6.6's "promo banner carousel," which is really an admin-managed
          platform ad slot. There's no platform_banners-style table and no
          admin UI (apps/admin isn't scaffolded) to manage one yet, so this
          is a single hardcoded block, not a carousel — swap the whole
          section out once that groundwork exists, don't extend it in place. */}
      <View className="bg-primary px-5 pb-5 pt-4">
        <Wordmark height={28} color="#FAF8F5" />
        <Text className="mt-4 font-headline-semibold text-base text-white">Fresh flavors, delivered fast</Text>
      </View>

      <View className="border-b border-border" />

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
          data={restaurants ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 }}
          ItemSeparatorComponent={() => <View className="h-4" />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="font-sans text-sm text-primary-dark">No restaurants yet.</Text>
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
