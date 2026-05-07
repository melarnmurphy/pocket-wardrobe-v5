# Outfit Decomposition + Detector Model Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect outfit photos (2+ garments), label them as `outfit_decomposition`, wire `outfitDecompositionAdapter` to real pipeline data with field confidence, and capture detector model metadata on all AI-detected drafts.

**Architecture:** Add `PIPELINE_MODEL_ID` constant to the pipeline schema module; extend `outfitDecompositionAdapter` to accept a `detected` pipeline result identically to `directUploadAdapter`; fix the pre-existing `createDraftCrops` double-rebuild by threading the pre-built payload; then add a single adapter-selection branch in `createDraftsFromPipelineResult` with a post-detection source-type update for outfit photos.

**Tech Stack:** TypeScript, Vitest, Supabase (jsonb — no schema migration needed)

---

## File Map

| File | Change |
|---|---|
| `lib/domain/ingestion/index.ts` | Add `PIPELINE_MODEL_ID` constant |
| `lib/domain/ingestion/adapters.ts` | Import `PIPELINE_MODEL_ID`; add `detector_model` to `directUploadAdapter` metadata; extend `outfitDecompositionAdapter` input type + detected branch |
| `lib/domain/ingestion/service.ts` | Import `outfitDecompositionAdapter` + `ReviewDraftAdapterPayload`; add `draftPayload` to `drafts` array; fix `createDraftCrops` to use pre-built payload; add adapter selection + source-type update |
| `lib/domain/ingestion/__tests__/adapters.test.ts` | Add `detector_model` assertion to `directUploadAdapter` detected test; new tests for `outfitDecompositionAdapter` detected branch |
| `lib/domain/ingestion/__tests__/service.test.ts` | New tests: source-type updated for 2+ garments; no update for single garment |

---

## Task 1: Add PIPELINE_MODEL_ID and detector_model to directUploadAdapter

**Files:**
- Modify: `lib/domain/ingestion/index.ts`
- Modify: `lib/domain/ingestion/adapters.ts`
- Test: `lib/domain/ingestion/__tests__/adapters.test.ts`

- [ ] **Step 1: Write failing test — assert detector_model in directUploadAdapter metadata**

In `lib/domain/ingestion/__tests__/adapters.test.ts`, in the `describe("directUploadAdapter")` block, update the existing "builds a detector-backed review draft with bbox provenance" test to add one assertion at the end:

```ts
expect(draft.metadata.detector_model).toBe("modal-v1");
```

The full updated test body (replace the existing test):

```ts
it("builds a detector-backed review draft with bbox provenance", () => {
  const draft = directUploadAdapter.buildDraft({
    fileName: "outfit.jpg",
    detected: {
      category: "blazer",
      confidence: 0.88,
      bbox: [10, 20, 100, 180],
      colour: "navy",
      material: "wool",
      style: "tailored",
      tag: "navy wool blazer",
      embedding: Array(768).fill(0.1)
    }
  });

  expect(draft.sourceType).toBe("direct_upload");
  expect(draft.category).toBe("blazer");
  expect(draft.bbox).toEqual([10, 20, 100, 180]);
  expect(draft.extractionSource).toBe("image analysis");
  expect(draft.fieldConfidence?.category).toBe(0.88);
  expect(draft.fieldConfidence?.colour).toBe(0.88);
  expect(draft.fieldConfidence?.material).toBe(0.88);
  expect(draft.fieldConfidence?.style).toBe(0.88);
  expect(draft.fieldConfidence?.title).toBe(0.88);
  expect(draft.fieldProvenance?.category).toBe("ai_vision");
  expect(draft.fieldProvenance?.colour).toBe("ai_vision");
  expect(draft.fieldConfidence?.brand).toBeUndefined();
  expect(draft.fieldConfidence?.retailer).toBeUndefined();
  expect(draft.metadata.detector_model).toBe("modal-v1");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -15
```

Expected: FAIL — `metadata.detector_model` is `undefined`.

- [ ] **Step 3: Add PIPELINE_MODEL_ID to index.ts**

In `lib/domain/ingestion/index.ts`, add after the existing schema and type exports:

```ts
export const PIPELINE_MODEL_ID = "modal-v1";
```

- [ ] **Step 4: Import PIPELINE_MODEL_ID in adapters.ts and add to directUploadAdapter metadata**

At the top of `lib/domain/ingestion/adapters.ts`, update the import line to add `PIPELINE_MODEL_ID`:

```ts
import type { ProductMetadata, ReceiptDraftCandidate } from "./extractors";
import { PIPELINE_MODEL_ID } from "./index";
```

In `directUploadAdapter.buildDraft`, in the `if (input.detected)` branch, update the `metadata` object:

