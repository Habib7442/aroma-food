import { getSupabaseClient } from "@/lib/supabase";
import { Pagination } from "@/components/Pagination";
import { CuisineRow } from "./CuisineRow";
import { CreateCuisineForm } from "./CreateCuisineForm";

const PAGE_SIZE = 12;

export default async function CuisinesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await getSupabaseClient();
  const {
    data: cuisines,
    error,
    count,
  } = await supabase
    .from("cuisines")
    .select("id, name, sort_order, image_url", { count: "exact" })
    .order("sort_order")
    .range(from, to);

  const makeHref = (targetPage: number) => (targetPage > 1 ? `/cuisines?page=${targetPage}` : "/cuisines");

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-primary">Cuisines</h1>
      <p className="mt-1 text-sm text-primary-dark">Shown as filters and tags across the customer app.</p>

      <CreateCuisineForm />

      {error ? (
        <p className="mt-6 text-sm text-non-veg">Couldn&apos;t load cuisines: {error.message}</p>
      ) : (cuisines ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card py-16">
          <p className="text-sm text-primary-dark">No cuisines yet.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-card border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-primary-dark">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Sort</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(cuisines ?? []).map((c) => (
                  <CuisineRow key={c.id} id={c.id} name={c.name} sortOrder={c.sort_order} />
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
