import "server-only";
import { createSupabaseClient } from "@zaavo/database";

// Bypasses RLS entirely. status/commission_rate_bps/gst_status/is_pure_veg
// on `restaurants` are not grantable to `authenticated` at all — Postgres
// column privileges apply to the whole role, not to a specific RLS policy,
// so granting them would also open restaurants_update_own (vendor's own
// row) to the same columns, letting a vendor self-approve (this was tried
// and reverted — see supabase/migrations/20260826040000_revoke_restaurants_admin_grants.sql
// and db:test-rls, which caught the leak). Every call site using this
// client MUST do its own explicit super-admin check first — there is no
// RLS backstop here.
export function getServiceRoleSupabaseClient() {
  return createSupabaseClient({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
}
