import Link from "next/link";
import { Suspense } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { Pagination } from "@/components/Pagination";
import { RestaurantsSearch } from "./RestaurantsSearch";
import type { RestaurantStatus } from "@zaavo/shared";

const STATUS_TABS: { label: string; value: RestaurantStatus | "all" }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Suspended", value: "suspended" },
  { label: "All", value: "all" },
];

const STATUS_STYLES: Record<RestaurantStatus, string> = {
  pending: "bg-secondary/15 text-secondary-dark",
  approved: "bg-veg/10 text-veg",
  rejected: "bg-non-veg/10 text-non-veg",
  suspended: "bg-border text-primary-dark",
};

const AVATAR_TINTS = ["bg-primary/10 text-primary", "bg-secondary/15 text-secondary-dark", "bg-veg/10 text-veg"];

const PAGE_SIZE = 20;

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; query?: string }>;
}) {
  const { status, page: pageParam, query: nameQuery } = await searchParams;
  const activeTab = (status as RestaurantStatus | undefined) ?? "pending";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const trimmedQuery = (nameQuery ?? "").trim();

  const supabase = await getSupabaseClient();
  let dbQuery = supabase
    .from("restaurants")
    .select("id, name, status, commission_rate_bps, gst_status, is_pure_veg, created_at, logo_url", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (activeTab !== ("all" as string)) {
    dbQuery = dbQuery.eq("status", activeTab);
  }
  if (trimmedQuery) {
    dbQuery = dbQuery.ilike("name", `%${trimmedQuery}%`);
  }

  const { data: restaurants, error, count } = await dbQuery;

  const makeHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (activeTab !== "pending") params.set("status", activeTab);
    if (trimmedQuery) params.set("query", trimmedQuery);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/restaurants?${qs}` : "/restaurants";
  };

  const makeTabHref = (tabValue: string) => {
    const params = new URLSearchParams();
    if (tabValue !== "pending") params.set("status", tabValue);
    if (trimmedQuery) params.set("query", trimmedQuery);
    const qs = params.toString();
    return qs ? `/restaurants?${qs}` : "/restaurants";
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-primary">Restaurants</h1>
        <p className="text-sm text-primary-dark">{count ?? 0} in this view</p>
      </div>

      <div className="mt-5 flex gap-1.5">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={makeTabHref(tab.value)}
            scroll={false}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-primary text-white"
                : "bg-card text-primary-dark border border-border hover:border-primary/30"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Suspense fallback={null}>
        <RestaurantsSearch />
      </Suspense>

      {error ? (
        <p className="mt-6 text-sm text-non-veg">Couldn&apos;t load restaurants: {error.message}</p>
      ) : (restaurants ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card py-16">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-9 w-9 text-border">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5 12 4l9 5.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5V19a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V9.5" />
          </svg>
          <p className="text-sm text-primary-dark">
            {trimmedQuery ? `No restaurants match "${trimmedQuery}" in this status.` : "No restaurants in this status."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-card border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-primary-dark">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Commission</th>
                  <th className="px-5 py-3">GST</th>
                  <th className="px-5 py-3">Pure veg</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {(restaurants ?? []).map((r, i) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/restaurants/${r.id}`} className="flex items-center gap-3">
                        {r.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external R2 URL
                          <img src={r.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
                        ) : (
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}
                          >
                            {r.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="font-medium text-primary hover:underline">{r.name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-primary-dark">{(r.commission_rate_bps / 100).toFixed(2)}%</td>
                    <td className="px-5 py-3.5 text-primary-dark capitalize">{r.gst_status}</td>
                    <td className="px-5 py-3.5 text-primary-dark">{r.is_pure_veg ? "Yes" : "No"}</td>
                    <td className="px-5 py-3.5 text-primary-dark">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} totalCount={count ?? 0} makeHref={makeHref} />
        </>
      )}
    </div>
  );
}