```ts
metadata: {
  original_filename: input.fileName,
  extraction_source: "image analysis",
  detector_model: PIPELINE_MODEL_ID
},
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/domain/ingestion/index.ts lib/domain/ingestion/adapters.ts lib/domain/ingestion/__tests__/adapters.test.ts
git commit -m "feat(ingestion): add PIPELINE_MODEL_ID and detector_model to directUploadAdapter metadata"
```

---

## Task 2: Extend outfitDecompositionAdapter with detected input

**Files:**
- Modify: `lib/domain/ingestion/adapters.ts`
- Test: `lib/domain/ingestion/__tests__/adapters.test.ts`

- [ ] **Step 1: Write failing tests**

In `lib/domain/ingestion/__tests__/adapters.test.ts`, replace the existing `describe("outfitDecompositionAdapter")` block with:

```ts
describe("outfitDecompositionAdapter", () => {
  it("scaffolds an outfit-derived review draft without creating a garment", () => {
    const draft = outfitDecompositionAdapter.buildDraft({
      fileName: "full-look.jpg",
      role: "outerwear"
    });

    expect(draft.sourceType).toBe("outfit_decomposition");
    expect(draft.category).toBe("");
    expect(draft.style).toBe("outerwear");
    expect(draft.extractionSource).toBe("outfit decomposition scaffold");
    expect(draft.fieldConfidence).toBeUndefined();
    expect(draft.fieldProvenance).toBeUndefined();
  });

  it("builds a detector-backed outfit draft with field confidence when detected is provided", () => {
    const draft = outfitDecompositionAdapter.buildDraft({
      fileName: "outfit.jpg",
      detected: {
        category: "coat",
        confidence: 0.82,
        bbox: [5, 10, 90, 200],
        colour: "camel",
        material: "wool",
        style: "classic",
        tag: "camel wool coat",
        embedding: Array(768).fill(0.2)
      }
    });

    expect(draft.sourceType).toBe("outfit_decomposition");
    expect(draft.category).toBe("coat");
    expect(draft.colour).toBe("camel");
    expect(draft.material).toBe("wool");
    expect(draft.confidence).toBe(0.82);
    expect(draft.extractionSource).toBe("image analysis");
    expect(draft.bbox).toEqual([5, 10, 90, 200]);
    expect(draft.fieldConfidence?.category).toBe(0.82);
    expect(draft.fieldConfidence?.colour).toBe(0.82);
    expect(draft.fieldConfidence?.material).toBe(0.82);
    expect(draft.fieldConfidence?.style).toBe(0.82);
    expect(draft.fieldConfidence?.title).toBe(0.82);
    expect(draft.fieldProvenance?.category).toBe("ai_vision");
    expect(draft.fieldProvenance?.colour).toBe("ai_vision");
    expect(draft.fieldConfidence?.brand).toBeUndefined();
    expect(draft.metadata.detector_model).toBe("modal-v1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -15
```

Expected: FAIL — the detected-branch test fails because `outfitDecompositionAdapter` has no `detected` input.

- [ ] **Step 3: Update outfitDecompositionAdapter in adapters.ts**

Replace the full `outfitDecompositionAdapter` definition with:

```ts
export const outfitDecompositionAdapter: IngestionAdapter<{
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
  role?: string | null;
  notes?: string | null;
}> = {
  kind: "outfit_decomposition",
  buildDraft(input) {
    if (input.detected) {
      const c = input.detected.confidence;
      return {
        sourceType: "outfit_decomposition",
        title: input.detected.tag,
        category: input.detected.category,
        colour: input.detected.colour,
        brand: null,
        material: input.detected.material,
        style: input.detected.style,
        notes: input.notes ?? "Review this outfit-derived candidate before saving it as an owned garment.",
        sourceLabel: input.fileName,
        confidence: c,
        retailer: null,
        purchasePrice: null,
        purchaseCurrency: null,
        extractionSource: "image analysis",
        bbox: input.detected.bbox,
        tag: input.detected.tag,
        embedding: input.detected.embedding,
        metadata: {
          original_filename: input.fileName,
          extraction_source: "image analysis",
          detector_model: PIPELINE_MODEL_ID
        },
        fieldConfidence: { title: c, category: c, colour: c, material: c, style: c },
        fieldProvenance: {
          title: "ai_vision",
          category: "ai_vision",
          colour: "ai_vision",
          material: "ai_vision",
          style: "ai_vision"
        }
      };
    }

    const normalizedTitle = input.fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();

    return {
      sourceType: "outfit_decomposition",
      title: normalizedTitle || "Outfit item",
      category: "",
      colour: "",
      brand: null,
      material: null,
      style: input.role ?? "outfit decomposition",
      notes:
        input.notes ??
        "Review this outfit-derived candidate before saving it as an owned garment.",
      sourceLabel: input.fileName,
      confidence: 0.12,
      retailer: null,
      purchasePrice: null,
      purchaseCurrency: null,
      extractionSource: "outfit decomposition scaffold",
      metadata: {
        original_filename: input.fileName,
        role: input.role ?? null,
        extraction_source: "outfit decomposition scaffold"
      }
    };
  }
};
```

