# Cut-outs, stickers, generous paywall, and order import — design

Date: 2026-08-31

Status: Draft from product conversation + Claude design-agent prototype. UI in that design project is the visual source of truth when it is copied into this repo. Do not invent a second look-and-feel.

## Problem

Users already save two kinds of photos:

1. **Looks** — editorial or lifestyle frames (person, wall, pose, jewellery, shoes). These should stay as lookbook photography.
2. **Resolved garments** — studio / ghost-mannequin / product shots that can become a **sticker**: transparent PNG, white edge, usable on a sheet and on a body canvas.

People already make garment stickers on iPhone (Photos / Messages: press and hold, lift subject, Add Sticker / Copy Subject). Pocket Wardrobe should feel like that system, not like a bbox crop in a review queue.

Separately, “import new orders automatically” needs a **sources** screen (The Iconic, Depop, Vestiaire, Gmail, plus more to connect) instead of only a receipt camera. Official retailer OAuth is mostly unavailable; the product still needs an honest connect UX and a real ingest path (email / URL / receipt) behind it.

## Locked product decisions

### Flow C (looks vs pieces)

- Saving a photo like a look **immediately** creates a lookbook entry with the original image.
- Isolation runs in the background.
- Each detected piece is a **candidate sticker**. The user confirms: wardrobe, sticker sheet, copy, or dismiss.
- Confirmed pieces never replace the original look photo.

### Visual target (v1)

- **Default:** matted cut-out (transparent PNG + white sticker ring + soft shadow). Person-in-garment is acceptable when the source is a look.
- **Do not** run aggressive isolation on textured lifestyle backgrounds (palms, night garden, street walk). Those stay look photography.
- **Studio / e-commerce flats** (plain wall, ghost mannequin, packshot) are the cut-out path.
- **Ghost-mannequin reconstruct** (person fully removed, dress on invisible form) is a later upgrade when matting is confident. Edge-based fill will leave holes between arm and torso; treat that as known v1 quality, not a blocker.

### Paywall — generous end (canonical)

Supersedes the earlier “Plus sells receipt import” pitch.

**Free**

- Unlimited pieces, however they arrive: camera, pasted sticker, look photo, **manual** receipt line, product URL typed/pasted, connected-source imports once a source is linked.
- Cost per wear on prices the user enters (or that land from a free import).
- Calendar and search.
- Sticker lift, sticker sheet, collage on a cut-out of you (the Photos-like gesture is not a paywall).

**Plus** (copy: does the typing and the deciding, not gating your own numbers)

- Scan: automatic vision labels / outfit decomposition assist (`feature_labels` / pipeline tagging).
- Trend calls.
- Packing.
- Let-go list.
- Availability.
- Long-run analytics.

**Copy rule:** do not sell cost-per-wear as Plus if the user typed the price. If 8b and the paywall line both pitch Plus, keep one of them short so they read as a pair, not a duplicate.

Current code gates receipt OCR, product URL, and outfit decomposition on paid flags (`deriveFeatureFlagsForPlan` in `lib/domain/billing/service.ts`). That map must change to match this spec.

### Stickers are a first-class ingest path

A sticker is a transparent image. It can come from:

- press-and-hold lift inside the app,
- paste from Photos / Messages (someone else’s sticker),
- server matting of a studio product photo.

One object. Three doors.

### Order import

Ship a **Sources** screen: connected stores and resale accounts with sync state and counts, “five more to connect”, and **forward a receipt** as the always-works fallback.

Modals must say **what is read and what is not**. Depop two-way (add what I buy, remove what I sell, list from let-go) is product intent; listing from let-go is Plus because let-go is Plus.

Do **not** fake live Depop / Iconic / Vestiaire APIs. Connectors are adapter-shaped. v1 real pipes: Gmail or inbound email receipts, product URL adapters, user-uploaded receipts. Partner OAuth is a later adapter behind the same connection row.

## Non-goals

- Do not merge wardrobe and lookbook tables.
- Do not store full publisher articles or unlicensed retailer gallery dumps.
- Do not scrape storefronts against robots.txt / ToS as the primary import.
- Do not make outfit generation LLM-primary.
- Do not block free users from adding clothes or typing a price.
- Do not treat geometric placeholder shapes as the shipping cut-out; real alpha PNGs are the product.

## Existing foundations

