-- Cloudflare R2 image upload feature: dish photos (menu_items.image_url
-- already existed from slice 1), a matching thumbnail for list views (never
-- fetch the full 1200px image where a 400px thumbnail is what's on screen),
-- category images, and a single per-restaurant promo banner.

alter table menu_items
  add column thumbnail_url text;

alter table menu_categories
  add column image_url text,
  add column thumbnail_url text;

alter table restaurants
  add column promo_banner_url text;

-- Same column-grant pattern as the slice-1 migration's `grant update (name,
-- description, cover_url, lat, lng, gstin, is_open)` — Postgres column
-- privileges accumulate across grants, so this adds promo_banner_url to a
-- vendor's existing writable set without needing to repeat the others.
grant update (promo_banner_url) on restaurants to authenticated;
