# Field-Level Confidence & Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-field confidence scores and provenance metadata to draft payloads and surface them as subtle visual cues (coloured left border + hover tooltip) on individual field inputs in the draft review UI.

**Architecture:** Extend `ReviewDraftAdapterPayload` with optional `fieldConfidence` / `fieldProvenance` maps, populate them in each adapter, pass them through the service layer into `PendingDraft.payload`, then read them in the `Field` component in the review UI.

**Tech Stack:** TypeScript, Vitest, React, Tailwind/CSS-in-style-prop, Supabase (jsonb column — no migration needed)

---

## File Map

| File | Change |
|---|---|
| `lib/domain/ingestion/adapters.ts` | Add `DraftFieldName` type, `fieldConfidence` + `fieldProvenance` to `ReviewDraftAdapterPayload`, populate in all 4 adapters |
| `lib/domain/ingestion/__tests__/adapters.test.ts` | Add field_confidence / field_provenance assertions for each adapter |
| `lib/domain/ingestion/service.ts` | Pass `field_confidence` / `field_provenance` through in draft inserts and in `PendingDraft` type + `listPendingDrafts` mapper |
| `app/wardrobe/review/draft-review-list.tsx` | Add `confidence` + `provenance` props to `Field`, render left-border tint + label tooltip, pass field data from payload |

---

## Task 1: Extend `ReviewDraftAdapterPayload` type

**Files:**
- Modify: `lib/domain/ingestion/adapters.ts`

- [ ] **Step 1: Add `DraftFieldName` union type and the two new optional payload fields**

At the top of `lib/domain/ingestion/adapters.ts`, before `ReviewDraftAdapterPayload`, add:

```ts
export type DraftFieldName =
  | "title"
  | "category"
  | "colour"
  | "brand"
  | "material"
  | "style"
  | "retailer"
  | "purchase_price"
  | "purchase_currency";
```

Then add two optional fields to `ReviewDraftAdapterPayload`:

```ts
export type ReviewDraftAdapterPayload = {
  sourceType: IngestionAdapterKind;
  title: string | null;
  category: string | null;
  colour: string | null;
  brand: string | null;
  material: string | null;
  style: string | null;
  notes: string | null;
  sourceLabel: string | null;
  confidence: number;
  retailer: string | null;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  extractionSource: string;
  metadata: Record<string, unknown>;
  bbox?: [number, number, number, number] | null;
  tag?: string | null;
  embedding?: number[] | null;
  fieldConfidence?: Partial<Record<DraftFieldName, number>>;
  fieldProvenance?: Partial<Record<DraftFieldName, string>>;
};
```

- [ ] **Step 2: Verify TypeScript compiles (no new errors)**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: same errors as before (if any), no new ones from adapters.ts.

- [ ] **Step 3: Commit**

```bash
git add lib/domain/ingestion/adapters.ts
git commit -m "feat(ingestion): add DraftFieldName type and fieldConfidence/fieldProvenance to payload"
```

---

## Task 2: Populate field confidence in `directUploadAdapter`

