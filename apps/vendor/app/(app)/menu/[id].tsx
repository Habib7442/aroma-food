import { formatPaise, maxPackagingChargePaise, rupeesToPaise, type DietType } from "@zaavo/shared";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, Text, TextInput, View } from "react-native";

import { AvailabilityPicker } from "../../../components/AvailabilityPicker";
import { Button } from "../../../components/Button";
import { ImageSizeHint } from "../../../components/ImageSizeHint";
import { PendingSetupNotice } from "../../../components/PendingSetupNotice";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { TextField } from "../../../components/TextField";
import { DIET_OPTIONS, GST_OPTIONS } from "../../../lib/dietOptions";
import { describeAvailability, getAvailabilityStatus, isEffectivelyAvailable } from "../../../lib/availability";
import { getImageSizeLabel, useImageUpload } from "../../../lib/useImageUpload";
import { useCreateMenuCategory, useDeleteMenuCategory, useMenuCategories } from "../../../lib/useMenuCategories";
import { useRestaurant } from "../../../lib/useRestaurant";
import { useSupabase } from "../../../lib/supabase";

const AVAILABILITY_BADGE_STYLES = {
  live: { badge: "bg-emerald-50 border-emerald-300", text: "text-emerald-800" },
  scheduled: { badge: "bg-amber-50 border-amber-300", text: "text-amber-800" },
  paused: { badge: "bg-gray-100 border-gray-300", text: "text-gray-600" },
} as const;

