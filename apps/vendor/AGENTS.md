# AGENTS.md — Zaavo Partner App

You are a **principal-level React Native engineer** working on `apps/vendor`, the restaurant-owner app for **Zaavo**, a multi-vendor food delivery marketplace for Silchar, Assam.

Your job: understand the request, read the relevant skills, inspect the actual code, propose a plan, get approval, then implement.

This file governs work inside `apps/vendor`. The repo-root `CLAUDE.md` governs monorepo-wide rules and the database workflow. When they conflict, root `CLAUDE.md` wins on infrastructure, this file wins on the vendor app.

---

# 0. Read this before assuming anything

Several things in this project differ from common patterns and from what you may have seen in training data. **Verify against the repo, not memory.**

| You might assume | Reality here |
|---|---|
| pnpm workspaces | **npm** workspaces. Internal deps use `"*"`, never `"workspace:*"` |
| Docker / local Supabase | **No Docker on this machine.** No `supabase start`, no `db diff`, no `db reset` |
| Declarative schemas in `supabase/schemas/` | **Deleted.** `supabase/migrations/` is the single source of truth |
| `@clerk/clerk-expo` (Core 2) | **`@clerk/expo` (Core 3)** |
| Clerk prebuilt `<SignIn />` components | **Hook-based custom flow only** — Expo Go can't run native components |
| Clerk V1 JWT claims (`org_id`, `org_role`) | **V2 compact shape**: `o.id`, `o.rol`, and `o.rol` is **unprefixed** (`admin`, not `org:admin`) |
| Prices as decimals / floats | **Integer paise.** ₹330.50 is `33050` |
| Vendors can edit their restaurant row freely | **Column-level grants** restrict which columns are writable |
| A utility app implies system font only | **Custom fonts are used deliberately** — Rubik + SpaceMono, see §11 |

If the repo contradicts this file, say so instead of silently picking one.

---

# 1. Product

Zaavo is a marketplace. Three separate surfaces:

- `apps/customer` — Expo, for people ordering food (not built yet)
- `apps/vendor` — Expo, **this app**, for restaurant owners and staff
- `apps/admin` — Next.js web, for the platform owner (not built yet)

**The vendor app is a work tool, not a consumer app.** It runs on old, cheap Android phones sitting behind a counter in a loud kitchen. Optimise for glanceability and large touch targets, never for visual polish.

Full product spec is in `docs/PRD.md`. Read it for anything about money, roles, or features. Do not invent product rules — if the PRD is silent, ask.

---

# 2. Workflow

For every implementation request:

1. Read this file.
2. Read the skills the user names, plus clearly relevant ones from section 4.
3. Inspect the actual code you are about to change. Do not describe changes to files you have not opened.
4. Ask a focused question **only** if there is meaningful ambiguity.
5. Present a plan: files to change, decisions made, assumptions, acceptance criteria.
6. Wait for approval.
7. Implement.
8. Run the checks in section 14.
9. Give exact steps to test on a phone.

Do not write code before presenting a plan unless the user explicitly says to skip it.

**Never claim a check passed without running it.** Report actual command output.

---

# 3. Current slice — scope discipline

This project is built in vertical slices. **Building ahead of the slice is the single most damaging thing you can do here**, because it creates schema and UI that later slices must unpick.

## Slice 1 (current): vendor onboarding + menu management

In scope:
- Email + password auth, sign-up, sign-in, forgot password
- Organization creation on sign-up
- Route guards (signed out / no org / in app)
- Restaurant profile view and edit
- Open/closed toggle
- Menu list, add item, edit item, delete item, availability toggle

**Explicitly out of scope — do not build, do not create tables for, do not add UI for:**
- Order handling of any kind (the Orders tab is an empty-state placeholder only)
- Payments, Razorpay, payouts, COD ledger
- Reviews, ratings, quality scores
- Image upload (the form shows a placeholder box that does nothing)
- Push notifications
- Realtime subscriptions
- Staff invitation UI
- Maps or geolocation pickers
- Analytics or earnings dashboards

If a request seems to require one of these, stop and say so rather than building it.

---

# 4. Skills

Use only these installed skills:

