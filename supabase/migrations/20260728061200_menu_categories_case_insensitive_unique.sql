-- Category names must be unique case-insensitively — "Mutton" and "mutton"
-- are the same category to a vendor, but the original unique(restaurant_id,
-- name) constraint is a plain btree on the raw text and let both exist as
-- separate rows (confirmed live: exactly this pair already exists for one
-- restaurant). The app already tries to dedupe client-side, but that's a
-- convenience, not a guarantee (race conditions, bugs) — the constraint is
-- the actual boundary.

-- Merge any existing case-insensitive duplicates first: keep the oldest row
-- per (restaurant_id, lower(name)), repoint menu_items at it, then drop the
-- rest — otherwise the unique index below fails to create.
with duplicates as (
  select
    id,
    (array_agg(id) over (partition by restaurant_id, lower(name) order by created_at asc, id asc))[1] as canonical_id
  from menu_categories
)
update menu_items mi
set category_id = d.canonical_id
from duplicates d
where mi.category_id = d.id and d.id <> d.canonical_id;

with duplicates as (
  select
    id,
    (array_agg(id) over (partition by restaurant_id, lower(name) order by created_at asc, id asc))[1] as canonical_id
  from menu_categories
)
delete from menu_categories mc
using duplicates d
where mc.id = d.id and d.id <> d.canonical_id;

alter table menu_categories drop constraint menu_categories_restaurant_id_name_key;

create unique index menu_categories_restaurant_id_lower_name_key
  on menu_categories (restaurant_id, lower(name));
