# Zaavo — Multi-Vendor Food Delivery Platform
## Product Requirement Document

**Version:** 2.0
**Last updated:** 27 July 2026
**Market:** Silchar, Assam (single city at launch)
**Owner:** Habib Tanwir

---

## 0. What changed in v2

This version supersedes the original single-app PRD. Key changes:

| Area | v1 | v2 |
|---|---|---|
| App structure | One app, role-routed | Two mobile apps + one web admin |
| Payments | Unspecified | Razorpay Route (split settlement) + COD ledger |
| Media storage | Sanity for everything | Cloudflare R2 for all media (menu photos, banners, video) — Sanity dropped |
| Auth | Clerk (roles) | Clerk **Organizations** — one org per restaurant |
| Discovery | Sort by distance/rating | Preference-based personalisation |
| Ratings | Mentioned only as a sort key | Full review system + vendor quality score |
| Money handling | Rupee decimals | **Integer paise throughout** |

---

## 1. Product Goals

1. **Neutral marketplace.** Any restaurant in Silchar can register, list a menu, and take orders. No single-brand gating.
2. **Right surface for each role.** Customers and vendors get purpose-built apps; the platform owner gets a web dashboard.
3. **Transparent, automated money flow.** Commission, GST, fees, and vendor payouts computed by one shared engine and settled automatically where possible.
4. **Works on cheap phones and slow networks.** Small bundles, low data usage, graceful degradation.

### Non-goals for v1
- Multi-city expansion
- In-house rider fleet and rider app
- Table booking / dine-in reservations
- Loyalty or rewards programme
- Dark theme

---

## 2. System Architecture

### 2.1 Three surfaces

| Surface | Tech | Users | Rationale |
|---|---|---|---|
| **Customer app** | Expo / React Native | Public | Play Store + App Store listing |
| **Vendor app** | Expo / React Native | Restaurant owners & staff | Separate listing, independent release cycle, focused UI |
| **Admin dashboard** | Next.js (web) | Platform owner | Wide tables, charts, CSV export, instant deploys with no store review |

### 2.2 Monorepo

```
zaavo/
├── .claude/
│   ├── skills/
│   └── CLAUDE.md
├── docs/
│   ├── PRD.md
│   └── DESIGN.md
├── apps/
│   ├── customer/            @zaavo/customer   (Expo)
│   ├── vendor/              @zaavo/vendor     (Expo)
│   └── admin/               @zaavo/admin      (Next.js)
└── packages/
    ├── shared/              @zaavo/shared     pricing engine, types, enums
    ├── database/            @zaavo/database   Supabase client + generated types
    └── ui/                  @zaavo/ui         shared RN components
```

