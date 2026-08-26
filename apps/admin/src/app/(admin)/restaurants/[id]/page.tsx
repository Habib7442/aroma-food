import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { MenuControls } from "./MenuControls";
import { RestaurantApprovalForm } from "./RestaurantApprovalForm";
import type { DietType } from "@zaavo/shared";

const DIET_STYLES: Record<DietType, string> = {
  veg: "bg-veg/10 text-veg",
  egg: "bg-egg/10 text-egg",
  non_veg: "bg-non-veg/10 text-non-veg",
};
const DIET_LABELS: Record<DietType, string> = { veg: "Veg", egg: "Egg", non_veg: "Non-veg" };

interface MenuItemRow {
  id: string;
  name: string;
  price_paise: number;
  diet_type: DietType;
  is_available: boolean;
  category_id: string | null;
  thumbnail_url: string | null;
}

const UNCATEGORIZED_SECTION_ID = "uncategorized";
// Categories per page, not dishes — keeps every category's dishes together
// on one page instead of splitting a category awkwardly across two pages.
const CATEGORIES_PAGE_SIZE = 3;
// Search cuts across categories, so it isn't paginated the same way — a
// generous cap instead, with a "refine your search" hint if it's hit.
const SEARCH_RESULTS_LIMIT = 40;

export default async function RestaurantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ menuPage?: string; menuQuery?: string }>;
}) {
  const { id } = await params;
  const { menuPage: menuPageParam, menuQuery: menuQueryParam } = await searchParams;
  const menuPage = Math.max(1, Number(menuPageParam) || 1);
  const menuQuery = (menuQueryParam ?? "").trim();
  const isSearching = menuQuery.length > 0;

  const supabase = await getSupabaseClient();
  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !restaurant) {
    notFound();
  }

  // Admin-only read policies (menu_categories_select_admin /
  // menu_items_select_admin) — this is oversight for the approval decision
  // below, not an editable view; there's no admin write policy on either
  // table (see apps/admin/AGENTS.md §8), so this section is display-only.
  let menuSections: { id: string; title: string; items: MenuItemRow[] }[] = [];
  let categoryCount = 0;
  let searchResultCount = 0;

  if (isSearching) {
    // Search cuts across every category, so category-based pagination
    // doesn't apply — a capped, ungrouped result list instead.
    const { data: matched, count } = await supabase
      .from("menu_items")
      .select("id, name, price_paise, diet_type, is_available, category_id, thumbnail_url", { count: "exact" })
      .eq("restaurant_id", id)
      .ilike("name", `%${menuQuery}%`)
      .order("name")
      .limit(SEARCH_RESULTS_LIMIT);
    searchResultCount = count ?? 0;
    if (matched?.length) menuSections = [{ id: "search", title: `Matching "${menuQuery}"`, items: matched }];
  } else {
    // Paginated by category (not a flat dish range) so a category's dishes
    // never get split across two pages. The uncategorized/orphaned bucket
    // only has meaning once every real category has been paged through, so
    // it's appended on the last page rather than needing its own page.
    const categoriesFrom = (menuPage - 1) * CATEGORIES_PAGE_SIZE;
    const categoriesTo = categoriesFrom + CATEGORIES_PAGE_SIZE - 1;
    const { data: categoriesPage, count } = await supabase
      .from("menu_categories")
      .select("id, name, sort_order", { count: "exact" })
      .eq("restaurant_id", id)
      .order("sort_order")
      .order("name")
      .range(categoriesFrom, categoriesTo);
    categoryCount = count ?? 0;

    const isLastMenuPage = menuPage * CATEGORIES_PAGE_SIZE >= categoryCount;
    const categoryIdsOnPage = (categoriesPage ?? []).map((c) => c.id);

    let menuItemsQuery = supabase
      .from("menu_items")
      .select("id, name, price_paise, diet_type, is_available, category_id, thumbnail_url")
      .eq("restaurant_id", id)
      .order("name");
    menuItemsQuery = isLastMenuPage
      ? menuItemsQuery.or(`category_id.in.(${categoryIdsOnPage.join(",") || "00000000-0000-0000-0000-000000000000"}),category_id.is.null`)
      : menuItemsQuery.in("category_id", categoryIdsOnPage.length ? categoryIdsOnPage : ["00000000-0000-0000-0000-000000000000"]);
    const { data: menuItems } = await menuItemsQuery;

    const byCategory = new Map<string, MenuItemRow[]>();
    for (const item of menuItems ?? []) {
      const key = item.category_id ?? UNCATEGORIZED_SECTION_ID;
      const bucket = byCategory.get(key);
      if (bucket) bucket.push(item);
      else byCategory.set(key, [item]);
    }
    for (const category of categoriesPage ?? []) {
      const bucket = byCategory.get(category.id);
      if (bucket?.length) menuSections.push({ id: category.id, title: category.name, items: bucket });
    }
    if (isLastMenuPage) {
      const uncategorized = byCategory.get(UNCATEGORIZED_SECTION_ID);
      if (uncategorized?.length) menuSections.push({ id: UNCATEGORIZED_SECTION_ID, title: "Other", items: uncategorized });
    }
  }

  const { count: totalDishCount } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", id);

  return (
    <div className="@container/page max-w-5xl">
      <Link href="/restaurants" className="inline-flex items-center gap-1 text-sm text-primary-dark hover:text-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
        Restaurants
      </Link>

      {restaurant.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- external R2 URL; a plain <img> avoids needing next.config remotePatterns for an internal tool
        <img
          src={restaurant.cover_url}
          alt=""
          className="mt-3 h-48 w-full rounded-card border border-border object-cover"
        />
      ) : null}

      <div className="mt-4 flex items-center gap-4">
        {restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- external R2 URL
          <img
            src={restaurant.logo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-2xl border border-border object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
            {restaurant.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-primary">{restaurant.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                restaurant.is_open ? "bg-veg/10 text-veg" : "bg-non-veg/10 text-non-veg"
              }`}
            >
              {restaurant.is_open ? "Open" : "Closed"}
            </span>
          </div>
          <p className="text-sm text-primary-dark">{restaurant.description ?? "No description."}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 @3xl/page:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-card border border-border bg-card p-6 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-primary-dark">Contact phone</div>
            <div className="text-xs font-medium uppercase tracking-wide text-primary-dark">Contact email</div>
            <div className="text-primary">{restaurant.contact_phone ?? "—"}</div>
            <div className="text-primary">{restaurant.contact_email ?? "—"}</div>

            <div className="mt-2 text-xs font-medium uppercase tracking-wide text-primary-dark">Address</div>
            <div className="mt-2 text-xs font-medium uppercase tracking-wide text-primary-dark">GSTIN</div>
            <div className="text-primary">
              {[restaurant.address, restaurant.landmark, restaurant.pincode].filter(Boolean).join(", ") || "—"}
            </div>
            <div className="text-primary">{restaurant.gstin ?? "—"}</div>

            <div className="mt-2 text-xs font-medium uppercase tracking-wide text-primary-dark">Location</div>
            <div className="mt-2 text-xs font-medium uppercase tracking-wide text-primary-dark">Signed up</div>
            <div className="text-primary">
              {restaurant.lat && restaurant.lng ? (
                <a
                  href={`https://maps.google.com/?q=${restaurant.lat},${restaurant.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {restaurant.lat.toFixed(5)}, {restaurant.lng.toFixed(5)}
                </a>
              ) : (
                "—"
              )}
            </div>
            <div className="text-primary">{new Date(restaurant.created_at).toLocaleDateString()}</div>
          </div>

          <div className="@container/menu rounded-card border border-border bg-card p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-primary">Menu</h2>
              <p className="text-xs text-primary-dark">
                {isSearching ? `${searchResultCount} matching` : `${totalDishCount ?? 0} dishes`}
              </p>
            </div>

            <div className="mt-3">
              <Suspense fallback={null}>
                <MenuControls
                  page={menuPage}
                  totalPages={Math.max(1, Math.ceil(categoryCount / CATEGORIES_PAGE_SIZE))}
                  isSearching={isSearching}
                >
                  {menuSections.length === 0 ? (
                    <p className="mt-4 text-sm text-primary-dark">
                      {isSearching ? `No dishes match "${menuQuery}".` : "No dishes on this restaurant's menu yet."}
                    </p>
                  ) : (
                    <div className="mt-4 flex flex-col gap-5">
                      {menuSections.map((section) => (
                        <div key={section.id}>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary-dark">{section.title}</p>
                          <div className="grid grid-cols-1 gap-2 @sm/menu:grid-cols-2">
                            {section.items.map((item) => (
                              <div key={item.id} className="flex items-start gap-2.5 rounded-xl border border-border px-3 py-2">
                                {item.thumbnail_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- external R2 URL
                                  <img
                                    src={item.thumbnail_url}
                                    alt=""
                                    className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
                                  />
                                ) : (
                                  <span className="h-9 w-9 shrink-0 rounded-lg bg-background" />
                                )}
                                <span
                                  title={item.name}
                                  className={`flex-1 text-sm ${
                                    item.is_available ? "text-primary" : "text-primary-dark line-through"
                                  }`}
                                >
                                  {item.name}
                                </span>
                                <span
                                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DIET_STYLES[item.diet_type]}`}
                                >
                                  {DIET_LABELS[item.diet_type]}
                                </span>
                                <span className="mt-0.5 w-14 shrink-0 text-right text-sm font-medium text-primary">
                                  {(item.price_paise / 100).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {isSearching && searchResultCount > SEARCH_RESULTS_LIMIT ? (
                        <p className="text-xs text-primary-dark">
                          Showing the first {SEARCH_RESULTS_LIMIT} of {searchResultCount} matches — refine your search to narrow it
                          down.
                        </p>
                      ) : null}
                    </div>
                  )}
                </MenuControls>
              </Suspense>
            </div>
          </div>
        </div>

        <RestaurantApprovalForm id={id} restaurant={restaurant} />
      </div>
    </div>
  );
}
