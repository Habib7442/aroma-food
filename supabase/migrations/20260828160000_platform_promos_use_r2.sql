-- Forward-fix to 20260828150000/150500_platform_banners*.sql: those
-- migrations set platform_banners up to store uploaded media in a Supabase
-- Storage bucket, but this project standardizes on Cloudflare R2 for every
-- other upload (menu photos, category photos, restaurant banners/logo/
-- cover, all via the r2-presign Edge Function) — the admin app's uploads
-- now go through a new platform-promo-presign Edge Function the same way,
-- so this bucket was never actually used (confirmed: created this same
-- session, no objects ever landed in it before the switch).
drop policy if exists "platform_promos_select_public" on storage.objects;
drop policy if exists "platform_promos_insert_admin" on storage.objects;
drop policy if exists "platform_promos_delete_admin" on storage.objects;

-- The bucket row itself (storage.buckets) isn't removed here — the
-- migration role lacks DELETE privilege on it (confirmed: this statement
-- failed live when first attempted). It was removed separately via the
-- Storage API instead; these policy drops are what actually matter for
-- security (no role can write to it through the normal client anymore).
