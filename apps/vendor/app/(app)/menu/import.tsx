import { rupeesToPaise, type DietType } from "@zaavo/shared";
import { useAuth } from "@clerk/expo";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "../../../components/Button";
import { PendingSetupNotice } from "../../../components/PendingSetupNotice";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { DIET_OPTIONS, GST_OPTIONS } from "../../../lib/dietOptions";
import { useSupabase } from "../../../lib/supabase";
import { useMenuCategories } from "../../../lib/useMenuCategories";
import { useRestaurant } from "../../../lib/useRestaurant";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Only ever rendering one page's worth of rows at a time keeps a 300+ dish
// menu smooth on a plain ScrollView — no need for a virtualized list (and
// no risk of FlashList's cell-recycling bleeding state across multi-input
// rows, see menu/import's original design note).
const PAGE_SIZE = 20;
// Bulk-inserting hundreds of rows in one request risks a timeout / an
// all-or-nothing failure on a flaky connection — chunking keeps each
// request small and lets save progress be shown.
const INSERT_CHUNK_SIZE = 50;

interface ExtractedItem {
  name: string;
  description: string;
  price: number;
  menu_category: string;
  diet_type: DietType | null;
}

interface ReviewRow {
  rowId: string;
  name: string;
  description: string;
  priceRupees: string;
  dietType: DietType | null;
  categoryId: string | null;
  gstRateBps: number;
  packagingChargeRupees: string;
}

interface PendingCategory {
  tempId: string;
  name: string;
}

type Step = "checking" | "existing" | "pick" | "uploading" | "extracting" | "extract-failed" | "review" | "saving";

interface UploadedFile {
  path: string;
  publicUrl: string;
  fileName: string;
  uploadedAt?: string;
}

function extensionFor(mimeType: string | undefined): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "pdf";
}

function makeRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function PaginationBar({
  page,
  totalPages,
  totalCount,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View className="w-full flex-row items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
      <Pressable
        onPress={onPrev}
        disabled={page === 0}
        hitSlop={8}
        className={`w-8 h-8 rounded-full items-center justify-center ${page === 0 ? "opacity-30" : "bg-background border border-border"}`}
      >
        <Ionicons name="chevron-back" size={16} color="#1D4626" />
      </Pressable>
      <Text className="font-rubik-medium text-xs text-primary">
        Page {page + 1} of {totalPages} · {totalCount} dishes
      </Text>
      <Pressable
        onPress={onNext}
        disabled={page >= totalPages - 1}
        hitSlop={8}
        className={`w-8 h-8 rounded-full items-center justify-center ${page >= totalPages - 1 ? "opacity-30" : "bg-background border border-border"}`}
      >
        <Ionicons name="chevron-forward" size={16} color="#1D4626" />
      </Pressable>
    </View>
  );
}

