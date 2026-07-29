import { useOrganization } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "./supabase";

export interface RestaurantProfile {
  id: string;
  name: string;
  description: string | null;
  gstin: string | null;
  is_open: boolean;
  logo_url: string | null;
  address: string | null;
  landmark: string | null;
  pincode: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

/**
 * The `restaurants` row for the active org, if it exists yet. It won't
 * until the (not-yet-built) Clerk `organization.created` webhook inserts it
 * — see CLAUDE.md / the slice-1 migration comment. Callers should treat
 * `data === null` (query succeeded, no row) as "pending setup," not an error.
 */
export function useRestaurant() {
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const restaurantId = organization?.id;

  return useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: async (): Promise<RestaurantProfile | null> => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, description, gstin, is_open, logo_url, address, landmark, pincode, contact_phone, contact_email")
        .eq("id", restaurantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });
}

/**
 * Interim fix for the gap above (see apps/vendor/AGENTS.md §9): self-heals a
 * missing `restaurants` row by inserting one on app-shell mount. Safe to call
 * unconditionally — `ignoreDuplicates` compiles to `ON CONFLICT (id) DO
 * NOTHING`, so an existing row (webhook built later, or a repeat app open)
 * is never overwritten. Superseded once the real Clerk webhook lands.
 */
export function useEnsureRestaurant() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async () => {
      if (!organization) return;
      const { error } = await supabase
        .from("restaurants")
        .upsert({ id: organization.id, name: organization.name }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant", organization?.id] });
    },
  });
}
