-- PDF menu import feature: adds per-restaurant menu categories (Starters,
-- Mains, ... — distinct from the global `cuisines` taxonomy), a packaging
-- charge column, and widens the GST slab a restaurant's items can be tagged
-- with from (5%, 18%) to (5%, 40%) — confirmed intentional, not a typo for
-- 18%.

-- ===========================================================================
-- menu_categories
-- ===========================================================================
create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create trigger set_updated_at before update on menu_categories
  for each row execute function set_updated_at();

-- ===========================================================================
-- menu_items: new columns + widened GST slab
-- ===========================================================================
alter table menu_items
  add column category_id uuid references menu_categories (id) on delete set null;

-- Not a safety-critical field like diet_type — nullable is fine; existing
-- rows and anything the PDF-import review screen doesn't map simply have no
-- category yet.

alter table menu_items
  add column packaging_charge_paise bigint not null default 0
    check (packaging_charge_paise >= 0);

alter table menu_items drop constraint menu_items_gst_rate_bps_check;
alter table menu_items
  add constraint menu_items_gst_rate_bps_check check (gst_rate_bps in (500, 4000));

-- ===========================================================================
-- RLS: menu_categories — exact same shape as menu_items' policies in the
-- slice-1 migration (full-row vendor ownership, no column-grant case here).
-- ===========================================================================
alter table menu_categories enable row level security;

create policy "menu_categories_select_public"
on menu_categories for select
to anon, authenticated
using (
  exists (
    select 1 from restaurants r
    where r.id = menu_categories.restaurant_id and r.status = 'approved'
  )
);

create policy "menu_categories_select_own"
on menu_categories for select
to authenticated
using (restaurant_id = (select auth_org_id()));

create policy "menu_categories_select_admin"
on menu_categories for select
to authenticated
using ((select is_super_admin()));

create policy "menu_categories_insert_own"
on menu_categories for insert
to authenticated
with check (restaurant_id = (select auth_org_id()));

create policy "menu_categories_update_own"
on menu_categories for update
to authenticated
using (restaurant_id = (select auth_org_id()))
with check (restaurant_id = (select auth_org_id()));

create policy "menu_categories_delete_own"
on menu_categories for delete
to authenticated
using (restaurant_id = (select auth_org_id()));

-- ===========================================================================
-- Indexes
-- ===========================================================================
create index menu_items_category_id_idx on menu_items (category_id);
create index menu_categories_restaurant_id_idx on menu_categories (restaurant_id);

-- ===========================================================================
-- Storage: menu-pdfs bucket for the PDF-import feature
-- ===========================================================================
-- Public bucket: menu PDFs aren't sensitive, and public read is what lets
-- the extract-menu-pdf Edge Function fetch them with a plain GET instead of
-- needing a signed URL / service-role fetch.
insert into storage.buckets (id, name, public)
values ('menu-pdfs', 'menu-pdfs', true)
on conflict (id) do nothing;

-- Uploads are scoped to a path prefixed with the vendor's own org id
-- (menu-pdfs/{orgId}/...), enforced the same way as every other
-- vendor-owns-this-row check in this project.
create policy "menu_pdfs_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'menu-pdfs'
  and (select auth_org_id()) = (storage.foldername(name))[1]
);

create policy "menu_pdfs_select_public"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'menu-pdfs');
