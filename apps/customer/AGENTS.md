# AGENTS.md — Zaavo Customer App

You are a **principal-level React Native engineer** working on `apps/customer`, the public ordering app for **Zaavo**, a multi-vendor food delivery marketplace for Silchar, Assam.

Your job: understand the request, read the relevant skills, inspect the actual code, propose a plan, get approval, then implement.

This file governs work inside `apps/customer`. The repo-root `CLAUDE.md` governs monorepo-wide rules and the database workflow. When they conflict, root `CLAUDE.md` wins on infrastructure, this file wins on the customer app.

---

# 0. Read this before assuming anything

Several things in this project differ from common patterns, from `apps/vendor`, and from what you may have seen in training data. **Verify against the repo, not memory.**

| You might assume | Reality here |
|---|---|
| pnpm workspaces | **npm** workspaces. Internal deps use `"*"`, never `"workspace:*"` |
| Docker / local Supabase | **No Docker on this machine.** No `supabase start`, no `db diff`, no `db reset` |
| The app is still auth-free | **It isn't anymore.** `@clerk/expo` is a real dependency, the whole app requires a signed-in session (mirroring `apps/vendor`), and there's a full `(auth)` → `(onboarding)` → `(app)` route-group flow. Check `app/_layout.tsx` and `app/index.tsx` before assuming otherwise |
| The home feed/restaurant detail screens attach a Clerk token | They still don't — `apps/customer/lib/supabase.ts` stays a **plain anon-key client** for those two screens (their reads are public regardless of who's signed in). Anything needing the signed-in user's identity (profiles, user_preferences) uses `apps/customer/lib/useSupabase.ts` instead, which does attach the Clerk token |
| Fonts come from `packages/ui` (Rubik/SpaceMono), shared with the vendor app | **They are not shared.** `apps/vendor/AGENTS.md` §11 claims Rubik/SpaceMono are "shared with `apps/customer` when that app exists" — that has not happened. This app installs its own Google Fonts packages (`@expo-google-fonts/inter`, `@expo-google-fonts/plus-jakarta-sans`) directly. `@zaavo/ui` **is** a real dependency now, but only for the shared `Mark`/`Wordmark`/`WordmarkSmall` logo components (§10) — never for its fonts |
| Prices as decimals / floats | **Integer paise.** ₹330.50 is `33050` |
| A consumer app implies dense/utility design like the vendor app | **The opposite is deliberate.** `docs/DESIGN.md` and PRD §7.1 call out that this app is visually rich and food-photography-led where the vendor app is stripped down |
| Checkout/order tracking exist somewhere | **They don't — but cart does.** `lib/useCart.ts` + `app/(app)/cart.tsx` are real (local Zustand state, no `orders` table involved — see §7/§9); checkout, payment, and order placement/tracking remain a later slice |
| No sign-out affordance needed | The real Sign Out button lives on the Profile screen (`app/(app)/profile.tsx`) now. There is no sign-out anywhere in `home.tsx` anymore — an earlier temporary header button was removed when Profile was built |

If the repo contradicts this file, say so instead of silently picking one.

---

# 1. Product

Zaavo is a marketplace. Three separate surfaces:

- `apps/customer` — Expo, **this app**, for people ordering food
- `apps/vendor` — Expo, for restaurant owners and staff
- `apps/admin` — Next.js web, for the platform owner (vendor-approval + cuisine-taxonomy slice only — see `apps/admin/AGENTS.md`)

**The customer app is a consumer product, not a work tool.** It is judged on appetite appeal and browsing delight, not glanceability under kitchen conditions — that posture belongs to `apps/vendor` only. Food photography, warmer visual polish, and pill-shaped interactive elements are all deliberate here (PRD §7.1, `docs/DESIGN.md`).

Full product spec is in `docs/PRD.md`, §6 "Customer App" specifically. Read it for anything about money, preferences, or ordering flow. Do not invent product rules — if the PRD is silent, ask.

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

This project is built in vertical slices. **Building ahead of the slice is the single most damaging thing you can do here**, because it creates UI and client-side assumptions that later slices must unpick, and because several of the tables a request might reach for do not exist in the database at all yet.

## Slice 2 (current): auth + onboarding preference capture

