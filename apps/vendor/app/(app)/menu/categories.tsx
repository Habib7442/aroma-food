import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";

import { ImageSizeHint } from "../../../components/ImageSizeHint";
import { PendingSetupNotice } from "../../../components/PendingSetupNotice";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { getImageSizeLabel, useImageUpload } from "../../../lib/useImageUpload";
import {
  useCreateMenuCategory,
  useDeleteMenuCategory,
  useMenuCategories,
  useUpdateMenuCategoryImage,
  type MenuCategory,
} from "../../../lib/useMenuCategories";
import { useRestaurant } from "../../../lib/useRestaurant";

function CategoryRow({
  category,
  restaurantId,
  onDelete,
}: {
  category: MenuCategory;
  restaurantId: string;
  onDelete: () => void;
}) {
  const { pickAndUpload, deleteExisting, isUploading } = useImageUpload();
  const updateImage = useUpdateMenuCategoryImage(restaurantId);
  const [error, setError] = useState<string | null>(null);

  const onPickImage = async () => {
    setError(null);
    try {
      const uploaded = await pickAndUpload({ restaurantId, entityType: "categories", entityId: category.id });
      if (!uploaded) return;
      await updateImage.mutateAsync({
        categoryId: category.id,
        imageUrl: uploaded.fullUrl,
        thumbnailUrl: uploaded.thumbnailUrl,
      });
      deleteExisting(restaurantId, [category.image_url, category.thumbnail_url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload this photo.");
    }
  };

  return (
    <View className="w-full rounded-xl border border-border bg-card p-3 gap-2">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onPickImage}
          disabled={isUploading}
          className="w-14 h-14 rounded-lg border border-border bg-background items-center justify-center overflow-hidden"
        >
          {category.thumbnail_url || category.image_url ? (
            <Image
              source={{ uri: category.thumbnail_url ?? category.image_url! }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Ionicons name="camera-outline" size={20} color="#8A8578" />
          )}
          {isUploading ? (
            <View className="absolute inset-0 bg-black/40 items-center justify-center">
              <ActivityIndicator color="#FFFFFF" size="small" />
            </View>
          ) : null}
        </Pressable>
        <Text className="flex-1 font-rubik-semibold text-sm text-primary">{category.name}</Text>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          className="w-9 h-9 rounded-full bg-red-50 border border-red-200 items-center justify-center"
        >
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
        </Pressable>
      </View>
      {error ? <Text className="font-sans text-[10px] text-non-veg">{error}</Text> : null}
    </View>
  );
}

export default function ManageCategoriesScreen() {
  const { data: restaurant, isLoading: isRestaurantLoading } = useRestaurant();
  const restaurantId = restaurant?.id;
  const { data: categories, isLoading } = useMenuCategories(restaurantId);
  const createCategory = useCreateMenuCategory(restaurantId);
  const deleteCategory = useDeleteMenuCategory(restaurantId);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const onAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setFormError(null);
    createCategory.mutate(trimmed, {
      onSuccess: () => setNewCategoryName(""),
      onError: (error) => setFormError(error instanceof Error ? error.message : "Couldn't add category."),
    });
  };

  const onDeleteCategory = (category: MenuCategory) => {
    Alert.alert(
      "Delete this category?",
      `"${category.name}" will be removed. Dishes using it will become uncategorized, not deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteCategory.mutate(category.id) },
      ],
    );
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
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-card border border-border shadow-sm items-center justify-center active:opacity-70"
          >
            <Ionicons name="arrow-back" size={20} color="#1D4626" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-rubik-bold text-primary">Manage Categories</Text>
            <Text className="font-sans text-xs text-[#5A6357]">Add a photo, rename, or remove a category</Text>
          </View>
        </View>

        <View className="w-full rounded-xl border border-border bg-card p-4 shadow-sm gap-2 mb-4">
          <Text className="font-rubik-medium text-xs uppercase tracking-wider text-primary">Add a category</Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              className="flex-1 min-h-[44px] rounded-xl border border-border bg-[#F9FAF4]/60 px-3 font-sans text-sm text-primary"
              placeholder="e.g. Beverages"
              placeholderTextColor="#8A8578"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoCapitalize="words"
            />
            <Pressable
              onPress={onAddCategory}
              disabled={!newCategoryName.trim() || createCategory.isPending}
              className={`min-h-[44px] rounded-xl border border-[#1D4626] px-4 items-center justify-center ${
                !newCategoryName.trim() || createCategory.isPending ? "opacity-50" : ""
              }`}
            >
              <Text className="font-rubik-semibold text-xs text-[#1D4626]">
                {createCategory.isPending ? "Adding..." : "+ Add"}
              </Text>
            </Pressable>
          </View>
          {formError ? <Text className="font-sans text-xs text-non-veg">{formError}</Text> : null}
          <Text className="font-sans text-[11px] text-[#5A6357]">Tap a category's photo below to add or change it.</Text>
          <ImageSizeHint label={getImageSizeLabel("categories")} />
        </View>

        {isLoading ? (
          <ActivityIndicator color="#1D4626" />
        ) : (
          <View className="w-full gap-2">
            {(categories ?? []).length === 0 ? (
              <View className="w-full rounded-2xl border border-border bg-card p-8 items-center justify-center gap-2">
                <Ionicons name="pricetags-outline" size={28} color="#8A8578" />
                <Text className="font-sans text-xs text-[#5A6357] text-center">No categories yet — add one above.</Text>
              </View>
            ) : (
              (categories ?? []).map((category) =>
                restaurantId ? (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    restaurantId={restaurantId}
                    onDelete={() => onDeleteCategory(category)}
                  />
                ) : null,
              )
            )}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
