import { useAuth } from "@clerk/expo";
import { createSupabaseClient, type Database } from "@zaavo/database";
import { useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Add EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/vendor/.env");
}

/**
 * Supabase client wired to the Clerk session via the `accessToken` hook
 * (Supabase's third-party-auth integration, not the deprecated JWT
 * template) — `getToken` always reads the *current* session, so RLS sees
 * live `auth_org_id()` / `auth_org_role()` claims even across sign-out /
 * sign-in as a different user.
 */
export function useSupabase(): SupabaseClient<Database> {
  const { getToken } = useAuth();

  return useMemo(
    () =>
      createSupabaseClient({
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        accessToken: () => getToken(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}
