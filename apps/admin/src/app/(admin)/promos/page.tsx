import { getSupabaseClient } from "@/lib/supabase";
import { CreatePromoForm } from "./CreatePromoForm";
import { PromoRow } from "./PromoRow";

export default async function PromosPage() {
  const supabase = await getSupabaseClient();
  const { data: banners, error } = await supabase
    .from("platform_banners")
    .select("id, media_type, media_url, sort_order, is_active")
    .order("sort_order");

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-primary">Platform Promos</h1>
      <p className="mt-1 text-sm text-primary-dark">
        Shown in the promo carousel at the top of the customer app&apos;s home screen.
      </p>

      <CreatePromoForm />

      {error ? (
        <p className="mt-6 text-sm text-non-veg">Couldn&apos;t load promos: {error.message}</p>
      ) : (banners ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card py-16">
          <p className="text-sm text-primary-dark">No promos yet.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-card">
          {(banners ?? []).map((banner) => (
            <PromoRow
              key={banner.id}
              id={banner.id}
              mediaType={banner.media_type}
              mediaUrl={banner.media_url}
              sortOrder={banner.sort_order}
              isActive={banner.is_active}
            />
          ))}
        </div>
      )}
    </div>
  );
}