What exists today, in full:
- **Route groups**: `(auth)` — sign-up, sign-in, forgot-password, all requiring no session; `(onboarding)` — Diet then Cuisine, requires a session but no `user_preferences` row yet; `(app)` — everything else, requires both a session and a `user_preferences` row. `app/index.tsx` (top-level) is a pure redirect between the three based on auth/preferences state.
- **The whole app requires sign-in** (mirroring `apps/vendor`, confirmed as the intended direction) — there is no anonymous browsing path anymore. Signed-out users land on `(auth)/sign-in`.
- **Onboarding** (PRD §6.2): Diet (single-select: Pure Veg / Veg + Egg / Everything) then Cuisine (multi-select, minimum 2 to actively continue). Both screens are independently skippable; either path writes exactly one `user_preferences` row (see `app/(onboarding)/cuisines.tsx`) — a row existing at all, not its contents, is what stops onboarding from showing twice.
- **Profile self-heal**: `lib/useProfile.ts`'s `useEnsureProfile()` upserts a `profiles` row, same interim-fix pattern as `apps/vendor`'s `useEnsureRestaurant()` — PRD §3.3's `user.created` webhook doesn't exist yet either. Fired from **both** `(onboarding)/_layout.tsx` and `(app)/_layout.tsx`, not just the latter: `user_preferences.user_id` has an FK to `profiles.id`, and a brand-new sign-up reaches onboarding (and writes a preferences row there) before `(app)` ever mounts. Dropping the onboarding call site would silently break preference-saving for every first-time sign-up.
- **Home screen** (`app/(app)/home.tsx`): a header (logo + a notification bell that's honest about not being built, `Alert.alert`), an inline search box (restaurant *and* dish name, via a second `menu_items` query), the promo carousel (§8), and the restaurant feed with pull-to-refresh — substantially built out since slice 1, not "unchanged apart from its path" anymore.
- **Restaurant detail** (`app/(app)/restaurant/[id].tsx`): a category rail driving a lazily-fetched dish grid (only the selected category's items are fetched, not the whole menu at once), in-category search + diet filter, a restaurant-details bottom sheet (address/phone/hours), a full-screen promo-banner lightbox, and add-to-cart on every dish card (§7/§9's cart notes). Also substantially built out since slice 1.
- **Bottom tab bar** (`app/(app)/_layout.tsx`, PRD §6.1's five tabs): Home, Profile, and Cart are real; Search and Orders are still `ComingSoonScreen` placeholders (`components/ComingSoonScreen.tsx`) — same convention as `apps/vendor`'s Orders tab, not fabricated functionality. `restaurant/[id]` is registered with `options={{ href: null }}` so it stays a pushed detail screen, not a sixth tab — see §6. Cart shows a `tabBarBadge` (total item count across the cart) sourced from `lib/useCart.ts`'s `useCartTotalItemCount()`.
- **Profile screen** (`app/(app)/profile.tsx`): fetches and edits `profiles.name`/`profiles.phone` (the WhatsApp number, for future offer/campaign messaging — no separate `whatsapp` column, `phone` is reused), shows a profile-completion percentage (name set, phone set, `diet_preference` set, ≥1 cuisine — see `lib/useProfile.ts`'s `useProfileDetails`/`useSaveProfileDetails`/`usePreferencesDetails`), and hosts the real Sign Out button (moved here from the home banner's temporary one, which is gone).

**Explicitly out of scope — do not build, do not create tables for, do not add UI for:**
- Checkout, payments, Razorpay, COD, order placement — the cart itself is real (`lib/useCart.ts`, `app/(app)/cart.tsx`), but "Proceed to Checkout" is an honest `Alert.alert("Checkout isn't built yet...")`, not a working button. Building checkout means extending `packages/shared`'s pricing engine for per-item GST first (see the comment above the bill-summary block in `cart.tsx` for why the cart itself deliberately shows no GST line) — don't wire up a fake/simplified total to make the button "work"
- Order tracking, order history, reorder, invoices — the Orders tab is a placeholder only
- The dedicated Search **tab** — still a placeholder. Don't confuse this with Home's own inline search box (`DebouncedSearchBox`, `home.tsx`), which is real and searches both restaurant names and dish names (`menu_items`) — that's a different, already-built thing
- Cuisine chips, filter row (Veg Mode / rating / fast / offers), location pill — still no implementation. (Cart badge and the promo banner carousel **are** built now — see §8, don't assume this whole PRD §6.6 "Home" list is equally unbuilt just because some of it still is)
- The hard-filter/soft-signal logic (PRD §6.3) — `user_preferences` is captured and stored, but nothing reads it back yet to actually filter or rank the home feed. Wiring that up is a separate request, not implied by the table existing.
- Editing diet/cuisine preferences after onboarding, addresses, saved payment methods — the Profile screen covers name/WhatsApp number only, nothing more
- Reviews, ratings, quality scores, recommendation scoring (PRD §6.5) — no reviews tables exist in the database at all
- Realtime subscriptions
- Push notifications
- Maps or geolocation pickers
- OAuth / social sign-in — Expo Go constraint, see §6

If a request seems to require one of these, stop and say so rather than building it.

---

# 4. Skills

Use only these installed skills:

| Skill | Use for |
|---|---|
| `supabase` | Client usage, RLS, CLI |
| `supabase-postgres-best-practices` | Schema and query design |
| `expo-router` | File-based routing, tabs, stacks, modals |
| `expo-project-structure` | Folder layout |
| `expo-tailwind-setup` | NativeWind configuration |
| `expo-data-fetching` | TanStack Query patterns |
| `clerk-expo` | Auth in Expo, token cache, hooks, SecureStore, Expo Router integration |
| `clerk-orgs` | Only if this app ever needs to read a signed-in user's org context (PRD §3.2: an owner may also be a customer; the customer app is meant to ignore org context, not branch on it) — not used anywhere today |

Do not invent skills. Do not install new ones without asking.

---

# 5. Tech stack

Use:
- Expo (SDK 57) + expo-router with typed routes
- TypeScript, strict
- NativeWind
- `@supabase/supabase-js` via the `@zaavo/database` client factory — plain anon client (`lib/supabase.ts`) for public reads, Clerk-token-attached client (`lib/useSupabase.ts`) for anything user-scoped
- `@clerk/expo` for auth, `expo-secure-store` for its token cache
- `expo-auth-session` / `expo-web-browser` — Clerk's browser-based `useSSO()` for Google sign-in (§6). Expo Go-compatible; do not confuse with native Google sign-in, which needs different packages and a dev build
- TanStack Query for server state
- `FlashList` for any list
- `@expo-google-fonts/inter` and `@expo-google-fonts/plus-jakarta-sans` for type

Do not use:
- Supabase Auth (Clerk is the identity provider)
- Redux
- Zustand — a real dependency now (`lib/useCart.ts`, persisted via AsyncStorage), the one deliberate exception to the house preference of avoiding cross-screen store state. It exists *only* for the cart. Don't reach for it for other screens' local state (the onboarding flow's diet/cuisine steps still correctly pass state via a router param, see `app/(onboarding)/diet.tsx`) — a single screen's state doesn't need a store
- `@zaavo/ui`'s fonts export (Rubik/SpaceMono) — that is the vendor app's typeface, deliberately different from this app's Plus Jakarta Sans + Inter (see §0, §11). The package itself is a real dependency now (for `Mark`/`Wordmark`/`WordmarkSmall`, §10) — just never its `fontAssets`
- Any UI kit that pulls in a large native dependency
- Lottie, moment.js, full lodash imports

---

# 6. Auth model

The whole app requires a signed-in session — mirroring `apps/vendor`'s pattern, confirmed as the intended direction rather than assumed.

- Development targets **Expo Go** until the project moves to a dev client, same constraint as `apps/vendor` — hook-based Clerk flows only (`useSignIn`, `useSignUp`, `useAuth`, `useUser`), no push, no passkeys, no MFA enrollment UI (email-code MFA is handled if Clerk requires it, but nothing here lets a user set up TOTP).
- **Social auth is browser-based SSO only (`useSSO`/`startSSOFlow`, `strategy: "oauth_google"`), never native.** `useSignInWithGoogle`/`useSignInWithApple` (`@clerk/expo/google`, `/apple`) give a real native picker but require a development build (`npx expo run:ios`/`run:android`) — that's the same hard line as everything else gated on Expo Go in this file. Don't add them without first revisiting this constraint with the user. Google must be enabled under Clerk Dashboard → Social connections before `startSSOFlow({ strategy: "oauth_google" })` works — this is a manual, non-automatable step; if it's missing, the SSO button fails at runtime with no build-time signal.
- **No organizations, at all — in this app's UI.** Per PRD §3.2, a restaurant owner may also place orders as a customer, so this app must not reject or branch on the presence of a Clerk organization. Unlike `apps/vendor`'s `(auth)/_layout.tsx`, there is no `no-org` gate here — `(auth)/_layout.tsx` only checks `isSignedIn`.
- **But the Clerk instance itself still has Organizations enabled**, because it's shared with `apps/vendor`. That means every session — including ones from this app, which never touches an org — gets a pending "choose-organization" task, and Clerk's SDK reports `isSignedIn: false` while a task is pending, no matter how many times you `reload()` the client. **Every `useAuth()` call in this app passes `{ treatPendingAsSignedOut: false }`** for exactly this reason (mirroring every `useAuth()` call in `apps/vendor`, for the identical underlying cause, even though the two apps' comments frame it differently). Omitting this option on a new call site is the single easiest way to reintroduce "just signed in, bounced straight back to sign-in" — confirmed by hitting it for real once, and it presented as the Google-SSO flow specifically appearing to loop back to the login screen with a `session_exists` error on retry.
- **`useSSO`'s redirect needs a real route.** `startSSOFlow` defaults to `AuthSession.makeRedirectUri({ path: "sso-callback" })`, and in Expo Go that redirect actually reaches Expo Router as a normal deep link (`exp://.../--/sso-callback`) — with no matching route it hits "Unmatched Route" instead of returning to the app. `app/sso-callback.tsx` exists solely to give that redirect somewhere valid to land; it just hands off to the root `index.tsx` redirect. Don't remove it while `useSSO` is in use.
- Shared Clerk instance with `apps/vendor`: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `apps/customer/.env` is the **same** value as in `apps/vendor/.env`, not a separate Clerk application — one user pool across both apps is what makes "owner is also a customer" possible.

## Route groups and the guard chain

```text
app/index.tsx           -- pure redirect: signed out -> (auth), no prefs -> (onboarding), else -> (app)/home
app/(auth)/              -- sign-up, sign-in, forgot-password. Layout redirects a signed-in user to "/"
app/(onboarding)/        -- diet, cuisines. Layout requires a session AND no existing user_preferences row
app/(app)/               -- Tabs: home, search, orders, cart, profile, + restaurant/[id] (hidden from the
                            tab bar via `href: null`, still reachable via Link/router.push from home.tsx).
                            Layout requires a session AND an existing user_preferences row.
```

`(app)/_layout.tsx` is a `<Tabs>`, not a bare `<Stack>` — mirrors `apps/vendor`'s tab bar structure (same active/inactive tint pattern), recolored to this app's palette (`#1D4626` active, `#8A8578` inactive). Don't collapse it back into a `<Stack>` "to simplify" — the five-tab bar (PRD §6.1) is deliberate. Any new screen that should NOT appear as a tab needs its own `<Tabs.Screen name="..." options={{ href: null }} />` entry, same as `restaurant/[id]`.

A `user_preferences` row existing at all (regardless of contents — see §3) is what `useHasPreferences()` (`lib/useProfile.ts`) checks to decide onboarding-vs-home. Both the top-level `index.tsx` and `(app)/_layout.tsx` re-check this independently rather than trusting navigation history, same reasoning as `apps/vendor`'s guards re-checking `isSignedIn`/`organization` at every layout rather than assuming a prior screen already enforced it.

## Supabase client split

`lib/supabase.ts` (plain anon client) and `lib/useSupabase.ts` (Clerk-token-attached, via Supabase's third-party-auth `accessToken` hook) **both exist and are each other's replacement for different call sites** — not a leftover to consolidate. Home feed and restaurant detail keep using the plain client (public reads, RLS's `to anon` policies do the work). Anything reading or writing `profiles` or `user_preferences` uses `useSupabase()` so RLS sees `auth_user_id()`.

---

# 7. Database — what actually exists

Same database as `apps/vendor`. **These are the only tables that exist. Do not query anything else.**

```text
profiles              id text PK (Clerk user id), name, phone
user_preferences      user_id text PK (references profiles.id), diet_preference,
                      preferred_cuisine_ids uuid[]
restaurants           id text PK (Clerk org id), name, description, cover_url,
                      logo_url, lat, lng, is_pure_veg, status, commission_rate_bps,
                      gst_status, gstin, is_open, address, landmark, pincode,
                      contact_phone, contact_email
restaurant_staff      id, restaurant_id, user_id, role
restaurant_hours      id, restaurant_id, day_of_week, is_closed, open_time, close_time
restaurant_banners    id, restaurant_id, image_url, sort_order — a restaurant's OWN
                      promo banners, distinct from platform_banners below
cuisines              id, name, image_url, sort_order
restaurant_cuisines   id, restaurant_id, cuisine_id
menu_categories       id, restaurant_id, name, sort_order, thumbnail_url
menu_items            id, restaurant_id, category_id, name, description, image_url,
                      thumbnail_url, price_paise, packaging_charge_paise, diet_type,
                      gst_rate_bps, cuisine_ids[], is_healthy, is_available,
                      unavailable_until (a scheduled "back in stock" time — see the
                      effective-availability formula noted in §7's RLS section below)
platform_banners      id, media_type ('image'/'video'/'youtube'), media_url,
                      sort_order, is_active — admin-managed (apps/admin's Promos
                      page), rendered by home.tsx's PromoCarousel; §8
```

This list grew during this session (menu_categories, restaurant_hours,
restaurant_banners, platform_banners, and several menu_items/restaurants
columns were added after this file was first written) — if you're about to
add a table/column that seems missing here, check the live schema
(`packages/database/src/types.ts`, or a read-only query) before assuming it
doesn't exist; this table can drift out of date again.

Enums: `diet_type` (`veg`/`egg`/`non_veg` — per-dish), `diet_preference` (`pure_veg`/`veg_egg`/`everything` — a user's onboarding stance, a **separate enum from `diet_type`**, do not conflate them), `gst_status` (`registered`/`composition`/`unregistered`), `restaurant_status` (`pending`/`approved`/`rejected`/`suspended`).

`user_preferences` has no `anon` policy — only `authenticated`, own-row (`user_id = auth_user_id()`), added in `supabase/migrations/20260729060000_user_preferences.sql`.

Do **not** reference `orders`, `order_items`, `payments`, `coupons`, `ledger_entries`, `reviews`, `restaurant_scores`, `item_reactions`, or `addresses`. They do not exist yet — anything in PRD §6 that depends on them (checkout, order placement/tracking, personalisation) is out of scope per §3. The cart itself (`lib/useCart.ts`) does **not** depend on any of these — it's pure local Zustand state (persisted to AsyncStorage, not a database write), which is exactly why it could be built ahead of the orders schema.

## Public read policies — what the home feed and restaurant detail can see

Those two screens still use the plain anon client (§6), relying on the `to anon` policies already in place (`supabase/migrations/20260727055325_slice1_vendor_menu.sql`) even though the app now requires sign-in to reach them:

- `restaurants_select_public_approved` — only rows with `status = 'approved'`
- `cuisines_select_public`, `restaurant_cuisines_select_public` — full read
- `menu_items_select_public_available` — rows where `is_available = true`, **or** `unavailable_until` has already passed (`unavailable_until <= now()`). A vendor can schedule a dish to come back automatically at a set time (apps/vendor's `AvailabilityPicker`) instead of only ever toggling it back on by hand — this policy (and every screen reading `menu_items`) has to apply that same "effectively available" formula, not a plain `is_available` check, or a dish whose scheduled time already passed would still be hidden
- `restaurant_hours_select_public`, `restaurant_banners_select_public`, `menu_categories_select_public` — full read for an approved restaurant's own rows
- `platform_banners_select_public` — rows where `is_active = true`

These policies already do the filtering. The `.or(\`is_available.eq.true,unavailable_until.lte.${...}\`)` in `app/(app)/restaurant/[id].tsx` (mirroring the RLS policy's own formula — not a plain `.eq("is_available", true)` anymore) and the absence of a `status` filter in `app/(app)/home.tsx` (RLS handles it) are deliberate, not accidental — see the comments in both files before "fixing" what looks like a missing filter.

Types are generated into `packages/database`. Regenerate with `npm run db:types` after any schema change; never hand-edit generated types.

---

# 8. Known gaps

**`restaurants.cover_url` is now rendered on the home feed** (`app/(app)/home.tsx`'s restaurant cards) — uploaded by vendors via `apps/vendor/app/(app)/profile.tsx`'s `onPickCover`, R2-backed (PRD §7.5). Falls back to a plain icon placeholder when a restaurant hasn't uploaded one yet; don't treat a missing cover as an error state.

**`menu_items.image_url` is still not rendered anywhere.** Populated by vendors the same way, but `app/(app)/restaurant/[id].tsx`'s menu row doesn't select or display it yet. Real gap, not a deliberate decision — in-scope to close (existing column, no new backend work) if asked.

**The promo banner carousel is now real, not a placeholder.** `home.tsx` renders `components/PromoCarousel.tsx`, reading `platform_banners` (admin-managed via `apps/admin`'s Promos page — image, video file, or a YouTube link; not a restaurant's own banners, see `restaurant_banners` in §7). It's a standalone rounded card with pagination dots and auto-advance (4s... actually 10s, see the component), sitting below the header/search — earlier revisions tried overlaying it as a full-bleed background behind the header/search, which didn't work well once real (busy, self-contained) marketing graphics were uploaded; don't reintroduce that layout without a specific reason. Renders nothing at all when there are no active banners.

**`menu_items.image_url` is still not rendered anywhere** (`thumbnail_url` is, everywhere a dish photo shows). Populated by vendors the same way as `thumbnail_url`, but nothing selects/displays the full-size `image_url`. Real gap, not a deliberate decision — in-scope to close if asked.

**Pull-to-refresh exists on Home, not on restaurant detail or anywhere else.** `home.tsx`'s `FlashList` has `refreshing`/`onRefresh`, invalidating both the restaurant feed and the promo banners query together. No pagination anywhere yet — fine at today's restaurant/menu count, revisit if it's ever raised.

**Cuisine onboarding selections aren't read back anywhere.** `user_preferences` is written to, correctly and completely, but nothing in the home feed or restaurant detail queries it — PRD §6.3's hard-filter/soft-signal behaviour has no implementation. Don't assume the table being populated means the feature is "mostly done."

---

# 9. Money

**All monetary values are integers in paise.** ₹330.50 is `33050`.

- Never write inline `* 100` or `/ 100`. Use `formatPaise` from `@zaavo/shared` for display, as `app/(app)/restaurant/[id].tsx` already does for menu item prices.
- Never use floats for currency anywhere, including intermediate values.
- All money math lives in `packages/shared` and is never duplicated into an app. If a calculation is needed that isn't there, add it to `packages/shared` with a test — do not inline it in a component.
- The cart exists (`lib/useCart.ts`, `app/(app)/cart.tsx`) but deliberately shows **no GST** — `packages/shared`'s `calculateOrderTotals` takes one flat order-wide GST rate, but `menu_items.gst_rate_bps` is per-item, so a mixed-rate cart can't be correctly expressed by that function as it stands. The cart's bill section is a plain sum of item subtotal + packaging charge (not proportional/BPS math, so it doesn't count as the kind of calculation that has to live in `packages/shared`) plus a "Taxes & delivery calculated at checkout" note. Extending the pricing engine for per-item GST is checkout work, not this app's current scope — don't hack a GST estimate into the cart screen to "finish" it.
- Commission math (`calculateVendorPayout`) has no call site in this app at all — it's vendor/admin-facing, not customer-facing. Don't add it here.

---

# 10. Design

This is a consumer app. Warm, photography-friendly, appetite-first — the deliberate opposite of the vendor app's utility density (§0, §1).

| Token | Value |
|---|---|
| Primary | `#1D4626` hunter green |
| Primary (dark variant) | `#032F12` |
| Secondary / attention | `#FEAE32` saffron |
| Secondary (dark variant) | `#835400` |
| Background | `#FAF8F5` warm off-white |
| Card | `#FFFFFF` |
| Border | `#EDE9E3` |
| Veg marker | `#0F8A4D` |
| Egg marker | `#E8A33D` |
| Non-veg marker | `#A52A2A` |

Rules (per `docs/DESIGN.md` and PRD §13):
- Hunter green (`#1D4626`) never appears inside a menu item card — it's a brand/header colour. Veg marker green (`#0F8A4D`, `bg-veg`) has a second deliberate use now: the add-to-cart button/stepper overlaid on a dish card's thumbnail (`restaurant/[id].tsx`'s `MenuItemCard`, `components/QuantityStepper.tsx`) — green-for-add is a near-universal convention in this category. Still never hunter green on a card.
- Card radius is `16px` (`rounded-card` in `tailwind.config.js`) — **larger** than the vendor app's `12px`, and interactive elements like the ADD button/stepper are pill-shaped (`rounded-full`), not the vendor app's boxy 8px — this is not an inconsistency to "fix" between the two apps.
- Veg/non-veg markers follow the FSSAI convention: filled square inside a circle outline (`components/DietBadge.tsx`), same convention as the vendor app, same three colours.
- Food photography is expected and encouraged here, unlike the vendor app.

## Fonts

Deliberately different from the vendor app's Rubik/SpaceMono (§0).

- **Plus Jakarta Sans** (`headline` = 700 Bold, `headline-semibold` = 600 SemiBold) for branding, titles, and prices.
- **Inter** (`sans` = 400 Regular, `inter-medium` = 500 Medium, `inter-semibold` = 600 SemiBold) for body text, descriptions, and micro-copy.
- Loaded via the two `@expo-google-fonts/*` packages directly in `app/_layout.tsx`, gating first render until both resolve (`if (!interLoaded || !plusJakartaLoaded) return null`) — same gating pattern as the vendor app, different font source.
- Tailwind mapping lives in `apps/customer/tailwind.config.js`. As in the vendor app, **every `<Text>` needs an explicit font class** — React Native does not cascade `fontFamily` from a wrapping `<View>`.
- PRD §13 calls for `tabular-nums` on price displays so bill/menu columns align; this isn't applied anywhere in the current code yet (menu item prices just use `font-headline-semibold`) — worth adding when touching price displays, not a blocking issue today.

## Logo

`Mark`, `Wordmark`, `WordmarkSmall` — from `@zaavo/ui` (`packages/ui/logo.tsx`), hand-transcribed `react-native-svg` components from `zaavo-logo-assets/` at the repo root (that folder is the source of truth for the geometry; regenerate the components by hand from there if the mark ever changes, don't edit path data ad hoc). Every colour variant in that asset folder is the same geometry with a different single fill — so recolouring here is the `color` prop, never a different component or a new file.

- `Mark` was the original icon-only choice for the three `(auth)` screens; **all three now use `Wordmark`** (the full logo with the fork/spoon cutout) at `height={44}`, an explicit, deliberate override of the width guidance below — the user asked for the detailed mark specifically, not the simplified one, even undersized. `home.tsx`'s header also uses `Wordmark` (`height={24}`, `color="#FAF8F5"` — white, since it sits on the dark green header bar).
- `WordmarkSmall` is still used in both `(onboarding)` screens' top-of-screen brand line — that one wasn't revisited.
- The width guidance itself still stands as the *default* rule for any *new* call site: `Wordmark` carries the fork/spoon cutout detail, and the asset README is explicit that it fills in illegibly under ~280px wide — prefer `WordmarkSmall` below that width unless there's a specific reason (matching the auth screens/home header) to accept the tradeoff.
- Default colour is the ink token (`#1D4626`); pass `color` explicitly when placing it on a dark/green surface (as `home.tsx` does) or a light card (auth screens use the default ink, no `color` prop).

---

# 11. Performance budget

- Customer app download **under 25MB** (PRD §12) — more headroom than the vendor app's 15MB, but still a budget, not a suggestion.
- `FlashList`, never `FlatList`, for any list — the rule for *new* lists. `restaurant/[id].tsx`'s category rail/dish grid/banner carousel and `home.tsx`'s promo carousel all currently use plain `FlatList` (built before this rule was consistently enforced, or for cases needing a `FlatList`-only API like `getItemLayout`-driven `scrollToIndex`) — that's a pre-existing inconsistency, not something to silently "fix" as a drive-by while touching those files for something else. `cart.tsx`'s line-item list correctly uses `FlashList`.
- Never `select('*')` — select the columns the screen renders. Every screen that queries Supabase does this.
- Wrap reads in TanStack Query so revisiting a screen is a cache hit.
- Check the bundle with `npx expo-atlas` when adding a dependency, especially a font or image-heavy one.

---

# 12. Security

## Environment variables

`apps/customer/.env` needs:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key — **same value as `apps/vendor/.env`**, one shared Clerk instance (§6) |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

**Nothing in a mobile bundle is secret.** `EXPO_PUBLIC_*` values are inlined into the shipped bundle and readable from any APK. Never place `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, or any webhook/gateway secret in this app. Never prefix a secret with `EXPO_PUBLIC_`.

Server-only operations belong in Supabase Edge Functions, not in the app.

## RLS is the security model

The anon key is public by design — it's safe only because every table's `to anon` policy already restricts rows (approved restaurants, available menu items) or excludes `anon` entirely (`profiles`, `user_preferences` are `to authenticated` only, own-row). If a query returns nothing unexpectedly, check the policy's `using` clause — and which client (`lib/supabase.ts` vs `lib/useSupabase.ts`, §6) the call site is actually using — before assuming the SQL is wrong.

---

# 13. Commands and checks

Run from the repo root:

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm test` — vitest, includes the pricing engine tests

Customer app:

- `npm run dev --workspace=@zaavo/customer` — start Metro, scan the QR in Expo Go

Database (repo root, no Docker):

- `npm run db:push` — apply migrations to the linked project
- `npm run db:seed` — idempotent seed via `@supabase/supabase-js`
- `npm run db:types` — regenerate types into `packages/database`
- `npm run db:test-rls` — RLS isolation suite; **must exit 0**

After implementation run `typecheck` and `lint` at minimum.

## Migrations

`supabase/migrations/` is the source of truth. There is no shadow database.

- New schema changes are **new forward migration files**, hand-written.
- Never edit a migration that has been pushed.
- Never run `supabase db diff`, `supabase start`, or `supabase db reset`.
- Any change to policies must come with a new assertion in `scripts/test-rls.ts`.

---

# 14. Testing output

After implementing anything user-facing, give exact steps:

1. Which command to run
2. What to do on the phone, screen by screen
3. What the correct result looks like
4. What to check in the Supabase dashboard to confirm the data matches (e.g. an item marked unavailable in the vendor app should disappear here)

For auth/onboarding work, always include: sign up fresh → verify the email code → confirm the `profiles` row exists → complete or skip onboarding → confirm the `user_preferences` row exists with the expected contents → force-quit and reopen → confirm it lands on home, not onboarding again.

Do not say "it should work." Say what to tap and what to expect.

---

# 15. Code standards

- TypeScript, strict. Avoid `any`.
- Small components. Business logic out of JSX.
- Shared types come from `packages/database` and `packages/shared` — do not redeclare them locally.
- Colocate a screen's query hooks with the screen; put anything reused in `lib/`.
- Handle loading, empty, and error states on every screen that fetches — both existing screens already do this; match the pattern.
- No unrelated refactors. No unrequested features.
- If you import a package, declare it in `apps/customer/package.json` — npm hoists flat, so an undeclared import can work today and break later.

---

# 16. When in doubt

1. Keep it inside the current slice (§3) — this app has eleven routes today (three auth, two onboarding, six under `(app)`: home, search, orders, cart, profile, restaurant/[id]) but not all eleven are equally built — search and orders are still placeholders; see §3's out-of-scope list for what's real vs. not. Most requests that sound reasonable are actually the next slice.
2. Read the actual file before describing a change to it.
3. Check `docs/PRD.md` §6 for product rules; ask if it's silent.
4. Prefer asking one focused question over guessing.
5. Present a plan, get approval, then implement.
6. Run the checks and report real output.
7. Give exact test steps.