**Files:**
- Modify: `lib/domain/ingestion/adapters.ts`
- Test: `lib/domain/ingestion/__tests__/adapters.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the existing `directUploadAdapter` describe block in `lib/domain/ingestion/__tests__/adapters.test.ts` with:

```ts
describe("directUploadAdapter", () => {
  it("builds a low-confidence manual review draft when no detector result exists", () => {
    const draft = directUploadAdapter.buildDraft({
      fileName: "black-linen-dress.jpg"
    });

    expect(draft.sourceType).toBe("direct_upload");
    expect(draft.title).toBe("black linen dress");
    expect(draft.confidence).toBe(0.05);
    expect(draft.extractionSource).toBe("manual entry");
    expect(draft.fieldConfidence).toBeUndefined();
    expect(draft.fieldProvenance).toBeUndefined();
  });

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
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -20
```

Expected: FAIL — `fieldConfidence` and `fieldProvenance` assertions fail.

- [ ] **Step 3: Update `directUploadAdapter.buildDraft` in `lib/domain/ingestion/adapters.ts`**

In the `if (input.detected)` branch, add `fieldConfidence` and `fieldProvenance`:

```ts
if (input.detected) {
  const c = input.detected.confidence;
  return {
    sourceType: "direct_upload",
    title: input.detected.tag,
    category: input.detected.category,
    colour: input.detected.colour,
    brand: null,
    material: input.detected.material,
    style: input.detected.style,
    notes: input.notes ?? null,
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
      extraction_source: "image analysis"
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
```

The fallback (no `detected`) return stays unchanged — no `fieldConfidence` / `fieldProvenance`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -20
```

Expected: PASS for all `directUploadAdapter` tests.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/adapters.ts lib/domain/ingestion/__tests__/adapters.test.ts
git commit -m "feat(ingestion): populate field confidence for directUploadAdapter"
```

---

## Task 3: Populate field confidence in `productUrlAdapter`

**Files:**
- Modify: `lib/domain/ingestion/adapters.ts`
- Test: `lib/domain/ingestion/__tests__/adapters.test.ts`

- [ ] **Step 1: Write failing tests**

Add inside the existing `describe("productUrlAdapter", ...)` block in `adapters.test.ts`:

```ts
it("sets ai_text provenance on fields extracted from retailer metadata", () => {
  const draft = productUrlAdapter.buildDraft({
    productUrl: "https://example.com/products/ivory-trench",
    titleHint: "ivory trench",
    extracted: baseProductMetadata
  });

  expect(draft.fieldConfidence?.title).toBe(0.8);
  expect(draft.fieldProvenance?.title).toBe("ai_text");
  expect(draft.fieldConfidence?.category).toBe(0.75);
  expect(draft.fieldProvenance?.category).toBe("ai_text");
  expect(draft.fieldConfidence?.colour).toBe(0.7);
  expect(draft.fieldConfidence?.brand).toBe(0.8);
  expect(draft.fieldConfidence?.retailer).toBe(0.85);
  expect(draft.fieldConfidence?.purchase_price).toBe(0.85);
  expect(draft.fieldConfidence?.purchase_currency).toBe(0.85);
});

it("sets url_parse provenance for title when only titleHint available", () => {
  const draft = productUrlAdapter.buildDraft({
    productUrl: "https://example.com/products/mystery-item",
    titleHint: "mystery item",
    extracted: {
      title: null,
      brand: null,
      category: null,
      colour: null,
      fit: null,
      material: null,
      retailer: null,
      description: null,
      price: null,
      currency: null,
      image_url: null,
      attributes: [],
      styling_suggestions: []
    }
  });

  expect(draft.fieldConfidence?.title).toBe(0.45);
  expect(draft.fieldProvenance?.title).toBe("url_parse");
  expect(draft.fieldConfidence?.category).toBe(0.2);
  expect(draft.fieldProvenance?.category).toBe("rule_based");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -20
```

Expected: FAIL — `fieldConfidence` assertions fail.

- [ ] **Step 3: Update `productUrlAdapter.buildDraft` in `lib/domain/ingestion/adapters.ts`**

Inside `buildDraft`, after computing `extractedPrice` and `extractionSource`, add:

```ts
const fieldConfidence: Partial<Record<DraftFieldName, number>> = {};
const fieldProvenance: Partial<Record<DraftFieldName, string>> = {};

if (input.extracted.title) {
  fieldConfidence.title = 0.8; fieldProvenance.title = "ai_text";
} else if (input.titleHint) {
  fieldConfidence.title = 0.45; fieldProvenance.title = "url_parse";
}

if (input.extracted.category) {
  fieldConfidence.category = 0.75; fieldProvenance.category = "ai_text";
} else {
  fieldConfidence.category = 0.2; fieldProvenance.category = "rule_based";
}

if (input.extracted.colour) {
  fieldConfidence.colour = 0.7; fieldProvenance.colour = "ai_text";
}
if (input.extracted.brand) {
  fieldConfidence.brand = 0.8; fieldProvenance.brand = "ai_text";
}
if (input.extracted.material) {
  fieldConfidence.material = 0.7; fieldProvenance.material = "ai_text";
}
if (input.extracted.fit) {
  fieldConfidence.style = 0.65; fieldProvenance.style = "ai_text";
}
if (input.extracted.retailer) {
  fieldConfidence.retailer = 0.85; fieldProvenance.retailer = "ai_text";
}
if (extractedPrice !== null) {
  fieldConfidence.purchase_price = 0.85; fieldProvenance.purchase_price = "ai_text";
}
if (input.extracted.currency) {
  fieldConfidence.purchase_currency = 0.85; fieldProvenance.purchase_currency = "ai_text";
}
```

Then add both to the return value:

```ts
return {
  sourceType: "product_url",
  title: input.extracted.title || input.titleHint,
  category: input.extracted.category ?? "top",
  colour: input.extracted.colour,
  brand: input.extracted.brand,
  material: input.extracted.material,
  style: input.extracted.fit,
  notes:
    input.notes ??
    input.extracted.description ??
    `Review this product-link draft from ${url.hostname}.`,
  sourceLabel: url.hostname,
  confidence,
  retailer: input.extracted.retailer,
  purchasePrice: extractedPrice,
  purchaseCurrency: input.extracted.currency,
  extractionSource,
  metadata: {
    source_url: input.productUrl,
    title_hint: input.titleHint,
    extraction_source: extractionSource,
    extracted_title: input.extracted.title,
    extracted_category: input.extracted.category,
    extracted_colour: input.extracted.colour,
    extracted_brand: input.extracted.brand,
    extracted_retailer: input.extracted.retailer,
    extracted_price: input.extracted.price,
    extracted_currency: input.extracted.currency,
    extracted_image_url: input.extracted.image_url,
    extracted_fit: input.extracted.fit,
    extracted_material: input.extracted.material,
    extracted_attributes: input.extracted.attributes,
    extracted_styling_suggestions: input.extracted.styling_suggestions
  },
  fieldConfidence,
  fieldProvenance
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -20
```

Expected: PASS for all `productUrlAdapter` tests.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/adapters.ts lib/domain/ingestion/__tests__/adapters.test.ts
git commit -m "feat(ingestion): populate field confidence for productUrlAdapter"
```

---

## Task 4: Populate field confidence in `receiptAdapter`

**Files:**
- Modify: `lib/domain/ingestion/adapters.ts`
- Test: `lib/domain/ingestion/__tests__/adapters.test.ts`

- [ ] **Step 1: Write failing tests**

Add inside the existing `describe("receiptAdapter", ...)` block:

```ts
it("sets ai_text provenance on populated receipt fields using candidate confidence", () => {
  const draft = receiptAdapter.buildDraft({
    fileName: "receipt.pdf",
    extractionSource: "pasted text",
    candidate: {
      title: "Wool Blazer",
      category: "blazer",
      colour: null,
      brand: "Basque",
      retailer: "Myer",
      price: 179.95,
      currency: "AUD",
      notes: null,
      confidence: 0.74
    }
  });

  expect(draft.fieldConfidence?.title).toBe(0.74);
  expect(draft.fieldProvenance?.title).toBe("ai_text");
  expect(draft.fieldConfidence?.category).toBe(0.74);
  expect(draft.fieldProvenance?.category).toBe("ai_text");
  expect(draft.fieldConfidence?.colour).toBeUndefined();
  expect(draft.fieldConfidence?.brand).toBe(0.74);
  expect(draft.fieldConfidence?.retailer).toBe(0.74);
  expect(draft.fieldConfidence?.purchase_price).toBe(0.74);
  expect(draft.fieldConfidence?.purchase_currency).toBe(0.74);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -20
```

Expected: FAIL — `fieldConfidence` assertions fail.

- [ ] **Step 3: Update `receiptAdapter.buildDraft` in `lib/domain/ingestion/adapters.ts`**

Replace the body of `receiptAdapter.buildDraft` with:

```ts
buildDraft(input) {
  const c = input.candidate.confidence;
  const fieldConfidence: Partial<Record<DraftFieldName, number>> = {};
  const fieldProvenance: Partial<Record<DraftFieldName, string>> = {};

  if (input.candidate.title) {
    fieldConfidence.title = c; fieldProvenance.title = "ai_text";
  }
  if (input.candidate.category) {
    fieldConfidence.category = c; fieldProvenance.category = "ai_text";
  }
  if (input.candidate.colour) {
    fieldConfidence.colour = c; fieldProvenance.colour = "ai_text";
  }
  if (input.candidate.brand) {
    fieldConfidence.brand = c; fieldProvenance.brand = "ai_text";
  }
  if (input.candidate.retailer) {
    fieldConfidence.retailer = c; fieldProvenance.retailer = "ai_text";
  }
  if (input.candidate.price !== null && input.candidate.price !== undefined) {
    fieldConfidence.purchase_price = c; fieldProvenance.purchase_price = "ai_text";
  }
  if (input.candidate.currency) {
    fieldConfidence.purchase_currency = c; fieldProvenance.purchase_currency = "ai_text";
  }

  return {
    sourceType: "receipt",
    title: input.candidate.title,
    category: input.candidate.category,
    colour: input.candidate.colour,
    brand: input.candidate.brand,
    material: null,
    style: "receipt import",
    notes: input.notes ?? input.candidate.notes ?? "Review this receipt-derived draft.",
    sourceLabel: input.fileName,
    confidence: c,
    retailer: input.candidate.retailer,
    purchasePrice: input.candidate.price,
    purchaseCurrency: input.candidate.currency,
    extractionSource: input.extractionSource,
    metadata: {
      original_filename: input.fileName,
      extraction_source: input.extractionSource,
      receipt_retailer: input.candidate.retailer,
      receipt_price: input.candidate.price,
      receipt_currency: input.candidate.currency
    },
    fieldConfidence,
    fieldProvenance
  };
}
```

- [ ] **Step 4: Run all adapter tests**

```bash
npx vitest run lib/domain/ingestion/__tests__/adapters.test.ts 2>&1 | tail -20
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/adapters.ts lib/domain/ingestion/__tests__/adapters.test.ts
git commit -m "feat(ingestion): populate field confidence for receiptAdapter"
```

---

## Task 5: Pass field confidence through the service layer

**Files:**
- Modify: `lib/domain/ingestion/service.ts`

- [ ] **Step 1: Add `field_confidence` and `field_provenance` to `PendingDraft.payload`**

In `service.ts`, update the `PendingDraft` interface payload type (around line 228):

```ts
payload: {
  title: string;
  category: string;
  colour: string;
  bbox: [number, number, number, number] | null;
  brand: string | null;
  material: string | null;
  style: string;
  tag: string;
  confidence: number;
  source_type: string;
  source_label: string | null;
  notes: string | null;
  retailer: string | null;
  purchase_price: number | null;
  purchase_currency: string | null;
  extraction_source: string | null;
  metadata: Record<string, unknown>;
  field_confidence?: Record<string, number>;
  field_provenance?: Record<string, string>;
};
```

- [ ] **Step 2: Pass field confidence in `createDraftsFromPipelineResult`**

In `createDraftsFromPipelineResult`, update the `draftInsert` object (around line 38). Add the two new fields after `metadata`:

```ts
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
```

Also do the same in the second `payload` object inside `createDraftCrops` (around line 161):

```ts
const payload = {
  title: existingDraftPayload.title,
  category: existingDraftPayload.category ?? "",
  confidence: existingDraftPayload.confidence,
  bbox: existingDraftPayload.bbox,
  colour: existingDraftPayload.colour ?? "",
  brand: existingDraftPayload.brand,
  material: existingDraftPayload.material,
  style: existingDraftPayload.style ?? "",
  tag: existingDraftPayload.tag ?? existingDraftPayload.title ?? "Photo upload draft",
  embedding: existingDraftPayload.embedding,
  source_type: existingDraftPayload.sourceType,
  source_label: existingDraftPayload.sourceLabel,
  notes: existingDraftPayload.notes,
  retailer: existingDraftPayload.retailer,
  purchase_price: existingDraftPayload.purchasePrice,
  purchase_currency: existingDraftPayload.purchaseCurrency,
  extraction_source: existingDraftPayload.extractionSource,
  metadata: existingDraftPayload.metadata,
  crop_path: cropPath,
  crop_width: crop.width,
  crop_height: crop.height,
  field_confidence: existingDraftPayload.fieldConfidence ?? null,
  field_provenance: existingDraftPayload.fieldProvenance ?? null
};
```

- [ ] **Step 3: Pass field confidence in `createManualReviewDraft`**

Update the `draft_payload_json` in `createManualReviewDraft` (around line 404):

```ts
draft_payload_json: {
  title: params.title ?? null,
  category: params.category ?? "",
  colour: params.colour ?? "",
  brand: params.brand ?? null,
  material: params.material ?? null,
  style: params.style ?? "",
  tag: params.title ?? sourceFallbackTag(params.sourceType),
  confidence: params.confidence ?? 0.18,
  source_type: params.sourceType,
  source_label: params.sourceLabel ?? null,
  notes: params.notes ?? null,
  retailer: params.retailer ?? null,
  purchase_price: params.purchasePrice ?? null,
  purchase_currency: params.purchaseCurrency ?? null,
  extraction_source: params.extractionSource ?? null,
  metadata: (params.metadata ?? {}) as Json,
  field_confidence: params.fieldConfidence ?? null,
  field_provenance: params.fieldProvenance ?? null
},
```

And add the two optional params to `createManualReviewDraft`'s params type:

```ts
export async function createManualReviewDraft(params: {
  sourceId: string;
  sourceType: IngestionAdapterKind;
  title?: string | null;
  category?: string | null;
  colour?: string | null;
  brand?: string | null;
  material?: string | null;
  style?: string | null;
  notes?: string | null;
  sourceLabel?: string | null;
  confidence?: number | null;
  retailer?: string | null;
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  extractionSource?: string | null;
  metadata?: Record<string, unknown>;
  fieldConfidence?: Partial<Record<string, number>> | null;
  fieldProvenance?: Partial<Record<string, string>> | null;
}): Promise<string>
```

- [ ] **Step 4: Update `listPendingDrafts` mapper to pass through the fields**

In the `return data.map(...)` block (around line 572), add after the `metadata` mapping:

```ts
field_confidence:
  p.field_confidence &&
  typeof p.field_confidence === "object" &&
  !Array.isArray(p.field_confidence)
    ? (p.field_confidence as Record<string, number>)
    : undefined,
field_provenance:
  p.field_provenance &&
  typeof p.field_provenance === "object" &&
  !Array.isArray(p.field_provenance)
    ? (p.field_provenance as Record<string, string>)
    : undefined,
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 6: Run all ingestion tests**

```bash
npx vitest run lib/domain/ingestion 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/domain/ingestion/service.ts
git commit -m "feat(ingestion): pass field_confidence and field_provenance through service layer"
```

---

## Task 6: Update `Field` component with confidence visual cues

**Files:**
- Modify: `app/wardrobe/review/draft-review-list.tsx`

- [ ] **Step 1: Add a provenance label helper at the bottom of the file (before `sourceLabel`)**

Add this helper function above the `sourceLabel` function at the bottom of `draft-review-list.tsx`:

```ts
const PROVENANCE_LABELS: Record<string, string> = {
  ai_vision: "AI vision",
  ai_text: "AI text",
  url_parse: "URL",
  filename_text: "Filename",
  rule_based: "Rule-based",
  user_manual: "Manual",
};

function provenanceLabel(provenance: string | undefined): string {
  return provenance ? (PROVENANCE_LABELS[provenance] ?? provenance) : "Unknown source";
}
```

- [ ] **Step 2: Update the `Field` component to accept and render confidence/provenance**

Replace the existing `Field` function with:

```tsx
function Field({
  id,
  label,
  value,
  placeholder,
  type = "text",
  step,
  confidence,
  provenance,
  onChange
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "number";
  step?: string;
  confidence?: number;
  provenance?: string;
  onChange: (value: string) => void;
}) {
  const borderColor =
    confidence === undefined || confidence >= 0.8
      ? undefined
      : confidence >= 0.5
        ? "rgba(200,140,40,0.55)"
        : "rgba(208,80,60,0.5)";

  const bgColor =
    confidence === undefined || confidence >= 0.8
      ? undefined
      : confidence >= 0.5
        ? "rgba(200,140,40,0.06)"
        : "rgba(208,80,60,0.05)";

  const tooltipText =
    borderColor && confidence !== undefined
      ? `${provenanceLabel(provenance)} · ${Math.round(confidence * 100)}%`
      : undefined;

  return (
    <label
      className="flex flex-col gap-2 text-[12px] text-[var(--muted)]"
      title={tooltipText}
    >
      <span className="font-medium">{label}</span>
      <input
        id={id}
        value={value}
        type={type}
        step={step}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
        style={{
          borderLeft: borderColor ? `2px solid ${borderColor}` : undefined,
          background: bgColor
        }}
      />
    </label>
  );
}
```

- [ ] **Step 3: Pass field confidence/provenance from the draft payload to each `Field` call**

In the `drafts.map((draft) => { ... })` render block, update each `Field` call inside the `grid` div to include `confidence` and `provenance`. The full updated block (replacing all 9 `Field` calls):

```tsx
<div className="mt-4 grid gap-3 md:grid-cols-2">
  <Field
    id={fieldId(draft.id, "title")}
    label="Title"
    value={draftEdit.title}
    confidence={draft.payload.field_confidence?.title}
    provenance={draft.payload.field_provenance?.title}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], title: value }
      }))
    }
  />
  <Field
    id={fieldId(draft.id, "category")}
    label="Category"
    value={draftEdit.category}
    placeholder="top, trousers, blazer"
    confidence={draft.payload.field_confidence?.category}
    provenance={draft.payload.field_provenance?.category}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], category: value }
      }))
    }
  />
  <Field
    id={fieldId(draft.id, "colour")}
    label="Colour"
    value={draftEdit.colour}
    confidence={draft.payload.field_confidence?.colour}
    provenance={draft.payload.field_provenance?.colour}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], colour: value }
      }))
    }
  />
  <Field
    id={fieldId(draft.id, "brand")}
    label="Brand"
    value={draftEdit.brand}
    confidence={draft.payload.field_confidence?.brand}
    provenance={draft.payload.field_provenance?.brand}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], brand: value }
      }))
    }
  />
  <Field
    id={fieldId(draft.id, "material")}
    label="Material"
    value={draftEdit.material}
    confidence={draft.payload.field_confidence?.material}
    provenance={draft.payload.field_provenance?.material}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], material: value }
      }))
    }
  />
  <Field
    id={fieldId(draft.id, "style")}
    label="Style Notes"
    value={draftEdit.style}
    confidence={draft.payload.field_confidence?.style}
    provenance={draft.payload.field_provenance?.style}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], style: value }
      }))
    }
  />
  <Field
    id={fieldId(draft.id, "retailer")}
    label="Retailer"
    value={draftEdit.retailer}
    confidence={draft.payload.field_confidence?.retailer}
    provenance={draft.payload.field_provenance?.retailer}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], retailer: value }
      }))
    }
  />
  <Field
    id={fieldId(draft.id, "purchase_price")}
    label="Price"
    type="number"
    step="0.01"
    value={draftEdit.purchase_price}
    confidence={draft.payload.field_confidence?.purchase_price}
    provenance={draft.payload.field_provenance?.purchase_price}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], purchase_price: value }
      }))
    }
  />
  <Field
    id={fieldId(draft.id, "purchase_currency")}
    label="Currency"
    value={draftEdit.purchase_currency}
    placeholder="AUD"
    confidence={draft.payload.field_confidence?.purchase_currency}
    provenance={draft.payload.field_provenance?.purchase_currency}
    onChange={(value) =>
      setEdits((prev) => ({
        ...prev,
        [draft.id]: { ...prev[draft.id], purchase_currency: value }
      }))
    }
  />
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run 2>&1 | tail -30
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add app/wardrobe/review/draft-review-list.tsx
git commit -m "feat(review): add per-field confidence visual cues to draft review fields"
```

---

## Task 7: Also pass fieldConfidence/fieldProvenance from `createManualPhotoReviewDraft`

**Files:**
- Modify: `lib/domain/ingestion/service.ts`

- [ ] **Step 1: Update `createManualPhotoReviewDraft` to forward the new fields**

`createManualPhotoReviewDraft` calls `createManualReviewDraft`. Update it to pass through the adapter's new fields (around line 448 in `service.ts`):

```ts
export async function createManualPhotoReviewDraft(params: {
  sourceId: string;
  fileName: string;
  notes?: string | null;
}): Promise<string> {
  const draftPayload = directUploadAdapter.buildDraft({
    fileName: params.fileName,
    notes: params.notes
  });

  return createManualReviewDraft({
    sourceId: params.sourceId,
    sourceType: draftPayload.sourceType,
    title: draftPayload.title,
    category: draftPayload.category,
    colour: draftPayload.colour,
    brand: draftPayload.brand,
    material: draftPayload.material,
    sourceLabel: draftPayload.sourceLabel,
    style: draftPayload.style,
    notes: draftPayload.notes,
    confidence: draftPayload.confidence,
    retailer: draftPayload.retailer,
    purchasePrice: draftPayload.purchasePrice,
    purchaseCurrency: draftPayload.purchaseCurrency,
    extractionSource: draftPayload.extractionSource,
    metadata: draftPayload.metadata,
    fieldConfidence: draftPayload.fieldConfidence,
    fieldProvenance: draftPayload.fieldProvenance
  });
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run 2>&1 | tail -30
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/domain/ingestion/service.ts
git commit -m "feat(ingestion): forward fieldConfidence/fieldProvenance through createManualPhotoReviewDraft"
```
