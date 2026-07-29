-- Slice 1: vendor onboarding + menu management.
--
-- This migration is hand-written, not CLI-generated: `supabase db diff`
-- needs a local Docker shadow database to compute a diff, and Docker isn't
-- available on this machine. migrations/ is therefore the single source of
-- truth going forward (see CLAUDE.md "Database & RLS") — schema changes are
-- new forward migrations, never edits to this file. It was assembled by
-- concatenating what would otherwise have been supabase/schemas/01 through
-- 11 in dependency order, then checked by hand for ordering problems that
-- only appear once split files are merged (extensions before enums, tables
-- before the foreign keys and functions that reference them, tables before
-- their RLS policies and indexes). None were found — the original numbering
-- already reflected true dependency order — see the section markers below.

-- ===========================================================================
-- 01: extensions
-- ===========================================================================
-- gen_random_uuid() has been a core Postgres function since v13 (no pgcrypto
-- needed). Supabase's hosted Postgres is v15+, so no extensions are required
-- for this schema.

-- ===========================================================================
-- 02: enums
-- ===========================================================================
-- order_status, discount_funded_by, review_status, and payment_status belong
-- to later slices (orders/payments/reviews) and are deliberately not created
-- here.

-- PRD §6.4: mandatory on menu_items, no default — a dish is never silently veg.
create type diet_type as enum ('veg', 'egg', 'non_veg');

-- PRD §4.6: composition and unregistered restaurants charge no GST on food.
create type gst_status as enum ('registered', 'composition', 'unregistered');

-- Under-specified in PRD §10 (only 'pending' and 'approved' appear verbatim
-- in §3.3); 'suspended' is implied by §9 ("approve or suspend"); 'rejected'
-- is the inferred counterpart to a review process.
create type restaurant_status as enum ('pending', 'approved', 'rejected', 'suspended');

-- ===========================================================================
-- 03: identity
-- ===========================================================================
-- Slice 1: profiles only — user_preferences and addresses belong to the
-- customer-app slice, not vendor onboarding/menu management.
--
-- profiles.id is the Clerk user id (text), not a generated uuid — one of the
-- two explicit exceptions to the uuid-pk convention.
create table profiles (
  id text primary key,
  name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- 04: restaurants, staff, cuisines
-- ===========================================================================
-- restaurant_staff.role is stored as plain text, synced verbatim from the
-- Clerk webhook payload (e.g. 'admin'/'member' per Clerk's compact V2
-- session claim shape), not a custom enum — it's a webhook-populated mirror
-- for display/audit, NOT the authorization source of truth. RLS policies
-- use the JWT's org claims directly (auth_org_id(), defined further down in
-- this file), so this table going briefly stale between webhook deliveries
-- never creates a security gap.

-- restaurants.id is the Clerk organization id (text) — the second explicit
-- exception to the uuid-pk convention. No route_account_id or
-- ledger_balance_paise here — those belong to the payments slice.
create table restaurants (
  id text primary key,
  name text not null,
  description text,
  cover_url text,
  lat double precision,
  lng double precision,
  is_pure_veg boolean not null default false,
  status restaurant_status not null default 'pending',
  -- PRD §4.1: default 10%, admin per-restaurant override allowed.
  commission_rate_bps int not null default 1000
    check (commission_rate_bps between 0 and 10000),
  gst_status gst_status not null default 'unregistered',
  gstin text,
  is_open boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table restaurant_staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create table cuisines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table restaurant_cuisines (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  cuisine_id uuid not null references cuisines (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, cuisine_id)
);

-- ===========================================================================
-- 05: menu
-- ===========================================================================
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  price_paise bigint not null check (price_paise >= 0),
  -- PRD §6.4: "mandatory with no default" — deliberately has no `default`.
  diet_type diet_type not null,
  -- The item's own tax classification (PRD §4.6 names 500/1800 as the two
  -- real-world values), independent of whether its restaurant currently
  -- charges GST (that branch happens at invoice time based on the
  -- restaurant's gst_status). PRD §4.6 names 500 and 1800 as the only two
  -- real-world GST rates for food, so both the default and a check
  -- constraint pin gst_rate_bps to that pair.
  gst_rate_bps int not null default 500 check (gst_rate_bps in (500, 1800)),
  -- References cuisines(id) informally — Postgres cannot FK-constrain
  -- individual array elements, so this is an accepted, documented gap.
  cuisine_ids uuid[] not null default '{}',
  is_healthy boolean not null default false,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- 09: functions (Clerk JWT helpers + updated_at trigger)
-- ===========================================================================
-- *** Deviation from a literal reading of the original task, confirmed with
-- the requester earlier in this conversation — read this before touching
-- these functions. ***
--
-- Clerk's session token format changed in 2025. The now-deprecated V1 shape
-- put org claims at the top level (`org_id`, `org_role` with an `org:`
-- prefix). The current default (V2, what any Clerk instance created or
-- upgraded after Aug 2025 uses) nests them compactly to keep the JWT small:
--   o.id  -> organization id
--   o.rol -> role WITHOUT the `org:` prefix (e.g. 'admin', not 'org:admin')
--   o.slg -> organization slug
--   o.per -> permissions
-- auth_org_role() below returns the *unprefixed* value. Every policy that
-- compares role must compare against 'admin'/'member', never 'org:admin' —
-- that comparison would silently never match and is the easiest mistake to
-- make here.
--
-- is_super_admin() requires a Clerk Dashboard step this migration cannot
-- perform: default Clerk session tokens do not expose publicMetadata.
-- Someone with dashboard access must add a custom claim under Sessions ->
-- Customize session token, e.g.:
--   { "superAdmin": "{{user.public_metadata.super_admin}}" }
-- Until that's configured, is_super_admin() always returns false — it fails
-- closed, which is the safe default. See CLAUDE.md for the full checklist.

create function auth_user_id()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.jwt()->>'sub';
$$;

create function auth_org_id()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.jwt()->'o'->>'id';
$$;

-- Unprefixed: 'admin' or 'member', not 'org:admin' / 'org:member'.
create function auth_org_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.jwt()->'o'->>'rol';
$$;

create function is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'superAdmin')::boolean, false);
$$;

