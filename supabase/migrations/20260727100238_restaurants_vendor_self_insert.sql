-- Interim fix for the "no restaurants row after sign-up" gap (see
-- apps/vendor/AGENTS.md §9 and the slice-1 migration's restaurants_insert_admin
-- comment): the proper Clerk `organization.created` webhook is a later slice,
-- so until then the vendor app self-heals by inserting its own row on first
-- app-shell load. That client-side insert needs a policy — today only
-- is_super_admin() can insert into restaurants.

-- A vendor may insert exactly one row: their own (id = auth_org_id()).
create policy "restaurants_insert_own"
on restaurants for insert
to authenticated
with check (id = (select auth_org_id()));

-- Same column-restriction pattern as restaurants_update_own's grant in the
-- slice-1 migration: id must be settable here (it's how the row gets scoped
-- to this vendor's org — UPDATE doesn't need this since the row already
-- exists), plus the six standing vendor-writable columns.
-- status/commission_rate_bps/gst_status/is_pure_veg are deliberately absent
-- so they fall through to their column defaults ('pending', 1000,
-- 'unregistered', false) — exactly what a brand-new, not-yet-reviewed
-- restaurant should get. If a vendor's insert explicitly names one of them,
-- Postgres rejects the whole statement (column privilege), not silently
-- accepts it.
revoke insert on restaurants from authenticated;
grant insert (id, name, description, cover_url, lat, lng, gstin, is_open)
  on restaurants to authenticated;
