# Outfit Decomposition + Detector Model Provenance

**Date:** 2026-05-07  
**Status:** Approved

## Problem

The existing photo upload flow calls `callPipelineService` and always uses `directUploadAdapter` regardless of how many garments are detected. When a user uploads a full-outfit photo that yields 2+ garments:

1. The `garment_sources` record is typed as `"direct_upload"` rather than `"outfit_decomposition"`.
2. Each draft's `source_type` reads "direct upload" in the review UI, which is misleading for an outfit photo.
3. `outfitDecompositionAdapter` exists as a scaffold but is never wired to real pipeline data.
4. `createDraftCrops` re-calls `directUploadAdapter.buildDraft` from scratch (double-rebuild), so outfit items would silently use the wrong adapter.
5. No detector model identifier is stored with drafts — extractions are not auditable over time.

## Goal

- Auto-detect outfit photos (2+ garments) and label them correctly end-to-end.
- Wire `outfitDecompositionAdapter` to real pipeline data so outfit drafts carry the same field-level confidence as direct-upload drafts.
- Capture detector model metadata on all AI-detected drafts.
- Fix the pre-existing `createDraftCrops` double-rebuild.

---

## Design

### Section 1: Adapter selection + source type update

**Threshold:** 2+ detected garments = outfit decomposition. 1 garment = direct upload (existing behaviour).

In `createDraftsFromPipelineResult`:

```
if result.garments.length >= 2:
  adapter = outfitDecompositionAdapter
  after all drafts created → update garment_sources.source_type = "outfit_decomposition"
else:
  adapter = directUploadAdapter   ← existing behaviour, no change
```

The source type update is a single Supabase `update` on the `garment_sources` row after drafts are created. The source is always created as `"direct_upload"` upfront (before the pipeline call) and retroactively corrected — this keeps `createGarmentSource` unchanged.

**Review UI:** The existing `sourceLabel()` function does `sourceType.replaceAll("_", " ")`, so `"outfit_decomposition"` → "outfit decomposition" automatically. No UI changes needed.

---

### Section 2: `outfitDecompositionAdapter` enhancement

Extended input type (in `adapters.ts`):

```ts
{
  fileName: string;
  detected?: {
    category: string;
    confidence: number;
    bbox: [number, number, number, number];
    colour: string;
    material: string;
    style: string;
    tag: string;
    embedding: number[];
  } | null;
  role?: string | null;   // retained for scaffold/fallback path
  notes?: string | null;
}
```

**When `detected` is provided:**

- Use real `category`, `colour`, `material`, `style`, `tag`, `confidence` from the pipeline result.
- `role` is ignored (the detector provides the category).
- `extractionSource` = `"image analysis"` (matching `directUploadAdapter`).
- `fieldConfidence` and `fieldProvenance` populated identically to `directUploadAdapter`'s detected branch: `{ title, category, colour, material, style }` all set to `detected.confidence` with provenance `"ai_vision"`.
- `metadata.detector_model` = `PIPELINE_MODEL_ID` (see Section 3).

**When `detected` is absent:**

- Existing scaffold behaviour: confidence 0.12, empty category/colour, `extractionSource = "outfit decomposition scaffold"`. No `fieldConfidence`/`fieldProvenance`.

---

### Section 3: Fix `createDraftCrops` double-rebuild

Currently `createDraftCrops` calls `directUploadAdapter.buildDraft(...)` again to reconstruct the payload before adding crop coordinates. This is adapter-unaware and would break for outfit items.

**Fix:** Thread the already-built `draftPayload: ReviewDraftAdapterPayload` alongside each draft into `createDraftCrops`. Use it directly instead of re-deriving it. The crop update merges crop fields on top of the adapter payload:

```ts
const payload = {
  ...draftPayloadToJson(draftPayload),   // same serialisation as the initial insert
  crop_path: cropPath,
  crop_width: crop.width,
  crop_height: crop.height
};
```

`createDraftsFromPipelineResult` already has both the adapter output and the `draftId` — passing them together into `createDraftCrops` requires no new data fetching.

---

### Section 4: Detector model metadata

New export in `lib/domain/ingestion/index.ts`:

```ts
export const PIPELINE_MODEL_ID = "modal-v1";
```

Both `directUploadAdapter` and `outfitDecompositionAdapter` include it in `metadata` when `detected` is provided:

```ts
metadata: {
  original_filename: input.fileName,
  extraction_source: "image analysis",
  detector_model: PIPELINE_MODEL_ID
}
```

Stored in `draft_payload_json.metadata.detector_model`. No new DB columns. Not surfaced in the review UI for now — captured for future audit. Replace with a dynamic value once the pipeline exposes the model name.

---

## Files changed

| File | Change |
|---|---|
| `lib/domain/ingestion/index.ts` | Add `PIPELINE_MODEL_ID` constant |
| `lib/domain/ingestion/adapters.ts` | Extend `outfitDecompositionAdapter` input type; populate `detected` branch; add `detector_model` to `directUploadAdapter` and `outfitDecompositionAdapter` metadata |
| `lib/domain/ingestion/service.ts` | Adapter selection branch in `createDraftsFromPipelineResult`; source type update post-detection; fix `createDraftCrops` to accept and use pre-built payload |
| `lib/domain/ingestion/__tests__/adapters.test.ts` | Tests for `outfitDecompositionAdapter` detected branch |
| `lib/domain/ingestion/__tests__/service.test.ts` | Tests for adapter selection branch (if applicable) |

---

## Out of scope

- Changing `createGarmentSource` — source is always created as `"direct_upload"` and corrected post-detection.
- New UI for outfit upload — auto-detected from existing upload form.
- Surfacing `detector_model` in the review UI.
- Gemini grounding activation.

---

## Success criteria

1. Uploading a photo where the pipeline returns 2+ garments produces drafts with `source_type = "outfit_decomposition"` and the `garment_sources` record is updated to `source_type = "outfit_decomposition"`.
2. Each outfit draft carries `fieldConfidence` and `fieldProvenance` for the five AI-detected fields.
3. All AI-detected drafts (both direct upload and outfit) have `metadata.detector_model = "modal-v1"`.
4. Uploading a single-garment photo behaves identically to today.
5. `createDraftCrops` no longer calls `directUploadAdapter.buildDraft` — it uses the pre-built payload.
6. `outfitDecompositionAdapter` without `detected` still produces the scaffold (backward compatible).
7. All existing tests pass; new tests cover the outfit decomposition detected branch.