- [ ] **Step 4: Run all adapter tests**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/adapters.ts lib/domain/ingestion/__tests__/adapters.test.ts
git commit -m "feat(ingestion): extend outfitDecompositionAdapter with detected pipeline input"
```

---

## Task 3: Fix createDraftCrops double-rebuild

**Files:**
- Modify: `lib/domain/ingestion/service.ts`

- [ ] **Step 1: Update the imports in service.ts**

At the top of `lib/domain/ingestion/service.ts`, change line 4 from:

```ts
import { directUploadAdapter, type IngestionAdapterKind } from "./adapters";
```

To:

```ts
import { directUploadAdapter, outfitDecompositionAdapter, type ReviewDraftAdapterPayload, type IngestionAdapterKind } from "./adapters";
```

- [ ] **Step 2: Add draftPayload to the drafts array in createDraftsFromPipelineResult**

In `createDraftsFromPipelineResult`, change the `drafts` array type (around line 28):

```ts
const drafts: Array<{
  draftId: string;
  garment: PipelineAnalyzeResponse["garments"][number];
  draftPayload: ReviewDraftAdapterPayload;
}> = [];
```

Then change the `drafts.push` call (around line 78) from:

```ts
drafts.push({ draftId: (data as { id: string }).id, garment });
```

To:

```ts
drafts.push({ draftId: (data as { id: string }).id, garment, draftPayload });
```

- [ ] **Step 3: Update createDraftCrops signature to accept draftPayload**

Change the `createDraftCrops` params type (starting around line 94) from:

```ts
async function createDraftCrops(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  sourceId: string;
  storagePath: string;
  drafts: Array<{
    draftId: string;
    garment: PipelineAnalyzeResponse["garments"][number];
  }>;
})
```

To:

```ts
async function createDraftCrops(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  sourceId: string;
  storagePath: string;
  drafts: Array<{
    draftId: string;
    garment: PipelineAnalyzeResponse["garments"][number];
    draftPayload: ReviewDraftAdapterPayload;
  }>;
})
```

- [ ] **Step 4: Replace the double-rebuild inside createDraftCrops**

Inside `createDraftCrops`, in the `drafts.map(async ({ draftId, garment }) => {` callback, change it to destructure `draftPayload` too:

```ts
drafts.map(async ({ draftId, garment, draftPayload }) => {
```

Then remove the `directUploadAdapter.buildDraft` call and the `existingDraftPayload` variable entirely (around lines 159–162), and replace the `payload` object with one that uses `draftPayload` directly:

```ts
const payload = {
  title: draftPayload.title,
  category: draftPayload.category ?? "",
  confidence: draftPayload.confidence,
  bbox: draftPayload.bbox,
  colour: draftPayload.colour ?? "",
  brand: draftPayload.brand,
  material: draftPayload.material,
  style: draftPayload.style ?? "",
  tag: draftPayload.tag ?? draftPayload.title ?? "Photo upload draft",
  embedding: draftPayload.embedding,
  source_type: draftPayload.sourceType,
  source_label: draftPayload.sourceLabel,
  notes: draftPayload.notes,
  retailer: draftPayload.retailer,
  purchase_price: draftPayload.purchasePrice,
  purchase_currency: draftPayload.purchaseCurrency,
  extraction_source: draftPayload.extractionSource,
  metadata: draftPayload.metadata,
  field_confidence: draftPayload.fieldConfidence ?? null,
  field_provenance: draftPayload.fieldProvenance ?? null,
  crop_path: cropPath,
  crop_width: crop.width,
  crop_height: crop.height
};
```

The `garment` parameter is still needed in the callback for `garment.bbox` — keep it in the destructure.

- [ ] **Step 5: Run all ingestion tests**

```bash
npx vitest run lib/domain/ingestion 2>&1 | tail -15
```

Expected: all PASS (the existing crop test verifies `crop_path`, `crop_width`, `crop_height` are still in the payload).

- [ ] **Step 6: Commit**

```bash
git add lib/domain/ingestion/service.ts
git commit -m "refactor(ingestion): fix createDraftCrops double-rebuild by threading pre-built payload"
```

---

## Task 4: Adapter selection + source type update

**Files:**
- Modify: `lib/domain/ingestion/service.ts`
- Test: `lib/domain/ingestion/__tests__/service.test.ts`

- [ ] **Step 1: Write failing tests**

In `lib/domain/ingestion/__tests__/service.test.ts`, inside the `describe("createDraftsFromPipelineResult")` block, add two new tests after the existing ones:

```ts
it("updates garment_sources to outfit_decomposition when 2+ garments are detected", async () => {
  const { createDraftsFromPipelineResult } = await import(
    "@/lib/domain/ingestion/service"
  );

  mockSingle
    .mockResolvedValueOnce({ data: { id: "draft-uuid-1" }, error: null })
    .mockResolvedValueOnce({ data: { id: "draft-uuid-2" }, error: null });

  const result: PipelineAnalyzeResponse = {
    garments: [
      validGarment,
      { ...validGarment, category: "pants", tag: "black denim pants" }
    ]
  };

  await createDraftsFromPipelineResult({ sourceId: "source-uuid-abc", result });

  const garmentSourcesCalls = (mockFrom as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([arg]: [string]) => arg === "garment_sources"
  );
  expect(garmentSourcesCalls).toHaveLength(1);
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ source_type: "outfit_decomposition" })
  );
});

it("does not update garment_sources when a single garment is detected", async () => {
  const { createDraftsFromPipelineResult } = await import(
    "@/lib/domain/ingestion/service"
  );

  await createDraftsFromPipelineResult({
    sourceId: "source-uuid-abc",
    result: { garments: [validGarment] }
  });

  const garmentSourcesCalls = (mockFrom as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([arg]: [string]) => arg === "garment_sources"
  );
  expect(garmentSourcesCalls).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/domain/ingestion/__tests__/service.test.ts 2>&1 | tail -20
```

Expected: FAIL — source type update tests fail because the source update doesn't happen yet.

- [ ] **Step 3: Add adapter selection and source type update to createDraftsFromPipelineResult**

In `lib/domain/ingestion/service.ts`, update `createDraftsFromPipelineResult`. Replace the loop setup and the loop itself (currently around lines 20–79):

```ts
export async function createDraftsFromPipelineResult(
  params: CreateDraftsParams
): Promise<string[]> {
  const { sourceId, storagePath, result } = params;

  if (result.garments.length === 0) {
    return [];
  }

  const user = await getRequiredUser();
  const supabase = await createClient();
  const isOutfitDecomposition = result.garments.length >= 2;
  const fileName = storagePath?.split("/").pop() ?? "photo upload";
  const drafts: Array<{
    draftId: string;
    garment: PipelineAnalyzeResponse["garments"][number];
    draftPayload: ReviewDraftAdapterPayload;
  }> = [];

  for (const garment of result.garments) {
    const draftPayload = isOutfitDecomposition
      ? outfitDecompositionAdapter.buildDraft({ fileName, detected: garment })
      : directUploadAdapter.buildDraft({ fileName, detected: garment });

    const draftInsert: GarmentDraftInsert = {
      user_id: user.id,
      source_id: sourceId,
      draft_payload_json: {
        title: draftPayload.title,
        category: draftPayload.category ?? "",
        confidence: draftPayload.confidence,
        bbox: draftPayload.bbox,
        colour: draftPayload.colour ?? "",
        brand: draftPayload.brand,
        material: draftPayload.material,
        style: draftPayload.style ?? "",
        tag: draftPayload.tag ?? draftPayload.title ?? "Photo upload draft",
        embedding: draftPayload.embedding,
        source_type: draftPayload.sourceType,
        source_label: draftPayload.sourceLabel,
        notes: draftPayload.notes,
        retailer: draftPayload.retailer,
        purchase_price: draftPayload.purchasePrice,
        purchase_currency: draftPayload.purchaseCurrency,
        extraction_source: draftPayload.extractionSource,
        metadata: draftPayload.metadata as Json,
        field_confidence: draftPayload.fieldConfidence ?? null,
        field_provenance: draftPayload.fieldProvenance ?? null
      },
      confidence: draftPayload.confidence,
      status: "pending"
    };

    const { data, error } = await supabase
      .from("garment_drafts")
      // TODO: remove cast once TablesInsert<"garment_drafts"> types are corrected
      .insert(draftInsert as never)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }

    drafts.push({ draftId: (data as { id: string }).id, garment, draftPayload });
  }

  if (isOutfitDecomposition) {
    await supabase
      .from("garment_sources")
      .update({ source_type: "outfit_decomposition" } as never)
      .eq("id", sourceId)
      .eq("user_id", user.id);
  }

  if (storagePath) {
    await createDraftCrops({
      supabase,
      userId: user.id,
      sourceId,
      storagePath,
      drafts
    });
  }

  return drafts.map((draft) => draft.draftId);
}
```

- [ ] **Step 4: Run all ingestion tests**

```bash
npx vitest run lib/domain/ingestion 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add lib/domain/ingestion/service.ts lib/domain/ingestion/__tests__/service.test.ts
git commit -m "feat(ingestion): auto-detect outfit photos and update source_type on 2+ garment detection"
```
