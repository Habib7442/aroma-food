-- Weekly operating hours per restaurant — one row per day of week, so a
-- vendor can mark individual days closed (e.g. a weekly off day) and set
-- different open/close times per day. day_of_week follows Postgres's
-- EXTRACT(DOW ...) / JS's Date.getDay() convention: 0 = Sunday .. 6 = Saturday.
-- This is separate from restaurants.is_open, which stays a manual
-- right-now override (e.g. "closed for a festival") — this table doesn't
-- drive it automatically.

create table restaurant_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_closed boolean not null default true,
  open_time time,
  close_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, day_of_week),
  -- A closed day has no times; an open day needs both. Deliberately no
  -- open_time < close_time check — a restaurant open past midnight (e.g.
  -- 18:00-02:00) is legitimate and would otherwise be wrongly rejected.
  check (
    (is_closed and open_time is null and close_time is null)
    or (not is_closed and open_time is not null and close_time is not null)
  )
);

create trigger set_updated_at before update on restaurant_hours
  for each row execute function set_updated_at();

create index restaurant_hours_restaurant_id_idx on restaurant_hours (restaurant_id);

-- RLS: same shape as menu_categories' policies in the slice-1 migration —
-- full-row vendor ownership, public read only for approved restaurants
-- (so a future customer-app "hours" display has a policy to read from).
alter table restaurant_hours enable row level security;

create policy "restaurant_hours_select_public"
on restaurant_hours for select
to anon, authenticated
using (
  exists (
    select 1 from restaurants r
    where r.id = restaurant_hours.restaurant_id and r.status = 'approved'
  )
);

create policy "restaurant_hours_select_own"
on restaurant_hours for select
to authenticated
using (restaurant_id = (select auth_org_id()));

create policy "restaurant_hours_select_admin"
on restaurant_hours for select
to authenticated
using ((select is_super_admin()));

create policy "restaurant_hours_insert_own"
on restaurant_hours for insert
to authenticated
with check (restaurant_id = (select auth_org_id()));

create policy "restaurant_hours_update_own"
on restaurant_hours for update
to authenticated
using (restaurant_id = (select auth_org_id()))
with check (restaurant_id = (select auth_org_id()));

create policy "restaurant_hours_delete_own"
on restaurant_hours for delete
to authenticated
using (restaurant_id = (select auth_org_id()));
