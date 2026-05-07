---
title: Fashion AI Vision Pipeline — Design Spec
date: 2026-03-23
status: approved
---

# Fashion AI Vision Pipeline

> **Status note, reconciled 2026-05-07:** The implemented service path is Modal-based: `modal_fashion_app.py` exposes `POST /analyse`, and the web app calls it through `PIPELINE_SERVICE_URL`. The `pipeline/` package and `/analyze` spelling below are historical design details unless that local service is explicitly revived.

## Overview

Implement the two-stage AI pipeline described in `FASHION_PIPELINE.md` and integrate it with the existing Next.js + Supabase wardrobe app. The pipeline detects garments in uploaded photos, classifies their attributes (colour, material, style), and generates semantic embeddings for similarity search. Results flow into the existing garment draft review system.

## Context

The existing app has:
- `addGarmentImage` in `lib/domain/wardrobe/service.ts` — stores images to `garment-originals` bucket but runs no AI
- `garment_drafts` table — intended for low-confidence ingestion awaiting user review
- `garment_sources` table — tracks ingestion provenance
- `embedding vector(1536)` on garments — **must be changed to `vector(768)`** to match FashionSigLIP output
- `extraction_metadata_json` on garments — stores attribute metadata

## Architecture

### Problem

The FASHION_PIPELINE.md pipeline uses PyTorch models (YOLOS ~500MB, FashionSigLIP ~800MB). These cannot run in:
- Next.js Server Actions (no PyTorch)
- Supabase Edge Functions (Deno runtime, no native PyTorch)

### Solution

A standalone Python FastAPI service (`pipeline/`) runs the models. The Next.js app calls it over HTTP after an image upload. This matches the pipeline spec directly with no model adaptations needed.

### Data flow

```
User uploads photo
      │
      ▼
addGarmentImage (existing)
  → stores image to garment-originals bucket
  → creates garment_source record
      │
      ▼
POST /api/pipeline/analyze (new Next.js route)
  → fetches signed URL for the uploaded image
  → calls Python service at PIPELINE_SERVICE_URL
      │
      ▼
Python FastAPI service (pipeline/)
  → downloads image from signed URL
  → YOLOS detection → bounding boxes + category labels
  → per garment: crop → FashionSigLIP attribute tagging + embedding
  → returns structured garment candidates
      │
      ▼
createDraftsFromPipelineResult (new service fn)
  → creates garment_draft rows for each detected garment
  → attaches source ID and pipeline metadata
      │
      ▼
User reviews drafts
  → confirms or edits each draft
  → draft promoted to garment record with embedding stored
```

## Components

### 1. Python service (`pipeline/`)

**Files:**
- `main.py` — FastAPI app with `POST /analyze` endpoint
- `models.py` — model loading (lazy, singleton), YOLOS detection, FashionSigLIP tagging + embedding
- `schema.py` — Pydantic request/response models
- `requirements.txt`
- `Dockerfile`

**API contract:**

`POST /analyze`
```json
Request:
{
  "image_url": "https://...",
  "threshold": 0.5
}

Response:
{
  "garments": [
    {
      "category": "shirt/blouse",
      "confidence": 0.87,
      "bbox": [x1, y1, x2, y2],
      "colour": "navy",
      "material": "cotton",
      "style": "casual",
      "tag": "navy cotton shirt/blouse",
      "embedding": [0.12, -0.03, ...]
    }
  ]
}
```

**Model loading:** Models load once at startup (lazy singleton). Cold start is ~15s on CPU; warm inference is ~2s per garment.

**Attribute label sets** (from FASHION_PIPELINE.md):
- Colours: black, white, navy, grey, red, green, beige, brown, pink, yellow, blue
- Materials: cotton, wool, silk, linen, polyester, denim, leather, synthetic
- Styles: casual, formal, smart-casual, sporty, streetwear, business

### 2. Database migration (`supabase/migrations/002_pipeline.sql`)

Changes:
- Drop `embedding vector(1536)` column on `garments`, add `embedding vector(768)` — FashionSigLIP outputs 768-dim
- Ensure `garment_drafts` table has `draft_payload_json` to store pipeline result per garment candidate

### 3. Next.js API route (`app/api/pipeline/analyze/route.ts`)

`POST /api/pipeline/analyze`

Request body: `{ sourceId: string }`

Steps:
1. Authenticate user (getRequiredUser)
2. Look up `garment_source` row by sourceId — verify ownership
3. Create signed URL for the storage path
4. Call Python service with the signed URL
5. Call `createDraftsFromPipelineResult` with the results
6. Return draft IDs

### 4. Ingestion domain module (`lib/domain/ingestion/`)

**`index.ts`** — Zod schemas:
- `PipelineGarmentResult` — single detected garment from pipeline response
- `PipelineAnalyzeResponse` — full pipeline response
- `CreateDraftInput` — input to draft creation

**`service.ts`** — `createDraftsFromPipelineResult(sourceId, userId, results)`
- Creates one `garment_draft` row per detected garment
- Stores `draft_payload_json` with: category, colour, material, style, bbox, confidence, tag, embedding

### 5. Wardrobe action integration

Update `app/wardrobe/actions.ts` to add `analyzePipelineAction`:
- Accepts `sourceId`
- Calls `POST /api/pipeline/analyze`
- Returns draft IDs for UI navigation

## Error handling

- Pipeline service unavailable → return `503` with clear message; image is already stored safely
- YOLOS detects 0 garments → return empty array; caller shows "no garments detected" message
- FashionSigLIP fails on a crop → skip that garment's attributes, include without tags
- Signed URL expiry → generate fresh URL at analysis time (not at upload time)

## Testing

- Unit tests for `createDraftsFromPipelineResult` with fixture pipeline responses
- Python service: test `classify_attribute` with known images and expected label sets
- Integration: upload a test outfit photo and verify correct number of drafts created

## Configuration

Environment variables:
- `PIPELINE_SERVICE_URL` — URL of the Python service (default: `http://localhost:8000`)

## Embedding dimension note

The existing schema uses `vector(1536)` (OpenAI text-embedding dimensions). FashionSigLIP outputs `vector(768)`. The migration changes this. Any existing garment rows with embeddings will need reprocessing — acceptable since the pipeline is new and no embeddings exist yet.

## Out of scope

- Segmentation (mattmdjaga/segformer) — noted as extension point in spec, not MVP
- Vector similarity search UI — embeddings are stored; search is a separate feature
- Pinecone/Qdrant — FAISS or pgvector can be added later; embedding storage is the priority
- Cutout image generation — crops used for inference only, not stored as `garment-cutouts`
