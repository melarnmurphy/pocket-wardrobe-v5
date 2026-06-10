# Calendar Thumbnails — Design

Date: 2026-06-10
Status: Approved (design); implementation pending
Owner area: `/calendar` (builds on the outfit-calendar feature).

## Problem

The calendar marks planned days with a plain accent dot and shows item
**category chips** in the day drawer. It should show real garment **imagery** so
it reads like a lookbook calendar. The blocker noted in `outfits/service.ts`:
outfit-item images can't come from a simple nested Supabase select — garment
images live in `garment_images` and need a feature-image pick + signed URLs.

## Goal

Show a representative garment **hero image** on each planned day cell, and a row
of garment **thumbnails** in the day drawer — reusing the existing signed-URL
logic, with graceful fallback when garments have no image.

## Non-goals (YAGNI)

- No new image pipeline, upload flow, or `garment_images` changes.
- No schema migration — `outfitWithItemsSchema.items[].garment.preview_url`
  already exists (currently always null); we populate it.
- No per-cell collage or multi-image cells (decided: single hero per cell).

## Architecture / data flow

`listWardrobeGarments()` already returns each `GarmentListItem` with a signed
`preview_url` (feature-image ranking + batched `createSignedUrls`). Reuse it:

- **`app/calendar/page.tsx`**: fetch `listSavedOutfits()` and
  `listWardrobeGarments()` together. Build `Map<garmentId, preview_url>`. Produce
  enriched outfits where each `items[].garment.preview_url` is set from the map.
  Pass the enriched outfits to `OutfitCalendar`. No duplication of signing logic.

The enrichment is a small pure transform; the signed-URL cost is the same one the
wardrobe page already pays (acceptable at personal-wardrobe scale).

## Pure helper (`lib/domain/outfits/calendar.ts`, TDD'd)

- **`pickHeroImage(outfit)`** → `string | null`. Scans items in role priority
  `["dress", "outerwear", "top", "bottom", "shoes", "bag", "accessory", "jewellery", "other"]`
  and returns the `preview_url` of the first item (in that priority) that has a
  non-empty `preview_url`. Returns `null` if no item has an image.

## UI (`components/outfit-calendar.tsx`)

- **Cell:** if `pickHeroImage(outfit)` is non-null → render the image as a
  `cover` background filling the cell, with the day number overlaid on a subtle
  dark scrim (legibility); selected/today borders unchanged. If null → the
  existing accent dot.
- **Drawer (outfit present):** replace/augment the category chips with a
  horizontal row of garment thumbnails — each item rendered as a small image
  (`preview_url`) captioned with its category; items without an image show a
  bordered placeholder box + the category label. Title, Swap/Remove unchanged.
- **Picker (empty day):** unchanged for now (text rows); thumbnails there are a
  later nicety, out of scope.

Uses plain `<img>` with the signed URL (consistent with how the app renders
signed garment images elsewhere); `alt` = garment title or category.

## Error handling / fallback

- Missing image → dot (cell) / placeholder box (drawer). Never an error.
- A failed/blank signed URL is treated as "no image" (same fallback).
- If `listWardrobeGarments()` throws auth, the page's existing `AuthRequiredCard`
  path already covers it (the call is inside the same `try`).

## Testing

- **TDD `pickHeroImage`** in `lib/domain/outfits/__tests__/calendar.test.ts`:
  - returns the dress's image when present;
  - respects priority (outerwear chosen over shoes when both have images);
  - skips items whose `preview_url` is null/empty and picks the next priority;
  - returns `null` when no item has an image.
- The page enrichment + component appearance verified via `tsc`, `npm run build`,
  and a live look. `listWardrobeGarments` signing is already tested.
