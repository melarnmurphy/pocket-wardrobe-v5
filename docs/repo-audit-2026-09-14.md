# Sibling repository audit — 2026-09-14

## Scope

Compared the current Garderobe app with the sibling projects one folder above:

- `FashionAppV3/pocketwardrobe` — original React/Supabase prototype
- `fashionappv4/trend-drobe` — small Next/Neo4j prototype
- `clothes-classifier` — model-training and fashion knowledge-graph research
- `fashion-trends-search` — standalone search/trend extraction prototype
- `fashionapp2` — empty directory; no source files to reuse

The sibling repositories were read-only during this audit. Their existing dirty files were
not changed.

## Executive conclusion

The current Garderobe app is the strongest production-shaped codebase and already contains
the canonical versions of most domain capabilities: drafts, provenance, storage, RLS,
lookbook-to-wardrobe links, wishlist/resale connections, structured outfit ranking, weather
context, and trend matching.

The main genuinely useful missing capability found in the siblings is the V3 image-editor
experience: crop, HEIC conversion, client-side background removal, and manual erase/restore
refinement. The implementation is real, but its output is held in browser state and passed
as base64; it is not a safe drop-in for the current server/storage/job pipeline.

The other useful material is reference logic and vocabulary, not code to transplant:

- V3 receipt parsing has a useful lightweight fallback and line-item heuristics.
- V3 weekly outfit generation demonstrates deterministic rotation and temperature bands,
  but is narrower than the current explainable constraint/ranking engine.
- V3 look tagging demonstrates the desired interaction, but persists loose positional JSON
  in legacy tables rather than normalized relationships.
- V3 trend matching has useful synonym and type-tag heuristics, but its source pipeline and
  data model predate the current IP-safe trend schema.
- V4 colour-wheel logic is a helpful conceptual reference, but it relies on Neo4j, RGB
  distance, and a hard-coded palette that conflicts with the current canonical colour
  ontology.
- The classifier repo contains research assets and category/attribute mappings, but no
  production inference service or tested integration that can be safely imported.
- The trend-search prototype extracts article text and offers demo results; this should not
  be brought into Garderobe because it conflicts with the product's signal-only/IP-safe
  trend policy.

## Capability decisions

| Capability | Best source | Finding | Decision for Garderobe |
| --- | --- | --- | --- |
| Background removal | V3 `ImageUpload.jsx`, `@imgly/background-removal` | Real browser-side removal with fallback to original | **Adapt** behind the current upload/review flow; persist only after review, with original and cutout as separate `garment_images` records |
| Crop and HEIC support | V3 `ImageUpload.jsx` | Real crop flow and HEIC-to-JPEG conversion | **Adapt** as a bounded upload utility; validate size/pixels and preserve original provenance |
| Manual erase/restore | V3 `ImageUpload.jsx` | Canvas erase, restore, edge smoothing; useful but stateful and not tested as a durable artifact | **Later / optional**; first add background removal and explicit “use original” fallback |
| Lookbook image tagging | V3 `LookDetail.jsx`, `ItemPickerModal.jsx` | Tap image, choose wardrobe item, show linked item list; positional data is loose JSON | **Adapt UX only**; use `lookbook_items` for links and add a normalized placement model only if positional tags are required |
| Lookbook ↔ shopping | V3 lookbook has basic “shopping” affordance; current app has wishlist, price checks, unlock scoring, and resale | Current app is materially more complete | **Keep current implementation**; use V3 only for interaction ideas |
| Receipt parsing | V3 `receiptParser.js` | Simple, deterministic OCR text parsing for merchant, code, description, price | **Adapt as fallback tests/heuristics**; current ingestion service remains the boundary |
| Weekly outfits | V3 `outfitRecommendationService.js` | Temperature-band buckets and deterministic daily rotation | **Compare, don’t replace**; current outfit engine has stronger hard filters, ranking, reasons, and persistence |
| Colour harmony | V4 `comp-colours.ts` / `stylist.ts` | Complementary/analogous/triadic ideas using Neo4j | **Translate concepts into existing style rules/colour math**; do not add Neo4j or duplicate palette tables |
| Clothing detection | `clothes-classifier` YOLO/model files | Research/training assets, no production service contract | **Use as research only** until a versioned inference endpoint and evaluation set exist |
| Fashion knowledge graph | `clothes-classifier/knowledge_graph` and V4 Neo4j | Category/attribute CSVs and graph experiments; not aligned to current Postgres schema | **Mine vocabulary selectively**; seed through current `style_rules`, not a second graph |
| Trend extraction | V3 scripts and `fashion-trends-search` | V3 has metadata/RSS pipeline; standalone app reads article bodies and includes demo/fake results | **Keep current IP-safe pipeline**; reject article-body extraction and demo data |

