-- Forward-fix to 20260828160000_platform_promos_use_r2.sql: that migration
-- dropped platform-promos' storage RLS policies but couldn't remove the
-- bucket row itself (the migration role lacks DELETE on storage.buckets —
-- confirmed live when first attempted). In production the row was deleted
-- separately via the Storage API, but a fresh environment (local reset,
-- CI, staging) only ever runs migrations — 20260828150000 still creates
-- this bucket there, public and accepting image/video uploads, with no
-- policy left permitting writes but no reason to leave it live either.
--
-- UPDATE is available to the migration role even though DELETE isn't, so
-- neutralize it here instead: no longer public, and an empty allowlist
-- means no content type can ever be accepted even if some future
-- privileged path tried to write to it.
update storage.buckets
set public = false,
    allowed_mime_types = array[]::text[],
    file_size_limit = 0
where id = 'platform-promos';
