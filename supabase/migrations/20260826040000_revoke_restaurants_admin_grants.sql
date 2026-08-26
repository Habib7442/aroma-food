-- Revert 20260826034349_restaurants_admin_grants.sql: granting these columns
-- to `authenticated` was wrong. Column privileges apply to the whole role,
-- not to a specific RLS policy — restaurants_update_own (vendor's own row)
-- and restaurants_update_admin (super-admin, any row) both run under the
-- same `authenticated` grantee, so granting status/commission_rate_bps/
-- gst_status/is_pure_veg to authenticated let a vendor self-approve their
-- own restaurant and zero their own commission via restaurants_update_own,
-- exactly the bypass the original slice-1 migration's comment warned about.
-- db:test-rls caught this live (2 failing checks) — see apps/admin/AGENTS.md
-- for the corrected approach: apps/admin writes these columns with the
-- service-role key server-side after its own super_admin check, not via
-- this grant.
revoke update (status, commission_rate_bps, gst_status, is_pure_veg)
  on restaurants from authenticated;
