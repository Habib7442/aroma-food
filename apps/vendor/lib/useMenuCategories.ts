import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "./supabase";

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  image_url: string | null;
  thumbnail_url: string | null;
}

export function useMenuCategories(restaurantId: string | undefined) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ["menu-categories", restaurantId],
    queryFn: async (): Promise<MenuCategory[]> => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("id, name, sort_order, image_url, thumbnail_url")
        .eq("restaurant_id", restaurantId!)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });
}

export function useCreateMenuCategory(restaurantId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<MenuCategory> => {
      if (!restaurantId) throw new Error("Restaurant record not ready. Please try again.");
      const { data, error } = await supabase
        .from("menu_categories")
        .insert({ restaurant_id: restaurantId, name: name.trim() })
        .select("id, name, sort_order, image_url, thumbnail_url")
        .single();
      if (error) {
        // 23505 = unique_violation — the case-insensitive unique index is
        // the real boundary; client-side dedupe is only a convenience, so a
        // race can still land here.
        if (error.code === "23505") throw new Error(`"${name.trim()}" already exists.`);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories", restaurantId] });
    },
  });
}

export function useUpdateMenuCategoryImage(restaurantId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      categoryId,
      imageUrl,
      thumbnailUrl,
    }: {
      categoryId: string;
      imageUrl: string | null;
      thumbnailUrl: string | null;
    }) => {
      if (!restaurantId) throw new Error("Restaurant record not ready. Please try again.");
      const { error } = await supabase
        .from("menu_categories")
        .update({ image_url: imageUrl, thumbnail_url: thumbnailUrl })
        .eq("id", categoryId)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories", restaurantId] });
    },
  });
}

export function useDeleteMenuCategory(restaurantId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!restaurantId) throw new Error("Restaurant record not ready. Please try again.");
      const { error } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", categoryId)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Deleting a category sets category_id to null on every item that used
      // it (on delete set null) — the menu list's grouping depends on both.
      queryClient.invalidateQueries({ queryKey: ["menu-categories", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["menu-items", restaurantId] });
    },
  });
}
