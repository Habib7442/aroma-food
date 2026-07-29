import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  /**
   * Supabase's third-party-auth `accessToken` hook (not the deprecated Clerk
   * JWT template) — wire a Clerk `session.getToken` here so RLS sees the
   * real V2 org claims (`auth_org_id()` / `auth_org_role()`). Omit for
   * anonymous/public-only access.
   */
  accessToken?: () => Promise<string | null>;
}

/**
 * Anon-key client factory. The anon key is safe to ship in an app bundle —
 * it is only safe because RLS is enabled on every table (PRD §11.2). Never
 * pass a service_role key here.
 */
export function createSupabaseClient(config: SupabaseClientConfig): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.anonKey, {
    accessToken: config.accessToken ? () => config.accessToken!() : undefined,
  });
}
