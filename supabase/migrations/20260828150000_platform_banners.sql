-- Platform-wide promotional banners shown on the customer home screen —
-- distinct from restaurant_banners (per-restaurant, vendor-managed). Admin
-- (super-admin) only; writes go through apps/admin's service-role client
-- with an explicit sessionClaims.superAdmin check in the Server Action,
-- the same pattern already used for restaurant approval — so there is
-- deliberately no insert/update/delete RLS policy for `authenticated`
-- here at all. A stray write attempt through the normal client fails
-- closed rather than needing a column-grant workaround.
create type platform_banner_media_type as enum ('image', 'video', 'youtube');

create table platform_banners (
  id uuid primary key default gen_random_uuid(),
  media_type platform_banner_media_type not null,
  -- Image: public image URL. Video: public video file URL (uploaded to the
  -- platform-promos bucket below). YouTube: the full watch/share URL —
  -- resolving it to an embeddable id/thumbnail is a client-side concern.
  media_url text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on platform_banners
  for each row execute function set_updated_at();

create index platform_banners_sort_order_idx on platform_banners (sort_order);

alter table platform_banners enable row level security;

create policy "platform_banners_select_public"
on platform_banners for select
to anon, authenticated
using (is_active);

create policy "platform_banners_select_admin"
on platform_banners for select
to authenticated
using ((select is_super_admin()));

-- Storage: platform-promos bucket for uploaded images/videos (a YouTube
-- banner stores only a URL, nothing uploaded). Public bucket — this is
-- marketing content, not sensitive, same reasoning as menu-pdfs and
-- restaurant_banners. Capped at 50MB and restricted to actual image/video
-- types so it can't be used to host arbitrary files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-promos',
  'platform-promos',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

-- Mirrors menu_pdfs_select_public's shape — the bucket's own public flag
-- already serves objects via the public URL path without RLS, but this
-- keeps the anon/authenticated REST path consistent with every other
-- public bucket in this project. No insert/delete policy for
-- `authenticated`: uploads/deletes go through the service-role key only.
create policy "platform_promos_select_public"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'platform-promos');
