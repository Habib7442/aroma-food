#!/usr/bin/env -S npx tsx
/**
 * Seeds slice 1 (vendor onboarding + menu management) dev data via
 * @supabase/supabase-js, using the service_role key to bypass RLS —
 * same SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY pair scripts/test-rls.ts
 * already relies on. No psql, no direct Postgres connection.
 *
 * Every insert below is an upsert against an explicit conflict target, so
 * running this twice never creates duplicate rows:
 *   - cuisines:            onConflict "name" (existing unique constraint)
 *   - restaurants:         onConflict "id" (primary key, ids below are fixed)
 *   - restaurant_cuisines: onConflict "restaurant_id,cuisine_id" (existing
 *                          unique constraint)
 *   - menu_items:          onConflict "id" — there's no unique constraint on
 *                          (restaurant_id, name) to upsert against, so the
 *                          ids below are hardcoded fixed UUIDs rather than
 *                          left to gen_random_uuid()'s default.
 */

import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const VEG_KITCHEN_ID = "org_2seedvegkitchen01";
const SPICE_HOUSE_ID = "org_2seedspicehouse01";

// PRD §6.2's exact cuisine tile list.
const CUISINES = [
  { name: "Biryani", image_url: null, sort_order: 1 },
  { name: "Chinese", image_url: null, sort_order: 2 },
  { name: "Tandoor", image_url: null, sort_order: 3 },
  { name: "North Indian", image_url: null, sort_order: 4 },
  { name: "South Indian", image_url: null, sort_order: 5 },
  { name: "Rolls", image_url: null, sort_order: 6 },
  { name: "Momos", image_url: null, sort_order: 7 },
  { name: "Combos/Thali", image_url: null, sort_order: 8 },
  { name: "Desserts", image_url: null, sort_order: 9 },
  { name: "Beverages", image_url: null, sort_order: 10 },
];

const RESTAURANTS = [
  {
    id: VEG_KITCHEN_ID,
    name: "Aroma Pure Veg Kitchen",
    description: "South Indian and North Indian vegetarian thalis, tiffin, and desserts.",
    lat: 24.8333,
    lng: 92.7789,
    is_pure_veg: true,
    status: "approved",
    commission_rate_bps: 1000,
    gst_status: "unregistered",
    gstin: null,
    is_open: true,
  },
  {
    id: SPICE_HOUSE_ID,
    name: "Silchar Spice House",
    description: "Biryani, tandoor, and Chinese — dine-in and delivery.",
    lat: 24.8258,
    lng: 92.7712,
    is_pure_veg: false,
    status: "approved",
    commission_rate_bps: 1000,
    gst_status: "registered",
    gstin: "18AABCS1429B1ZP",
    is_open: true,
  },
];

const RESTAURANT_CUISINE_NAMES: Record<string, string[]> = {
  [VEG_KITCHEN_ID]: ["South Indian", "North Indian", "Combos/Thali", "Desserts", "Beverages"],
  [SPICE_HOUSE_ID]: ["Biryani", "Tandoor", "North Indian", "Chinese"],
};

