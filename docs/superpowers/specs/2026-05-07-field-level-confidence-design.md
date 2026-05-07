# Field-Level Confidence & Provenance for Draft Review

**Date:** 2026-05-07  
**Status:** Approved

## Problem

The draft review UI shows a single `confidence` score for each draft card. Reviewers cannot tell which specific fields are reliable and which need attention. A draft with a 62% overall confidence may have a perfect `colour` extraction but a guessed `category` — the current UI treats them identically.

## Goal

Add per-field confidence scores and provenance metadata to draft payloads, then surface them in the review UI as subtle visual cues on individual field inputs.

---

## Data Model

Two optional top-level keys added to `draft_payload_json` (and mirrored in the `PendingDraft.payload` TypeScript type):

```ts
field_confidence?: Partial<Record<FieldName, number>>;  // 0–1 per field
field_provenance?: Partial<Record<FieldName, string>>;  // how it was sourced
```

**FieldName** covers: `title`, `category`, `colour`, `brand`, `material`, `style`, `retailer`, `purchase_price`, `purchase_currency`.

**Provenance vocabulary:**

| Value | Meaning |
|---|---|
| `"ai_vision"` | Extracted by AI image detection |
| `"ai_text"` | Extracted by AI text/document parsing |
| `"url_parse"` | Parsed from a product URL |
| `"filename_text"` | Inferred from filename |
| `"rule_based"` | Derived by deterministic rules |
| `"user_manual"` | Set directly by the user |

Old drafts without these keys render no indicator — fully backward-compatible. No DB migration needed; `draft_payload_json` is already an untyped JSON column.

---

## Adapter Changes

### `directUploadAdapter` (photo / AI pipeline)

Currently sets a single `confidence` float from the AI detection response. Extended to populate `field_confidence` and `field_provenance` from the same result:

- Fields the AI returned with a value → `"ai_vision"`, confidence from detector score
- Fields that fell back to filename parsing → `"filename_text"`, ~0.25
- Fields not populated → omitted (no indicator shown)

### `receiptAdapter` and `productUrlAdapter`

- AI-extracted fields → `"ai_text"`, confidence from extraction score if available, else ~0.6
- URL-parsed fields → `"url_parse"`, ~0.45
- Filename fallback fields → `"filename_text"`, ~0.25

### `createManualReviewDraft`

Fields set by the caller are treated as `"user_manual"` with confidence 1.0 — never flagged.

Adapters that do not yet have per-field signal simply omit both keys entirely.

---

## Review UI

### `Field` component additions

```ts
confidence?: number;
provenance?: string;
```

### Visual rules (left border on input, 2px, no layout shift)

| Confidence | Left border |
|---|---|
| ≥ 0.8 or absent | none |
| 0.5 – 0.79 | amber `rgba(200,140,40,0.55)` |
| < 0.5 | soft red `rgba(208,80,60,0.5)` |

- Faint background tint on the input matches the border color for visibility without hover.
- Label tooltip on hover shows provenance + score, e.g. `"AI vision · 43%"` — no always-visible text.

### Existing behavior preserved

The whole-draft `isLowConfidence` logic (card opacity, "Jump To" prompt) is unchanged. Field-level indicators are additive.

---

## Out of scope

- Changing the `draft_payload_json` DB column type (stays `jsonb`)
- Surfacing confidence in the accepted garment record
- Aggregating field confidence back into whole-draft confidence
- Gemini grounding activation (separate decision)

---

## Success criteria

1. `directUploadAdapter.buildDraft` returns `field_confidence` and `field_provenance` populated for at least `category`, `colour`, and `brand`.
2. `PendingDraft.payload` type includes both optional fields.
3. `Field` component renders a colored left border for fields with confidence < 0.8.
4. Hovering a flagged field label shows `"<provenance> · <score>%"`.
5. Drafts created before this change render no indicators (graceful degradation).
6. Existing tests pass; new unit tests cover the adapter output and Field rendering at each confidence tier.