create function set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One trigger per table in this slice — no exceptions (the requester's
-- restated convention is "updated_at on every table", including join
-- tables like restaurant_cuisines).
create trigger set_updated_at before update on profiles
  for each row execute function set_updated_at();

create trigger set_updated_at before update on restaurants
  for each row execute function set_updated_at();

create trigger set_updated_at before update on restaurant_staff
  for each row execute function set_updated_at();

create trigger set_updated_at before update on cuisines
  for each row execute function set_updated_at();

create trigger set_updated_at before update on restaurant_cuisines
  for each row execute function set_updated_at();

create trigger set_updated_at before update on menu_items
  for each row execute function set_updated_at();

-- ===========================================================================
-- 10: row level security
-- ===========================================================================
-- Conventions applied throughout, per the supabase / supabase-postgres-best-
-- practices skills:
--   * every policy names its role explicitly (`to authenticated` / `to anon`)
--     rather than relying on the deprecated `auth.role()`;
--   * ownership predicates are wrapped as `(select auth_user_id())` /
--     `(select auth_org_id())` / `(select is_super_admin())` so they
--     evaluate once per statement, not once per row;
--   * every UPDATE policy pairs `using` with `with check` so a row can't be
--     re-owned by changing its FK mid-update;
--   * multiple permissive policies on the same table+command are OR'd
--     together by Postgres, so "public read" and "vendor read own" are
--     written as separate, individually-readable policies rather than one
--     large boolean expression.

-- ------------------------------------------------------------- profiles ---
alter table profiles enable row level security;

create policy "profiles_select_own_or_admin"
on profiles for select
to authenticated
using (id = (select auth_user_id()) or (select is_super_admin()));

create policy "profiles_insert_own"
on profiles for insert
to authenticated
with check (id = (select auth_user_id()));

create policy "profiles_update_own"
on profiles for update
to authenticated
using (id = (select auth_user_id()))
with check (id = (select auth_user_id()));

-- ----------------------------------------------------------- restaurants ---
alter table restaurants enable row level security;

create policy "restaurants_select_public_approved"
on restaurants for select
to anon, authenticated
using (status = 'approved');

create policy "restaurants_select_own"
on restaurants for select
to authenticated
using (id = (select auth_org_id()));

create policy "restaurants_select_admin"
on restaurants for select
to authenticated
using ((select is_super_admin()));

-- No client insert policy: a restaurants row is created by the Clerk
-- `organization.created` webhook (service role, bypasses RLS) — out of
-- scope for this slice. Super admin can still insert directly (e.g. manual
-- onboarding) since "scoped write" for admin covers restaurant management.
create policy "restaurants_insert_admin"
on restaurants for insert
to authenticated
with check ((select is_super_admin()));

create policy "restaurants_update_own"
on restaurants for update
to authenticated
using (id = (select auth_org_id()))
with check (id = (select auth_org_id()));

create policy "restaurants_update_admin"
on restaurants for update
to authenticated
using ((select is_super_admin()))
with check ((select is_super_admin()));

-- restaurants_update_own is a row-level policy: it decides which *rows* a
-- vendor may target, not which *columns*. Left alone, a vendor could PATCH
-- their own row's status to 'approved' (self-approval, bypassing PRD §3.3's
-- admin review) or zero their own commission_rate_bps. Postgres column
-- privileges are the only mechanism that restricts columns within a row a
-- policy already permits, so admin-only fields are locked down here on top
-- of the policy above. status, commission_rate_bps, gst_status, and
-- is_pure_veg (PRD §9: admin verifies this claim at approval) are
-- deliberately absent from the grant and stay service-role only. If a
-- future migration adds a column to restaurants, it defaults to
-- vendor-writable unless explicitly excluded here — add it to this list
-- (or leave it out, if it should be admin/service-role only) rather than
-- assuming the RLS policy alone covers it.
revoke update on restaurants from authenticated;
grant update (name, description, cover_url, lat, lng, gstin, is_open)
  on restaurants to authenticated;

