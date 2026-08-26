# AGENTS.md — Zaavo Admin Dashboard

You are a **principal-level Next.js engineer** working on `apps/admin`, the platform-owner
dashboard for **Zaavo**, a multi-vendor food delivery marketplace for Silchar, Assam.

Your job: understand the request, read the relevant skills, inspect the actual code, propose a
plan, get approval, then implement.

This file governs work inside `apps/admin`. The repo-root `CLAUDE.md` governs monorepo-wide
rules and the database workflow. When they conflict, root `CLAUDE.md` wins on infrastructure,
this file wins on the admin app.

---

# 0. Read this before assuming anything

| You might assume | Reality here |
|---|---|
| Admin access is a Clerk organization role (`org:admin`) | **It is not.** Admin is a single-user `public_metadata.super_admin` boolean, orthogonal to the restaurant-organization system vendor/customer use |
| `is_super_admin()` works once this app is deployed | **It fails closed until a manual, non-code Clerk Dashboard step is done** — see §6. Every admin write will be rejected by RLS until then, and that's correct, not a bug |
| This app covers everything in PRD §9 | **It covers two things**: restaurant approval and cuisine taxonomy. Everything else in §9 is explicitly out of scope — see §3 |
| All admin writes go through RLS like vendor/customer | **`cuisines` writes do; the `restaurants` approval fields don't.** Column-level grants apply to the whole `authenticated` role, not to a specific RLS policy — granting `status`/`commission_rate_bps`/`gst_status`/`is_pure_veg` to `authenticated` was tried and reverted because it also let a vendor self-approve via `restaurants_update_own` (caught live by `db:test-rls`). Those four columns are written with the service-role key instead — see §6 |
| `docs/DESIGN.md` covers dashboard/table layout | **It doesn't.** It's 100% mobile card/bottom-nav prose. Only the color/type/radius *tokens* are reused here — layout is this app's own |

If the repo contradicts this file, say so instead of silently picking one.

---

# 1. Product

Zaavo is a marketplace. Three separate surfaces:

- `apps/customer` — Expo, for people ordering food
- `apps/vendor` — Expo, for restaurant owners and staff
- `apps/admin` — Next.js web, **this app**, for the platform owner

Full product spec is in `docs/PRD.md` §9 (Admin Dashboard) and §3 (Roles & Identity). Do not
invent product rules — if the PRD is silent, ask.

---

# 2. Workflow

Same as the other two apps:

1. Read this file.
2. Read the skills the user names, plus clearly relevant ones from §4.
3. Inspect the actual code you are about to change. Do not describe changes to files you have
   not opened.
4. Ask a focused question only if there is meaningful ambiguity.
5. Present a plan: files to change, decisions made, assumptions, acceptance criteria.
6. Wait for approval.
7. Implement.
8. Run the checks in §13.
9. Give exact steps to test in a browser (and in the Supabase dashboard, to confirm data
   actually changed).

Never claim a check passed without running it. Report actual command output.

---

# 3. Current slice — scope discipline

## Slice 1 (current): vendor approval + cuisine taxonomy

In scope:
- Clerk auth, super-admin gate (redirect everyone else to `/not-authorized`)
- Restaurants list (all statuses, filterable), restaurant detail view
- Approve / reject / suspend a restaurant (`status`), override `commission_rate_bps`,
  `gst_status`, `is_pure_veg`
- Restaurant detail also shows that restaurant's menu (dishes grouped by its own
  `menu_categories`) — **read-only oversight for the approval decision, not an editor**.
  There's no admin write policy on `menu_items`/`menu_categories` (§8) and this page
  doesn't try to add one.
- Cuisines: add, edit sort order, delete

**Explicitly out of scope — do not build, do not create tables for, do not add UI for:**
- Coupons (no `coupons` table exists)
- Financial oversight / GMV / commission-collected / payout ledger (no `orders`, `payments`,
  or `ledger_entries` tables exist — this is Phase 4/5 work, not this slice)
- Order search or manual intervention (no `orders` table exists)
- Review moderation queue (no `reviews` table exists — this is Phase 6 per PRD §14)
- Platform banner management (home-screen carousel) — **the table itself doesn't exist**.
  Don't confuse this with `restaurant_banners` (vendor-owned, per-restaurant promo images,
  already built in `apps/vendor`) — the PRD's admin-managed platform-wide carousel is a
  different, not-yet-created table (`banners`, per PRD §7.5's interim spec: `image_url`,
  `video_url`, `link_target`, `active`, `sort_order`, `valid_from`, `valid_to`)
