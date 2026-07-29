import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { ImageSizeHint } from "../../components/ImageSizeHint";
import { PendingSetupNotice } from "../../components/PendingSetupNotice";
import { ScreenContainer } from "../../components/ScreenContainer";
import { generateEntityId, getImageSizeLabel, useImageUpload } from "../../lib/useImageUpload";
import { useRestaurant } from "../../lib/useRestaurant";
import {
  MAX_BANNERS,
  useCreateRestaurantBanner,
  useDeleteRestaurantBanner,
  useRestaurantBanners,
} from "../../lib/useRestaurantBanners";

export default function BannersScreen() {
  const { data: restaurant, isLoading: isRestaurantLoading } = useRestaurant();
  const restaurantId = restaurant?.id;
  const { data: banners, isLoading } = useRestaurantBanners(restaurantId);
  const createBanner = useCreateRestaurantBanner(restaurantId);
  const deleteBanner = useDeleteRestaurantBanner(restaurantId);
  const { pickAndUpload, deleteExisting, isUploading } = useImageUpload();

  const [error, setError] = useState<string | null>(null);

  const bannerCount = banners?.length ?? 0;
  const atCap = bannerCount >= MAX_BANNERS;

  const onAddBanner = async () => {
    if (!restaurantId || atCap) return;
    setError(null);
    try {
      const bannerId = generateEntityId();
      const uploaded = await pickAndUpload({ restaurantId, entityType: "banners", entityId: bannerId });
      if (!uploaded) return;
      await createBanner.mutateAsync({ id: bannerId, imageUrl: uploaded.fullUrl, sortOrder: bannerCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload this banner.");
    }
  };

  const onDeleteBanner = (banner: { id: string; image_url: string }) => {
    Alert.alert("Delete this banner?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteBanner.mutateAsync(banner.id);
          if (restaurantId) deleteExisting(restaurantId, [banner.image_url]);
        },
      },
    ]);
  };

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
    <ScreenContainer scroll center>
      <View className="w-full max-w-[480px] items-center">
        <View className="w-full mb-4 flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
            <Ionicons name="megaphone" size={20} color="#1D4626" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-rubik-bold text-primary">Promo Banners</Text>
            <Text className="font-sans text-xs text-[#5A6357]">
              {bannerCount} of {MAX_BANNERS} used
            </Text>
          </View>
        </View>

        {error ? (
          <View className="w-full rounded-lg bg-red-50 p-3 border border-red-200 mb-4">
            <Text className="font-sans text-xs text-non-veg">{error}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color="#1D4626" />
        ) : (
          <View className="w-full gap-3">
            {(banners ?? []).map((banner) => (
              <View key={banner.id} className="w-full rounded-xl border border-border bg-card p-2 gap-2">
                <View className="w-full aspect-[3/1] rounded-lg overflow-hidden bg-background">
                  <Image
                    source={{ uri: banner.image_url }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </View>
                <Pressable
                  onPress={() => onDeleteBanner(banner)}
                  className="self-end flex-row items-center gap-1 rounded-full bg-red-50 border border-red-200 px-3 py-1.5"
                >
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <Text className="font-rubik-medium text-xs text-non-veg">Delete</Text>
                </Pressable>
              </View>
            ))}

            {!atCap ? (
              <View className="gap-2">
                <Pressable
                  onPress={onAddBanner}
                  disabled={isUploading}
                  className="w-full aspect-[3/1] rounded-xl border border-dashed border-border bg-background items-center justify-center overflow-hidden"
                >
                  {isUploading ? (
                    <ActivityIndicator color="#1D4626" />
                  ) : (
                    <View className="items-center gap-1.5">
                      <Ionicons name="add-circle-outline" size={28} color="#1D4626" />
                      <Text className="font-rubik-semibold text-sm text-primary">Add a Banner</Text>
                    </View>
                  )}
                </Pressable>
                <ImageSizeHint label={getImageSizeLabel("banners")} />
              </View>
            ) : (
              <View className="rounded-xl border border-border bg-background p-4 flex-row items-center gap-2">
                <Ionicons name="information-circle-outline" size={18} color="#5A6357" />
                <Text className="flex-1 font-sans text-xs text-[#5A6357]">
                  You've reached the {MAX_BANNERS}-banner limit. Delete one to add another.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
