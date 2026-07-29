import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "./supabase";

export interface RestaurantBanner {
  id: string;
  image_url: string;
  sort_order: number;
}

// Soft cap, enforced client-side — not a hard DB constraint. A handful of
// promo banners is plenty for a single restaurant; this just stops the
// list from growing unbounded, matching the "no storage waste" rule
// applied everywhere else in this feature.
export const MAX_BANNERS = 5;

export function useRestaurantBanners(restaurantId: string | undefined) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ["restaurant-banners", restaurantId],
    queryFn: async (): Promise<RestaurantBanner[]> => {
      const { data, error } = await supabase
        .from("restaurant_banners")
        .select("id, image_url, sort_order")
        .eq("restaurant_id", restaurantId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });
}

export function useCreateRestaurantBanner(restaurantId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, imageUrl, sortOrder }: { id: string; imageUrl: string; sortOrder: number }) => {
      if (!restaurantId) throw new Error("Restaurant record not ready. Please try again.");
      const { error } = await supabase
        .from("restaurant_banners")
        .insert({ id, restaurant_id: restaurantId, image_url: imageUrl, sort_order: sortOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-banners", restaurantId] });
    },
  });
}

export function useDeleteRestaurantBanner(restaurantId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bannerId: string) => {
      if (!restaurantId) throw new Error("Restaurant record not ready. Please try again.");
      const { error } = await supabase
        .from("restaurant_banners")
        .delete()
        .eq("id", bannerId)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-banners", restaurantId] });
    },
  });
}