-- ------------------------------------------------------- restaurant_staff ---
alter table restaurant_staff enable row level security;

-- Read-only for authenticated: this table is a webhook-populated mirror of
-- Clerk org membership (see the comment on its create table above), not a
-- record clients maintain. Membership changes flow one way, from Clerk's
-- webhook (service role, bypasses RLS) into this table — there is
-- deliberately no insert/update/delete policy for `authenticated`.
create policy "restaurant_staff_select_own"
on restaurant_staff for select
to authenticated
using (restaurant_id = (select auth_org_id()));

create policy "restaurant_staff_select_admin"
on restaurant_staff for select
to authenticated
using ((select is_super_admin()));

-- -------------------------------------------------------------- cuisines ---
alter table cuisines enable row level security;

-- Shared global taxonomy — has no restaurant_id, so the vendor-scoped rule
-- doesn't apply to it; every role (including vendors tagging their own
-- restaurant) reads the same list. Writes are admin-only (PRD §9 "cuisine
-- taxonomy management").
create policy "cuisines_select_public"
on cuisines for select
to anon, authenticated
using (true);

create policy "cuisines_insert_admin"
on cuisines for insert
to authenticated
with check ((select is_super_admin()));

create policy "cuisines_update_admin"
on cuisines for update
to authenticated
using ((select is_super_admin()))
with check ((select is_super_admin()));

create policy "cuisines_delete_admin"
on cuisines for delete
to authenticated
using ((select is_super_admin()));

-- ----------------------------------------------------- restaurant_cuisines ---
alter table restaurant_cuisines enable row level security;

-- Public read: needed for a restaurant's cuisine tags / the cuisine-chip
-- filter to be visible at all (with RLS enabled and no read policy, the
-- table would be unreadable by anyone). This also satisfies super admin's
-- read requirement, so no separate admin-select policy is needed here.
create policy "restaurant_cuisines_select_public"
on restaurant_cuisines for select
to anon, authenticated
using (true);

create policy "restaurant_cuisines_insert_own"
on restaurant_cuisines for insert
to authenticated
with check (restaurant_id = (select auth_org_id()));

create policy "restaurant_cuisines_update_own"
on restaurant_cuisines for update
to authenticated
using (restaurant_id = (select auth_org_id()))
with check (restaurant_id = (select auth_org_id()));

create policy "restaurant_cuisines_delete_own"
on restaurant_cuisines for delete
to authenticated
using (restaurant_id = (select auth_org_id()));

-- ---------------------------------------------------------- menu_items ---
alter table menu_items enable row level security;

-- Public read: available items belonging to an approved restaurant only.
-- The subquery is subject to restaurants' own RLS for the querying role,
-- which is harmless here — an anon/customer request can only ever see
-- approved restaurants anyway, so the two policies agree rather than
-- conflict.
create policy "menu_items_select_public_available"
on menu_items for select
to anon, authenticated
using (
  is_available
  and exists (
    select 1 from restaurants r
    where r.id = menu_items.restaurant_id and r.status = 'approved'
  )
);

create policy "menu_items_select_own"
on menu_items for select
to authenticated
using (restaurant_id = (select auth_org_id()));

create policy "menu_items_select_admin"
on menu_items for select
to authenticated
using ((select is_super_admin()));

create policy "menu_items_insert_own"
on menu_items for insert
to authenticated
with check (restaurant_id = (select auth_org_id()));

create policy "menu_items_update_own"
on menu_items for update
to authenticated
using (restaurant_id = (select auth_org_id()))
with check (restaurant_id = (select auth_org_id()));

create policy "menu_items_delete_own"
on menu_items for delete
to authenticated
using (restaurant_id = (select auth_org_id()));

-- ===========================================================================
-- 11: indexes
-- ===========================================================================
-- Note on what's *not* duplicated here: `unique (restaurant_id, user_id)` on
-- restaurant_staff and `unique (restaurant_id, cuisine_id)` on
-- restaurant_cuisines (both declared above) already create a composite
-- btree index usable for restaurant_id-leftmost lookups — including the
-- restaurant_id = auth_org_id() predicate every vendor RLS policy on those
-- two tables uses. Only the *reverse* direction (by user_id / by cuisine_id
-- alone) needs a new index below.

-- Customer home-feed base filter: approved + open restaurants.
create index restaurants_status_is_open_idx on restaurants (status, is_open);

-- Restaurant detail / menu listing: a restaurant's available items.
create index menu_items_restaurant_id_is_available_idx
  on menu_items (restaurant_id, is_available);

-- Menu items tagged with a given cuisine (array containment queries).
create index menu_items_cuisine_ids_gin_idx on menu_items using gin (cuisine_ids);

-- Reverse FK lookups not already covered by a unique constraint above.
create index restaurant_staff_user_id_idx on restaurant_staff (user_id);
create index restaurant_cuisines_cuisine_id_idx on restaurant_cuisines (cuisine_id);
