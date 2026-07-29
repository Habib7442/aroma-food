#!/usr/bin/env -S npx tsx
/**
 * RLS leak test for slice 1 (vendor onboarding + menu management).
 *
 * Mints a REAL Clerk session token for a vendor of a throwaway "restaurant 1"
 * organization and asserts it can read/write its own restaurants + menu_items
 * rows but cannot read or write restaurant 2's. Exits non-zero on any leak.
 *
 * Requires a Clerk DEVELOPMENT instance: Clerk's `POST /v1/sessions` endpoint
 * ("create a session for a user id, no sign-in flow") is documented as
 * testing-only and unavailable on production instances — see Clerk's own
 * Backend API spec. A `sk_test_...` secret key is a development key.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_PUBLISHABLE_KEY   (the project's publishable/anon key)
 *   SUPABASE_SERVICE_ROLE_KEY  (used only for fixture setup/teardown)
 *   CLERK_SECRET_KEY           (sk_test_... — a development instance)
 *
 * This script does NOT reuse supabase/seed.sql's fake ids — real Clerk
 * tokens need real Clerk fixtures, so it creates and tears down its own.
 */

const SUPABASE_URL = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = requireEnv("SUPABASE_PUBLISHABLE_KEY");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const CLERK_SECRET_KEY = requireEnv("CLERK_SECRET_KEY");

const CLERK_API = "https://api.clerk.com/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function clerk(method: string, path: string, body?: unknown) {
  const res = await fetch(`${CLERK_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Clerk ${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function rest(
  key: "publishable" | "service_role",
  method: string,
  path: string,
  opts: { body?: unknown; jwt?: string; prefer?: string } = {},
) {
  const apikey = key === "service_role" ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_PUBLISHABLE_KEY;
  const bearer = opts.jwt ?? (key === "service_role" ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_PUBLISHABLE_KEY);
  const headers: Record<string, string> = {
    apikey,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
  };
  if (opts.prefer) headers.Prefer = opts.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  return { status: res.status, ok: res.ok, json };
}

type Check = { name: string; pass: boolean; detail?: string };
const results: Check[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`  ok  ${name}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, pass: false, detail });
    console.log(`FAIL  ${name}\n      ${detail}`);
  }
}

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

