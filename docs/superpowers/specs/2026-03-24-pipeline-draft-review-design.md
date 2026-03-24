# Pipeline Draft Review — Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Overview

Complete the pipeline-to-wardrobe flow by improving the draft review experience. Currently the flow is wired end-to-end (upload → analyse → drafts → review page) but draft cards show a grey placeholder image, fields are read-only, and accepted garments have no image attached. This spec addresses all three gaps.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Draft card image | Bounding box crop | Shows exactly what the AI detected; faster to load than full source image |
| Crop timing | At draft creation (server-side, `sharp`) | Crops stored once; review page loads fast with small images |
| Card layout | Compact inline (image + fields side by side) | Multiple cards visible without scrolling |
| Edit before accept | Yes — inline editable fields | User can correct AI mistakes before committing |
| Garment image on accept | The cropped bbox image | Clean isolated garment photo, no extra upload needed |

---

## Architecture

### 1. Cropping at Draft Creation (`lib/domain/ingestion/service.ts`)

`createDraftsFromPipelineResult` gains a `storagePath` parameter (the source image's storage path). After inserting drafts, it:

1. Downloads the source image from `garment-originals` bucket via Supabase Storage.
2. Uses `sharp` to crop each garment's bounding box region (`[x1, y1, x2, y2]`).
3. Uploads each crop to the `garment-cutouts` bucket at `{userId}/crops/{draftId}.jpg`.
4. Stores the crop path in `draft_payload_json.crop_path`.

Crops run in parallel with `Promise.all`. If a crop fails, the draft is still created — `crop_path` will be null and the card falls back to a placeholder.

**`sharp` install:** Add `sharp` to `package.json` dependencies.

### 2. `PendingDraft` type changes (`lib/domain/ingestion/service.ts`)

`listPendingDrafts` joins `garment_sources` to retrieve `storage_path`. The returned `PendingDraft` type gains:

```ts
interface PendingDraft {
  id: string;
  sourceId: string;
  confidence: number | null;
  cropPath: string | null;          // new — from draft_payload_json.crop_path
  payload: {
    category: string;
    colour: string;
    material: string | null;
    style: string;
    tag: string;
    confidence: number;
  };
}
```

### 3. Signed URL generation for crop images (`app/wardrobe/review/page.tsx`)

The review page (server component) generates signed URLs for each draft's `cropPath` from the `garment-cutouts` bucket (1-hour expiry). These are passed to `DraftReviewList` alongside the draft data.

```ts
interface DraftWithImageUrl extends PendingDraft {
  cropUrl: string | null;
}
```

### 4. Editable draft card (`app/wardrobe/review/draft-review-list.tsx`)

Each card uses local React state to hold editable field values, initialised from `draft.payload`. Layout:

```
┌────────────────────────────────────────┐
│ [crop img] [title input          ]     │
│ 80×110px   [category] [colour   ]      │
│            [material] [style    ]      │
│            [Reject]   [Accept ──────]  │
└────────────────────────────────────────┘
```

Fields: title (text), category (text), colour (text), material (text), style (text).

On **Accept**, the edited values are passed to `acceptDraftAction`. On **Reject**, no field values are needed.

### 5. Accept action with image attachment (`app/wardrobe/review/actions.ts`)

`acceptDraftAction` is updated to accept edited field overrides and `cropPath`:

```ts
acceptDraftAction(draftId: string, fields: EditedFields, cropPath: string | null)
```

Steps:
1. Fetch draft from DB, guard against non-pending status.
2. Call `createGarment` with edited field values.
3. If `cropPath` is non-null: insert a `garment_images` record with `image_type: "original"` and `storage_path: cropPath`. Also update `garment_sources.garment_id` to link the source to the new garment.
4. Mark draft `status: "confirmed"`.
5. Revalidate `/`, `/wardrobe`, `/wardrobe/review`.

---

## Data Flow

```
uploadAndAnalyseAction
  → createGarmentSource           (uploads source to garment-originals)
  → callPipelineService           (gets garments + bboxes)
  → createDraftsFromPipelineResult(sourceStoragePath)
      → for each garment:
          insert garment_draft    (with bbox in payload)
          sharp.crop(bbox)        (parallel)
          upload to garment-cutouts  → crop_path stored in payload
  → redirect /wardrobe/review

/wardrobe/review (server)
  → listPendingDrafts             (includes cropPath)
  → createSignedUrl per cropPath  (garment-cutouts bucket)
  → render DraftReviewList with cropUrls

DraftReviewList (client)
  → editable fields per draft
  → acceptDraftAction(id, editedFields, cropPath)
      → createGarment
      → insert garment_images (crop_path)
      → update garment_draft status → "confirmed"
  → rejectDraftAction(id)
      → update garment_draft status → "rejected"
  → redirect /wardrobe when all actioned
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Crop fails for one garment | Draft created with `crop_path: null`; card shows placeholder |
| All crops fail | Drafts still created; review page works, cards show placeholders |
| Accept fails after garment created | Return error, draft stays pending; user can retry |
| Source image not in storage | Log warning, skip crop step; draft created without image |

---

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `sharp` dependency |
| `lib/domain/ingestion/service.ts` | Crop at draft creation; update `PendingDraft` type; join sources in `listPendingDrafts` |
| `app/page-actions.ts` | Pass `storagePath` to `createDraftsFromPipelineResult` |
| `app/wardrobe/review/page.tsx` | Generate signed crop URLs server-side |
| `app/wardrobe/review/draft-review-list.tsx` | Editable fields; pass edited values + cropPath to accept action |
| `app/wardrobe/review/actions.ts` | Accept edited fields; attach crop image to garment |

---

## Out of Scope

- Bulk accept/reject all
- Brand or size fields (can be edited post-accept via Edit Item)
- Receipt or URL ingestion (separate flows)
- Retry UI for failed crops
