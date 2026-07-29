-- Restaurant contact & address details — customers need these to find and
-- reach a restaurant (delivery address, a landmark for the notoriously
-- landmark-dependent addressing in Silchar, a pincode, and a contact
-- number/email). Nullable at the DB level since real restaurant rows
-- already exist without them — the vendor app enforces these as required
-- before letting a vendor save their profile, rather than a hard NOT NULL
-- that would break existing data on this migration.

alter table restaurants
  add column address text,
  add column landmark text,
  add column pincode text,
  add column contact_phone text,
  add column contact_email text;

grant update (address, landmark, pincode, contact_phone, contact_email)
  on restaurants to authenticated;
