-- Scheduled "back in stock" pause for a menu item. Effective availability
-- is computed at read time, not written back when the timer elapses —
-- see apps/vendor/lib/availability.ts's isEffectivelyAvailable, which this
-- policy mirrors exactly:
--
--   effectively_available = is_available OR (unavailable_until IS NOT NULL AND unavailable_until <= now())
--
-- Scheduling a pause writes is_available=false, unavailable_until=<future
-- time>; once real time passes that point, the OR clause alone makes the
-- item available again everywhere it's read. No cron job, no follow-up
-- write. Turning it back on early (or the existing plain indefinite
-- pause) writes unavailable_until=null, same as before this migration.
alter table menu_items add column unavailable_until timestamptz;

-- Strict superset of the old policy (`using (is_available and ...)`):
-- everything visible before stays visible, nothing new becomes visible
-- across a different restaurant — scripts/test-rls.ts's existing
-- menu_items assertions should keep passing unchanged.
drop policy "menu_items_select_public_available" on menu_items;
create policy "menu_items_select_public_available"
on menu_items for select
to anon, authenticated
using (
  (is_available or (unavailable_until is not null and unavailable_until <= now()))
  and exists (
    select 1 from restaurants r
    where r.id = menu_items.restaurant_id and r.status = 'approved'
  )
);
