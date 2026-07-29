import { useClerk } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { ImageSizeHint } from "../../components/ImageSizeHint";
import { PendingSetupNotice } from "../../components/PendingSetupNotice";
import { ScreenContainer } from "../../components/ScreenContainer";
import { TextField } from "../../components/TextField";
import { getImageSizeLabel, useImageUpload } from "../../lib/useImageUpload";
import { useRestaurant } from "../../lib/useRestaurant";
import { DAY_LABELS, useRestaurantHours, useSaveRestaurantHours, type DayHours } from "../../lib/useRestaurantHours";
import { useSupabase } from "../../lib/supabase";

// One logo per restaurant — a fixed entityId keeps every upload for a given
// restaurant landing on the same versioned path prefix (see
// useImageUpload), so there's only ever one logo object to clean up.
const LOGO_ENTITY_ID = "logo";

function timeStringToDate(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function dateToTimeString(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Basic, deliberately lenient formats — good enough to catch obvious typos
// without rejecting a legitimate landline number or an address entered in a
// slightly different shape.
const PINCODE_REGEX = /^\d{6}$/;
const PHONE_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export default function ProfileScreen() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { data: restaurant, isLoading } = useRestaurant();
  // restaurants.id *is* the Clerk org id by design (see useRestaurant.ts /
  // useEnsureRestaurant's upsert), so this is equivalent to organization?.id
  // whenever restaurant is loaded — deriving it from the fetched row instead
  // matches every other screen (menu/[id].tsx, categories.tsx, banners.tsx).
  const restaurantId = restaurant?.id;
  const { data: hours, isLoading: isHoursLoading, error: hoursError } = useRestaurantHours(restaurantId);
  const saveHours = useSaveRestaurantHours(restaurantId);
  const { pickAndUpload, deleteExisting, isUploading: isLogoUploading } = useImageUpload();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [week, setWeek] = useState<DayHours[]>([]);
  const [timePicker, setTimePicker] = useState<{ dayOfWeek: number; field: "open" | "close" } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setDescription(restaurant.description ?? "");
    setGstin(restaurant.gstin ?? "");
    setAddress(restaurant.address ?? "");
    setLandmark(restaurant.landmark ?? "");
    setPincode(restaurant.pincode ?? "");
    setContactPhone(restaurant.contact_phone ?? "");
    setContactEmail(restaurant.contact_email ?? "");
    setIsOpen(restaurant.is_open);
    setLogoUrl(restaurant.logo_url);
  }, [restaurant]);

  // Independent of "Save Changes" below, same reasoning as the dish-photo
  // upload in menu/[id].tsx — a few-second upload shouldn't wait on an
  // unrelated form save, and the vendor should see it land immediately.
  const onPickLogo = async () => {
    if (!restaurantId) return;
    setLogoError(null);
    const previousUrl = logoUrl;
    try {
      const uploaded = await pickAndUpload({ restaurantId, entityType: "logo", entityId: LOGO_ENTITY_ID });
      if (!uploaded) return;

      const { error } = await supabase.from("restaurants").update({ logo_url: uploaded.fullUrl }).eq("id", restaurantId);
      if (error) throw error;

      setLogoUrl(uploaded.fullUrl);
      queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      deleteExisting(restaurantId, [previousUrl]);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Couldn't upload this logo. Please try again.");
    }
  };

  useEffect(() => {
    if (hours) setWeek(hours);
  }, [hours]);

  const updateDay = (dayOfWeek: number, patch: Partial<DayHours>) => {
    setWeek((prev) => prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)));
  };

  const onCopyToAllDays = (sourceDayOfWeek: number) => {
    const source = week.find((day) => day.dayOfWeek === sourceDayOfWeek);
    if (!source) return;
    setWeek((prev) =>
      prev.map((day) => ({ ...day, isClosed: source.isClosed, openTime: source.openTime, closeTime: source.closeTime })),
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Restaurant name is required.");

      const trimmedAddress = address.trim();
      if (!trimmedAddress) throw new Error("Restaurant address is required.");

      const trimmedPincode = pincode.trim();
      if (!PINCODE_REGEX.test(trimmedPincode)) throw new Error("Enter a valid 6-digit pincode.");

      const trimmedPhone = contactPhone.trim();
      if (!PHONE_REGEX.test(trimmedPhone)) throw new Error("Enter a valid 10-digit contact number.");

      const trimmedEmail = contactEmail.trim();
      if (!EMAIL_REGEX.test(trimmedEmail)) throw new Error("Enter a valid contact email address.");

      const { error } = await supabase
        .from("restaurants")
        .update({
          name: trimmedName,
          description: description.trim() || null,
          gstin: gstin.trim() || null,
          address: trimmedAddress,
          landmark: landmark.trim() || null,
          pincode: trimmedPincode,
          contact_phone: trimmedPhone,
          contact_email: trimmedEmail,
          is_open: isOpen,
        })
        .eq("id", restaurantId!);
      if (error) throw error;

      await saveHours.mutateAsync(week);
    },
    onSuccess: () => {
      setSaved(true);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
    },
    onError: (error) => {
      setSaved(false);
      setFormError(error instanceof Error ? error.message : "Couldn't save your profile.");
    },
  });

  if (isLoading) {
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
        {/* Custom Top Header */}
        <View className="w-full mb-5 flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
            <Ionicons name="storefront" size={20} color="#1D4626" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-rubik-bold text-primary">Restaurant Profile</Text>
            <Text className="font-sans text-xs text-[#5A6357]">
              Manage store details, GSTIN & online status
            </Text>
          </View>
        </View>

        {/* Main Form Card */}
        <View className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm gap-5">
          {/* Store Open/Closed Toggle Card */}
          <View className="flex-row items-center justify-between rounded-xl border border-border bg-background p-4">
            <View className="flex-1 pr-3 gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-rubik-semibold text-sm text-primary">
                  {isOpen ? "Accepting Orders" : "Store Closed"}
                </Text>
                <View
                  className={`rounded-full px-2 py-0.5 border ${
                    isOpen
                      ? "bg-emerald-50 border-emerald-300"
                      : "bg-gray-100 border-gray-300"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-rubik-bold ${
                      isOpen ? "text-emerald-800" : "text-gray-600"
                    }`}
                  >
                    {isOpen ? "LIVE" : "PAUSED"}
                  </Text>
                </View>
              </View>
              <Text className="font-sans text-xs text-[#5A6357]">
                Customers can place orders on the app while store is open.
              </Text>
            </View>
            <Switch
              value={isOpen}
              onValueChange={setIsOpen}
              trackColor={{ true: "#1D4626", false: "#D1D5DB" }}
            />
          </View>

          {/* Restaurant Logo */}
          <View className="gap-2">
            <Text className="font-rubik-medium text-xs uppercase tracking-wider text-primary">Restaurant Logo</Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={onPickLogo}
                disabled={isLogoUploading}
                className="w-20 h-20 rounded-xl border border-border bg-background items-center justify-center overflow-hidden"
              >
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Ionicons name="business-outline" size={24} color="#8A8578" />
                )}
                {isLogoUploading ? (
                  <View className="absolute inset-0 bg-black/40 items-center justify-center">
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  </View>
                ) : null}
              </Pressable>
              <View className="flex-1 gap-1.5">
                <Text className="font-sans text-xs text-[#5A6357]">
                  {logoUrl ? "Tap to change your logo." : "Tap to add your restaurant logo."}
                </Text>
                <ImageSizeHint label={getImageSizeLabel("logo")} />
              </View>
            </View>
            {logoError ? <Text className="font-sans text-xs text-non-veg">{logoError}</Text> : null}
          </View>

          <TextField
            label="Restaurant Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <TextField
            label="Description"
            placeholder="e.g. Authentic biryanis, kebabs and curry delights"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TextField
            label="GSTIN Number"
            placeholder="e.g. 18AABCU9603R1ZM"
            value={gstin}
            onChangeText={setGstin}
            autoCapitalize="characters"
          />

          {/* Contact & Address — required so customers can actually find
              and reach the restaurant. */}
          <View className="gap-4">
            <Text className="font-rubik-medium text-xs uppercase tracking-wider text-primary">
              Contact & Address
            </Text>

            <TextField
              label="Address"
              placeholder="e.g. 2nd Floor, Central Road, Silchar"
              value={address}
              onChangeText={setAddress}
              multiline
            />

            <TextField
              label="Landmark (optional)"
              placeholder="e.g. Near Ambika Cinema"
              value={landmark}
              onChangeText={setLandmark}
            />

            <View className="flex-row gap-4">
              <View className="flex-1">
                <TextField
                  label="Pincode"
                  placeholder="e.g. 788001"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              <View className="flex-1">
                <TextField
                  label="Contact Number"
                  placeholder="e.g. 9435012345"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <TextField
              label="Contact Email"
              placeholder="e.g. habibcafe@example.com"
              value={contactEmail}
              onChangeText={setContactEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Store Hours */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-rubik-medium text-xs uppercase tracking-wider text-primary">Store Hours</Text>
              <Pressable onPress={() => onCopyToAllDays(1)} hitSlop={8}>
                <Text className="font-rubik-medium text-xs text-[#1D4626] underline">Copy Monday to all days</Text>
              </Pressable>
            </View>

            {isHoursLoading ? (
              <ActivityIndicator color="#1D4626" />
            ) : hoursError ? (
              <View className="rounded-lg bg-red-50 p-3 border border-red-200">
                <Text className="font-sans text-xs text-non-veg">
                  Couldn't load store hours. Pull to refresh or try again.
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {week.map((day) => (
                  <View
                    key={day.dayOfWeek}
                    className="flex-row items-center gap-2 rounded-xl border border-border bg-background p-3"
                  >
                    <Text className="w-9 font-rubik-medium text-xs text-primary">
                      {DAY_LABELS[day.dayOfWeek].slice(0, 3)}
                    </Text>
                    <Switch
                      value={!day.isClosed}
                      onValueChange={(value) => updateDay(day.dayOfWeek, { isClosed: !value })}
                      trackColor={{ true: "#1D4626", false: "#D1D5DB" }}
                    />
                    {day.isClosed ? (
                      <Text className="flex-1 text-center font-sans text-xs text-[#5A6357]">Closed</Text>
                    ) : (
                      <View className="flex-1 flex-row items-center gap-1.5">
                        <Pressable
                          onPress={() => setTimePicker({ dayOfWeek: day.dayOfWeek, field: "open" })}
                          className="flex-1 items-center rounded-lg border border-border bg-card px-2 py-2"
                        >
                          <Text className="font-mono text-[11px] text-primary">{formatTimeLabel(day.openTime)}</Text>
                        </Pressable>
                        <Text className="font-sans text-[10px] text-[#5A6357]">to</Text>
                        <Pressable
                          onPress={() => setTimePicker({ dayOfWeek: day.dayOfWeek, field: "close" })}
                          className="flex-1 items-center rounded-lg border border-border bg-card px-2 py-2"
                        >
                          <Text className="font-mono text-[11px] text-primary">{formatTimeLabel(day.closeTime)}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {formError ? (
            <View className="rounded-lg bg-red-50 p-3 border border-red-200">
              <Text className="font-sans text-xs text-non-veg">{formError}</Text>
            </View>
          ) : null}

          {saved && !formError ? (
            <View className="flex-row items-center gap-2 rounded-lg bg-emerald-50 p-3 border border-emerald-200">
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <Text className="font-sans text-xs font-rubik-medium text-emerald-800">
                Profile updated successfully.
              </Text>
            </View>
          ) : null}

          <Button
            label="Save Changes"
            onPress={() => {
              setFormError(null);
              setSaved(false);
              mutation.mutate();
            }}
            loading={mutation.isPending}
            icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
          />

          <View className="border-t border-border pt-4 mt-1">
            <Button
              label="Sign Out"
              onPress={() => signOut()}
              variant="destructive"
              icon={<Ionicons name="log-out-outline" size={18} color="#E11D48" />}
            />
          </View>
        </View>
      </View>

      {timePicker ? (
        <DateTimePicker
          value={timeStringToDate(
            week.find((day) => day.dayOfWeek === timePicker.dayOfWeek)?.[
              timePicker.field === "open" ? "openTime" : "closeTime"
            ] ?? "09:00",
          )}
          mode="time"
          display="default"
          onValueChange={(_event, selectedDate) => {
            const { dayOfWeek, field } = timePicker;
            setTimePicker(null);
            updateDay(dayOfWeek, field === "open" ? { openTime: dateToTimeString(selectedDate) } : { closeTime: dateToTimeString(selectedDate) });
          }}
          onDismiss={() => setTimePicker(null)}
        />
      ) : null}
    </ScreenContainer>
  );
}



