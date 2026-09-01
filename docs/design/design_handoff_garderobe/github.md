repo: melarnmurphy/pocket-wardrobe-v5
branch: main

## Last sync

date: 2026-09-01T02:42:29Z

### Updated in this project

- Read the repo to ground the handoff: stack is Next.js 15 App Router + React 19 + Supabase + Tailwind 4, server actions per route, domain modules under `lib/domain/*`.
- Reworked the sources screens to match the receipts-only decision — store account connections are gone; resale accounts (depop, vestiaire) stay for listings and sold-removal.
- Repurposed the desktop store-search palette (w3c) into a ⌘K search across pieces, looks, trends and nearby listings.
- Recorded handover payment method (cash / payid / transfer) on local threads, since no money moves through the app.

### Conflicts to resolve before build

- `docs/style-guide.md` specifies violet / electric purple / hot pink with Space Grotesk and Plus Jakarta Sans. These mockups are oxblood `#6d2a24` on cream `#faf7f2` in Karla. The mockups are the newer direction — confirm they supersede the style guide, and update `docs/style-guide.md` and `app/globals.css` rather than mixing the two.
- `agents.md` lists "resale marketplace integration" and "social feed" as MVP non-goals. Local threads is a local resale marketplace with threads. That non-goal needs lifting or scoping in `agents.md` before an agent will build it.
- `agents.md` also treats connected retailer order history as an ingestion route. The product decision is now receipts and photographed dockets only, plus resale accounts.

## Screen map

| Project screen | Repo files it builds on |
| --- | --- |
| 1d / 1e wardrobe grid + filters, w1a | `app/wardrobe/(closet)/page.tsx`, `components/closet-tabs.tsx`, `app/wardrobe/actions.ts` |
| 11a piece detail, w3f | `app/wardrobe/actions.ts`, `components/garment-image-upload.tsx` — no detail route exists yet |
| 14a / 14b batch add, w1d upload | `app/components/upload-card.tsx`, `app/wardrobe/review/*`, `app/api/pipeline/analyse/route.ts`, `pipeline/fashion_pipeline.py` |
| 13a / 13b receipts, w3d, 15b | `lib/domain/ingestion/*`, `app/wardrobe/actions.ts` (receipt paths) — no `/receipts` route yet |
| 10a / w3b sources | `garment_sources` table, `lib/domain/ingestion/*` — no `/sources` route yet |
| 12a today, w1c | `app/page.tsx`, `components/today-outfit-card.tsx`, `app/wardrobe/today-actions.ts`, `app/api/weather/local/route.ts` |
| 5a / 11b look detail, w3g | `app/lookbook/page.tsx`, `app/lookbook/actions.ts`, `components/lookbook-entry-card.tsx` |
| 6d outfit builder, w1b look canvas | `components/outfit-planner.tsx`, `components/outfit-generator.tsx`, `app/outfits/*` |
| 9d calendar, w3h | `app/calendar/*`, `components/outfit-calendar.tsx` |
| 2a–2c trends, 8c, w3i | `app/trends/page.tsx`, `components/trend-sparkline.tsx`, `components/owned-trend-card.tsx`, `lib/domain/trends/*` |
| 15a wishlist, w3a | `lookbook_entries` with `source_type = 'wishlist'`, `app/lookbook/actions.ts` — unlock scoring is new |
| 17a you, 9g settings, 12b, w3e | `app/account/*`, `avatar_profiles`, `avatar_measurement_sets` |
| 9h paywall | `components/premium-upsell-card.tsx`, `lib/domain/entitlements/*`, `user_entitlements` |
| 16a–16d local threads, w2a–w2d | all new — proposed `lib/domain/local-threads/*` and `app/nearby`, `app/handovers` |
| 6a onboarding, w4a–w4c | `app/auth/*` exists; the welcome flow itself is new |