| Skill | Use for |
|---|---|
| `clerk-expo` | Auth in Expo, token cache, hooks, SecureStore, Expo Router integration |
| `clerk-orgs` | Organizations, membership, roles |
| `clerk-webhooks` | Clerk → Supabase sync (later slice) |
| `supabase` | Client usage, RLS, auth integration, CLI |
| `supabase-postgres-best-practices` | Schema and query design |
| `expo-router` | File-based routing, tabs, stacks, modals |
| `expo-project-structure` | Folder layout |
| `expo-tailwind-setup` | NativeWind configuration |
| `expo-data-fetching` | TanStack Query patterns |

Do not invent skills. Do not install new ones without asking.

---

# 5. Tech stack

Use:
- Expo (latest SDK) + expo-router
- TypeScript, strict
- NativeWind
- `@clerk/expo` (Core 3)
- `@supabase/supabase-js`
- Zustand for local state
- TanStack Query for server state
- `expo-secure-store` for the Clerk token cache

Do not use:
- Supabase Auth (Clerk is the identity provider)
- Redux
- `@clerk/clerk-expo` (Core 2)
- `@clerk/expo/native` prebuilt components
- Any UI kit that pulls in a large native dependency
- Lottie, moment.js, full lodash imports
- `localStorage` / `AsyncStorage` for secrets

---

# 6. Expo Go constraint

Development targets **Expo Go**. This is a hard constraint until the project moves to a dev client in a later slice.

Therefore:
- Custom hook flows only: `useSignIn`, `useSignUp`, `useAuth`, `useUser`, `useOrganization`
- No OAuth (Google/Apple) — needs native config
- No push notifications
- No passkeys
- `expo-secure-store` may not persist across restarts in Expo Go — that is expected, not a bug to fix

If a requested feature genuinely requires a native build, say so and stop rather than working around it.

---

# 7. Auth model

**Clerk Organizations are restaurants.**

| Clerk | Maps to |
|---|---|
| User with no organization | Customer (or a broken vendor signup) |
| Organization | Restaurant |
| `org:admin` | Restaurant owner |
| `org:member` | Restaurant staff |

## Sign-up flow

Email + password + restaurant name → create Clerk user → **call `createOrganization` with the restaurant name** → set it active → enter app.

Without the `createOrganization` step, every new vendor lands on the no-org gate. This is the most common way to break signup.

## Route guards

| State | Destination |
|---|---|
| Signed out | `(auth)/sign-in` |
| Signed in, no active organization | `(auth)/no-org` — "This account isn't registered as a restaurant" + sign out |
| Signed in, active organization | `(app)` |

## Supabase client

The Supabase client **must attach the Clerk session token** so Postgres RLS can read the org claims. Use Clerk's Supabase integration pattern. A bare anon client will silently return zero rows for everything.

## JWT claim shape — critical

Clerk V2 session tokens nest org claims compactly:

```
o.id   → organization id      (auth_org_id() reads this)
o.rol  → role, UNPREFIXED     ('admin' / 'member', NOT 'org:admin')
o.slg  → slug
o.per  → permissions
```

Any comparison against `'org:admin'` will never match. This is the easiest mistake to make in this codebase.

---

# 8. Database — what actually exists

Slice 1 tables only. **These are the only tables that exist. Do not query anything else.**

```
profiles              id text PK (Clerk user id), name, phone
restaurants           id text PK (Clerk org id), name, description, cover_url,
                      lat, lng, is_pure_veg, status, commission_rate_bps,
                      gst_status, gstin, is_open
restaurant_staff      id, restaurant_id, user_id, role
cuisines              id, name, image_url, sort_order
restaurant_cuisines   id, restaurant_id, cuisine_id
menu_items            id, restaurant_id, name, description, image_url,
                      price_paise, diet_type, gst_rate_bps, cuisine_ids[],
                      is_healthy, is_available
```

Enums: `diet_type` (`veg`/`egg`/`non_veg`), `gst_status` (`registered`/`composition`/`unregistered`), `restaurant_status` (`pending`/`approved`/`rejected`/`suspended`).

Do **not** reference `orders`, `order_items`, `payments`, `coupons`, `ledger_entries`, `reviews`, `restaurant_scores`, `item_reactions`, `user_preferences`, or `addresses`. They do not exist yet.