## What is already covered in the current app

The audit confirmed that current Garderobe already has production-shaped modules for:

- direct upload, product URL, receipt, forwarded email, and outfit-decomposition sources;
- confidence-aware drafts and manual review;
- durable photo batches/jobs and retry handling;
- original image storage, derived image processing, colour analysis, and garment image records;
- separate wardrobe and lookbook tables;
- lookbook item links to owned garments and desired items;
- wishlist entries, price checks, resolved/bought-garment links, and outfit unlock scoring;
- deterministic outfit generation with role completion, hard filters, colour/category rules,
  ranking, trend boosts, explanations, and planner/calendar persistence;
- global trend ingestion with source metadata and user-specific matching;
- current resale/local listing and messaging surfaces.

## Cleanup priorities

### P0 — release hygiene

The local audited branch is at `1e813b3`, but GitHub `main` and the latest Vercel production
deployment still point to `fba4f33`. The recent cohesion, signed-out auth, and image-ratio
fixes are therefore not deployed. Resolve this before judging the current UI in production.

### P1 — image pipeline convergence

Add an explicit derivative step to the current upload/review architecture:

1. preserve the original upload;
2. optionally create a cutout derivative using the V3 approach;
3. show original/cutout choice in review;
4. persist the selected derivative through the existing garment image path;
5. fall back cleanly when browser processing fails or is unavailable.

Do not copy V3's base64 persistence or bypass the current `garment_sources`, draft, batch,
and storage policies.

### P1 — reduce legacy surface area

Search for duplicated or obsolete compatibility paths after the image work lands. In
particular, keep domain logic in `lib/domain/*`; do not reintroduce V3's React context,
legacy wardrobe tables, or mixed client/server persistence.

### P2 — tagging interaction

Use the V3 tap-to-tag interaction as a design reference for a future lookbook editor. The
first implementation should link garments through `lookbook_items`; positional coordinates
should be added only with a schema-backed, tested representation and clear coordinate rules.

### P2 — ingestion heuristics

Port the valuable receipt parsing cases into the current extractor test suite, especially:

- merchant/header noise removal;
- item code versus price disambiguation;
- line-item descriptions with a trailing amount;
- graceful low-confidence output.

### P3 — model research

Keep classifier and graph assets outside the production app until they have a versioned
service contract, measured precision/recall, licensing review, and a migration plan into
the canonical garment attributes.

## Evidence reviewed

- V3: `src/components/wardrobe/ImageUpload.jsx`, `src/pages/LookDetail.jsx`,
  `src/components/wardrobe/ItemPickerModal.jsx`, `src/services/receiptParser.js`,
  `src/services/outfitRecommendationService.js`, `src/services/trendService.js`,
  `docs/PIPELINE_AND_STORAGE.md`.
- V4: `src/app/api/wardrobe/upload/route.ts`, `src/services/receipt-parser.ts`,
  `src/services/comp-colours.ts`, `src/services/stylist.ts`,
  `src/services/wardrobe-ts`, `src/services/trend-bridge.ts`.
- Classifier: `README.md`, `knowledge_graph/*.csv`, model/training scripts.
- Trend search: `server/index.js`, `server/trendExtractor.js`, React search surfaces.
- Current app: `lib/domain/ingestion/*`, `lib/domain/wardrobe/image-analysis.ts`,
  `lib/domain/lookbook/*`, `lib/domain/outfits/*`, `lib/domain/wishlist/*`, photo-processing
  route, storage migrations, and canonical `PRD.md` / `schema.sql`.

