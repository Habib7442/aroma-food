# Zaavo

Multi-vendor food delivery platform for Silchar, Assam. Full spec: `docs/PRD.md`.

## Three surfaces, one repo

| Surface | Path | Tech | Users |
|---|---|---|---|
| Customer app | `apps/customer` | Expo / React Native | Public |
| Vendor app | `apps/vendor` | Expo / React Native | Restaurant owners & staff |
| Admin dashboard | `apps/admin` | Next.js | Platform owner |

These are separate apps with independent release cycles, not one app with role-based routing.

## Package manager: npm, not pnpm

npm workspaces are used deliberately. pnpm's symlinked `node_modules` conflicts with Metro's
module resolver in Expo/React Native apps — pnpm would break the customer and vendor apps.

- Always run `npm install` from the repo root. One lockfile, committed.
- Internal workspace dependencies use `"*"`, never `"workspace:*"` — npm has no workspace protocol.
- **Phantom dependency discipline:** npm hoists flat, so an app can accidentally import a
  package it never declared, and it will work locally until the hoisting changes. If you import
  a package, declare it in that app's own `package.json`.
- Each Expo app will need its own `metro.config.js` with `watchFolders` pointing at the workspace
  root and `nodeModulesPaths` resolving both app-level and root `node_modules`.

## Money: integer paise, rates in basis points

**All money math lives in `packages/shared` and is never duplicated.** The customer invoice, the
vendor payout screen, the admin dashboard, and the email receipt all call the same
`calculateOrderTotals` / `calculateVendorPayout` functions. If you find yourself computing a GST,
commission, or total inline in an app, stop — call the shared function instead, or add one there.

- Every monetary value is an **integer number of paise**. ₹330.50 is `33050`. No floats, anywhere,
  ever — floating-point currency produces off-by-one-paisa errors that surface as invoices that
  don't add up.
- Rates are **basis points**: 10% is `1000`, not `0.1`.
- Rounding happens once, at the final paise, round-half-up (`roundHalfUpDivision` in
  `packages/shared/src/money.ts`).
- Formatting to rupees (`formatPaise`) happens only at the display layer.

## Secrets

Nothing in a mobile bundle is secret. `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` variables are inlined
into the shipped JS at build time and readable from any APK or webpage.

- Safe in app code: Supabase `anon` key, Clerk publishable key, Razorpay `key_id`, a
  package-restricted Google Maps key, Sentry DSN.
- Never in app code: Supabase `service_role` key, Clerk secret key, Razorpay `key_secret` /
  webhook secret, Upstash REST token, any signing secret.
- Server-only keys live in Supabase Edge Function secrets or the admin app's Vercel environment
  variables — never in a mobile or web app bundle. See `.env.example` for the full list.

## Orders snapshot their data

`order_items` stores `name_snapshot`, `price_paise_snapshot`, and `diet_type_snapshot` at order
time. A vendor editing a menu item's name, price, or diet marker later must never alter a
historical invoice. Never join `orders` back to live `menu_items` for display of past orders —
read the snapshot columns.

## Database & RLS

**`supabase/migrations/*.sql` is the single source of truth.** There is no
`supabase/schemas/` declarative layer and no local Docker-based Supabase stack on this
machine — `supabase db diff` requires a Docker shadow database to compute a diff
against, and Docker isn't available here, which makes the declarative schema workflow
unusable in this environment. `supabase start` / `supabase db reset` are likewise not
part of the workflow.

Consequences of migrations being hand-written rather than CLI-generated:

- **A schema change is a new forward migration file**, timestamped
  `YYYYMMDDHHMMSS_description.sql` (UTC), never an edit to an existing one — once a
  migration has been pushed, treat it as immutable history.
- **Once real data exists in the linked project, migrations are forward-fix only.** Don't
  reach for `DROP TABLE`/destructive rewrites to "fix" an earlier migration — write a new
  migration that alters what's there.
- Apply with `npm run db:push`, which runs directly against the linked hosted project
  (see `supabase/.temp/project-ref` for which one). This has an immediate, real effect —
  treat it with the same care as any other action against shared infrastructure.
- Every migration is reviewed by eye before it's pushed. There's no CLI-generated diff to
  trust instead.

### Clerk JWT shape — read before touching `auth_org_id()`/`auth_org_role()`

Supabase RLS policies read the Clerk session token via `auth.jwt()`, using the
third-party auth integration (not the deprecated Clerk JWT template). Clerk's session
token format changed in 2025: the current default (**V2**) nests organization claims
compactly — `o.id`, `o.rol` (role **without** the `org:` prefix, e.g. `'admin'`), `o.slg`,
`o.per` — replacing the old top-level `org_id`/`org_role` (with prefix) shape, which is
deprecated. The helper functions (in the slice 1 migration) are written against **V2**.
If this project's Clerk instance is ever pinned to the legacy shape, those functions need
updating to match — they will silently return null/never-match otherwise.

`is_super_admin()` depends on a **manual Clerk Dashboard step this repo cannot perform**:
default Clerk session tokens don't expose `publicMetadata`. Someone with Dashboard
access must add a custom claim under Sessions → Customize session token:

```json
{ "superAdmin": "{{user.public_metadata.super_admin}}" }
```

Until that's configured, `is_super_admin()` always returns `false` (fails closed).

### RLS conventions

- Every table has RLS enabled — no table is ever left accessible-by-default.
- Vendor-owned tables are scoped with `restaurant_id = auth_org_id()` (or `id =
  auth_org_id()` for `restaurants` itself), never by anything the client sends.
- Ownership predicates are wrapped as `(select auth_user_id())` etc. so Postgres
  evaluates them once per statement, not once per row.
- Every `UPDATE` policy pairs `USING` with `WITH CHECK` — without `WITH CHECK` a row
  could be re-owned by changing its FK mid-update.
- Test with `scripts/test-rls.ts` (`npm run db:test-rls`) — it mints a real Clerk
  session token (requires a Clerk **development** instance secret key) and asserts a
  vendor of one restaurant cannot read or write another restaurant's rows. Exits
  non-zero on any leak.

## Workspace layout

```
apps/customer   @zaavo/customer   (Expo, not yet scaffolded)
apps/vendor     @zaavo/vendor     (Expo, not yet scaffolded)
apps/admin      @zaavo/admin      (Next.js, not yet scaffolded)
packages/shared    @zaavo/shared    pricing engine, types, enums — zero runtime deps
packages/database  @zaavo/database  Supabase client factory + generated types (schema: vendor onboarding + menu, slice 1)
packages/ui        @zaavo/ui        shared RN components (stub)
```
