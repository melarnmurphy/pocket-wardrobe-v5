# Pocket Wardrobe — handover note

Written 2026-09-06. Supersedes the previous handoff note in this file entirely —
that one predates this whole session and its "16 commits ahead, nothing merged"
claim is no longer true.

## Where things actually stand right now

- **`main` is live in production.** `design/handoff` was fast-forward merged into
  `main` and pushed to `origin/main`. Nothing is sitting on an unmerged branch.
- **Production is genuinely public.** Found and fixed a real, silent blocker:
  Vercel's Deployment Protection (SSO gate) was on for Production, redirecting
  every request — including all `/api/mobile/*` calls — to a Vercel login wall
  before it ever reached the app. Disabled via
  `vercel project protection disable fashionapp5 --sso`. Confirmed: homepage
  returns `200`, mobile routes return real `401` JSON (not a redirect) when
  unauthenticated.
- **Database is up to date.** All migrations through `042_wear_event_photos.sql`
  are applied to the live Supabase project (confirmed via
  `mcp__supabase__list_migrations`). No pending schema changes.
- **The app has been run once, for the first time ever**, on an iOS Simulator
  (iPhone 17, `xcodebuild` + `xcrun simctl`). Clean launch, real Supabase
  connection (Secrets.plist is fully populated — `SUPABASE_URL`/
  `SUPABASE_ANON_KEY` were already there, `API_BASE_URL` now points at the
  live production alias), sign-in screen rendered correctly, no crashes.
  **Nobody has actually signed in and used a real account yet** — that's the
  next real risk surface, not anything before it.

## What's built, end to end (this session)

Every iOS tab is wired to real data via a new `/api/mobile/*` route layer
(bearer-token auth via `lib/auth-mobile.ts` + `lib/supabase/mobile.ts`, reusing
existing web service functions through an additive, optional
`ctx?: ServiceContext` parameter — see `lib/domain/service-context.ts`):

- **Wardrobe, Rules, Trends, Lookbook** — straightforward reads.
- **Outfits/Planner** — three real, distinct variants (Safe/Elevated/
  Trend-forward) for "today," plus real **week-batched generation**
  (`generateWeekOfOutfits` / `POST /api/mobile/outfits/generate-week`) with
  genuine avoid-repeat (each day excludes garments already picked earlier that
  week), laundry-awareness (hard-excludes anything logged worn in the last 7
  days), a real per-day occasion picker mapped to real dress codes, and a
  trend-weight slider that leans generation toward the user's top trend match
  even outside "trend" mode.
- **Camera capture** (Wardrobe) — real photo → garment pipeline.
- **Diary** — was fully built but genuinely **unreachable** (never added to
  `RootView`'s `TabView`) until this session added it as a sixth tab. Wear
  logging (`LogOutfitSheet` → `WearLogStore` → `POST /api/mobile/wear-events`)
  now really persists, including real photo capture/upload
  (`wear_events.photo_storage_path`, its own `wear-event-photos` storage
  bucket). The calendar grid and stats strip read real wear history instead of
  `SampleData`.
- **Settings/Account** (new) — sign-out (previously impossible — `AuthStore.
  signOut()` existed but no UI called it), display name, weather location,
  region/temperature/currency prefs, real plan status. Backed by
  `GET/POST /api/mobile/account`.
- **Real bug found and fixed while building Settings**: `WeatherStore` read
  `profiles.suburb` directly, but the web app resolves weather from a
  completely different, unsynced field — `user_metadata.preferred_location`.
  Setting a location on web had zero effect on iOS weather and vice versa.
  `WeatherStore` now takes a location string from `AccountStore` instead of
  querying Supabase itself. There's also a one-screen `LocationSetupView`
  shown after sign-in if no location is set yet (nothing else in the sign-up
  flow collected one).
- **Notifications inbox** (new) — bell icon + unread badge on Wardrobe,
  surfaces the web session's real triggers (message, offer, sold, receipt
  read, batch finished, wear reminder, trend expiry, price drop) that were
  previously invisible on mobile.