- **Package manager: npm workspaces** (not pnpm — its symlinked `node_modules` conflicts with Metro's resolver).
- Internal dependencies use `"*"`, not `"workspace:*"` (npm does not support the workspace protocol).
- Task runner: Turborepo.
- Always run `npm install` from the repo root. One lockfile, committed.
- Each Expo app needs `metro.config.js` with `watchFolders` pointing at the workspace root and `nodeModulesPaths` resolving both app-level and root `node_modules`.

**Phantom dependency discipline:** npm hoists flat, so an app can import a package it never declared. Rule: if you import it, declare it in that app's `package.json`.

### 2.3 Bundle identifiers (permanent once published)

- Customer: `com.zaavo.customer`
- Vendor: `com.zaavo.partner`

### 2.4 Service map

| Concern | Service |
|---|---|
| Auth & organisations | Clerk (Organizations = restaurants) |
| Relational data | Supabase Postgres + RLS |
| Realtime | Supabase Realtime |
| Server logic | Supabase Edge Functions |
| Menu / restaurant images, promo banners, video | Cloudflare R2 (zero egress fees — see §7.5) |
| Cache, rate limits, locks | Upstash Redis |
| Scheduled & delayed jobs | Upstash QStash |
| Payments | Razorpay Route |
| Push notifications | Expo Push / FCM |
| Error monitoring | Sentry |
| OTA JS updates | EAS Update |

---

## 3. Roles & Identity

### 3.1 Clerk Organizations model

Each **restaurant is a Clerk Organization**.

| Clerk concept | Maps to |
|---|---|
| User, no organisation | Customer |
| Organization | Restaurant |
| `org:admin` | Restaurant owner |
| `org:member` | Restaurant staff (cashier, kitchen) |
| Platform admin | User with `super_admin` in `publicMetadata` |

**Why:** `org_id` and `org_role` land in the session JWT, so Supabase RLS policies read them directly. Staff invitations are built in — an owner invites their manager by email with no code from us.

**Quota note:** Clerk's free tier includes 100 monthly active organisations. Beyond that the paid tier is a step change, not a gradual cost. Re-verify current limits before crossing 90 restaurants.

### 3.2 Access rules

- Customer app: rejects any account with an active organisation? **No** — an owner may also be a customer. Customer app simply ignores org context.
- Vendor app: **requires** an active organisation. No org → sign out with "This account isn't registered as a restaurant."
- Admin dashboard: requires `super_admin` metadata. Verified server-side, never client-side.

### 3.3 Clerk ↔ Supabase sync

| Clerk webhook | Action |
|---|---|
| `user.created` | Insert into `profiles` |
| `organization.created` | Insert into `restaurants` with `status = 'pending'` |
| `organizationMembership.created` | Insert into `restaurant_staff` |
| `user.deleted` | Soft-delete profile, retain orders |

**The approval gate lives in Supabase, not Clerk.** Clerk creates the organisation instantly; the restaurant cannot go live until an admin sets `status = 'approved'` and KYC is cleared.

---

## 4. Financial Model

### 4.1 Definitions

| Term | Meaning |
|---|---|
| **Menu price** | Set by the restaurant. What the customer pays for food. |
| **Item subtotal** | Sum of menu prices × quantity |
| **Commission rate (C%)** | Set by admin, per-restaurant override allowed. Default 10%. |
| **Platform commission** | `item_subtotal × C%` — **applied to food only**, never to GST or fees |
| **GST (T%)** | 5% or 18% depending on item tax rules, applied to food |
| **Delivery fee** | Paid by customer, retained by platform |
| **Platform fee** | Paid by customer, retained by platform |
| **Vendor payout** | `item_subtotal − platform_commission` |
| **Platform earnings** | `platform_commission + delivery_fee + platform_fee` |

### 4.2 Money is integer paise

**All monetary values are stored, transmitted, and computed as integers in paise.** ₹330.50 is `33050`. Formatting to rupees happens only at the display layer.

Floating-point currency produces off-by-one-paisa errors that surface as invoices that don't add up, and it is miserable to retrofit.

### 4.3 The pricing engine is shared and singular

All money math lives in `packages/shared` as pure, dependency-free functions with unit tests:

```ts
calculateOrderTotals(input): CustomerInvoice
calculateVendorPayout(itemSubtotalPaise, commissionRateBps): VendorPayout
```

The customer invoice screen, the vendor payout screen, the admin dashboard, and the email receipt all call the same functions. **Money math is never duplicated.**

### 4.4 Worked example

Order: Chicken Biryani ₹200 + Garlic Naan ₹100. GST 5%. Delivery ₹30. Platform fee ₹5. Discount ₹20. Commission 10%.

**Customer invoice**

| Line | Amount |
|---|---|
| Item subtotal | ₹300.00 |
| GST (5%) | ₹15.00 |
| Delivery fee | ₹30.00 |
| Platform fee | ₹5.00 |
| Discount | −₹20.00 |
| **Grand total** | **₹330.00** |

**Vendor payout sheet**

| Line | Amount |
|---|---|
| Customer paid for food | ₹300.00 |
| Platform commission (10%) | −₹30.00 |
| **Net payout to restaurant** | **₹270.00** |

**Platform earnings:** ₹30 commission + ₹30 delivery + ₹5 platform fee = **₹65.00**

### 4.5 Discount funding

Every coupon declares who pays for it: `funded_by ∈ ('platform', 'vendor')`.

- Platform-funded: discount comes out of platform earnings. Vendor payout unaffected.
- Vendor-funded: discount reduces the vendor payout.

This must be an explicit field. An unfunded discount silently corrupts the payout ledger.

### 4.6 GST handling

- `restaurants.gst_status ∈ ('registered', 'composition', 'unregistered')`
- `restaurants.gstin` (nullable)
- Menu items carry their own `gst_rate_bps` (500 or 1800)
- Service fees (delivery + platform) attract 18% separately
- Unregistered and composition-scheme restaurants do not charge GST on food — the invoice generator branches on `gst_status`

---

## 5. Payments

### 5.1 Gateway: Razorpay Route

RevenueCat and in-app purchase are **not applicable** — this is physical goods and real-world services, which are exempt from Apple/Google billing rules. Routing food orders through IAP would also surrender 15–30% per order.

**Regulatory reason for Route specifically:** under RBI's Payment Aggregator guidelines, collecting money on behalf of other merchants and disbursing it requires a PA licence. Razorpay Route makes the gateway the licensed aggregator and each restaurant a **sub-merchant**, with the split executed at capture.

Flow: ₹330 captured → ₹65 to platform account, ₹270 settled to restaurant, automatically, on the gateway's settlement cycle.

### 5.2 Sub-merchant onboarding

Each restaurant supplies PAN, bank proof, and business documents to become a Route sub-merchant. **This is a prerequisite for going live**, enforced in the admin approval flow. KYC takes days to weeks — it is the longest lead item in the project.

### 5.3 Payment methods (priority order for this market)

1. **UPI Intent** — opens GPay/PhonePe directly with the amount pre-filled. Not UPI Collect; conversion is materially worse.
2. **Cash on Delivery** — likely the majority of early orders. Not optional.
3. Cards / netbanking.

### 5.4 COD ledger

COD breaks split settlement: the restaurant collects cash including the platform's commission and fees.

- Each restaurant has a running `ledger_balance_paise`.
- COD order → ledger debited by the platform's share.
- Online order → ledger credited, netted against future settlements.
- Persistent negative balance beyond a threshold → invoice monthly, and optionally disable COD for that restaurant.

Build the ledger as a running balance from day one. Retrofitting it is painful.

### 5.5 Non-negotiable implementation rules

1. **The webhook is the source of truth, never the client.** An order becomes `placed` and the vendor is notified only when the server receives and signature-verifies the gateway webhook.
2. **Idempotency on every webhook.** Gateways retry. Use Upstash `SETNX` on the payment ID. Without it, a retry can double-credit a payout.
3. **Orders start as `pending_payment`.** A QStash job expires anything stuck there for 10 minutes.
4. **Automatic refunds.** A vendor rejection on a paid order fires the refund without the customer asking. Tell them upfront that UPI refunds take 5–7 working days.

---

## 6. Customer App

### 6.1 Navigation

Bottom tabs: **Home · Search · Orders · Cart · Profile**

(The v1 nav — Home / Menu / Bookings / Rewards / Profile — was single-restaurant. "Menu" is not a global concept in a marketplace; "Bookings" is out of scope.)

### 6.2 Onboarding preference capture

Two screens, after signup, before the first feed. **Both skippable** — never block signup.

**Screen 1 — Diet (single select)**
- Pure Veg
- Veg + Egg
- Everything

**Screen 2 — Cuisines (multi-select, minimum 2)**
Image tiles: Biryani, Chinese, Tandoor, North Indian, South Indian, Rolls, Momos, Combos/Thali, Desserts, Beverages.

Editable anytime from Profile.

**"Healthy" is not a diet type.** It is a menu-item tag and a home filter chip, orthogonal to veg/non-veg.

### 6.3 The hard-filter / soft-signal rule

This distinction is load-bearing:

| Preference | Behaviour |
|---|---|
| **Diet** | **Hard filter.** A pure-veg user is never shown non-veg items. |
| **Cuisine** | **Soft ranking signal.** Reorders the feed. **Never hides anything.** |

Rationale: Spotify has 100M tracks; we will have ~40 restaurants. Hard-filtering by cuisine on a small catalogue produces an apparently empty app. The full restaurant list always remains scrollable below the personalised rail.

### 6.4 Veg handling (India-specific)

- `restaurants.is_pure_veg` is a **separate flag** from "has veg items", verified at approval, and shown as a badge. Many vegetarian users will not order from a kitchen that also cooks meat.
- **Veg Mode toggle** is permanently visible in the Home header, seeded from onboarding. Users switch it situationally (festivals, particular weekdays). It must not be buried in Settings.
- Veg-mode ranking: pure-veg restaurants first, then mixed restaurants showing only their veg items.
- `menu_items.diet_type ∈ ('veg', 'egg', 'non_veg')` is **mandatory with no default**. FSSAI marker: green square in circle for veg, brown/red for non-veg.

### 6.5 Recommendation scoring

Computed server-side. No ML.

```
score =
    3.0 × cuisine_overlap_count
  + 2.5 × user_ordered_here_before
  + 2.0 × (is_pure_veg AND user_diet = 'veg')
  + 1.5 × (bayesian_rating − 3.0)
  + 1.5 × proximity_score
  + 1.0 × popularity_last_30_days
  − 5.0 × currently_closed
```

Two rules:

- **Behaviour outweighs the quiz.** Once a user has 3+ orders, decay the onboarding weights. What people order beats what they claimed at signup.
- **Always inject variety.** Reserve two slots in the recommendations rail for well-rated restaurants outside the user's stated cuisines. Otherwise the feed staleses and new vendors never get impressions — and vendor retention is a bigger business risk than an imperfect feed.

**Cold start:** if preferences were skipped or the catalogue is small, rank by rating × popularity × proximity and title the rail **"Popular near you"**. Never render an empty personalised section.

### 6.6 Screens

| Screen | Contents |
|---|---|
| Home | Location pill, cart badge, promo banner carousel, cuisine chips, filter row (Veg Mode / 4.0+ / Fast / Offers), "Recommended for you" rail, full restaurant feed |
| Search | Restaurants and dishes, empty + no-results states |
| Restaurant detail | Cover, rating, ETA, sticky category tabs, menu rows with diet marker + ADD button |
| Cart & checkout | Steppers, address, coupon, full bill breakdown, payment selector, sticky Place Order |
| Order tracking | 5-state vertical stepper, live ETA, restaurant contact |
| Orders history | Past orders, reorder, invoice view |
| Profile | Addresses, preferences, payments, help |

### 6.7 Order status flow

```
pending_payment → placed → accepted → preparing → out_for_delivery → delivered
                     ↓         ↓
                 cancelled  rejected
```

Same seven states, identical colour tokens, in both the customer tracker and the vendor desk.

---

## 7. Vendor App

### 7.1 Design posture

Deliberately different from the customer app: dense, high-contrast, glanceable from a metre away, large touch targets, **no photography**, no custom fonts. It runs on an old phone behind a counter in a loud kitchen.

Shares the token scale from `DESIGN.md` but applies a **vendor density mode**.

### 7.2 Features

- **Order desk.** Realtime new-order alerts with sound and a full-bleed banner. Accept / Reject with reason. Mark Ready.
- **Menu management.** Add/edit/remove dishes, price, description, diet marker (required), cuisine tags, availability toggle, photo upload.
- **Restaurant profile.** Name, description, cover, location, open/closed toggle, operating hours.
- **Staff.** Invite and remove staff via Clerk organisation membership.
- **Earnings.** Order history, commission deducted, net payout, COD ledger balance, settlement history.
- **Quality scorecard.** See §8.4.

### 7.3 Photo upload compression (mandatory)

Vendors shoot dish photos on phones — 3–4 MB each. Before upload, run `expo-image-manipulator`: resize to 1200px wide, convert to WebP, quality 80. Result ≈ 120 KB, a ~30× reduction in both storage and bandwidth.

Without this step, no storage tier survives contact with real vendors.

### 7.4 Realtime discipline

Subscribe to a Supabase Realtime channel only while orders are actively in flight; unsubscribe on `delivered`. A backgrounded vendor app is woken by push notification, not by a held socket. Concurrent connections are the first scaling ceiling we will hit.

### 7.5 Media handling (Cloudflare R2, all media)

Sanity is dropped entirely (see §0). Menu photos, promo banners, and any video all go to a single R2 bucket — one provider, one upload path, one set of credentials, and (unlike a metered CDN) zero egress cost no matter how much a video gets replayed.

- **Never put R2 credentials in an app.** The vendor app requests a presigned upload URL from a Supabase Edge Function, then uploads directly to R2 with it.
- **Images:** two sizes generated at upload time — 1200px full + 400px thumbnail (see §7.3's compression step). No transform layer (Cloudflare Images, a resizing Worker) needed at this scale.
- **Video** (promo banners only, not per-dish): 15 seconds max, under 3 MB, 720p — enforced at upload, not just documented, since one oversized clip makes the home screen unusable on a 4G connection in Silchar.
  - Never autoplay with sound; default muted with tap-to-unmute, and prefer showing a poster image with the video loading only on tap (respect metered connections).
  - Always store a poster frame alongside the video — the card renders it instantly while the video loads behind it, instead of a black rectangle.
- **Banner management:** no CMS editor UI (that was Sanity Studio's job). A banner upload form belongs in the admin dashboard (§9) once it exists. **Interim, before that dashboard ships:** upload banners to R2 manually via the Cloudflare dashboard and store references in a `banners` table (`image_url`, `video_url`, `link_target`, `active`, `sort_order`, `valid_from`, `valid_to`); the app queries that table, rows are edited directly in the Supabase dashboard. The app-side query code is identical to what it'll be once the admin form exists.

---

## 8. Ratings, Reviews & Quality Score

### 8.1 Review integrity

- Every review carries an `order_id` for a `delivered` order belonging to that user.
- **One review per order**, enforced by a unique constraint at the database level.
- Without this, competitor sabotage begins within a month. Silchar is a small market.

### 8.2 Two separate ratings

| Rating | Affects |
|---|---|
| **Food** | Restaurant's score |
| **Delivery** | Platform's score — **not** the restaurant's |

Not splitting these punishes restaurants for late riders and creates the single largest source of vendor conflict in delivery apps. It costs nothing to split now.

### 8.3 Bayesian average, not raw average

```
weighted = (v / (v + m)) × R + (m / (v + m)) × C

R = restaurant average    v = review count
m = confidence threshold (start at 20)
C = platform-wide average (seed at 4.2)
```

A single 5-star review lands near 4.24 — honest. At 200 reviews the restaurant's own score dominates.

**Display rule:** no numeric rating until 5+ reviews. Show a **New** badge instead.

**Time decay:** last 90 days weighted 2×, 90–365 days 1×, older 0.3×.

### 8.4 Vendor quality score (0–100)

Recomputed nightly by a QStash job — never live in the feed query.

| Component | Weight |
|---|---|
| Bayesian food rating | 40 |
| Order acceptance rate | 20 |
| Prep-time accuracy | 15 |
| Vendor-initiated cancellation rate (inverse) | 15 |
| Repeat customer rate | 10 |

Surfaced prominently in the vendor dashboard **with a breakdown**. This converts a rating system into an operations lever: a vendor who sees "acceptance rate 78% — costing you placement" will fix it.

### 8.5 Placement guardrails

- **New-restaurant boost:** a placement floor for the first 30 days or 20 orders. Otherwise: no reviews → no placement → no orders → no reviews.
- **Promoted placement, if ever sold, is always labelled.** Paid and earned lanes stay visually distinct. Blending them silently loses customer trust and raises consumer-protection issues.

### 8.6 Moderation & reply

- **Vendor right of reply** — one reply per review, shown beneath it.
- **Report button** on every review + an admin moderation queue. Required to take down defamatory content, phone numbers, and abuse.

### 8.7 Per-dish reactions

Thumbs up/down per item after delivery → "87% liked this" on the menu row. Converts better than restaurant-level stars, and a thumbs-up is a far stronger cuisine signal than a signup-quiz answer, feeding §6.5 directly.

### 8.8 Prompt timing

No modal at delivery. A dismissible card at the top of Home on next app open: thumbnail, two rows of tappable stars, optional comment. **One tap constitutes a complete review** — most users will never type, and that is fine.

---

## 9. Admin Dashboard (Web)

- **Vendor onboarding:** review applications, verify KYC and Route sub-merchant status, verify `is_pure_veg`, approve or suspend.
- **Commission manager:** default rate + per-restaurant overrides.
- **Coupons:** create, set `funded_by`, usage caps, validity.
- **Financial oversight:** GMV, platform earnings, commission collected, payouts settled, COD ledger balances by restaurant.
- **Review moderation queue.**
- **Cuisine taxonomy management.**
- **Order search and manual intervention** (refund, force-cancel).
- **Banner management:** upload/replace home-screen banner images and promo video, set link target, active flag, sort order, validity window — see §7.5. Replaces the interim manual-row-editing workflow once built.
- CSV export on all financial tables.

---

## 10. Data Model (core tables)

```
profiles                 id (clerk user), name, phone, created_at
user_preferences         user_id, diet_type, preferred_cuisines[], updated_at
addresses                id, user_id, label, line1, line2, lat, lng, is_default

restaurants              id (clerk org), name, description, cover_url, lat, lng,
                         is_pure_veg, status, commission_rate_bps,
                         gst_status, gstin, route_account_id,
                         ledger_balance_paise, is_open, created_at
restaurant_staff         restaurant_id, user_id, role
cuisines                 id, name, image_url, sort_order
restaurant_cuisines      restaurant_id, cuisine_id

menu_items               id, restaurant_id, name, description, image_url,
                         price_paise, diet_type, gst_rate_bps, cuisine_ids[],
                         is_healthy, is_available

orders                   id, user_id, restaurant_id, status,
                         item_subtotal_paise, gst_paise, delivery_fee_paise,
                         platform_fee_paise, discount_paise, grand_total_paise,
                         commission_paise, vendor_payout_paise,
                         payment_method, payment_status, coupon_id,
                         address_snapshot jsonb, placed_at, delivered_at
order_items              order_id, menu_item_id, name_snapshot,
                         price_paise_snapshot, quantity, diet_type_snapshot

coupons                  id, code, type, value, funded_by, min_order_paise,
                         max_discount_paise, valid_from, valid_to, usage_cap
payments                 id, order_id, gateway_payment_id (unique),
                         amount_paise, status, raw_webhook jsonb
ledger_entries           id, restaurant_id, order_id, delta_paise, reason, created_at

reviews                  id, order_id (unique), user_id, restaurant_id,
                         food_rating, delivery_rating, comment, status,
                         vendor_reply, vendor_replied_at, created_at
restaurant_scores        restaurant_id, bayesian_rating, review_count,
                         acceptance_rate, avg_prep_variance,
                         quality_score, updated_at
item_reactions           order_id, menu_item_id, liked
```

**Snapshot rule:** orders store price, name, and diet type as they were at order time. A vendor editing a menu item must never alter historical invoices.

---

## 11. Security

### 11.1 Nothing in a mobile bundle is secret

`EXPO_PUBLIC_*` variables are inlined into the JS bundle at build time and readable from any APK. EAS Secrets protect the build pipeline, not the shipped app.

| Safe in the app | Never in the app |
|---|---|
| Supabase `anon` key | Supabase `service_role` key |
| Clerk publishable key | Clerk secret key |
| Razorpay `key_id` | Razorpay `key_secret`, webhook secret |
| Google Maps key (restricted) | Upstash REST token |
| Sentry DSN | Any signing secret |

Server-only keys live in Supabase Edge Function secrets or Vercel environment variables. Redis is **never** called directly from the app.

### 11.2 RLS is the security model

The anon key is public by design; it is safe only because Postgres refuses unauthorised rows.

- RLS enabled on **every** table.
- Policies keyed on the Clerk JWT's `sub` and `org_id` claims.
- Vendors read/write only rows for their own `restaurant_id`.
- Customers read only their own orders, addresses, and reviews.
- **Test by curling the REST endpoint with the anon key.** If another restaurant's orders come back, that is a breach.

### 11.3 Bot and abuse prevention

1. Clerk **Bot sign-up protection** enabled; `<View nativeID="clerk-captcha" />` present on the sign-up screen. (Cloudflare-based detection has known limits in non-browser environments — treat as a filter, not a wall.)
2. **Play Integrity / App Attest** via Firebase App Check — proves requests come from the genuine unmodified app. The strongest mobile control; do not skip it.
3. Phone OTP restricted to **+91 only** in Clerk, plus Upstash rate limiting per IP and device — defends against SMS-pumping fraud.
4. **First-order discount is bound to device + phone hash, not account.** Referral rewards pay out only after the referred order is delivered and paid.

### 11.4 Other

- Google Maps key restricted by package name + release SHA-1.
- Clerk token cache uses `expo-secure-store` (Keychain / Android Keystore).
- Razorpay webhook signature verified before any state change.

---

## 12. Performance Budget

Target device: 3 GB RAM Android, patchy 4G.

| Metric | Target |
|---|---|
| Customer app download | < 25 MB |
| Vendor app download | < 15 MB |
| Cold start | < 2.5 s |
| Home feed first paint | < 1.5 s on 4G |

**Rules:**
- Ship AAB, not APK. Enable ProGuard/R8 and resource shrinking. Hermes + New Architecture on.
- One custom font family, two weights maximum. System font for body text. Vendor app: no custom fonts.
- No interactive maps in the customer app — address entry plus a static map image for confirmation.
- `expo-image` with blurhash placeholders. Always request the exact display size from the CDN.
- FlashList, never FlatList, for the feed.
- Never `select('*')`. Paginate at 10–15. Cache with TanStack Query.
- Cart lives in local MMKV state, not the network.
- No shadows on Android — use tonal layering and 1px borders. Overdraw is real jank on low-end devices.
- Audit with `npx expo-atlas` after each build.
- Zustand over Redux; `date-fns` over moment; no full lodash import; no Lottie.

**Do not hand-roll infrastructure to save bytes.** Cut fonts, icons, maps, and images — keep the boring libraries.

---

## 13. Design System Corrections

`docs/DESIGN.md` must be updated before generating screens:

1. **Rename** from "Aroma Culinary System" to "Zaavo" (see §15, decision 2).
2. **Resolve the palette conflict.** Tokens say `#f1fcf5` (mint); prose says `#F7F6F2` (warm). Adopt the warm direction: background `#FAF8F5`, dividers `#EDE9E3`.
3. **Green conflict rule.** Brand hunter green must never appear inside a menu item card. `#0F8A4D` is reserved exclusively for the FSSAI veg marker; `#A52A2A` for non-veg. In-card ADD buttons use saffron.
4. **Add missing tokens:** seven order-status colours, success, closed/unavailable treatment, skeleton shimmer, discount strikethrough, rating pill.
5. **Add `fontVariant: ['tabular-nums']`** to `numeric-display` so invoice columns align.
6. **Replace the iOS shadow spec** with tonal layering + border for Android.
7. **Add vendor density mode.**
8. **Record "light theme only, v1"** as an explicit decision.

---

## 14. Build Phases

### Phase 1 — Foundation
Monorepo, shared pricing engine with tests, database schema, RLS policies, Clerk org integration, Clerk↔Supabase webhooks. **No UI.**

*Exit criteria:* pricing tests green; curling the REST endpoint with the anon key cannot reach another restaurant's rows.

### Phase 2 — Vendor app
Auth, order desk, menu management, restaurant profile. Orders seeded manually.

*Rationale: no customer app is useful without restaurants and menus in it.*

### Phase 3 — Customer app, core
Auth, onboarding preferences, home feed, restaurant detail, cart, checkout **COD only**, order tracking, realtime.

*Exit criteria:* a real COD order placed end to end.

### Phase 4 — Payments
Razorpay Route, sub-merchant onboarding, webhooks with idempotency, refunds, COD ledger.

*Start KYC during Phase 1 — it is the longest lead item.*

### Phase 5 — Admin dashboard
Approvals, commission manager, financial oversight, coupons.

### Phase 6 — Ratings & personalisation
Reviews, Bayesian scoring, nightly quality-score job, recommendation ranking, per-dish reactions.

*Note: personalisation delivers little visible value below ~50 restaurants. **Capture preference data from Phase 3 anyway** so that when the catalogue is large enough, there is a year of history rather than a cold start.*

### Later
Rider app and fleet, loyalty/rewards, promoted placement, scheduled orders, multi-city, dark theme.

---

## 15. Open Decisions

| # | Question | Blocks |
|---|---|---|
| 1 | Who delivers — restaurant self-delivery or platform riders? Determines whether the delivery fee is profit or cost. | Financial model, rider app |
| 2 | ~~Public brand name.~~ **Resolved: Zaavo.** ("Aroma" was rejected — it's an existing Silchar restaurant; competitors would have resisted listing on an app named after it.) | ~~Store listings, marketing~~ |
| 3 | Default delivery fee — flat or distance-banded? | Checkout |
| 4 | Free-delivery threshold, if any? | Checkout, margins |
| 5 | Support channel — in-app chat, phone, or WhatsApp? | Phase 3 |

---

## 16. Non-Functional Requirements

1. **Role separation.** RLS enforces that customers cannot reach vendor data and vendors cannot reach other restaurants' data.
2. **Realtime.** New orders reach the vendor within 3 seconds; status changes reach the customer within 3 seconds.
3. **Invoicing.** Renderable in-app and exportable as a clean printable slip.
4. **Observability.** Sentry on all three surfaces from day one.
5. **Releasability.** EAS Update configured for JS-only fixes without store review.
6. **Auditability.** Every ledger entry traceable to an order and a reason.
