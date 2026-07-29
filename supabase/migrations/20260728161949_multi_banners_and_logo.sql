-- Promo banners become multi (a vendor asked for more than one), and a
-- restaurant logo is added — same R2 upload path, one more entity type.
-- No existing data to migrate: confirmed live, restaurants.promo_banner_url
-- is null for every row so far.

alter table restaurants drop column promo_banner_url;

alter table restaurants
  add column logo_url text;

grant update (logo_url) on restaurants to authenticated;

create table restaurant_banners (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on restaurant_banners
  for each row execute function set_updated_at();

create index restaurant_banners_restaurant_id_idx on restaurant_banners (restaurant_id, sort_order);

-- RLS: same shape as menu_categories — full-row vendor ownership, public
-- read only for approved restaurants (customer app can show a restaurant's
-- banners on its page later).
alter table restaurant_banners enable row level security;

create policy "restaurant_banners_select_public"
on restaurant_banners for select
to anon, authenticated
using (
  exists (
    select 1 from restaurants r
    where r.id = restaurant_banners.restaurant_id and r.status = 'approved'
  )
);

create policy "restaurant_banners_select_own"
on restaurant_banners for select
to authenticated
using (restaurant_id = (select auth_org_id()));

create policy "restaurant_banners_select_admin"
on restaurant_banners for select
to authenticated
using ((select is_super_admin()));

create policy "restaurant_banners_insert_own"
on restaurant_banners for insert
to authenticated
with check (restaurant_id = (select auth_org_id()));

create policy "restaurant_banners_update_own"
on restaurant_banners for update
to authenticated
using (restaurant_id = (select auth_org_id()))
with check (restaurant_id = (select auth_org_id()));

create policy "restaurant_banners_delete_own"
on restaurant_banners for delete
to authenticated
using (restaurant_id = (select auth_org_id()));
