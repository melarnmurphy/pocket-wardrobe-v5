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
| Garment image on accept | The cropped bbox image (`image_type: "cropped"`) | Clean isolated garment photo, no extra upload needed. `"cropped"` = rectangular region; `"cutout"` = background-removed. Storage bucket is named `garment-cutouts` but `image_type` value is `"cropped"`. |

---

## Architecture

### 1. Cropping at Draft Creation (`lib/domain/ingestion/service.ts`)

`CreateDraftsParams` gains a `storagePath` field (the source image's storage path in `garment-originals`):

```ts
interface CreateDraftsParams {
  sourceId: string;
  storagePath: string;   // new
  result: PipelineAnalyzeResponse;
}
```

`createDraftsFromPipelineResult` updates in two phases:

**Phase 1 — insert all drafts** (existing loop, unchanged structure):
- Insert each garment as a `garment_draft` row with `crop_path: null` in `draft_payload_json`.
- Collect `{ draftId, bbox }` pairs.

**Phase 2 — crop in parallel** (`Promise.all`):
- Generate a short-lived signed URL for `storagePath` in the `garment-originals` bucket (e.g. 60s expiry) using the Supabase client's `createSignedUrl`. Fetch the image bytes via `fetch(signedUrl)` → `ArrayBuffer`. This gives `sharp` actual bytes — it cannot use a storage path directly.
- For each `{ draftId, bbox }`:
  - Use `sharp` to crop `[x1, y1, x2, y2]` → JPEG buffer.
  - Upload to `garment-cutouts` at `{userId}/crops/{draftId}.jpg`.
  - Capture output `{ width, height }` from sharp metadata.
  - `UPDATE garment_drafts SET draft_payload_json = draft_payload_json || '{"crop_path": "...", "crop_width": N, "crop_height": N}'` for that draft id.
- If a crop fails for one garment, log the error and leave `crop_path: null` — do not abort other crops or throw.

**`sharp` install:** Add `sharp` to `package.json` dependencies.

`app/page-actions.ts` passes `storagePath` when calling `createDraftsFromPipelineResult`:

```ts
await createDraftsFromPipelineResult({ sourceId, storagePath, result });
```

`storagePath` is already returned by `createGarmentSource` and available in `uploadAndAnalyseAction`.

---

### 2. `PendingDraft` type update (`lib/domain/ingestion/service.ts`)

Add `cropPath`, `cropWidth`, `cropHeight` to the existing type. All other existing fields are retained:

```ts
export interface PendingDraft {
  id: string;
  sourceId: string;
  confidence: number | null;
  cropPath: string | null;        // new — from draft_payload_json.crop_path
  cropWidth: number | null;       // new — from draft_payload_json.crop_width
  cropHeight: number | null;      // new — from draft_payload_json.crop_height
  payload: {
    tag: string;                  // pipeline's human-readable label (used as title)
    category: string;
    colour: string;
    material: string | null;
    style: string;
    confidence: number;
  };
}
```

`listPendingDrafts` reads `crop_path`, `crop_width`, `crop_height` from `draft_payload_json` when mapping rows.

---

### 3. Title field mapping

Pipeline drafts do not have a `title` field in `draft_payload_json`. The `tag` field (e.g., `"navy cotton shirt/blouse"`) serves as the human-readable label. In the editable card UI, the "Title" input is initialised from `draft.payload.tag`. When `acceptDraftAction` is called, the edited title value is passed as the `title` argument to `createGarment` — the same mapping already present in the current `acceptDraftAction`.

---

### 4. Signed URL generation (`app/wardrobe/review/page.tsx`)

The review page (server component) generates signed URLs for each draft's `cropPath` from the `garment-cutouts` bucket (1-hour expiry). If `cropPath` is null or `createSignedUrl` returns an error, `cropUrl` is `null` — the card falls back to a placeholder image.

Export the combined type from `page.tsx`:

```ts
export interface DraftWithImageUrl extends PendingDraft {
  cropUrl: string | null;
}
```

---

### 5. Editable draft card (`app/wardrobe/review/draft-review-list.tsx`)

`Props` changes to:

```ts
interface Props {
  drafts: DraftWithImageUrl[];
}
```

Each card uses local React state (`useState`) to hold editable field values, initialised from `draft.payload`. Layout (compact inline, A):

```
┌────────────────────────────────────────┐
│ [crop img] [title input          ]     │
│ 80×110px   [category] [colour   ]      │
│            [material] [style    ]      │
│            [Reject]   [Accept ──────]  │
└────────────────────────────────────────┘
```

Fields: title (from `tag`), category, colour, material, style — all plain `<input type="text">`.

Crop image: `<img src={draft.cropUrl ?? undefined} />` with a grey placeholder `<div>` when `cropUrl` is null.

On **Accept**, pass only `{ draftId, fields }` to `acceptDraftAction` — the action reads `cropPath` server-side from the draft row.
On **Reject**, call `rejectDraftAction` with no field values.

---

### 6. Accept action (`app/wardrobe/review/actions.ts`)

Define `EditedFields` locally in `actions.ts`:

```ts
interface EditedFields {
  title: string;
  category: string;
  colour: string;
  material: string;
  style: string;
}
```

Update `acceptDraftAction` signature — crop data is read server-side from the draft row, not supplied by the client:

```ts
acceptDraftAction(input: {
  draftId: string;
  fields: EditedFields;
})
```

Steps:
1. Fetch draft from DB; guard: if `status !== "pending"` return `{ status: "success" }` (idempotent).
2. Read `cropPath`, `cropWidth`, `cropHeight` from `draft.draft_payload_json` (already fetched in step 1). Never trust client-supplied paths — this prevents path injection into `garment-cutouts`.
3. Call `createGarment` with `fields.title`, `fields.category`, and canonical colour from `fields.colour`.
4. If `cropPath` is non-null:
   - Insert a `garment_images` row: `{ garment_id, image_type: "cropped", storage_path: cropPath, width: cropWidth, height: cropHeight }`.
   - Update `garment_sources` row where `id = draft.source_id`: set `garment_id = garment.id` (column already exists as nullable — no migration needed).
5. Update `garment_drafts` row: `status → "confirmed"`.
6. Revalidate `/`, `/wardrobe`, `/wardrobe/review`.

---

### 7. Reject action (`app/wardrobe/review/actions.ts`)

Add a pending-status guard to `rejectDraftAction` (currently absent):

```ts
if (draft.status !== "pending") return { status: "success" };
```

This prevents a confirmed draft from being overwritten to `rejected` if the user manages to click Reject on a stale page.

---

## Data Flow

```
uploadAndAnalyseAction
  → createGarmentSource           → storagePath
  → callPipelineService           → garments + bboxes
  → createDraftsFromPipelineResult({ sourceId, storagePath, result })
      Phase 1: insert all garment_draft rows (crop_path: null)
      Phase 2: Promise.all crops
        download source image once
        for each draft: sharp.crop(bbox) → upload garment-cutouts → UPDATE draft crop_path/width/height
  → redirect /wardrobe/review

/wardrobe/review (server component)
  → listPendingDrafts()           → PendingDraft[] (includes cropPath)
  → createSignedUrl per cropPath  (garment-cutouts, 1h; null on error)
  → render DraftReviewList with DraftWithImageUrl[]

DraftReviewList (client component)
  → editable fields per card (title/category/colour/material/style)
  → acceptDraftAction({ draftId, fields })
      → fetch draft row (reads cropPath/cropWidth/cropHeight from draft_payload_json)
      → createGarment(fields)
      → insert garment_images (image_type: "cropped", crop dimensions)
      → update garment_sources set garment_id where id = draft.source_id
      → update garment_draft status → "confirmed"
  → rejectDraftAction(draftId)    (guards status === "pending")
      → update garment_draft status → "rejected"
  → redirect /wardrobe when all actioned
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Crop fails for one garment | Draft created with `crop_path: null`; card shows placeholder |
| All crops fail | Drafts still created; review page works, cards show placeholders |
| `createSignedUrl` fails | `cropUrl` set to `null`; card shows placeholder, review continues |
| Accept fails after garment created | Return error, draft stays pending; user can retry |
| Source image not in storage | Log warning, skip crop phase; drafts created without images |
| Reject on already-confirmed draft | Guard returns `{ status: "success" }` silently |

---

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `sharp` dependency |
| `lib/domain/ingestion/service.ts` | Add `storagePath` to `CreateDraftsParams`; two-phase crop logic; update `PendingDraft` type; read crop fields in `listPendingDrafts` |
| `app/page-actions.ts` | Pass `storagePath` to `createDraftsFromPipelineResult` |
| `app/wardrobe/review/page.tsx` | Generate signed crop URLs; export `DraftWithImageUrl` type |
| `app/wardrobe/review/draft-review-list.tsx` | Use `DraftWithImageUrl[]`; editable fields; pass fields + cropPath to accept action |
| `app/wardrobe/review/actions.ts` | Add `EditedFields`; updated accept signature; crop image attachment; status guard on reject |

---

## Out of Scope

- Bulk accept/reject all
- Brand or size fields (can be edited post-accept via Edit Item)
- Receipt or URL ingestion (separate flows)
- Retry UI for failed crops
- DB schema changes (all required columns already exist)
