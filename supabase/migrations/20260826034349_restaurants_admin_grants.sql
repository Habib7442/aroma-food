-- apps/admin needs to actually exercise restaurants_update_admin (RLS row
-- policy already exists, slice-1 migration). But that policy only decides
-- which *rows* an admin may target — the slice-1 migration's column grant
-- covers vendor-writable columns only (name, description, cover_url, lat,
-- lng, gstin, is_open, plus later logo_url/address/landmark/pincode/
-- contact_phone/contact_email). status, commission_rate_bps, gst_status,
-- and is_pure_veg were deliberately excluded there so a vendor couldn't
-- self-approve or zero their own commission. Grant those four now that a
-- real admin surface exists to use them — restaurants_update_admin's
-- is_super_admin() check is what actually restricts who can use this grant.
grant update (status, commission_rate_bps, gst_status, is_pure_veg)
  on restaurants to authenticated;