- CSV export
- Editing a vendor's `menu_items`, `menu_categories`, `restaurant_hours`, or
  `restaurant_banners` on their behalf — RLS only grants admin **read** access to these
  today (see §8), not write

If a request seems to require one of these, stop and say so rather than building it.

---

# 4. Skills

| Skill | Use for |
|---|---|
| `clerk-nextjs-patterns` | Middleware, Server Actions, caching with Clerk |
| `clerk-orgs` | Understanding Clerk's org model (even though admin auth itself doesn't use it) |
| `supabase` | Client usage, RLS, auth integration, CLI |
| `supabase-postgres-best-practices` | Schema and query design |

Do not invent skills. Do not install new ones without asking.

---

# 5. Tech stack

Use:
- Next.js (App Router), TypeScript strict
- Tailwind CSS v4 (`@theme` tokens in `globals.css`, not a JS config)
- `@clerk/nextjs`
- `@zaavo/database`'s `createSupabaseClient`, two ways (see §6 — pick deliberately, don't
  default to whichever is more convenient):
  - `src/lib/supabase.ts`'s `getSupabaseClient()` — anon key + Clerk access token, RLS
    applies. Use for everything `cuisines`-related and for reading `restaurants`.
  - `src/lib/supabaseServiceRole.ts`'s `getServiceRoleSupabaseClient()` — service-role key,
    bypasses RLS. Use **only** for writing `restaurants.status` /
    `commission_rate_bps` / `gst_status` / `is_pure_veg`, and only after an explicit
    in-action `sessionClaims.superAdmin` check (see §6) — there is no RLS backstop on
    this path.
- `@zaavo/shared` for all money/commission math (`calculateVendorPayout`,
  `calculateOrderTotals`, `formatPaise`, `rupeesToPaise` — never inline `* 100` / `/ 100`)
- Server Components + Server Actions for data fetching/mutation (no client-side fetch
  library needed for this slice's simple CRUD; add `@tanstack/react-query` — already a
  dependency — only if a future page needs optimistic client-side updates)
- `shadcn/ui` for components that need real dialog/overlay accessibility semantics (focus
  trap, `Escape` to close, ARIA roles) rather than a hand-rolled `<div>` overlay — add one
  via `npx shadcn@latest add <component>` from `apps/admin/`, not by copy-pasting source.
  Only `alert-dialog` is installed so far (confirmations — see §15). It brings its own
  gray/black token system into `globals.css` alongside the brand palette (§10) — the two
  are deliberately kept separate, don't let them bleed into each other.
- `useActionState` (React) for any form that needs inline save/error feedback instead of a
  silent throw — see §15's "Save feedback" pattern.

Do not use:
- The service-role client for anything beyond the four `restaurants` columns above —
  everything else goes through RLS (`getSupabaseClient()`), same as vendor/customer
- Supabase Auth (Clerk is the identity provider, same as vendor/customer)
- NativeWind (this is a web app — plain Tailwind v4)

---

# 6. Auth model — this is structurally different from vendor/customer

**Platform admin is a single Clerk user with a custom `public_metadata.super_admin` flag —
not an organization membership.** There's no `org:admin` equivalent here.

## The hard prerequisite

`is_super_admin()` (`supabase/migrations/20260727055325_slice1_vendor_menu.sql`) reads:

```sql
select coalesce((auth.jwt() ->> 'superAdmin')::boolean, false);
```

Clerk does not emit a `superAdmin` claim by default. **A human with Clerk Dashboard access
must**:

1. Go to Sessions → Customize session token, add:
   ```json
   { "superAdmin": "{{user.public_metadata.super_admin}}" }
   ```
2. Set `public_metadata.super_admin = true` on the specific user(s) who should be admins.

Until both steps are done, `is_super_admin()` returns `false` for everyone, and every
`_admin`-gated RLS policy is dead code in practice — this app's own gate
(`src/app/(admin)/layout.tsx`) will correctly redirect everyone to `/not-authorized`, and any
write attempted before then fails at the database, not just the UI. **This is not something
this repo/agent can configure** — it's a manual Clerk Dashboard action, not a code change.

## The gate

