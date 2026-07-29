import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "./supabase";

export interface DayHours {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

// day_of_week follows Postgres's EXTRACT(DOW ...) / JS's Date.getDay()
// convention: 0 = Sunday .. 6 = Saturday.
export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_OPEN_TIME = "09:00";
const DEFAULT_CLOSE_TIME = "21:00";

function defaultWeek(): DayHours[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: true,
    openTime: DEFAULT_OPEN_TIME,
    closeTime: DEFAULT_CLOSE_TIME,
  }));
}

export function useRestaurantHours(restaurantId: string | undefined) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ["restaurant-hours", restaurantId],
    queryFn: async (): Promise<DayHours[]> => {
      const { data, error } = await supabase
        .from("restaurant_hours")
        .select("day_of_week, is_closed, open_time, close_time")
        .eq("restaurant_id", restaurantId!)
        .order("day_of_week");
      if (error) throw error;

      // A brand-new restaurant has no rows yet — fill in every day as
      // closed so the editor always shows exactly 7 rows, saved lazily on
      // the vendor's first "Save Changes" rather than pre-seeded server-side.
      const byDay = new Map(data.map((row) => [row.day_of_week, row]));
      return defaultWeek().map((fallback) => {
        const row = byDay.get(fallback.dayOfWeek);
        if (!row) return fallback;
        return {
          dayOfWeek: row.day_of_week,
          isClosed: row.is_closed,
          openTime: row.open_time?.slice(0, 5) ?? DEFAULT_OPEN_TIME,
          closeTime: row.close_time?.slice(0, 5) ?? DEFAULT_CLOSE_TIME,
        };
      });
    },
    enabled: !!restaurantId,
  });
}

export function useSaveRestaurantHours(restaurantId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (week: DayHours[]) => {
      if (!restaurantId) throw new Error("Restaurant record not ready. Please try again.");
      const rows = week.map((day) => ({
        restaurant_id: restaurantId,
        day_of_week: day.dayOfWeek,
        is_closed: day.isClosed,
        open_time: day.isClosed ? null : `${day.openTime}:00`,
        close_time: day.isClosed ? null : `${day.closeTime}:00`,
      }));
      const { error } = await supabase
        .from("restaurant_hours")
        .upsert(rows, { onConflict: "restaurant_id,day_of_week" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-hours", restaurantId] });
    },
  });
}
