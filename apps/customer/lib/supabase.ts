import { createSupabaseClient } from "@zaavo/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Add EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/customer/.env");
}

/**
 * Plain anon-key client — this app has no auth this slice, so there's no
 * Clerk session to attach via `accessToken`. RLS's `to anon` read policies
 * (restaurants_select_public_approved, menu_items_select_public_available)
 * carry this entirely; see supabase/migrations/20260727055325_slice1_vendor_menu.sql.
 */
export const supabase = createSupabaseClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
});