Types are generated into `packages/database`. Regenerate with `npm run db:types` after any schema change; never hand-edit generated types.

## Column-level grants on `restaurants` — read this

RLS controls which **rows** a vendor can touch. It does not control **columns**. Column privileges do that, and they are already applied:

**Vendor-writable:** `name`, `description`, `cover_url`, `lat`, `lng`, `gstin`, `is_open`

**Service-role only:** `status`, `commission_rate_bps`, `gst_status`, `is_pure_veg`

Do not build UI for the service-role-only fields. A write to them fails silently or errors — either way the user sees a save that didn't save. `status` in particular is the admin approval gate; a vendor self-approving would bypass PRD §3.3.

## `restaurant_staff` is read-only from the app

It mirrors Clerk org membership and is written only by the (not yet built) Clerk webhook. There are no insert/update/delete policies for `authenticated`. Do not build staff management UI in this slice.

---

# 9. Known gap — missing `restaurants` row

**A new vendor signs up, Clerk creates the organization, but no `restaurants` row exists in Supabase.** The `organization.created` webhook that would create it has not been built. Menu and Profile therefore have nothing to read.

This is a known gap, not a bug to be surprised by.

Interim approach for slice 1: on first load of the app shell, if no `restaurants` row exists for `auth_org_id()`, upsert one with the org name and `status = 'pending'`. Only ever set the vendor-writable columns from section 8.

The proper webhook lands in a later slice and will supersede this.

---

# 10. Money

**All monetary values are integers in paise.** ₹330.50 is `33050`.

- The user types rupees; convert on save, format on display.
- Conversion and formatting helpers live in `packages/shared`. **Import them. Never write inline `* 100` or `/ 100`.**
- Never use floats for currency anywhere, including intermediate values.
- Display rupee amounts with tabular figures so columns align.

All money math lives in `packages/shared` and is never duplicated into an app. If a calculation is needed that isn't there, add it to `packages/shared` with a test — do not inline it in a component.

---

# 11. Design

This is a utility app. High contrast, dense, glanceable, no decoration.

| Token | Value |
|---|---|
| Primary | `#1D4626` hunter green |
| Attention / warning | `#FEAE32` saffron |
| Background | `#FAF8F5` warm off-white |
| Card | `#FFFFFF` with a 1px `#EDE9E3` border |
| Veg marker | `#0F8A4D` |
| Egg marker | `#E8A33D` |
| Non-veg marker | `#A52A2A` |

Rules:
- Minimum touch target **56px**. Users have wet or greasy hands.
- Nothing actionable below 16px text.
- 12px card radius, 8px button radius (not pills — this is a tool).
- 16px screen margins.
- **No drop shadows.** React Native on Android only exposes `elevation`; use the 1px border instead. Shadows also cost overdraw on low-end devices.
- No food photography anywhere in the vendor app.
- Veg/non-veg markers follow the FSSAI convention: filled square inside a circle outline.

## Fonts

This app uses a deliberate custom typeface, not the system font — glanceability comes from weight and size contrast, and the system font doesn't give consistent weights across Android OEM skins.

- **Rubik** (Light, Regular, Medium, SemiBold, Bold, ExtraBold) for all UI text.
- **SpaceMono-Regular** for rupee amounts specifically — true monospace guarantees column alignment digit-for-digit, which a `tabular-nums` CSS-style utility does not reliably do on React Native's text renderer.
- Font files and the `fontAssets` export live in `packages/ui` (`fonts.ts` + `fonts/*.ttf`), shared with `apps/customer` when that app exists — one copy, not duplicated per app.
- Loaded via `useFonts(fontAssets)` from `expo-font` in `app/_layout.tsx`, gating first render until they resolve (`if (!fontsLoaded) return null`).
- Tailwind mapping in `tailwind.config.js`: `font-sans` → Rubik-Regular, `font-mono` → SpaceMono-Regular, plus explicit `font-rubik-{light,medium,semibold,bold,extrabold}` utilities for the other weights. **Never use bare `font-bold` / `font-semibold` / `font-medium`** — those set CSS `font-weight`, which React Native does not honor for custom-loaded fonts (each weight needs its own registered font-family name, hence the explicit utilities).
- Every `<Text>` needs an explicit font class. RN does not cascade `fontFamily` down from a wrapping `<View>` the way CSS cascades on web, so a class set on a container does not reach child `<Text>` elements — each one sets its own.
- Adding more weights or a second family goes through `packages/ui`, not a per-app font file, and should be checked against the 15MB budget in §12 with `npx expo-atlas`.

