# Label-Event Capture — Design

Date: 2026-06-09
Status: Approved (design); implementation pending
Owner area: wardrobe draft review (`app/wardrobe/review/`), new training-data domain.

## Problem

Every remaining detection error is a category misclassification (shirt→dress,
pants→skirt, cardigan→jacket, false hat). These are only fixable by fine-tuning
on in-domain data — and that data is generated for free every time a user
reviews an AI draft, but is currently discarded. Worse, `acceptDraftAction`
**overwrites** the model's original proposal in `draft_payload_json` with the
user's edited values, so the model-vs-human delta is lost.

This feature captures every review action as a labeled training example.

## Goal

Silently record, per review action, the model's guess, the human's truth, and a
reference to the image — into a user-scoped, append-only table — so a future
fine-tuning step has a labeled dataset. No model training is built here; this is
the data-capture foundation only.

## Non-goals

- Any model training / export tooling (future work; the table is queryable).
- Consent UI / opt-in toggle (capture is silent within the user's own account).
- Duplicating image bytes (we store storage paths; images stay in their bucket).
- Changing detection, the `/analyse` contract, or the review UX.

## Data model

New table `public.garment_label_events` (migration `020_garment_label_events.sql`),
append-only, RLS scoped to `auth.uid() = user_id` (select + insert own; no
update/delete policies):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk default gen_random_uuid() | |
| `user_id` | uuid not null | RLS key |
| `draft_id` | uuid | source draft |
| `garment_id` | uuid null | set on accept, null on reject |
| `source_id` | uuid null | garment_sources ref |
| `event_type` | text not null | `'confirmed' | 'corrected' | 'rejected'` (check) |
| `corrected_fields` | text[] not null default '{}' | fields the user changed |
| `source_storage_path` | text null | original image path |
| `crop_path` | text null | cropped garment image path |
| `bbox` | jsonb null | `[x1,y1,x2,y2]` |
| `crop_width` | int null | |
| `crop_height` | int null | |
| `model_category` | text null | |
| `model_colour` | text null | |
| `model_material` | text null | |
| `model_style` | text null | |
| `model_brand` | text null | |
| `model_confidence` | numeric null | detection confidence |
| `model_field_confidence` | jsonb null | per-field confidences |
| `final_category` | text null | human truth; null on reject |
| `final_colour` | text null | |
| `final_material` | text null | |
| `final_style` | text null | |
| `final_brand` | text null | |
| `final_title` | text null | |
| `created_at` | timestamptz not null default now() | |

Index: `(user_id, created_at)`.

## Architecture / isolation

New module `lib/domain/training/label-events.ts`, two units:

1. `computeLabelEvent(model, final)` — **pure function**, the only non-trivial
   logic. Given the model's labels and the final (human) labels, returns
   `{ eventType: 'confirmed' | 'corrected', correctedFields: string[] }`.
   - Compares the comparable fields (`category, colour, material, style, brand,
     title`) case-insensitively after trim.
   - `correctedFields` = the subset that differ.
   - `eventType` = `'corrected'` if any differ, else `'confirmed'`.
   - (Rejection is set directly by the caller, not via this function.)

2. `recordLabelEvent(supabase, row)` — best-effort insert into
   `garment_label_events`. Returns void; **catches and swallows all errors**
   (telemetry must never break the user's action). Logs failures.

### Data flow

- `acceptDraftAction`: after parsing/validating but **before** the
  `draft_payload_json` overwrite, read the model values from `p.*`
  (`category, colour, material, style, brand`, `confidence`, `field_confidence`,
  `bbox`, `crop_path`, `crop_width/height`) and the source `storage_path`; call
  `computeLabelEvent` with model vs final; call `recordLabelEvent` with the merged
  row including `garment_id`, `event_type`, `corrected_fields`, final values.
- `rejectDraftAction`: fetch the draft payload (currently it only selects
  `status` — widen the select to include `draft_payload_json, source_id,
  garment_sources(storage_path)`), then `recordLabelEvent` with
  `event_type='rejected'`, model values, image ref, `garment_id=null`,
  `final_*` null.

## Error handling

`recordLabelEvent` wraps its insert in try/catch and never throws. Both server
actions call it without `await`-blocking their success path semantics — the
garment creation / status update remains the source of truth for the user-facing
result. A capture failure is logged and ignored.

## Testing

- **TDD `computeLabelEvent`** (pure, no I/O):
  - identical model + final → `confirmed`, `[]`.
  - one field differs (e.g. category dress→shirt) → `corrected`, `['category']`.
  - multiple differ → `corrected`, all changed fields.
  - case/whitespace-insensitive: `"Dress"` vs `"dress "` → not a change.
  - null/empty model field vs set final → treated as a change.
- Confirm existing `app/wardrobe/review/__tests__` accept/reject tests still
  pass (capture is additive and best-effort).

## Risks / notes

- `bbox`/`crop_path` are only present for photo-pipeline drafts; receipt/URL
  drafts will have null image refs — acceptable (their rows still capture the
  label delta, just without an image to train on).
- Append-only: no dedup if a user re-reviews; acceptable for a capture log.
- The model's *original* values must be read from `draft_payload_json` BEFORE the
  accept overwrite — this ordering is the critical correctness point.