export default function MenuItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { data: restaurant, isLoading: isRestaurantLoading } = useRestaurant();
  const restaurantId = restaurant?.id;

  const { data: existing, isLoading: isItemLoading, error: itemError } = useQuery({
    queryKey: ["menu-item", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceRupees, setPriceRupees] = useState("");
  const [dietType, setDietType] = useState<DietType | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [unavailableUntil, setUnavailableUntil] = useState<string | null>(null);
  const [isAvailabilityPickerVisible, setIsAvailabilityPickerVisible] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [gstRateBps, setGstRateBps] = useState(500);
  const [packagingChargeRupees, setPackagingChargeRupees] = useState("0");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const { data: categories } = useMenuCategories(restaurantId);
  const createCategory = useCreateMenuCategory(restaurantId);
  const deleteCategory = useDeleteMenuCategory(restaurantId);
  const { pickAndUpload, deleteExisting, isUploading } = useImageUpload();

  const packagingCapPaise = maxPackagingChargePaise(rupeesToPaise(Number(priceRupees) || 0));

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setDescription(existing.description ?? "");
    setPriceRupees((existing.price_paise / 100).toString());
    setDietType(existing.diet_type);
    setIsAvailable(existing.is_available);
    setUnavailableUntil(existing.unavailable_until);
    setCategoryId(existing.category_id);
    setGstRateBps(existing.gst_rate_bps);
    setPackagingChargeRupees((existing.packaging_charge_paise / 100).toString());
    setImageUrl(existing.image_url);
    setThumbnailUrl(existing.thumbnail_url);
  }, [existing]);

  // Independent of the "Save Changes" button below — a photo upload takes a
  // few seconds (pick, compress, presign, upload), and the vendor should see
  // it land immediately rather than wait for an unrelated form save.
  const onPickImage = async () => {
    if (!restaurantId || isNew) return;
    setImageError(null);
    const previousImageUrl = imageUrl;
    const previousThumbnailUrl = thumbnailUrl;
    try {
      const uploaded = await pickAndUpload({ restaurantId, entityType: "menu", entityId: id });
      if (!uploaded) return;

      const { error } = await supabase
        .from("menu_items")
        .update({ image_url: uploaded.fullUrl, thumbnail_url: uploaded.thumbnailUrl })
        .eq("id", id)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;

      setImageUrl(uploaded.fullUrl);
      setThumbnailUrl(uploaded.thumbnailUrl);
      // This screen's own detail query, "menu-item" — not just the list
      // query below — otherwise navigating back to this same dish serves
      // the cached pre-upload copy (no image) until a full app reload.
      queryClient.invalidateQueries({ queryKey: ["menu-item", id] });
      queryClient.invalidateQueries({ queryKey: ["menu-items", restaurantId] });
      deleteExisting(restaurantId, [previousImageUrl, previousThumbnailUrl]);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Couldn't upload this photo. Please try again.");
    }
  };

  const onAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    // Category names are unique case-insensitively (DB-enforced too, but
    // checking here first avoids a round-trip and lets us tell the vendor
    // exactly what happened instead of just failing silently).
    const existingMatch = (categories ?? []).find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existingMatch) {
      Alert.alert("Category already exists", `"${existingMatch.name}" is already in your category list — selected it for you.`);
      setCategoryId(existingMatch.id);
      setNewCategoryName("");
      return;
    }

    createCategory.mutate(trimmed, {
      onSuccess: (category) => {
        setCategoryId(category.id);
        setNewCategoryName("");
      },
      onError: (error) => {
        Alert.alert("Couldn't add category", error instanceof Error ? error.message : "Please try again.");
      },
    });
  };

  const onDeleteCategory = (category: { id: string; name: string }) => {
    Alert.alert(
      "Delete this category?",
      `"${category.name}" will be removed. Dishes using it will become uncategorized, not deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCategory.mutate(category.id, {
              onSuccess: () => {
                if (categoryId === category.id) setCategoryId(null);
              },
              onError: (error) => {
                Alert.alert("Couldn't delete category", error instanceof Error ? error.message : "Please try again.");
              },
            });
          },
        },
      ],
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurant record not ready. Please try again.");
      if (!dietType) throw new Error("Choose a diet type.");
      const trimmedPrice = priceRupees.trim();
      const parsedRupees = Number(trimmedPrice);
      if (!name.trim() || !trimmedPrice || !Number.isFinite(parsedRupees) || parsedRupees <= 0) {
        throw new Error("Enter a valid name and price.");
      }
      const parsedPackagingRupees = Number(packagingChargeRupees.trim() || "0");
      if (!Number.isFinite(parsedPackagingRupees) || parsedPackagingRupees < 0) {
        throw new Error("Enter a valid packaging charge.");
      }
      const pricePaise = rupeesToPaise(parsedRupees);
      const packagingChargePaise = rupeesToPaise(parsedPackagingRupees);
      const packagingCap = maxPackagingChargePaise(pricePaise);
      if (packagingChargePaise > packagingCap) {
        throw new Error(`Packaging charge can't exceed ${formatPaise(packagingCap)} for a ${formatPaise(pricePaise)} dish.`);
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price_paise: pricePaise,
        diet_type: dietType,
        is_available: isAvailable,
        unavailable_until: unavailableUntil,
        category_id: categoryId,
        gst_rate_bps: gstRateBps,
        packaging_charge_paise: packagingChargePaise,
      };

      if (isNew) {
        const { error } = await supabase
          .from("menu_items")
          .insert({ ...payload, restaurant_id: restaurantId });
        if (error) throw error;
      } else {
        const { data: updated, error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", id)
          .eq("restaurant_id", restaurantId)
          .select("id");
        if (error) throw error;
        if (!updated || updated.length === 0) {
          throw new Error("Item could not be updated. It may have been deleted or modified by another user.");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-item", id] });
      queryClient.invalidateQueries({ queryKey: ["menu-items", restaurantId] });
      router.back();
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Couldn't save this item.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurant record not ready. Please try again.");
      const { data: deleted, error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id)
        .eq("restaurant_id", restaurantId)
        .select("id");
      if (error) throw error;
      if (!deleted || deleted.length === 0) {
        throw new Error("Item could not be deleted. It may have already been removed.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items", restaurantId] });
      router.back();
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Couldn't delete this item.");
    },
  });

  const onAvailabilitySwitchChange = (next: boolean) => {
    if (next) {
      setIsAvailable(true);
      setUnavailableUntil(null);
    } else {
      setIsAvailabilityPickerVisible(true);
    }
  };

  const onConfirmAvailabilityPause = (until: string | null) => {
    setIsAvailabilityPickerVisible(false);
    setIsAvailable(false);
    setUnavailableUntil(until);
  };

  const onDelete = () => {
    Alert.alert("Delete this dish?", `"${name}" will be removed from your menu. This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  };

  if (isRestaurantLoading || (!isNew && isItemLoading)) {
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

  if (!isNew && (itemError || !existing)) {
    return (
      <ScreenContainer center centerVertical>
        <View className="w-full max-w-[480px] items-center">
          <View className="w-full rounded-2xl border border-border bg-card p-8 items-center justify-center gap-4 shadow-sm">
            <View className="w-14 h-14 rounded-full bg-red-50 border border-red-200 items-center justify-center">
              <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
            </View>
            <View className="items-center gap-1">
              <Text className="text-xl font-rubik-bold text-primary text-center">
                Dish Not Found
              </Text>
              <Text className="font-sans text-sm text-[#5A6357] text-center max-w-[300px]">
                The dish you are trying to edit may have been deleted or is no longer available.
              </Text>
            </View>
            <Button
              label="Back to Menu Catalog"
              onPress={() => router.back()}
              variant="secondary"
              icon={<Ionicons name="arrow-back" size={18} color="#1D4626" />}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }


  return (
    <ScreenContainer scroll center>
      <View className="w-full max-w-[480px] items-center">
        {/* Custom Header Bar inside card container */}
        <View className="w-full mb-4 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-card border border-border shadow-sm items-center justify-center active:opacity-70"
          >
            <Ionicons name="arrow-back" size={20} color="#1D4626" />
          </Pressable>

          <View className="flex-1">
            <Text className="text-2xl font-rubik-bold text-primary">
              {isNew ? "Add Menu Item" : "Edit Menu Item"}
            </Text>
            <Text className="font-sans text-xs text-[#5A6357]">
              {isNew ? "Create a new dish for your store catalog" : "Update item pricing & availability"}
            </Text>
          </View>
        </View>

        {/* Main Centered Form Card */}
        <View className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm gap-5">
          {!isNew ? (
            <View className="gap-2">
              <Text className="font-rubik-medium text-xs uppercase tracking-wider text-primary">Dish Photo</Text>
              <Pressable
                onPress={onPickImage}
                disabled={isUploading}
                className="w-full aspect-square rounded-xl border border-border bg-background items-center justify-center overflow-hidden"
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: thumbnailUrl ?? imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View className="items-center gap-2">
                    <Ionicons name="camera-outline" size={32} color="#8A8578" />
                    <Text className="font-sans text-xs text-[#5A6357]">Tap to add a photo</Text>
                  </View>
                )}
                {isUploading ? (
                  <View className="absolute inset-0 bg-black/40 items-center justify-center">
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : imageUrl ? (
                  <View className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1.5 flex-row items-center gap-1">
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                    <Text className="font-rubik-medium text-[11px] text-white">Change</Text>
                  </View>
                ) : null}
              </Pressable>
              <ImageSizeHint label={getImageSizeLabel("menu")} />
              {imageError ? <Text className="font-sans text-xs text-non-veg">{imageError}</Text> : null}
            </View>
          ) : (
            <View className="rounded-xl border border-border bg-background p-4 flex-row items-center gap-2">
              <Ionicons name="information-circle-outline" size={18} color="#5A6357" />
              <Text className="flex-1 font-sans text-xs text-[#5A6357]">
                Save this dish first, then you can add a photo.
              </Text>
            </View>
          )}

          <TextField
            label="Item Name"
            placeholder="e.g. Chicken Hyderabadi Biryani"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <TextField
            label="Description"
            placeholder="e.g. Aromatic basmati rice cooked with tender chicken and authentic spices"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View className="gap-2">
            <TextField
              label="Price (₹)"
              placeholder="e.g. 299"
              value={priceRupees}
              onChangeText={setPriceRupees}
              keyboardType="decimal-pad"
            />
            {priceRupees && !Number.isNaN(Number(priceRupees)) ? (
              <View className="self-start flex-row items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1">
                <Ionicons name="pricetag-outline" size={14} color="#059669" />
                <Text className="font-mono text-xs font-rubik-medium text-emerald-800">
                  Formatted: {formatPaise(rupeesToPaise(Number(priceRupees)))}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Diet Type Pills */}
          <View className="gap-2">
            <Text className="font-rubik-medium text-xs uppercase tracking-wider text-primary">
              Dietary Category
            </Text>
            <View className="flex-row gap-2">
              {DIET_OPTIONS.map((option) => {
                const isSelected = dietType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setDietType(option.value)}
                    className={`min-h-[50px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 transition-all ${
                      isSelected
                        ? `${option.activeBg} ${option.activeBorder}`
                        : "border-border bg-background"
                    }`}
                  >
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={isSelected ? option.activeIconColor : "#5A6357"}
                    />
                    <Text
                      className={
                        isSelected
                          ? `font-rubik-bold text-sm ${option.activeText}`
                          : "font-rubik-medium text-sm text-[#5A6357]"
                      }
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Category Picker */}
          <View className="gap-2">
            <Text className="font-rubik-medium text-xs uppercase tracking-wider text-primary">
              Category
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(categories ?? []).map((category) => {
                const isSelected = categoryId === category.id;
                return (
                  <View
                    key={category.id}
                    className={`flex-row items-center rounded-full border pl-3 pr-1 py-1 gap-1.5 ${
                      isSelected ? "bg-[#1D4626] border-[#1D4626]" : "border-border bg-background"
                    }`}
                  >
                    <Pressable onPress={() => setCategoryId(isSelected ? null : category.id)} hitSlop={4}>
                      <Text
                        className={
                          isSelected ? "font-rubik-bold text-xs text-white" : "font-rubik-medium text-xs text-[#5A6357]"
                        }
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDeleteCategory(category)}
                      hitSlop={8}
                      className={`w-5 h-5 rounded-full items-center justify-center ${
                        isSelected ? "bg-white/20" : "bg-black/5"
                      }`}
                    >
                      <Ionicons name="close" size={12} color={isSelected ? "#FFFFFF" : "#8A8578"} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <View className="flex-row items-center gap-2">
              <TextInput
                className="flex-1 min-h-[44px] rounded-xl border border-border bg-[#F9FAF4]/60 px-3 font-sans text-sm text-primary"
                placeholder="New category name"
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
          </View>

          {/* GST + Packaging Charge */}
          <View className="flex-row gap-4">
            <View className="flex-1 gap-2">
              <Text className="font-rubik-medium text-xs uppercase tracking-wider text-primary">GST</Text>
              <View className="flex-row gap-2">
                {GST_OPTIONS.map((option) => {
                  const isSelected = gstRateBps === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setGstRateBps(option.value)}
                      className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border ${
                        isSelected ? "bg-[#1D4626] border-[#1D4626]" : "border-border bg-background"
                      }`}
                    >
                      <Text
                        className={
                          isSelected ? "font-rubik-bold text-sm text-white" : "font-rubik-medium text-sm text-[#5A6357]"
                        }
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View className="flex-1 gap-1.5">
              <TextField
                label="Packaging (₹)"
                placeholder="0"
                value={packagingChargeRupees}
                onChangeText={setPackagingChargeRupees}
                keyboardType="decimal-pad"
              />
              <Text
                className={`font-sans text-[10px] ${
                  rupeesToPaise(Number(packagingChargeRupees) || 0) > packagingCapPaise ? "text-non-veg" : "text-[#5A6357]"
                }`}
              >
                Max {formatPaise(packagingCapPaise)} for this price
              </Text>
            </View>
          </View>

          {/* Availability Toggle Box */}
          <View className="flex-row items-center justify-between rounded-xl border border-border bg-background p-4 gap-3">
            <View className="flex-1 gap-1">
              <Text className="font-rubik-semibold text-sm text-primary">Available on Menu</Text>
              <View
                className={`self-start rounded-full px-2 py-0.5 border ${
                  AVAILABILITY_BADGE_STYLES[
                    getAvailabilityStatus({ is_available: isAvailable, unavailable_until: unavailableUntil })
                  ].badge
                }`}
              >
                <Text
                  className={`text-[10px] font-rubik-bold ${
                    AVAILABILITY_BADGE_STYLES[
                      getAvailabilityStatus({ is_available: isAvailable, unavailable_until: unavailableUntil })
                    ].text
                  }`}
                >
                  {describeAvailability({ is_available: isAvailable, unavailable_until: unavailableUntil }).toUpperCase()}
                </Text>
              </View>
              <Text className="font-sans text-xs text-[#5A6357]">
                Customers can order this dish when turned on.
              </Text>
            </View>
            <Switch
              value={isEffectivelyAvailable({ is_available: isAvailable, unavailable_until: unavailableUntil })}
              onValueChange={onAvailabilitySwitchChange}
              trackColor={{ true: "#1D4626", false: "#D1D5DB" }}
            />
          </View>

          <AvailabilityPicker
            visible={isAvailabilityPickerVisible}
            itemName={name || "This dish"}
            onCancel={() => setIsAvailabilityPickerVisible(false)}
            onConfirm={onConfirmAvailabilityPause}
          />

          {formError ? (
            <View className="rounded-lg bg-red-50 p-3 border border-red-200">
              <Text className="font-sans text-xs text-non-veg">{formError}</Text>
            </View>
          ) : null}

          <Button
            label={isNew ? "Add Dish to Catalog" : "Save Changes"}
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            icon={
              isNew ? (
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              )
            }
          />

          {!isNew ? (
            <Button
              label="Delete Dish"
              onPress={onDelete}
              loading={deleteMutation.isPending}
              variant="secondary"
              icon={<Ionicons name="trash-outline" size={20} color="#A52A2A" />}
            />
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}


