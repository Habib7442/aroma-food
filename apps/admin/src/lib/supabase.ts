import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@zaavo/database";

// Server-only (Server Components / Server Actions) — uses the anon key +
// RLS via Clerk's third-party-auth token, same mechanism apps/vendor and
// apps/customer use, not the SUPABASE_SERVICE_ROLE_KEY. Admin writes work
// because restaurants_update_admin / cuisines_*_admin policies already
// gate on is_super_admin(); this client just needs the caller's Clerk
// session token so those functions can read the (still-to-be-configured)
// `superAdmin` JWT claim.
//
// Wrapped in React's cache() so the several queries a single page makes
// (restaurant + its categories + its menu items, say) share one client
// instance instead of each re-resolving Clerk's getToken() — cache() dedupes
// per request, not across requests, so this has no effect on staleness.
export const getSupabaseClient = cache(async () => {
  const { getToken } = await auth();
  return createSupabaseClient({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    accessToken: () => getToken(),
  });
});