`src/app/(admin)/layout.tsx` reads `(await auth()).sessionClaims?.superAdmin` — same claim
name `is_super_admin()` reads in Postgres, checked server-side (PRD §3.2: "verified
server-side, never client-side"). Not signed in → `/sign-in`. Signed in, not a super admin →
`/not-authorized`.

## Supabase clients — two, deliberately different

`src/lib/supabase.ts`'s `getSupabaseClient()` uses the **anon key**, with Clerk's
`getToken()` wired in as the access-token callback — same third-party-auth mechanism
vendor/customer use. RLS's `is_super_admin()`-gated policies authorize the read/write; this
is what `cuisines` CRUD and all `restaurants` reads use.

`src/lib/supabaseServiceRole.ts`'s `getServiceRoleSupabaseClient()` uses the
**service-role key** and bypasses RLS entirely. This exists because
`status`/`commission_rate_bps`/`gst_status`/`is_pure_veg` on `restaurants` turned out to have
no safe RLS-column-grant path at all: Postgres column privileges apply to the whole
`authenticated` role, not to whichever RLS policy matched, so granting those columns to
`authenticated` (tried in `20260826034349_restaurants_admin_grants.sql`) also opened them to
`restaurants_update_own` — a vendor updating their own row could self-approve and zero their
own commission. `db:test-rls` caught this live; the grant was reverted in
`20260826040000_revoke_restaurants_admin_grants.sql`. The only remaining option for a
column-scoped admin-only write is a server-side bypass: `updateRestaurant` (in
`restaurants/[id]/actions.ts`) reads `sessionClaims.superAdmin` itself before touching the
service-role client — **do not add another service-role write without the same explicit
check in the action**, since this path has no RLS backstop to catch a missing one.

---

# 7. Money

Same rule as every other surface: **integers in paise, rates in basis points.** This slice's
only money-adjacent field is `commission_rate_bps` — the restaurant detail form accepts a
percentage input and converts with `Math.round(percent * 100)` (not `packages/shared`, since
there's no existing helper for percent→bps specifically; if a second call site needs the
same conversion, add one there instead of a second inline copy). Never write inline currency
math for anything paise-denominated — call `packages/shared`.

---

# 8. Database — what this app can actually read/write

| Table | Admin access |
|---|---|
| `restaurants` | Full read via RLS (anon key, `restaurants_select_admin`); `status`/`commission_rate_bps`/`gst_status`/`is_pure_veg` written via the **service-role client** with an explicit in-action `superAdmin` check — see §6, no RLS column grant exists for these (one was tried and reverted) |
| `cuisines` | Full CRUD — `cuisines_insert_admin`/`update_admin`/`delete_admin` already existed before this slice, no migration needed |
| `profiles`, `menu_items`, `menu_categories`, `restaurant_hours`, `restaurant_banners`, `restaurant_staff` | **Read-only** (admin `SELECT` policies exist; no admin write policy on any of them). Do not build edit UI for these without a new migration adding the write policy first |
| `user_preferences`, `restaurant_cuisines` | **No admin policy at all.** Do not query these from this app without adding RLS first |

Do **not** reference `orders`, `order_items`, `payments`, `coupons`, `ledger_entries`,
`reviews`, `restaurant_scores`, `item_reactions`, or `addresses` — none exist yet.

Types come from `packages/database` (`npm run db:types`). Never hand-edit generated types.

---

# 9. Known gaps

- No Clerk `organization.created`/webhook-driven admin notification when a new restaurant
  signs up — an admin has to check the Restaurants → Pending tab manually. A later slice
  could add this.
- No audit log of who approved/rejected/suspended what, or of commission overrides. If PRD
  work later needs one, it's a new table + trigger, not something to bolt onto the existing
  `restaurants` row.
- Restaurant detail page has no image preview beyond raw URLs shown as text links (cover/logo
  aren't rendered as `<img>` yet) — small, deliberately deferred polish, not a bug.

---

# 10. Design

Same brand tokens as `apps/customer`/`apps/vendor` (the *corrected* DESIGN.md palette, not
`apps/landing`'s literal frontmatter values — see `src/app/globals.css`'s comment):

| Token | Value |
|---|---|
| Primary | `#1D4626` hunter green |
| Primary dark | `#032F12` |
| Secondary | `#FEAE32` saffron |
| Secondary dark | `#835400` |
| Background | `#FAF8F5` warm off-white |
| Card | `#FFFFFF` with a 1px `#EDE9E3` border |
| Veg marker | `#0F8A4D` |
| Egg marker | `#E8A33D` |
| Non-veg marker | `#A52A2A` |

`docs/DESIGN.md` has no dashboard/table/sidebar guidance at all — it's entirely mobile-card
and bottom-nav prose. Layout here (sidebar nav, data tables, status-filter tabs) is this
app's own, built from the tokens above, not copied from mobile patterns. Tailwind v4
`@theme` in `globals.css`, not a `tailwind.config.js`/NativeWind setup like the mobile apps.

`shadcn@latest init` (run once, to get the `alert-dialog` component — see §5/§15) also
added its own `:root`/`.dark` token block (gray/black, oklch-based) and a Geist font to
`src/app/layout.tsx`, on top of the brand palette above. Both token systems coexist in
`globals.css` without conflict — shadcn only added tokens that didn't already exist
(`--color-primary-foreground`, `--color-destructive`, etc.), it didn't touch `--color-primary`
or the others in the table above. Don't "clean up" globals.css by merging them — components
built with shadcn (currently just the alert dialog) intentionally use shadcn's own tokens,
everything else uses the brand ones.

Favicon/logo: `public/brand/*.svg` and `src/app/icon.png`/`apple-icon.png` are the same
Zaavo mark assets `apps/landing` uses (copied, not regenerated) — reuse that source if a
new size/format is ever needed rather than re-exporting from scratch.

---

# 11. Performance

This is an internal tool used by one platform owner, not a public-facing app under the
mobile performance budget in `CLAUDE.md`/PRD §12. Don't import that budget's constraints
(bundle-size targets, `FlashList`, etc.) here — normal Next.js/React Server Component
practice (paginate large tables, don't `select('*')` needlessly) is enough.

---

# 12. Security

## Environment variables

`apps/admin/.env` contains:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (safe to expose) |
| `CLERK_SECRET_KEY` | Server-only — never sent to the browser |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose — RLS is what protects data, not key secrecy) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — bypasses RLS. Currently used by exactly one call site: `restaurants/[id]/actions.ts`'s `updateRestaurant` (see §6). Never send this value to the client, and never add a second call site for it without the same explicit `sessionClaims.superAdmin` check that one has |

Never add `CLERK_WEBHOOK_SECRET` or any Razorpay/Upstash secret to this app — nothing here
needs them. `SUPABASE_SERVICE_ROLE_KEY` is the one server-only secret this app does use, and
only from `src/lib/supabaseServiceRole.ts` — don't reach for it anywhere else without the
same explicit super-admin check its one existing call site has.

## RLS is still the security model — except where it can't be

Everything except the four `restaurants` columns in §6/§8 goes through
`is_super_admin()`-gated RLS policies via the anon key + Clerk token, same mechanism as
vendor/customer. If a `cuisines`/`restaurants`-read query returns nothing unexpectedly,
check the JWT claims (§6) before assuming the SQL is wrong — the most likely cause is the
Clerk Dashboard `superAdmin` claim not being configured yet. For the service-role write path,
RLS is bypassed entirely by design (see §6 for why) — its safety depends solely on the
in-action `superAdmin` check, not on any database policy.

---

# 13. Commands and checks

Run from the repo root:

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm run build --workspace=@zaavo/admin` — production build, catches issues typecheck/lint miss

Admin app:

- `npm run dev --workspace=@zaavo/admin` — start the dev server, open in a browser

Database (repo root, no Docker):

- `npm run db:push` — apply migrations to the linked project
- `npm run db:types` — regenerate types into `packages/database`
- `npm run db:test-rls` — RLS isolation suite; must exit 0

## Migrations

Same discipline as every other surface: `supabase/migrations/` is the source of truth, new
schema/grant changes are new forward migration files, never edit one that's been pushed.

---

# 14. Testing output

After implementing anything, give exact steps:

1. Which command to run.
2. What to click in the browser, page by page.
3. What the correct result looks like.
4. What to check in the Supabase dashboard to confirm the data actually changed.

For any change to the approval flow, always include: sign in as the admin → open a pending
restaurant → approve it → confirm `status = 'approved'` in the Supabase dashboard → confirm
the vendor app's "Restaurant record pending setup" notice clears for that restaurant.

Do not say "it should work." Say what to click and what to expect.

---

# 15. Reusable components and patterns

Built up across the Restaurants/Cuisines slice — reuse these rather than rebuilding the
same thing per page:

- **`src/components/Pagination.tsx`** — Previous/Next + "X–Y of Z" for any `.range()`-paginated
  list. Takes `page`, `pageSize`, `totalCount`, and a `makeHref(page)` builder so the caller
  controls which query params to preserve. Used as-is by Restaurants and Cuisines. The
  Menu section's category-based pagination (`restaurants/[id]/MenuControls.tsx`) is
  deliberately **not** built on this — it paginates by category count, not a flat range, so
  a category's dishes never split across two pages — but it follows the same
  page/pageSize/totalCount shape.
- **`src/components/DebouncedSearchBox.tsx`** — router-agnostic: it only debounces
  keystrokes (300ms) and calls `onSearch(value)`; the caller decides what searching means
  (a URL param via `router.push`, an in-memory filter, whatever) and owns any pending state,
  passed back in via `isPending` for the box's built-in spinner. See `RestaurantsSearch.tsx`
  and `MenuControls.tsx` for the two current callers — both are ~20-line wrappers, not
  reimplementations. Add a new search box the same way, don't copy the debounce logic.
- **`src/components/SubmitButton.tsx`** — a `<button>` that reads `useFormStatus()` to show
  "Saving…" and disable itself while its enclosing `<form>` is submitting. Works with a
  plain Server Action `<form action={...}>` or a `useActionState`-wrapped one.
- **Save feedback pattern (`useActionState`)** — any mutation a human waits on should show
  success/error inline, not throw to Next.js's crash overlay. Shape:
  1. The Server Action returns `{ error?: string }` (or a richer state shape) instead of
     throwing — see `restaurants/[id]/actions.ts`'s `updateRestaurant` and
     `cuisines/actions.ts`.
  2. A client component wraps the form: `const [state, formAction] = useActionState(action,
     initialState)`, renders `state.error`/`state.success` inline, uses `formAction` as the
     `<form>`'s `action`. See `RestaurantApprovalForm.tsx`, `CreateCuisineForm.tsx`.
  3. For a mutation triggered outside a `<form>` (an inline table-row edit, a dialog confirm
     button), skip `useActionState` — just call the action directly inside
     `startTransition(async () => { const result = await action(...); if (result.error)
     setError(result.error); })`, same `{ error? }` shape. See `CuisineRow.tsx`.
- **Confirm-before-destructive/consequential-action pattern (shadcn `AlertDialog`)** — use
  for anything that deletes data or has real business consequence (rejecting/suspending a
  restaurant), never for a routine save. Two shapes exist:
  - Simple (`<AlertDialogTrigger>` + `<AlertDialogAction onClick={...}>`, which auto-closes
    on click): only reach for this if the action truly can't fail in a way the user needs
    to see inside the dialog.
  - **When the confirmed action can fail and the error needs to stay visible** (the common
    case for anything hitting the database) — don't use `<AlertDialogAction>`. Radix closes
    the dialog on click regardless of what its `onClick` does, so a failure's error message
    would vanish the instant it appeared. Instead control `open` yourself (`<AlertDialog
    open={open} onOpenChange={setOpen}>`) and use a plain `<button>` in the footer that
    only calls `setOpen(false)` on confirmed success, leaving the dialog open with an
    inline error otherwise. See `DeleteCuisineButton.tsx` and
    `RestaurantApprovalForm.tsx`'s confirm-before-reject/suspend dialog — both use this
    shape, not the simple one above.
- **Container queries (`@container`) over viewport breakpoints for nested layout** — a
  section next to the sidebar (and sometimes next to the sticky approval panel too) has
  less width than the viewport suggests, so `sm:`/`lg:` breakpoints can fire "wide enough"
  while the box itself isn't. Mark the relevant wrapper `@container/name` and use
  `@breakpoint/name:` variants instead. See `restaurants/[id]/page.tsx`'s `@container/page`
  (info+menu vs. the approval panel) and `@container/menu` (the dish grid inside the Menu
  card) — note container-query breakpoint sizes are a *different* scale than viewport
  breakpoints (e.g. `@3xl` = 48rem, not the same 48rem-ish point `lg`/viewport would imply).
- **`scroll={false}` on any `<Link>`/`router.push` that just changes a filter/page/search
  param on the current page** — otherwise Next.js scrolls back to the top of the page on
  every pagination click or search keystroke, which reads as broken on a long list. Every
  pagination, tab, and search interaction in this app sets it; keep doing so for new ones.

---

# 16. Code standards

- TypeScript, strict. Avoid `any`.
- Shared types come from `packages/database` and `packages/shared` — do not redeclare them
  locally.
- Server Actions colocated with the page that uses them (`actions.ts` next to `page.tsx`),
  same pattern as `src/app/(admin)/restaurants/[id]/actions.ts` and
  `src/app/(admin)/cuisines/actions.ts`.
- No unrelated refactors. No unrequested features.
- If you import a package, declare it in `apps/admin/package.json` — npm hoists flat, so an
  undeclared import can work today and break later.

---

# 17. When in doubt

1. Keep it inside the current slice (§3).
2. Read the actual file before describing a change to it.
3. Check `docs/PRD.md` for product rules; ask if it's silent.
4. Remember the `is_super_admin()` prerequisite (§6) before assuming a write "should" work.
5. Present a plan, get approval, then implement.
6. Run the checks and report real output.
7. Give exact test steps.
