-- Forward-fix to 20260828150000_platform_banners.sql: that migration only
-- added SELECT policies, reasoning (at the time) that writes would go
-- through a service-role client like restaurants' admin write path does.
-- On reflection platform_banners has no vendor-write overlap at all (unlike
-- restaurants, where a column GRANT for admin ended up also being usable by
-- a vendor's own-restaurant UPDATE policy — see 20260826034349/040000) — so
-- there's no column-grant pitfall here, and the simpler, fully RLS-enforced
-- pattern already used for `cuisines` (is_super_admin()-gated INSERT/
-- UPDATE/DELETE, no service-role needed) applies directly.
create policy "platform_banners_insert_admin"
on platform_banners for insert
to authenticated
with check ((select is_super_admin()));

create policy "platform_banners_update_admin"
on platform_banners for update
to authenticated
using ((select is_super_admin()))
with check ((select is_super_admin()));

create policy "platform_banners_delete_admin"
on platform_banners for delete
to authenticated
using ((select is_super_admin()));

-- Same is_super_admin() gate for the storage side — an admin's browser
-- upload goes straight to Supabase Storage with their own session, not
-- through a server-role key, so storage.objects needs its own RLS policy
-- (the table-level policies above don't cover the bucket).
create policy "platform_promos_insert_admin"
on storage.objects for insert
to authenticated
with check (bucket_id = 'platform-promos' and (select is_super_admin()));

create policy "platform_promos_delete_admin"
on storage.objects for delete
to authenticated
using (bucket_id = 'platform-promos' and (select is_super_admin()));