---

# 12. Performance budget

Target device: 3GB RAM Android on patchy 4G.

- Vendor app download **under 15MB**
- `FlashList`, never `FlatList`, for the menu list
- Never `select('*')` — select the columns the screen renders
- Wrap reads in TanStack Query so revisiting a screen is a cache hit
- Zustand for local state, not Redux
- Check the bundle with `npx expo-atlas` when adding a dependency

Do not hand-roll infrastructure to save bytes. Keep the boring libraries. The Rubik + SpaceMono font set in `packages/ui` (§11) is the one sanctioned exception to "no custom fonts" — don't add further font families, icon sets, or images without checking `npx expo-atlas` against the budget first.

---

# 13. Security

## Environment variables

`apps/vendor/.env` contains **only** these three:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

**Nothing in a mobile bundle is secret.** `EXPO_PUBLIC_*` values are inlined into `index.android.bundle` at build time and readable from any APK in minutes. The three above are designed to be public.

Never, under any circumstance, place in this app:
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS entirely
- `CLERK_SECRET_KEY`
- Any webhook signing secret
- Any Upstash, Razorpay, or gateway secret

Never prefix a secret with `EXPO_PUBLIC_`. That prefix means "inline this into the bundle."

Server-only operations belong in Supabase Edge Functions, not in the app.

## RLS is the security model

The anon key is public by design; it is safe only because Postgres refuses unauthorised rows. Every query from this app is subject to RLS. If a query returns nothing unexpectedly, check the JWT claims before assuming the SQL is wrong.

---

# 14. Commands and checks

Run from the repo root:

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm test` — vitest, includes the pricing engine tests

Vendor app:

- `npm run dev --workspace=@zaavo/vendor` — start Metro, scan the QR in Expo Go

Database (repo root, no Docker):

- `npm run db:push` — apply migrations to the linked project
- `npm run db:seed` — idempotent seed via `@supabase/supabase-js`
- `npm run db:types` — regenerate types into `packages/database`
- `npm run db:test-rls` — RLS isolation suite; **must exit 0**

After implementation run `typecheck` and `lint` at minimum. Run `db:test-rls` after any change touching policies or grants.

## Migrations

`supabase/migrations/` is the source of truth. There is no shadow database.

- New schema changes are **new forward migration files**, hand-written.
- Never edit a migration that has been pushed.
- Never run `supabase db diff`, `supabase start`, or `supabase db reset`.
- Any change to policies or grants must come with a new assertion in `scripts/test-rls.ts`.

---

# 15. Testing output

After implementing anything user-facing, give exact steps:

1. Which command to run
2. What to do on the phone, screen by screen
3. What the correct result looks like
4. What to check in the Supabase dashboard to confirm the data actually landed

For auth work, always include: sign up fresh → confirm the Clerk organization was created → confirm the `restaurants` row exists → sign out → sign back in.

Do not say "it should work." Say what to tap and what to expect.

---

# 16. Code standards

- TypeScript, strict. Avoid `any`.
- Small components. Business logic out of JSX.
- Shared types come from `packages/database` and `packages/shared` — do not redeclare them locally.
- Colocate a screen's query hooks with the screen; put anything reused in `src/lib`.
- Handle loading, empty, and error states on every screen that fetches. On a slow Silchar connection users see loading states more than content.
- No unrelated refactors. No unrequested features.
- If you import a package, declare it in `apps/vendor/package.json` — npm hoists flat, so an undeclared import can work today and break later.

---

# 17. When in doubt

1. Keep it inside the current slice.
2. Read the actual file before describing a change to it.
3. Check `docs/PRD.md` for product rules; ask if it's silent.
4. Prefer asking one focused question over guessing.
5. Present a plan, get approval, then implement.
6. Run the checks and report real output.
7. Give exact test steps.