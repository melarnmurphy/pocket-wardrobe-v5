# Homepage Dashboard & Draft Review — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Goal

Replace the placeholder homepage with a real user-facing dashboard, and add a `/wardrobe/review` page where users accept or reject garments detected by the AI pipeline.

---

## User Flow

```
Homepage (dashboard)
  → user clicks "Upload Photo ↑" on the upload card
  → file picker opens, user selects outfit/garment photo
  → Next.js creates a garment_source row, uploads image to Supabase Storage
  → calls POST /api/pipeline/analyse with the new sourceId
  → loading state while Modal processes (~50s cold start, ~5s warm)
  → on success: redirect to /wardrobe/review
  → user sees detected garments, taps Accept or Reject on each
  → Accept: creates a new garment row pre-filled with AI data, redirects to /wardrobe
  → Reject: marks draft status = 'rejected'
  → after all drafts actioned: redirect to /wardrobe
```

---

## Pages

### 1. Homepage (`app/page.tsx`)

Replaces the current scaffold placeholder. Requires authentication — redirect to sign-in if not logged in.

**Layout:** stats row + recent additions grid.

**Stats row (4 columns):**
| Card | Data source | Highlight behaviour |
|------|-------------|---------------------|
| Wardrobe | `count(*) from garments` | Plain white card |
| Favourites | `count(*) from garments where favourite_score > 0` | Plain white card |
| Drafts | `count(*) from garment_drafts where status = 'pending'` | Amber tint when count > 0; clicking navigates to `/wardrobe/review` |
| Upload | Static — always shown | Brown accent card with file input |

**Upload card behaviour:**
- Label: "Upload Outfit / Garment Photo"
- Sub-label: "AI detects garments automatically"
- Button: "Upload Photo ↑"
- On file select: creates garment_source, uploads to Supabase Storage, calls pipeline, shows loading spinner, redirects to `/wardrobe/review` on success
- On error: shows inline error message on the card

**Recent additions grid:**
- Last 6 garments ordered by `created_at desc`
- Each shows garment image thumbnail (or placeholder if no image)
- "View all →" links to `/wardrobe`

---

### 2. Review Page (`app/wardrobe/review/page.tsx`)

Lists all `garment_drafts` with `status = 'pending'` for the current user.

**Each garment card shows:**
- Placeholder image area (no cropped thumbnail in v1 — future work)
- Tag (e.g. "Navy cotton shirt/blouse")
- Attribute pills: category, colour, material, style
- Confidence percentage
- Low-confidence warning (amber text) when confidence < 0.6
- Accept button (brown) — creates new garment, marks draft `confirmed`
- Reject button (outlined) — marks draft `rejected`

**Empty state:** "No pending drafts. Upload a photo to get started." with link back to homepage.

**After all drafts are actioned:** redirect to `/wardrobe`.

---

## Data

### New server actions / API

| Function | Location | What it does |
|----------|----------|--------------|
| `uploadAndAnalyseAction` | `app/page-actions.ts` | Creates garment_source (with `garment_id: null` — no garment exists yet), uploads file to Supabase Storage, then calls the existing `analyzePipelineAction` from `app/wardrobe/actions.ts` (which POSTs to `/api/pipeline/analyse`). Returns the sourceId on success. |
| `acceptDraftAction` | `app/wardrobe/review/actions.ts` | Creates garment from draft payload, marks draft `confirmed` |
| `rejectDraftAction` | `app/wardrobe/review/actions.ts` | Marks draft `rejected` |

### New query functions

| Function | Location | What it does |
|----------|----------|--------------|
| `getDashboardStats()` | `lib/domain/wardrobe/service.ts` | Returns garment count, favourites count, pending draft count |
| `getRecentGarments(n)` | `lib/domain/wardrobe/service.ts` | Returns last n garments with image URL |
| `listPendingDrafts()` | `lib/domain/ingestion/service.ts` | Returns pending garment_drafts for current user |

### `acceptDraft` logic

```
1. Parse draft_payload_json → garment fields (category, colour, material, style, tag)
2. Call createGarment(
     { category, title: tag, material },
     { primaryColourFamily: colour }   ← second options argument, not a schema field
   )
   Note: colour is passed via the options.primaryColourFamily argument to trigger
   syncGarmentPrimaryColour. Do NOT pass primary_colour_family inside the first
   argument — it is not part of createGarmentSchema and will be silently ignored.
3. Update draft status = 'confirmed'
4. Return new garment id
```

No embedding is written to `garments.embedding` in v1 — that is future work (similarity search sprint).

---

## Error handling

- Pipeline timeout / error: show error message on upload card, do not redirect
- Draft already actioned (stale page): silently skip, re-fetch draft list
- No garments detected: redirect to review page, show empty state with message "No garments detected — try a clearer photo"

---

## Out of scope (v1)

- Cropped garment thumbnails on review cards (requires storing bbox crops)
- Editing garment details before accepting (accept creates garment, user edits from wardrobe)
- Bulk accept/reject all
- Writing embeddings to `garments.embedding`