function ReviewRowCard({
  row,
  index,
  categoryName,
  onUpdate,
  onRemove,
  onOpenCategoryPicker,
}: {
  row: ReviewRow;
  index: number;
  categoryName: string | null;
  onUpdate: (patch: Partial<ReviewRow>) => void;
  onRemove: () => void;
  onOpenCategoryPicker: () => void;
}) {
  return (
    <View className="w-full rounded-xl border border-border bg-card px-3 py-2.5 gap-2 shadow-sm">
      <View className="flex-row items-center gap-2">
        <Text className="w-5 text-[10px] font-rubik-bold text-[#8A8578]">{index + 1}</Text>
        <TextInput
          className="flex-1 rounded-lg border border-border bg-[#F9FAF4]/60 px-2.5 py-2 font-rubik-medium text-sm text-primary"
          placeholder="Dish name"
          placeholderTextColor="#8A8578"
          value={row.name}
          onChangeText={(v) => onUpdate({ name: v })}
        />
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          className="w-7 h-7 rounded-full bg-red-50 border border-red-200 items-center justify-center"
        >
          <Ionicons name="close" size={14} color="#DC2626" />
        </Pressable>
      </View>

      <View className="flex-row items-center gap-1.5">
        <TextInput
          className="w-16 rounded-lg border border-border bg-[#F9FAF4]/60 px-2 py-2 font-mono text-xs text-primary text-center"
          placeholder="₹"
          placeholderTextColor="#8A8578"
          value={row.priceRupees}
          onChangeText={(v) => onUpdate({ priceRupees: v })}
          keyboardType="decimal-pad"
        />

        <View className="flex-row rounded-lg border border-border overflow-hidden">
          {DIET_OPTIONS.map((option) => {
            const isSelected = row.dietType === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onUpdate({ dietType: option.value })}
                className={`w-7 h-7 items-center justify-center ${isSelected ? option.activeBg : "bg-background"}`}
              >
                <Ionicons name={option.icon} size={13} color={isSelected ? option.activeIconColor : "#5A6357"} />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={onOpenCategoryPicker}
          className="flex-1 flex-row items-center justify-between rounded-lg border border-border bg-background px-2 py-2"
        >
          <Text numberOfLines={1} className="flex-1 font-rubik-medium text-[11px] text-[#5A6357]">
            {categoryName ?? "No category"}
          </Text>
          <Ionicons name="chevron-down" size={12} color="#8A8578" />
        </Pressable>

        <View className="flex-row rounded-lg border border-border overflow-hidden">
          {GST_OPTIONS.map((option) => {
            const isSelected = row.gstRateBps === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onUpdate({ gstRateBps: option.value })}
                className={`px-2 h-7 items-center justify-center ${isSelected ? "bg-[#1D4626]" : "bg-background"}`}
              >
                <Text className={`text-[10px] font-rubik-bold ${isSelected ? "text-white" : "text-[#5A6357]"}`}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!row.dietType ? (
        <Text className="font-sans text-[10px] text-non-veg">Choose a diet type before saving.</Text>
      ) : null}
    </View>
  );
}

function CategoryPickerModal({
  visible,
  categories,
  selectedId,
  newCategoryName,
  onChangeNewCategoryName,
  onSelect,
  onAddCategory,
  onClose,
}: {
  visible: boolean;
  categories: { id: string; name: string }[];
  selectedId: string | null;
  newCategoryName: string;
  onChangeNewCategoryName: (v: string) => void;
  onSelect: (id: string | null) => void;
  onAddCategory: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="absolute bottom-0 left-0 right-0 max-h-[75%] rounded-t-3xl bg-card p-5 gap-3">
        <Text className="text-lg font-rubik-bold text-primary">Choose Category</Text>
        <ScrollView className="max-h-[280px]" keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => onSelect(null)}
            className="flex-row items-center justify-between rounded-xl px-3 py-3 active:bg-[#F3F4EF]"
          >
            <Text className="font-rubik-medium text-sm text-[#5A6357]">No category</Text>
            {selectedId === null ? <Ionicons name="checkmark" size={18} color="#1D4626" /> : null}
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => onSelect(category.id)}
              className="flex-row items-center justify-between rounded-xl px-3 py-3 active:bg-[#F3F4EF]"
            >
              <Text className="font-rubik-medium text-sm text-primary">{category.name}</Text>
              {selectedId === category.id ? <Ionicons name="checkmark" size={18} color="#1D4626" /> : null}
            </Pressable>
          ))}
        </ScrollView>
        <View className="flex-row items-center gap-2 pt-1 border-t border-border">
          <TextInput
            className="flex-1 min-h-[44px] rounded-xl border border-border bg-[#F9FAF4]/60 px-3 mt-2 font-sans text-sm text-primary"
            placeholder="New category name"
            placeholderTextColor="#8A8578"
            value={newCategoryName}
            onChangeText={onChangeNewCategoryName}
            autoCapitalize="words"
          />
          <Pressable
            onPress={onAddCategory}
            disabled={!newCategoryName.trim()}
            className={`mt-2 min-h-[44px] rounded-xl border border-[#1D4626] px-4 items-center justify-center ${
              !newCategoryName.trim() ? "opacity-50" : ""
            }`}
          >
            <Text className="font-rubik-semibold text-xs text-[#1D4626]">+ Add</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ImportMenuScreen() {
  const supabase = useSupabase();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: restaurant, isLoading: isRestaurantLoading } = useRestaurant();
  const restaurantId = restaurant?.id;
  const { data: existingCategories } = useMenuCategories(restaurantId);

  const [step, setStep] = useState<Step>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [pendingCategories, setPendingCategories] = useState<PendingCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [page, setPage] = useState(0);
  const [categoryPickerRowId, setCategoryPickerRowId] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  // A restaurant only ever has one menu file in storage (uploads replace,
  // not accumulate — see onPickAndUpload). Check for it on open so a vendor
  // who already uploaded one doesn't have to pick/upload it again just to
  // re-run extraction or see what's there.
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    (async () => {
      const { data: existingObjects } = await supabase.storage.from("menu-pdfs").list(restaurantId);
      if (cancelled) return;
      const existingObject = existingObjects?.[0];
      if (existingObject) {
        const path = `${restaurantId}/${existingObject.name}`;
        setUploadedFile({
          path,
          publicUrl: `${supabaseUrl}/storage/v1/object/public/menu-pdfs/${path}`,
          fileName: existingObject.name,
          uploadedAt: existingObject.created_at ?? undefined,
        });
        setStep("existing");
      } else {
        setStep("pick");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Existing (already-saved) categories first, then this import's new ones —
  // matching against existing names avoids inserting a duplicate that would
  // violate the unique(restaurant_id, name) constraint and fail the whole save.
  const categoryOptions = useMemo(
    () => [
      ...(existingCategories ?? []).map((c) => ({ id: c.id, name: c.name })),
      ...pendingCategories.map((c) => ({ id: c.tempId, name: c.name })),
    ],
    [existingCategories, pendingCategories],
  );
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of existingCategories ?? []) map.set(c.id, c.name);
    for (const c of pendingCategories) map.set(c.tempId, c.name);
    return map;
  }, [existingCategories, pendingCategories]);
  const findCategoryByName = useCallback(
    (name: string) => categoryOptions.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null,
    [categoryOptions],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const updateRow = useCallback((rowId: string, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((row) => row.rowId !== rowId));
  }, []);

  const onAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const existing = findCategoryByName(trimmed);
    if (existing) {
      if (categoryPickerRowId) updateRow(categoryPickerRowId, { categoryId: existing.id });
      setNewCategoryName("");
      setCategoryPickerRowId(null);
      return;
    }
    const tempId = `pending-${makeRowId()}`;
    setPendingCategories((prev) => [...prev, { tempId, name: trimmed }]);
    if (categoryPickerRowId) updateRow(categoryPickerRowId, { categoryId: tempId });
    setNewCategoryName("");
    setCategoryPickerRowId(null);
  };

  const onSelectCategory = (id: string | null) => {
    if (categoryPickerRowId) updateRow(categoryPickerRowId, { categoryId: id });
    setCategoryPickerRowId(null);
  };

  // Parses an already-uploaded file. Split out from the pick/upload flow so
  // a failed extraction (Gemini timeout, transient error, etc.) can be
  // retried against the same storage object instead of forcing the vendor
  // to re-pick and re-upload the same file.
  const runExtraction = async (file: UploadedFile) => {
    setErrorMessage(null);
    setStep("extracting");
    try {
      const { data, error } = await supabase.functions.invoke<{ success?: true; items?: ExtractedItem[]; error?: string }>(
        "extract-menu-pdf",
        { body: { pdfUrl: file.publicUrl, restaurantId } },
      );
      if (error) {
        // FunctionsHttpError's own `.message` is always the generic
        // "Edge Function returned a non-2xx status code" — the function's
        // real error is in `.context`, the raw Response our function sent.
        let detail: string | undefined;
        if (error instanceof FunctionsHttpError) {
          detail = await error.context
            .json()
            .then((body: { error?: string }) => body.error)
            .catch(() => undefined);
        }
        throw new Error(detail ?? error.message ?? "Couldn't parse this file.");
      }
      if (!data || data.error || !data.items) {
        throw new Error(data?.error ?? "Couldn't parse this file.");
      }

      const nextPendingCategories: PendingCategory[] = [];
      const nextRows: ReviewRow[] = data.items.map((item) => {
        let categoryId: string | null = null;
        const categoryName = item.menu_category.trim();
        if (categoryName) {
          // Match an already-saved category first — creating a new one with
          // the same name would violate the unique(restaurant_id, name)
          // constraint and fail the whole save.
          const existingSaved = (existingCategories ?? []).find(
            (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
          );
          const existingPending = nextPendingCategories.find(
            (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
          );
          if (existingSaved) {
            categoryId = existingSaved.id;
          } else if (existingPending) {
            categoryId = existingPending.tempId;
          } else {
            const tempId = `pending-${makeRowId()}`;
            nextPendingCategories.push({ tempId, name: categoryName });
            categoryId = tempId;
          }
        }
        return {
          rowId: makeRowId(),
          name: item.name,
          description: item.description,
          priceRupees: String(item.price),
          dietType: item.diet_type,
          categoryId,
          gstRateBps: 500,
          packagingChargeRupees: "0",
        };
      });

      setPendingCategories(nextPendingCategories);
      setRows(nextRows);
      setPage(0);
      setStep("review");
    } catch (err) {
      console.error("[import] runExtraction failed:", err);
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("extract-failed");
    }
  };

  const onPickAndUpload = async () => {
    setErrorMessage(null);
    if (!restaurantId) return;

    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];

    try {
      setStep("uploading");

      const token = await getToken();
      if (!token) throw new Error("Your session expired. Please sign in again.");

      const path = `${restaurantId}/${Date.now()}.${extensionFor(asset.mimeType)}`;
      // ArrayBuffer, not Blob: RN's Blob implementation has known gaps under
      // the New Architecture that surface as an opaque "undefined is not a
      // function" when fetch tries to serialize a Blob body. ArrayBuffer
      // bodies skip that native bridge path entirely.
      const fileBuffer = await (await fetch(asset.uri)).arrayBuffer();

      const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/menu-pdfs/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
          "Content-Type": asset.mimeType ?? "application/pdf",
        },
        body: fileBuffer,
      });
      if (!uploadResponse.ok) {
        const uploadErrorText = await uploadResponse.text().catch(() => "");
        throw new Error(`Couldn't upload the file (${uploadResponse.status}). ${uploadErrorText}`.trim());
      }

      // Only clean up previous uploads once the new one is confirmed on
      // storage — a restaurant should only ever have one menu file sitting
      // in the bucket (imports shouldn't accumulate and burn storage), but
      // if this delete fails it's not worth blocking the import over; it's
      // best-effort housekeeping, not the critical path.
      const { data: existingObjects } = await supabase.storage.from("menu-pdfs").list(restaurantId);
      const staleObjects = (existingObjects ?? []).filter((o) => `${restaurantId}/${o.name}` !== path);
      if (staleObjects.length > 0) {
        const { error: removeError } = await supabase.storage
          .from("menu-pdfs")
          .remove(staleObjects.map((o) => `${restaurantId}/${o.name}`));
        if (removeError) console.warn("[import] couldn't remove stale menu file(s):", removeError.message);
      }

      const publicUrl = `${supabaseUrl}/storage/v1/object/public/menu-pdfs/${path}`;
      const file: UploadedFile = { path, publicUrl, fileName: asset.name };
      setUploadedFile(file);
      await runExtraction(file);
    } catch (err) {
      console.error("[import] onPickAndUpload failed:", err);
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("pick");
    }
  };

  const onRetryExtraction = () => {
    if (!uploadedFile) return;
    runExtraction(uploadedFile);
  };

  const onConfirm = async () => {
    setErrorMessage(null);
    if (!restaurantId) return;
    if (rows.length === 0) {
      setErrorMessage("Nothing to save — every item was removed.");
      return;
    }
    if (rows.some((row) => !row.dietType)) {
      setErrorMessage("Choose a diet type for every dish before saving.");
      return;
    }
    for (const row of rows) {
      const parsedRupees = Number(row.priceRupees);
      if (!row.name.trim() || Number.isNaN(parsedRupees) || parsedRupees < 0) {
        setErrorMessage(`"${row.name || "Untitled dish"}" needs a valid name and price.`);
        return;
      }
    }

    try {
      setStep("saving");
      setSaveProgress(null);

      const usedTempIds = new Set(rows.map((r) => r.categoryId).filter((id): id is string => !!id?.startsWith("pending-")));
      const categoriesToInsert = pendingCategories.filter((c) => usedTempIds.has(c.tempId));

      const tempIdToRealId = new Map<string, string>();
      if (categoriesToInsert.length > 0) {
        const { data: inserted, error } = await supabase
          .from("menu_categories")
          .insert(categoriesToInsert.map((c) => ({ restaurant_id: restaurantId, name: c.name })))
          .select("id, name");
        if (error) throw error;
        for (const category of categoriesToInsert) {
          const match = inserted?.find((row) => row.name === category.name);
          if (match) tempIdToRealId.set(category.tempId, match.id);
        }
      }

      const itemsToInsert = rows.map((row) => ({
        restaurant_id: restaurantId,
        name: row.name.trim(),
        description: row.description.trim() || null,
        price_paise: rupeesToPaise(Number(row.priceRupees)),
        diet_type: row.dietType!,
        category_id: row.categoryId?.startsWith("pending-") ? (tempIdToRealId.get(row.categoryId) ?? null) : row.categoryId,
        gst_rate_bps: row.gstRateBps,
        packaging_charge_paise: rupeesToPaise(Number(row.packagingChargeRupees) || 0),
      }));

      setSaveProgress({ done: 0, total: itemsToInsert.length });
      for (let i = 0; i < itemsToInsert.length; i += INSERT_CHUNK_SIZE) {
        const chunk = itemsToInsert.slice(i, i + INSERT_CHUNK_SIZE);
        const { error: insertError } = await supabase.from("menu_items").insert(chunk);
        if (insertError) throw insertError;
        setSaveProgress({ done: Math.min(i + INSERT_CHUNK_SIZE, itemsToInsert.length), total: itemsToInsert.length });
      }

      queryClient.invalidateQueries({ queryKey: ["menu-items", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["menu-categories", restaurantId] });
      router.back();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't save these items. Please try again.");
      setStep("review");
    }
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

  const pickerRow = rows.find((r) => r.rowId === categoryPickerRowId) ?? null;

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
            <Text className="text-2xl font-rubik-bold text-primary">Import Menu</Text>
            <Text className="font-sans text-xs text-[#5A6357]">
              Upload a menu PDF or photo — Gemini extracts the dishes for you to review
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <View className="w-full rounded-lg bg-red-50 p-3 border border-red-200 mb-4">
            <Text className="font-sans text-xs text-non-veg">{errorMessage}</Text>
          </View>
        ) : null}

        {step === "checking" ||
        step === "existing" ||
        step === "pick" ||
        step === "uploading" ||
        step === "extracting" ||
        step === "extract-failed" ? (
          <View className="w-full rounded-2xl border border-border bg-card p-8 items-center justify-center gap-4 shadow-sm">
            {step === "checking" ? (
              <>
                <ActivityIndicator color="#1D4626" size="large" />
                <Text className="font-rubik-semibold text-sm text-primary text-center">
                  Checking for an existing menu file...
                </Text>
              </>
            ) : step === "existing" ? (
              <>
                <View className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
                  <Ionicons name="document-text-outline" size={28} color="#1D4626" />
                </View>
                <Text className="text-lg font-rubik-semibold text-primary text-center">
                  You already have a menu file uploaded
                </Text>
                <Text className="font-sans text-xs text-[#5A6357] text-center max-w-[280px]">
                  {uploadedFile?.fileName}
                  {uploadedFile?.uploadedAt ? ` — uploaded ${new Date(uploadedFile.uploadedAt).toLocaleDateString()}` : ""}
                </Text>
                <View className="w-full gap-2">
                  <Button
                    label="Use This File"
                    onPress={() => uploadedFile && runExtraction(uploadedFile)}
                    icon={<Ionicons name="sparkles-outline" size={20} color="#FFFFFF" />}
                  />
                  <Button
                    label="Replace with New File"
                    onPress={onPickAndUpload}
                    variant="secondary"
                    icon={<Ionicons name="cloud-upload-outline" size={20} color="#1D4626" />}
                  />
                </View>
              </>
            ) : step === "pick" ? (
              <>
                <View className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
                  <Ionicons name="document-attach-outline" size={28} color="#1D4626" />
                </View>
                <Text className="text-lg font-rubik-semibold text-primary text-center">
                  Choose a menu PDF or photo
                </Text>
                <Text className="font-sans text-xs text-[#5A6357] text-center max-w-[280px]">
                  Every extracted dish will show up here for you to review and edit before it's added to your menu.
                </Text>
                <Button
                  label="Choose File"
                  onPress={onPickAndUpload}
                  icon={<Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />}
                />
              </>
            ) : step === "extract-failed" ? (
              <>
                <View className="w-14 h-14 rounded-full bg-red-50 border border-red-200 items-center justify-center">
                  <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
                </View>
                <Text className="text-lg font-rubik-semibold text-primary text-center">Couldn't read this file</Text>
                <Text className="font-sans text-xs text-[#5A6357] text-center max-w-[280px]">
                  {uploadedFile
                    ? `"${uploadedFile.fileName}" is already uploaded — retry without picking it again, or choose a different file.`
                    : "Something went wrong."}
                </Text>
                <View className="w-full gap-2">
                  <Button
                    label="Retry Extraction"
                    onPress={onRetryExtraction}
                    icon={<Ionicons name="refresh" size={20} color="#FFFFFF" />}
                  />
                  <Button
                    label="Choose a Different File"
                    onPress={onPickAndUpload}
                    variant="secondary"
                    icon={<Ionicons name="document-attach-outline" size={20} color="#1D4626" />}
                  />
                </View>
              </>
            ) : (
              <>
                <ActivityIndicator color="#1D4626" size="large" />
                <Text className="font-rubik-semibold text-sm text-primary text-center">
                  {step === "uploading" ? "Uploading file..." : "Reading your menu with Gemini..."}
                </Text>
                <Text className="font-sans text-xs text-[#5A6357] text-center max-w-[280px]">
                  This can take a minute or two for a full menu — please keep the app open.
                </Text>
              </>
            )}
          </View>
        ) : (
          <View className="w-full gap-3">
            <PaginationBar
              page={safePage}
              totalPages={totalPages}
              totalCount={rows.length}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />

            {pagedRows.map((row, i) => (
              <ReviewRowCard
                key={row.rowId}
                row={row}
                index={safePage * PAGE_SIZE + i}
                categoryName={row.categoryId ? (categoryNameById.get(row.categoryId) ?? null) : null}
                onUpdate={(patch) => updateRow(row.rowId, patch)}
                onRemove={() => removeRow(row.rowId)}
                onOpenCategoryPicker={() => setCategoryPickerRowId(row.rowId)}
              />
            ))}

            <PaginationBar
              page={safePage}
              totalPages={totalPages}
              totalCount={rows.length}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />

            <Button
              label={`Save ${rows.length} Dish${rows.length === 1 ? "" : "es"} to Menu`}
              onPress={onConfirm}
              loading={step === "saving"}
              disabled={rows.length === 0}
              icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
            />
            {step === "saving" && saveProgress ? (
              <Text className="font-sans text-xs text-[#5A6357] text-center">
                Saving {saveProgress.done} of {saveProgress.total} dishes...
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <CategoryPickerModal
        visible={categoryPickerRowId !== null}
        categories={categoryOptions}
        selectedId={pickerRow?.categoryId ?? null}
        newCategoryName={newCategoryName}
        onChangeNewCategoryName={setNewCategoryName}
        onSelect={onSelectCategory}
        onAddCategory={onAddCategory}
        onClose={() => setCategoryPickerRowId(null)}
      />
    </ScreenContainer>
  );
}