| Piece | Where | Gap |
| --- | --- | --- |
| Lookbook entry + original image | `lookbook_entries`, `lookbook-images` bucket | No isolation job, no sticker candidates |
| Lookbook items | `lookbook_items` (`garment_id` or `desired_item_json`) | No cutout path / confirm state |
| Pipeline detect | `POST /analyse`, YOLOS bbox + FashionSigLIP | Bbox crop, not a matte; `image_type: cropped` vs `cutout` already in schema |
| Draft review | `/wardrobe/review`, `garment-cutouts` | Wardrobe-owned drafts, not lookbook stickers |
| Avatar canvas | `components/avatar-styler.tsx` | Slot carousel on a photo; not a sticker sheet or press-hold lift |
| Entitlements | `user_entitlements` | Free currently has almost all ingest flags off |
| Outfit decomposition | `outfitDecompositionAdapter`, 2+ detections | Labels sources; does not produce stickers |
| iOS app | `ios/PocketWardrobev5` | No Vision subject lift yet |

## Architecture

### Objects

```
Look photo (lookbook_entries.image_path)
  → processing_jobs job_type = outfit_decomposition (existing enum)
  → candidate stickers (pending lookbook_items.desired_item_json)
  → user confirm
       → wardrobe garment + garment_images.image_type = cutout
       → and/or sticker (same PNG; sheet is a view over cutouts)
       → copy (clipboard PNG)

Studio / packshot / pasted PNG
  → matte if needed
  → same garment / sticker record
```

Keep **one PNG** as the canonical cut-out. The sticker sheet, lift animation, collage, and wardrobe card all point at `garment_images` (wardrobe) or `desired_item_json.cutout_path` (lookbook-only wishlist).

### Classification (look vs packshot)

Heuristic, inspectable, no LLM required:

- Pipeline garment count, bbox coverage, background colour variance.
- If background is busy / outdoor / multi-subject → **look**. Store original; candidates optional if detector is confident on a hero piece.
- If background is near-flat and one dominant garment → **packshot**. Matte the garment; original still stored as provenance (`image_type: original`).

### Lift gesture (web + iOS)

Match Photos: press and hold the piece → outline → dim the rest of the frame → piece lifts with a white sticker edge and a light sweep → release → actions: **Wardrobe / Sticker / Copy**.

Web v1: pointer hold (~400ms), CSS (dim overlay, lift keyframes, white ring via `drop-shadow` / SVG silhouette). Hit-test uses detector bboxes mapped into the displayed image. If there is no bbox, lift the whole foreground matte.

iOS: `VNGenerateForegroundInstanceMaskRequest` for person/subject; fashion bboxes for per-garment. Prefer on-device lift for the gesture; server pipeline still writes structured metadata.

Paste: `clipboard` / `NSItemProvider` image with alpha. If alpha coverage is already a cut-out, skip rematting.

Animation constraint from the prototype: **rotation and position on a wrapper; float keyframes on the inner node** so transforms do not fight.

### Sticker sheet and body canvas

- Sheet: confirmed cut-outs, gentle float, slight angles, ring + shadow. Empty state is not geometric placeholders in production.
- Canvas: layer stickers on a **cut-out of the user** (avatar photo matted). Reuse avatar layout persistence (`avatar` domain) rather than a new layout table unless the design requires a separate “look board” document — if so, store as `lookbook_entries.source_type = outfit_reference` plus items.

### Sources (order import)

New table (smallest add; do not merge into `garments`):

```
retailer_connections
  id, user_id, provider, status (disconnected|pending|connected|error),
  display_name, external_account_label,
  last_synced_at, item_count,
  scopes_json,      -- e.g. { add_purchases, remove_sold, list_from_let_go }
  metadata_json,    -- no secrets in client-readable fields
  created_at, updated_at
```

Providers in the first UI: `the_iconic`, `depop`, `vestiaire`, `gmail`, plus slots for more. Secrets live in server-only storage or the email inbound address, never in `metadata_json` returned to the client.

v1 sync implementations:

| Provider | Honest v1 | Not v1 |
| --- | --- | --- |
| Gmail / forward | Inbound address or Gmail readonly messages matching retail receipts → existing receipt draft path | Full mailbox scrape |
| The Iconic | Order-confirmation emails + product URL adapter | Unofficial account scrape |
| Depop / Vestiaire | Same email/URL path; UI toggles stored even if list-from-let-go is disabled until Plus + a real listing API | Fake two-way sync |

Each imported line becomes `garment_sources` (`receipt` or `product_url`) then a draft. Unlimited **count** is free; **automatic labelling** of photos remains Plus.

## Quality bar for cut-outs

- Alpha PNG, not a white-filled JPEG.
- White sticker edge (~2–4px, slightly irregular is fine).
- Enclosed holes (arm vs torso) may stay filled in v1.
- Lifestyle frames: do not ship a bad matte; keep the look.

## Open items for the Claude design HTML

When that project is copied in, align:

- Exact Sources list of “five more to connect”.
- Paywall screen 8b vs in-situ Plus line (dedupe copy).
- Whether collage is avatar page, lookbook board, or both.
- Naming: Plus vs current `pro` / `premium` rows.

Until then, implement against this spec and the described prototype (press-hold lift, sticker sheet, sources list, generous paywall).