// Fixed ids so a second run upserts onto the same rows instead of inserting
// duplicates — there's no unique constraint on (restaurant_id, name).
const MENU_ITEMS: Array<{
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price_paise: number;
  diet_type: "veg" | "egg" | "non_veg";
  gst_rate_bps: number;
  cuisine_names: string[];
  is_healthy: boolean;
  is_available: boolean;
}> = [
  // Aroma Pure Veg Kitchen (is_pure_veg = true) -> every item is diet_type
  // 'veg', deliberately never 'egg' — a "pure veg" Indian kitchen serves
  // neither meat nor egg.
  {
    id: "ec255384-60a8-4011-9907-e9ea954b5715",
    restaurant_id: VEG_KITCHEN_ID,
    name: "Masala Dosa",
    description: "Crisp rice crepe, potato masala, sambar, chutney.",
    price_paise: 9000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["South Indian"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "bde5e53f-67cb-4d1a-8aca-9e0fa72d6e20",
    restaurant_id: VEG_KITCHEN_ID,
    name: "Idli Sambar",
    description: "Steamed rice cakes with sambar and coconut chutney.",
    price_paise: 7000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["South Indian"],
    is_healthy: true,
    is_available: true,
  },
  {
    id: "27b1cece-413c-4c52-8319-62829eef446c",
    restaurant_id: VEG_KITCHEN_ID,
    name: "Paneer Butter Masala",
    description: "Paneer in a creamy tomato gravy.",
    price_paise: 22000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["North Indian"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "fbb0a346-9b14-4ca6-82b9-8da7e9b73ace",
    restaurant_id: VEG_KITCHEN_ID,
    name: "Dal Makhani",
    description: "Slow-cooked black lentils with butter and cream.",
    price_paise: 20000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["North Indian"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "b540bc48-e2db-4e15-af57-d6c3f9cf9ede",
    restaurant_id: VEG_KITCHEN_ID,
    name: "Veg Thali",
    description: "Dal, sabzi, rice, roti, salad, and a sweet.",
    price_paise: 18000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["Combos/Thali"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "0457a012-2cf8-4490-9ecb-ea87ebffce01",
    restaurant_id: VEG_KITCHEN_ID,
    name: "Gulab Jamun",
    description: "Milk-solid dumplings in sugar syrup, two pieces.",
    price_paise: 6000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["Desserts"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "db51f0be-964e-4a42-9ef6-41d7cc9dbbe5",
    restaurant_id: VEG_KITCHEN_ID,
    name: "Filter Coffee",
    description: "South Indian filter coffee.",
    price_paise: 4000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["Beverages"],
    is_healthy: false,
    is_available: true,
  },
  // Silchar Spice House (is_pure_veg = false) -> realistic veg/egg/non_veg mix.
  {
    id: "ce891c1e-3a91-4d21-bdfc-4e737e9e6d4a",
    restaurant_id: SPICE_HOUSE_ID,
    name: "Chicken Biryani",
    description: "Slow-cooked basmati rice with chicken and spices.",
    price_paise: 28000,
    diet_type: "non_veg",
    gst_rate_bps: 500,
    cuisine_names: ["Biryani"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "b97f6150-006a-4378-bbda-644abdb2c34d",
    restaurant_id: SPICE_HOUSE_ID,
    name: "Mutton Biryani",
    description: "Slow-cooked basmati rice with mutton and spices.",
    price_paise: 35000,
    diet_type: "non_veg",
    gst_rate_bps: 500,
    cuisine_names: ["Biryani"],
    is_healthy: false,
    is_available: false,
  },
  {
    id: "b0f1be40-37be-460f-a2d6-de7e96084cfa",
    restaurant_id: SPICE_HOUSE_ID,
    name: "Veg Biryani",
    description: "Basmati rice with mixed vegetables and spices.",
    price_paise: 20000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["Biryani"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "48c75dcd-222e-48e4-adb1-90453f48425c",
    restaurant_id: SPICE_HOUSE_ID,
    name: "Tandoori Chicken (Half)",
    description: "Charcoal-grilled marinated chicken.",
    price_paise: 25000,
    diet_type: "non_veg",
    gst_rate_bps: 500,
    cuisine_names: ["Tandoor"],
    is_healthy: true,
    is_available: true,
  },
  {
    id: "4cfe89c0-5225-4f76-aac3-2eaeea697ea1",
    restaurant_id: SPICE_HOUSE_ID,
    name: "Paneer Tikka",
    description: "Charcoal-grilled marinated paneer.",
    price_paise: 22000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["Tandoor"],
    is_healthy: true,
    is_available: true,
  },
  {
    id: "5a33b69d-6028-4fcb-976f-7a61d819e504",
    restaurant_id: SPICE_HOUSE_ID,
    name: "Egg Curry",
    description: "Boiled eggs in a spiced onion-tomato gravy.",
    price_paise: 15000,
    diet_type: "egg",
    gst_rate_bps: 500,
    cuisine_names: ["North Indian"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "18ec4151-87fd-4df4-97a2-ffff054d2faa",
    restaurant_id: SPICE_HOUSE_ID,
    name: "Chicken Chilli",
    description: "Indo-Chinese stir-fried chicken.",
    price_paise: 23000,
    diet_type: "non_veg",
    gst_rate_bps: 500,
    cuisine_names: ["Chinese"],
    is_healthy: false,
    is_available: true,
  },
  {
    id: "8dc9b758-3f92-46b0-847f-9137c40f659c",
    restaurant_id: SPICE_HOUSE_ID,
    name: "Veg Hakka Noodles",
    description: "Indo-Chinese stir-fried noodles with vegetables.",
    price_paise: 16000,
    diet_type: "veg",
    gst_rate_bps: 500,
    cuisine_names: ["Chinese"],
    is_healthy: true,
    is_available: true,
  },
];

async function main() {
  console.log("Upserting cuisines...");
  const { data: cuisineRows, error: cuisineError } = await supabase
    .from("cuisines")
    .upsert(CUISINES, { onConflict: "name" })
    .select("id, name");
  if (cuisineError) throw new Error(`cuisines upsert failed: ${cuisineError.message}`);
  const cuisineIdByName = new Map((cuisineRows ?? []).map((c) => [c.name as string, c.id as string]));
  console.log(`  ${cuisineRows?.length ?? 0} cuisines upserted.`);

  console.log("Upserting restaurants...");
  const { error: restaurantError } = await supabase
    .from("restaurants")
    .upsert(RESTAURANTS, { onConflict: "id" });
  if (restaurantError) throw new Error(`restaurants upsert failed: ${restaurantError.message}`);
  console.log(`  ${RESTAURANTS.length} restaurants upserted.`);

  console.log("Upserting restaurant_cuisines...");
  const restaurantCuisineRows = Object.entries(RESTAURANT_CUISINE_NAMES).flatMap(
    ([restaurantId, names]) =>
      names.map((name) => {
        const cuisineId = cuisineIdByName.get(name);
        if (!cuisineId) throw new Error(`Unknown cuisine name in seed data: ${name}`);
        return { restaurant_id: restaurantId, cuisine_id: cuisineId };
      }),
  );
  const { error: restaurantCuisineError } = await supabase
    .from("restaurant_cuisines")
    .upsert(restaurantCuisineRows, { onConflict: "restaurant_id,cuisine_id" });
  if (restaurantCuisineError) {
    throw new Error(`restaurant_cuisines upsert failed: ${restaurantCuisineError.message}`);
  }
  console.log(`  ${restaurantCuisineRows.length} restaurant_cuisines upserted.`);

  console.log("Upserting menu_items...");
  const menuItemRows = MENU_ITEMS.map(({ cuisine_names, ...item }) => ({
    ...item,
    cuisine_ids: cuisine_names.map((name) => {
      const cuisineId = cuisineIdByName.get(name);
      if (!cuisineId) throw new Error(`Unknown cuisine name in seed data: ${name}`);
      return cuisineId;
    }),
  }));
  const { error: menuItemError } = await supabase
    .from("menu_items")
    .upsert(menuItemRows, { onConflict: "id" });
  if (menuItemError) throw new Error(`menu_items upsert failed: ${menuItemError.message}`);
  console.log(`  ${menuItemRows.length} menu_items upserted.`);

  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error("seed.ts failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