- **Purchase flow** (new) — native StoreKit 2 (`BillingStore.swift`), verified
  server-side (`POST /api/mobile/billing/verify-purchase` →
  `lib/domain/billing/apple.ts`, checks the transaction's JWS signature
  against Apple's public root CA — bundled at `lib/domain/billing/
  apple-certs/`, no App Store Connect API key needed for this part) and
  funneled into the **same** `syncUserEntitlementsFromBillingEvent` the
  Stripe webhook already uses, just tagged `billing_provider: "apple"`
  instead of `"stripe"`. Settings' Plan section has a real "Upgrade to Plus"
  button and "Restore purchases."

Everything above is covered by real tests (iOS: Swift Testing, store-mapping
logic; web: Vitest) and was verified with actual `xcodebuild build`/`test` and
`npm run test`/`tsc --noEmit` runs, not just read for plausibility.

## Known non-issues (don't re-investigate these)

- **SourceKit's live editor diagnostics are unreliable all session** —
  flags errors on code that a real `xcodebuild` proves compiles fine.
  Always trust the actual build/test invocation over SourceKit.
- **One pre-existing flaky test**: `lib/domain/billing/__tests__/service.
  test.ts`'s "reuses an existing Stripe customer id..." test fails
  intermittently only when run as part of the full suite (test-order
  dependent pollution from another file), passes 100% in isolation. Confirmed
  repeatedly across this whole session. Not something introduced by any of
  this session's work.
- **Two pre-existing, unrelated typecheck errors**, confirmed via `git
  status` showing these files untouched by any of this session's work:
  `lib/domain/trends/__tests__/vibe-last-smoke.test.ts` and
  `lib/domain/wear-events/__tests__/service.test.ts`.

## Outstanding, in rough priority order

1. **App icon.** `AppIcon.appiconset` still has only an empty `Contents.json`
   — no actual image files in the repo, despite an icon design having been
   shared in chat (couldn't be extracted from a pasted chat image without a
   real file path — still waiting on that path).
2. **Camera permission string is stale.** `Info.plist`'s
   `NSCameraUsageDescription` still says "...to photograph a garment..." —
   now that Diary wear-logging also uses the camera, it should mention both.
   Small, cheap fix, not yet done.
3. **Apple Developer Program enrollment, as an Organization** — the user is
   registering a new Pty Ltd business for this app. Real sequence, each step
   blocking the next: register the Pty Ltd with ASIC (if not done) → get a
   D-U-N-S Number (can take 1–2 weeks for a brand-new business, start this
   immediately) → enrol as an Organization in the Apple Developer Program
   (needs a director's legal signing authority) → set up App Store Connect
   under the new Team. Nothing has ever been registered under any existing
   Apple Developer account for this app (all builds so far are locally
   ad-hoc signed), so this is a clean start, not a migration — the bundle id
   (`com.melandwes.PocketWardrobev5`) and StoreKit product id
   (`com.melandwes.pocketwardrobe.plus.annual`) can stay exactly as they are.
4. **App Store Connect subscription product** doesn't exist yet — create a
   real auto-renewable subscription with product id
   `com.melandwes.pocketwardrobe.plus.annual`, $69/year, matching
   `Configuration.storekit` (already built for local testing). Until this
   exists, `Product.products(for:)` finds nothing in a real build.
5. **Wire `Configuration.storekit` into the active Xcode scheme** — one-time
   manual step (Product → Scheme → Edit Scheme → Run → Options → StoreKit
   Configuration), not safely hand-authorable into a scheme file that doesn't
   exist yet (no shared `.xcscheme` file currently — Xcode auto-manages it).
   Once wired, the whole purchase flow is testable in Simulator today, before
   any App Store Connect product exists.
6. **Apple Server Notifications V2** — for subscription renewals/
   cancellations that happen while the app isn't open, mirroring the Stripe
   webhook. The verify-purchase route only handles purchases made *in* the
   app. Not built yet; needs a webhook URL registered in App Store Connect
   (blocked on item 3).
7. **Real-device / real-account testing** — the app has only ever run once,
   to the sign-in screen, in Simulator. Nobody has signed in with a real
   account and used a real feature yet.
8. **App Store submission mechanics beyond the above** — screenshots, listing
   copy, privacy nutrition label, TestFlight. Entirely untouched.
9. **Resend / inbound email** (a different session's territory — "Web app
   gaps closure") — deferred by the user's own choice, needs a purchased
   domain first.

## Key files if you need to reorient fast

- Mobile API layer: `app/api/mobile/**`, all following the same
  `getRequiredMobileUser(request)` → build `ctx` → call existing service
  function → `NextResponse.json(...)` shape.
- iOS stores: `ios/PocketWardrobev5/PocketWardrobev5/Stores/*.swift` — each
  has row-decoding types and mapping functions marked `internal` (not
  `private`) specifically so `PocketWardrobev5Tests.swift` can reach them via
  `@testable import`. Follow that exact pattern for anything new.
- `lib/domain/service-context.ts` — the `ServiceContext` type every
  mobile-reachable service function takes as an optional trailing param.
- `lib/domain/billing/apple.ts` — Apple transaction verification; the cert
  lives alongside it in `apple-certs/`.

## A quirk worth knowing about if you use workflows/subagents here again

A background `Workflow` run (two parallel builder agents + a wiring/
verification pass) worked well this session for the Notifications inbox and
Diary photo capture — both builders delivered real, tested code, and the
wiring pass correctly integrated both into shared app-root files without
collision, including fixing a build error one builder had left behind. Trust
but verify held up: re-running the full build/test suite myself after the
workflow reported success was worth doing (it was accurate, but that's not
something to skip next time either).