async function main() {
  console.log("Setting up fixtures (real Clerk org + user + session, real Postgres rows)...");

  const suffix = Date.now().toString(36);
  const vendorUser = await clerk("POST", "/users", {
    email_address: [`rls-test-vendor-${suffix}@example.com`],
    skip_password_requirement: true,
    skip_password_checks: true,
  });

  const org1 = await clerk("POST", "/organizations", {
    name: `RLS Test Restaurant 1 ${suffix}`,
    created_by: vendorUser.id,
  });
  const org2 = await clerk("POST", "/organizations", {
    name: `RLS Test Restaurant 2 ${suffix}`,
    created_by: vendorUser.id,
  });
  // A third org exists purely to be approved-and-public: restaurants_select_
  // public_approved / menu_items_select_public_available are `to anon,
  // authenticated`, so an *approved* restaurant is visible to every signed-in
  // user, vendors included — that's by design, not a leak. Restaurant 2 needs
  // to stay non-public (status 'pending') for the vendor-cross-tenant checks
  // below to mean anything, so the public-read checks use restaurant 3
  // instead of overloading restaurant 2 for both roles.
  const org3 = await clerk("POST", "/organizations", {
    name: `RLS Test Restaurant 3 (public) ${suffix}`,
    created_by: vendorUser.id,
  });
  // orgs 4-6 back the restaurants_insert_own checks below. Deliberately have
  // NO Postgres row created here (unlike 1-3) — the whole point is to prove
  // the vendor's own client-side insert is what creates it. org4 gets its
  // own session/JWT (active org = org4) so the insert tests aren't tangled
  // up with restaurant1's already-existing row or its other assertions.
  const org4 = await clerk("POST", "/organizations", {
    name: `RLS Test Restaurant 4 (insert target) ${suffix}`,
    created_by: vendorUser.id,
  });
  const org5 = await clerk("POST", "/organizations", {
    name: `RLS Test Restaurant 5 (insert column-privilege) ${suffix}`,
    created_by: vendorUser.id,
  });
  const org6 = await clerk("POST", "/organizations", {
    name: `RLS Test Restaurant 6 (insert cross-tenant) ${suffix}`,
    created_by: vendorUser.id,
  });

  const restaurant1Id = org1.id as string;
  const restaurant2Id = org2.id as string;
  const restaurant3Id = org3.id as string;
  const restaurant4Id = org4.id as string;
  const restaurant5Id = org5.id as string;
  const restaurant6Id = org6.id as string;

  // Insert matching Postgres fixtures via service role (bypasses RLS).
  await rest("service_role", "POST", "/restaurants", {
    body: {
      id: restaurant1Id,
      name: "RLS Test Restaurant 1",
      // Deliberately 'pending', not 'approved': the self-approval checks
      // below need a starting state a vendor PATCH could visibly move away
      // from, and 'pending' also matches how a real restaurant starts out.
      status: "pending",
      commission_rate_bps: 1000,
      gst_status: "unregistered",
      is_open: true,
    },
  });
  await rest("service_role", "POST", "/restaurants", {
    body: {
      id: restaurant2Id,
      name: "RLS Test Restaurant 2",
      // 'pending', not 'approved' — see the org3 comment above. If this were
      // 'approved', the public-read policy alone would let restaurant 1's
      // vendor see it, and the "vendor CANNOT read restaurant 2" checks
      // below would fail for a reason that has nothing to do with a leak.
      status: "pending",
      gst_status: "unregistered",
      is_open: true,
    },
  });
  await rest("service_role", "POST", "/restaurants", {
    body: {
      id: restaurant3Id,
      name: "RLS Test Restaurant 3 (public)",
      status: "approved",
      gst_status: "unregistered",
      is_open: true,
    },
  });

  const item1 = await rest("service_role", "POST", "/menu_items", {
    prefer: "return=representation",
    body: {
      restaurant_id: restaurant1Id,
      name: "RLS Test Item 1",
      price_paise: 10000,
      diet_type: "veg",
      gst_rate_bps: 500,
      is_available: true,
    },
  });
  const item2 = await rest("service_role", "POST", "/menu_items", {
    prefer: "return=representation",
    body: {
      restaurant_id: restaurant2Id,
      name: "RLS Test Item 2",
      price_paise: 10000,
      diet_type: "veg",
      gst_rate_bps: 500,
      is_available: true,
    },
  });
  const item3 = await rest("service_role", "POST", "/menu_items", {
    prefer: "return=representation",
    body: {
      restaurant_id: restaurant3Id,
      name: "RLS Test Item 3",
      price_paise: 10000,
      diet_type: "veg",
      gst_rate_bps: 500,
      is_available: true,
    },
  });
  assert(Array.isArray(item1.json) && item1.json.length === 1, "fixture insert (item1) failed");
  assert(Array.isArray(item2.json) && item2.json.length === 1, "fixture insert (item2) failed");
  assert(Array.isArray(item3.json) && item3.json.length === 1, "fixture insert (item3) failed");

  // menu_categories fixtures — one per restaurant 1-3, same pattern as the
  // menu_items fixtures above (own/cross-tenant/public-read coverage).
  const category1 = await rest("service_role", "POST", "/menu_categories", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant1Id, name: "RLS Test Category 1" },
  });
  const category2 = await rest("service_role", "POST", "/menu_categories", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant2Id, name: "RLS Test Category 2" },
  });
  const category3 = await rest("service_role", "POST", "/menu_categories", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant3Id, name: "RLS Test Category 3" },
  });
  assert(Array.isArray(category1.json) && category1.json.length === 1, "fixture insert (category1) failed");
  assert(Array.isArray(category2.json) && category2.json.length === 1, "fixture insert (category2) failed");
  assert(Array.isArray(category3.json) && category3.json.length === 1, "fixture insert (category3) failed");

  // restaurant_hours fixtures — one Monday row per restaurant 1-3, same
  // own/cross-tenant/public-read coverage as menu_categories above.
  const hours1 = await rest("service_role", "POST", "/restaurant_hours", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant1Id, day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "21:00" },
  });
  const hours2 = await rest("service_role", "POST", "/restaurant_hours", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant2Id, day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "21:00" },
  });
  const hours3 = await rest("service_role", "POST", "/restaurant_hours", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant3Id, day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "21:00" },
  });
  assert(Array.isArray(hours1.json) && hours1.json.length === 1, "fixture insert (hours1) failed");
  assert(Array.isArray(hours2.json) && hours2.json.length === 1, "fixture insert (hours2) failed");
  assert(Array.isArray(hours3.json) && hours3.json.length === 1, "fixture insert (hours3) failed");

  // restaurant_banners fixtures — one per restaurant 1-3, same
  // own/cross-tenant/public-read coverage as menu_categories above.
  const banner1 = await rest("service_role", "POST", "/restaurant_banners", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant1Id, image_url: "https://example.com/banner1.webp" },
  });
  const banner2 = await rest("service_role", "POST", "/restaurant_banners", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant2Id, image_url: "https://example.com/banner2.webp" },
  });
  const banner3 = await rest("service_role", "POST", "/restaurant_banners", {
    prefer: "return=representation",
    body: { restaurant_id: restaurant3Id, image_url: "https://example.com/banner3.webp" },
  });
  assert(Array.isArray(banner1.json) && banner1.json.length === 1, "fixture insert (banner1) failed");
  assert(Array.isArray(banner2.json) && banner2.json.length === 1, "fixture insert (banner2) failed");
  assert(Array.isArray(banner3.json) && banner3.json.length === 1, "fixture insert (banner3) failed");

  // Mint a real session JWT for the vendor, active org = restaurant 1.
  // POST /sessions + POST /sessions/{id}/tokens confirmed against Clerk's
  // own Backend API spec — testing-only, requires a dev instance.
  const session = await clerk("POST", "/sessions", {
    user_id: vendorUser.id,
    active_organization_id: restaurant1Id,
  });
  const tokenRes = await clerk("POST", `/sessions/${session.id}/tokens`, {});
  const vendorJwt = tokenRes.jwt as string;

  // Second session for the same vendor, active org = restaurant 4 — used
  // only by the restaurants_insert_own checks below, so they exercise
  // auth_org_id() = restaurant4Id rather than restaurant1Id.
  const session4 = await clerk("POST", "/sessions", {
    user_id: vendorUser.id,
    active_organization_id: restaurant4Id,
  });
  const tokenRes4 = await clerk("POST", `/sessions/${session4.id}/tokens`, {});
  const vendorJwtOrg4 = tokenRes4.jwt as string;

  console.log("\nRunning assertions...\n");

  // --- Positive controls (must pass, or the "leak" checks below are meaningless) ---
  await check("vendor can read their own restaurant", async () => {
    const r = await rest("publishable", "GET", `/restaurants?id=eq.${restaurant1Id}`, { jwt: vendorJwt });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("vendor can read their own menu_items", async () => {
    const r = await rest("publishable", "GET", `/menu_items?restaurant_id=eq.${restaurant1Id}`, { jwt: vendorJwt });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("vendor can read their own menu_categories", async () => {
    const r = await rest("publishable", "GET", `/menu_categories?restaurant_id=eq.${restaurant1Id}`, {
      jwt: vendorJwt,
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("vendor can insert a menu_category into their own restaurant", async () => {
    const r = await rest("publishable", "POST", "/menu_categories", {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { restaurant_id: restaurant1Id, name: "RLS Test Category 1b" },
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `insert failed: ${JSON.stringify(r.json)}`);
  });

  await check("vendor can read their own restaurant_hours", async () => {
    const r = await rest("publishable", "GET", `/restaurant_hours?restaurant_id=eq.${restaurant1Id}`, {
      jwt: vendorJwt,
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("vendor can insert a restaurant_hours row into their own restaurant", async () => {
    const r = await rest("publishable", "POST", "/restaurant_hours", {
      jwt: vendorJwt,
      prefer: "return=representation",
      // day_of_week=2 (Tuesday) — day_of_week=1 is already taken by the fixture.
      body: { restaurant_id: restaurant1Id, day_of_week: 2, is_closed: true },
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `insert failed: ${JSON.stringify(r.json)}`);
  });

  await check("vendor can read their own restaurant_banners", async () => {
    const r = await rest("publishable", "GET", `/restaurant_banners?restaurant_id=eq.${restaurant1Id}`, {
      jwt: vendorJwt,
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("vendor can insert a restaurant_banner into their own restaurant", async () => {
    const r = await rest("publishable", "POST", "/restaurant_banners", {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { restaurant_id: restaurant1Id, image_url: "https://example.com/banner1b.webp" },
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `insert failed: ${JSON.stringify(r.json)}`);
  });

  await check("vendor can update their own restaurant", async () => {
    const r = await rest("publishable", "PATCH", `/restaurants?id=eq.${restaurant1Id}`, {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { is_open: false },
    });
    assert(
      r.ok && Array.isArray(r.json) && r.json.length === 1 && r.json[0].is_open === false,
      `update did not apply: ${JSON.stringify(r.json)}`,
    );
  });

  // --- Public read policy (anon, no JWT at all) ---
  // Exercises restaurants_select_public_approved / menu_items_select_public_available
  // directly — none of the checks above ever query without a vendor JWT, so without
  // these the public-read half of each policy is never actually run.
  await check("anon can read restaurant 3 (approved)", async () => {
    const r = await rest("publishable", "GET", `/restaurants?id=eq.${restaurant3Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("anon CANNOT read restaurant 1 (pending)", async () => {
    const r = await rest("publishable", "GET", `/restaurants?id=eq.${restaurant1Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("anon can read restaurant 3's available menu_item", async () => {
    const r = await rest("publishable", "GET", `/menu_items?restaurant_id=eq.${restaurant3Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("anon CANNOT read any of restaurant 1's menu_items", async () => {
    const r = await rest("publishable", "GET", `/menu_items?restaurant_id=eq.${restaurant1Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("anon can read restaurant 3's menu_category", async () => {
    const r = await rest("publishable", "GET", `/menu_categories?restaurant_id=eq.${restaurant3Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("anon CANNOT read restaurant 1's menu_categories", async () => {
    const r = await rest("publishable", "GET", `/menu_categories?restaurant_id=eq.${restaurant1Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("anon can read restaurant 3's restaurant_hours", async () => {
    const r = await rest("publishable", "GET", `/restaurant_hours?restaurant_id=eq.${restaurant3Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("anon CANNOT read restaurant 1's restaurant_hours", async () => {
    const r = await rest("publishable", "GET", `/restaurant_hours?restaurant_id=eq.${restaurant1Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("anon can read restaurant 3's restaurant_banners", async () => {
    const r = await rest("publishable", "GET", `/restaurant_banners?restaurant_id=eq.${restaurant3Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `expected 1 row, got ${JSON.stringify(r.json)}`);
  });

  await check("anon CANNOT read restaurant 1's restaurant_banners", async () => {
    const r = await rest("publishable", "GET", `/restaurant_banners?restaurant_id=eq.${restaurant1Id}`);
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  // --- restaurants_insert_own (apps/vendor's self-heal on app-shell mount) ---
  // Uses vendorJwtOrg4 (active org = restaurant4Id), not the main vendorJwt,
  // so these don't interact with restaurant1's already-existing fixture row.
  await check("vendor can insert their own restaurant row (own org, writable columns only)", async () => {
    const r = await rest("publishable", "POST", "/restaurants", {
      jwt: vendorJwtOrg4,
      prefer: "return=representation",
      body: { id: restaurant4Id, name: "RLS Test Restaurant 4", is_open: false },
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 1, `insert failed: ${JSON.stringify(r.json)}`);
  });

  await check("vendor's self-insert defaults status to 'pending', not vendor-supplied", async () => {
    const r = await rest("service_role", "GET", `/restaurants?id=eq.${restaurant4Id}`);
    assert(
      r.json[0].status === "pending" && r.json[0].commission_rate_bps === 1000,
      `expected column defaults, got status=${r.json[0].status} commission_rate_bps=${r.json[0].commission_rate_bps}`,
    );
  });

  await check("vendor's insert naming a service-role-only column is rejected outright", async () => {
    const r = await rest("publishable", "POST", "/restaurants", {
      jwt: vendorJwtOrg4,
      prefer: "return=representation",
      body: { id: restaurant5Id, name: "RLS Test Restaurant 5", status: "approved" },
    });
    assert(!r.ok || (Array.isArray(r.json) && r.json.length === 0), `LEAK: insert succeeded: ${JSON.stringify(r.json)}`);
    const stillMissing = await rest("service_role", "GET", `/restaurants?id=eq.${restaurant5Id}`);
    assert(
      Array.isArray(stillMissing.json) && stillMissing.json.length === 0,
      `LEAK: row 5 exists despite the rejected insert: ${JSON.stringify(stillMissing.json)}`,
    );
  });

  await check("vendor CANNOT insert a restaurant row for an org that isn't their active one", async () => {
    const r = await rest("publishable", "POST", "/restaurants", {
      jwt: vendorJwtOrg4,
      prefer: "return=representation",
      body: { id: restaurant6Id, name: "RLS Test Restaurant 6" },
    });
    assert(!r.ok || (Array.isArray(r.json) && r.json.length === 0), `LEAK: insert succeeded: ${JSON.stringify(r.json)}`);
    const stillMissing = await rest("service_role", "GET", `/restaurants?id=eq.${restaurant6Id}`);
    assert(
      Array.isArray(stillMissing.json) && stillMissing.json.length === 0,
      `LEAK: row 6 exists despite the rejected cross-tenant insert: ${JSON.stringify(stillMissing.json)}`,
    );
  });

  // --- Leak checks ---
  await check("vendor CANNOT read restaurant 2's row", async () => {
    const r = await rest("publishable", "GET", `/restaurants?id=eq.${restaurant2Id}`, { jwt: vendorJwt });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT read restaurant 2's menu_items", async () => {
    const r = await rest("publishable", "GET", `/menu_items?restaurant_id=eq.${restaurant2Id}`, { jwt: vendorJwt });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT update restaurant 2's row", async () => {
    await rest("publishable", "PATCH", `/restaurants?id=eq.${restaurant2Id}`, {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { is_open: false },
    });
    // Whether the request errored or silently matched 0 rows, verify via
    // service role that the value is provably unchanged.
    const check2 = await rest("service_role", "GET", `/restaurants?id=eq.${restaurant2Id}`);
    assert(
      check2.json[0].is_open === true,
      `LEAK: restaurant 2's is_open was changed to ${check2.json[0].is_open}`,
    );
  });

  await check("vendor CANNOT self-approve their own restaurant (status)", async () => {
    await rest("publishable", "PATCH", `/restaurants?id=eq.${restaurant1Id}`, {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { status: "approved" },
    });
    const stillPending = await rest("service_role", "GET", `/restaurants?id=eq.${restaurant1Id}`);
    assert(
      stillPending.json[0].status === "pending",
      `LEAK: vendor self-approved their restaurant, status is now ${stillPending.json[0].status}`,
    );
  });

  await check("vendor CANNOT zero their own restaurant's commission_rate_bps", async () => {
    await rest("publishable", "PATCH", `/restaurants?id=eq.${restaurant1Id}`, {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { commission_rate_bps: 0 },
    });
    const check2 = await rest("service_role", "GET", `/restaurants?id=eq.${restaurant1Id}`);
    assert(
      check2.json[0].commission_rate_bps === 1000,
      `LEAK: vendor changed their own commission_rate_bps to ${check2.json[0].commission_rate_bps}`,
    );
  });

  await check("vendor CANNOT insert a menu_item into restaurant 2", async () => {
    const r = await rest("publishable", "POST", "/menu_items", {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: {
        restaurant_id: restaurant2Id,
        name: "Injected item",
        price_paise: 1,
        diet_type: "veg",
        gst_rate_bps: 500,
      },
    });
    assert(!r.ok || (Array.isArray(r.json) && r.json.length === 0), `LEAK: insert succeeded: ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT delete restaurant 2's menu_item", async () => {
    await rest("publishable", "DELETE", `/menu_items?id=eq.${item2.json[0].id}`, { jwt: vendorJwt });
    const stillThere = await rest("service_role", "GET", `/menu_items?id=eq.${item2.json[0].id}`);
    assert(stillThere.json.length === 1, "LEAK: restaurant 2's menu_item was deleted");
  });

  await check("vendor CANNOT read restaurant 2's menu_categories", async () => {
    const r = await rest("publishable", "GET", `/menu_categories?restaurant_id=eq.${restaurant2Id}`, {
      jwt: vendorJwt,
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT insert a menu_category into restaurant 2", async () => {
    const r = await rest("publishable", "POST", "/menu_categories", {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { restaurant_id: restaurant2Id, name: "Injected category" },
    });
    assert(!r.ok || (Array.isArray(r.json) && r.json.length === 0), `LEAK: insert succeeded: ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT delete restaurant 2's menu_category", async () => {
    await rest("publishable", "DELETE", `/menu_categories?id=eq.${category2.json[0].id}`, { jwt: vendorJwt });
    const stillThere = await rest("service_role", "GET", `/menu_categories?id=eq.${category2.json[0].id}`);
    assert(stillThere.json.length === 1, "LEAK: restaurant 2's menu_category was deleted");
  });

  await check("vendor CANNOT read restaurant 2's restaurant_hours", async () => {
    const r = await rest("publishable", "GET", `/restaurant_hours?restaurant_id=eq.${restaurant2Id}`, {
      jwt: vendorJwt,
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT insert a restaurant_hours row into restaurant 2", async () => {
    const r = await rest("publishable", "POST", "/restaurant_hours", {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { restaurant_id: restaurant2Id, day_of_week: 3, is_closed: true },
    });
    assert(!r.ok || (Array.isArray(r.json) && r.json.length === 0), `LEAK: insert succeeded: ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT delete restaurant 2's restaurant_hours", async () => {
    await rest("publishable", "DELETE", `/restaurant_hours?id=eq.${hours2.json[0].id}`, { jwt: vendorJwt });
    const stillThere = await rest("service_role", "GET", `/restaurant_hours?id=eq.${hours2.json[0].id}`);
    assert(stillThere.json.length === 1, "LEAK: restaurant 2's restaurant_hours was deleted");
  });

  await check("vendor CANNOT read restaurant 2's restaurant_banners", async () => {
    const r = await rest("publishable", "GET", `/restaurant_banners?restaurant_id=eq.${restaurant2Id}`, {
      jwt: vendorJwt,
    });
    assert(r.ok && Array.isArray(r.json) && r.json.length === 0, `LEAK: got ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT insert a restaurant_banner into restaurant 2", async () => {
    const r = await rest("publishable", "POST", "/restaurant_banners", {
      jwt: vendorJwt,
      prefer: "return=representation",
      body: { restaurant_id: restaurant2Id, image_url: "https://example.com/injected.webp" },
    });
    assert(!r.ok || (Array.isArray(r.json) && r.json.length === 0), `LEAK: insert succeeded: ${JSON.stringify(r.json)}`);
  });

  await check("vendor CANNOT delete restaurant 2's restaurant_banner", async () => {
    await rest("publishable", "DELETE", `/restaurant_banners?id=eq.${banner2.json[0].id}`, { jwt: vendorJwt });
    const stillThere = await rest("service_role", "GET", `/restaurant_banners?id=eq.${banner2.json[0].id}`);
    assert(stillThere.json.length === 1, "LEAK: restaurant 2's restaurant_banner was deleted");
  });

  console.log("\nTearing down fixtures...");
  await rest(
    "service_role",
    "DELETE",
    `/menu_items?restaurant_id=in.(${restaurant1Id},${restaurant2Id},${restaurant3Id})`,
  );
  await rest(
    "service_role",
    "DELETE",
    `/menu_categories?restaurant_id=in.(${restaurant1Id},${restaurant2Id},${restaurant3Id})`,
  );
  await rest(
    "service_role",
    "DELETE",
    `/restaurant_hours?restaurant_id=in.(${restaurant1Id},${restaurant2Id},${restaurant3Id})`,
  );
  await rest(
    "service_role",
    "DELETE",
    `/restaurant_banners?restaurant_id=in.(${restaurant1Id},${restaurant2Id},${restaurant3Id})`,
  );
  // restaurant5Id/restaurant6Id never got rows (their inserts were rejected
  // by design) — included here anyway since DELETE ... IN matching zero rows
  // is a harmless no-op, and it keeps this line correct if that ever changes.
  await rest(
    "service_role",
    "DELETE",
    `/restaurants?id=in.(${restaurant1Id},${restaurant2Id},${restaurant3Id},${restaurant4Id},${restaurant5Id},${restaurant6Id})`,
  );
  await clerk("POST", `/sessions/${session.id}/revoke`).catch((e) => console.warn("cleanup warning:", e.message));
  await clerk("POST", `/sessions/${session4.id}/revoke`).catch((e) => console.warn("cleanup warning:", e.message));
  await clerk("DELETE", `/organizations/${restaurant1Id}`).catch((e) => console.warn("cleanup warning:", e.message));
  await clerk("DELETE", `/organizations/${restaurant2Id}`).catch((e) => console.warn("cleanup warning:", e.message));
  await clerk("DELETE", `/organizations/${restaurant3Id}`).catch((e) => console.warn("cleanup warning:", e.message));
  await clerk("DELETE", `/organizations/${restaurant4Id}`).catch((e) => console.warn("cleanup warning:", e.message));
  await clerk("DELETE", `/organizations/${restaurant5Id}`).catch((e) => console.warn("cleanup warning:", e.message));
  await clerk("DELETE", `/organizations/${restaurant6Id}`).catch((e) => console.warn("cleanup warning:", e.message));
  await clerk("DELETE", `/users/${vendorUser.id}`).catch((e) => console.warn("cleanup warning:", e.message));

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.error(`\n${failed.length} FAILING CHECK(S):`);
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("test-rls.ts crashed before completing:", err);
  process.exit(1);
});
