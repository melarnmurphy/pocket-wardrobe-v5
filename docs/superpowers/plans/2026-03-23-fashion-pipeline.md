# Fashion AI Vision Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the YOLOS + FashionSigLIP pipeline as a Python FastAPI service and wire it into the Next.js app so that uploading an outfit photo automatically creates garment drafts with colour/material/style attributes and 768-dim embeddings.

**Architecture:** A standalone Python FastAPI service (`pipeline/`) loads YOLOS-Fashionpedia for detection and Marqo-FashionSigLIP for attribute tagging and embeddings. The Next.js app calls it over HTTP via a new API route after an image upload; results are stored as `garment_drafts` rows for user review. A DB migration changes the embedding dimension from 1536 to 768 to match the model output.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, PyTorch, HuggingFace Transformers, Pillow, Pydantic; Next.js 15, TypeScript, Zod, Supabase (Postgres + Storage); Vitest for TS tests, pytest for Python tests.

**Spec:** `docs/superpowers/specs/2026-03-23-fashion-pipeline-design.md`

---

## File Map

### New files — Python service

| File | Responsibility |
|------|----------------|
| `pipeline/schema.py` | Pydantic request/response models for `/analyze` |
| `pipeline/models.py` | Model loading (lazy singletons) + YOLOS detection + SigLIP attribute tagging + embedding |
| `pipeline/main.py` | FastAPI app, `/health` + `/analyze` endpoints |
| `pipeline/requirements.txt` | Python dependencies |
| `pipeline/Dockerfile` | Container for the service |
| `pipeline/tests/test_models.py` | Unit tests for `classify_attribute` and `get_embedding` |
| `pipeline/tests/test_api.py` | Integration tests for `/analyze` endpoint |

### New files — Next.js

| File | Responsibility |
|------|----------------|
| `lib/domain/ingestion/index.ts` | Zod schemas: `PipelineGarmentResult`, `PipelineAnalyzeResponse`, `GarmentDraftRow` |
| `lib/domain/ingestion/service.ts` | `createDraftsFromPipelineResult()` — writes `garment_drafts` rows |
| `lib/domain/ingestion/client.ts` | `callPipelineService()` — HTTP call to Python service |
| `app/api/pipeline/analyze/route.ts` | `POST /api/pipeline/analyze` — auth, signed URL, call service, create drafts |

### Modified files — Next.js

| File | Change |
|------|--------|
| `lib/env.ts` | Add `PIPELINE_SERVICE_URL` to env schema |
| `.env.example` | Add `PIPELINE_SERVICE_URL=http://localhost:8000` |

### New files — DB

| File | Responsibility |
|------|----------------|
| `supabase/migrations/002_pipeline.sql` | Change `garments.embedding` from `vector(1536)` to `vector(768)` |

### New files — Tests (TypeScript)

| File | Responsibility |
|------|----------------|
| `lib/domain/ingestion/__tests__/service.test.ts` | Tests for `createDraftsFromPipelineResult` |
| `lib/domain/ingestion/__tests__/client.test.ts` | Tests for `callPipelineService` (mock HTTP) |

---

## Task 1: Python service — Pydantic schemas

**Files:**
- Create: `pipeline/schema.py`
- Create: `pipeline/tests/__init__.py`
- Create: `pipeline/tests/test_api.py` (empty stub)

- [ ] **Step 1: Create `pipeline/schema.py`**

```python
# pipeline/schema.py
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional


class AnalyzeRequest(BaseModel):
    image_url: str
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class GarmentResult(BaseModel):
    category: str
    confidence: float
    bbox: list[int]        # [x1, y1, x2, y2]
    colour: str
    material: str
    style: str
    tag: str
    embedding: list[float]  # 768 floats


class AnalyzeResponse(BaseModel):
    garments: list[GarmentResult]
```

- [ ] **Step 2: Create `pipeline/tests/__init__.py`** (empty file)

- [ ] **Step 3: Write failing schema test**

```python
# pipeline/tests/test_schema.py
from pipeline.schema import AnalyzeRequest, AnalyzeResponse, GarmentResult


def test_analyze_request_defaults():
    req = AnalyzeRequest(image_url="https://example.com/photo.jpg")
    assert req.threshold == 0.5


def test_analyze_request_custom_threshold():
    req = AnalyzeRequest(image_url="https://example.com/photo.jpg", threshold=0.7)
    assert req.threshold == 0.7


def test_garment_result_fields():
    g = GarmentResult(
        category="shirt/blouse",
        confidence=0.87,
        bbox=[10, 20, 100, 200],
        colour="navy",
        material="cotton",
        style="casual",
        tag="navy cotton shirt/blouse",
        embedding=[0.1] * 768,
    )
    assert len(g.embedding) == 768
    assert g.tag == "navy cotton shirt/blouse"


def test_analyze_response_empty():
    resp = AnalyzeResponse(garments=[])
    assert resp.garments == []
```

- [ ] **Step 4: Run test (expected: FAIL — module not found)**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
python -m pytest tests/test_schema.py -v
```

Expected: `ModuleNotFoundError: No module named 'pipeline'`

- [ ] **Step 5: Create `pipeline/__init__.py`** (empty file)

- [ ] **Step 6: Run test again**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
python -m pytest tests/test_schema.py -v
```

Expected: all 4 tests PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add pipeline/schema.py pipeline/__init__.py pipeline/tests/__init__.py pipeline/tests/test_schema.py
git commit -m "feat(pipeline): add Pydantic schemas for analyze API"
```

---

## Task 2: Python service — Model loading and inference

**Files:**
- Create: `pipeline/models.py`
- Create: `pipeline/tests/test_models.py`

**Note:** The first run downloads ~1.3GB of model weights. This only happens once; weights cache in `~/.cache/huggingface/`.

- [ ] **Step 1: Write failing model tests (using mocks so tests don't require GPU)**

```python
# pipeline/tests/test_models.py
from unittest.mock import patch, MagicMock
import torch
from PIL import Image
import io


def _make_dummy_image() -> Image.Image:
    """Create a tiny solid-colour image for testing."""
    img = Image.new("RGB", (64, 64), color=(100, 150, 200))
    return img


def test_classify_attribute_returns_label_from_list():
    """classify_attribute must return one of the provided labels."""
    from pipeline.models import classify_attribute

    labels = ["black", "white", "navy"]
    dummy_img = _make_dummy_image()

    # Mock the siglip model and processor so no GPU/weights needed
    with patch("pipeline.models._get_siglip") as mock_siglip:
        mock_model = MagicMock()
        mock_processor = MagicMock()

        # Processor returns a dict with pixel_values and input_ids
        mock_processor.return_value = {
            "pixel_values": torch.zeros(1, 3, 224, 224),
            "input_ids": torch.zeros(3, 64, dtype=torch.long),
        }

        # Model returns image features that, after softmax, pick index 1
        img_feat = torch.zeros(1, 768)
        txt_feat = torch.eye(768)[:3]  # 3 labels x 768
        # Force probs to pick label at index 1 ("white") by making img_feat = txt_feat[1]
        img_feat[0] = txt_feat[1]
        mock_model.get_image_features.return_value = img_feat
        mock_model.get_text_features.return_value = txt_feat

        mock_siglip.return_value = (mock_model, mock_processor)

        result = classify_attribute(dummy_img, labels)

    assert result in labels


def test_get_embedding_returns_768_floats():
    """get_embedding must return a list of 768 floats."""
    from pipeline.models import get_embedding

    dummy_img = _make_dummy_image()

    with patch("pipeline.models._get_siglip") as mock_siglip:
        mock_model = MagicMock()
        mock_processor = MagicMock()

        mock_processor.return_value = {
            "pixel_values": torch.zeros(1, 3, 224, 224),
        }
        mock_model.get_image_features.return_value = torch.zeros(1, 768)
        mock_siglip.return_value = (mock_model, mock_processor)

        result = get_embedding(dummy_img)

    assert isinstance(result, list)
    assert len(result) == 768
    assert all(isinstance(v, float) for v in result)
```

- [ ] **Step 2: Run test (expected: FAIL — `pipeline.models` not found)**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
python -m pytest tests/test_models.py -v
```

Expected: `ImportError: cannot import name 'classify_attribute' from 'pipeline.models'`

- [ ] **Step 3: Implement `pipeline/models.py`**

```python
# pipeline/models.py
"""
Model loading (lazy singletons) and inference functions.

YOLOS-Fashionpedia: garment detection → bounding boxes + categories
Marqo-FashionSigLIP: attribute classification + 768-dim embeddings
"""
from __future__ import annotations

import torch
from PIL import Image
from transformers import (
    YolosImageProcessor,
    YolosForObjectDetection,
    AutoModel,
    AutoProcessor,
)
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass

YOLOS_ID = "valentinafevu/yolos-fashionpedia"
SIGLIP_ID = "Marqo/marqo-fashionSigLIP"

COLOURS = ["black", "white", "navy", "grey", "red", "green", "beige", "brown", "pink", "yellow", "blue"]
MATERIALS = ["cotton", "wool", "silk", "linen", "polyester", "denim", "leather", "synthetic"]
STYLES = ["casual", "formal", "smart-casual", "sporty", "streetwear", "business"]

# Module-level lazy singletons
_yolos_processor: YolosImageProcessor | None = None
_yolos_model: YolosForObjectDetection | None = None
_siglip_model: AutoModel | None = None
_siglip_processor: AutoProcessor | None = None


def _get_yolos() -> tuple[YolosImageProcessor, YolosForObjectDetection]:
    global _yolos_processor, _yolos_model
    if _yolos_processor is None or _yolos_model is None:
        _yolos_processor = YolosImageProcessor.from_pretrained(YOLOS_ID)
        _yolos_model = YolosForObjectDetection.from_pretrained(YOLOS_ID)
        _yolos_model.eval()
    return _yolos_processor, _yolos_model


def _get_siglip() -> tuple[AutoModel, AutoProcessor]:
    global _siglip_model, _siglip_processor
    if _siglip_model is None or _siglip_processor is None:
        _siglip_model = AutoModel.from_pretrained(SIGLIP_ID, trust_remote_code=True)
        _siglip_processor = AutoProcessor.from_pretrained(SIGLIP_ID, trust_remote_code=True)
        _siglip_model.eval()
    return _siglip_model, _siglip_processor


def classify_attribute(image: Image.Image, labels: list[str]) -> str:
    """Zero-shot attribute classification via FashionSigLIP."""
    model, processor = _get_siglip()
    inputs = processor(
        text=labels,
        images=[image],
        padding="max_length",
        return_tensors="pt",
    )
    with torch.no_grad():
        img_f = model.get_image_features(inputs["pixel_values"], normalize=True)
        txt_f = model.get_text_features(inputs["input_ids"], normalize=True)
        probs = (100.0 * img_f @ txt_f.T).softmax(dim=-1)
    return labels[probs.argmax().item()]


def get_embedding(image: Image.Image) -> list[float]:
    """Generate a 768-dim embedding for a garment image via FashionSigLIP."""
    model, processor = _get_siglip()
    inputs = processor(images=[image], return_tensors="pt")
    with torch.no_grad():
        embedding = model.get_image_features(inputs["pixel_values"], normalize=True)
    return embedding.squeeze(0).tolist()


def detect_garments(
    image: Image.Image,
    threshold: float = 0.5,
) -> list[dict]:
    """
    Run YOLOS detection and return raw detections.

    Returns list of dicts with keys: category, confidence, bbox (x1,y1,x2,y2).
    """
    processor, model = _get_yolos()
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)

    target_sizes = torch.tensor([image.size[::-1]])
    results = processor.post_process_object_detection(
        outputs,
        threshold=threshold,
        target_sizes=target_sizes,
    )[0]

    detections = []
    for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
        x1, y1, x2, y2 = [int(v) for v in box.tolist()]
        detections.append({
            "category": model.config.id2label[label.item()],
            "confidence": round(score.item(), 3),
            "bbox": [x1, y1, x2, y2],
        })
    return detections
```

- [ ] **Step 4: Run model tests**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
python -m pytest tests/test_models.py -v
```

Expected: all 2 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add pipeline/models.py pipeline/tests/test_models.py
git commit -m "feat(pipeline): add YOLOS detection and FashionSigLIP inference functions"
```

---

## Task 3: Python service — FastAPI app

**Files:**
- Create: `pipeline/main.py`
- Create: `pipeline/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

```python
# pipeline/tests/test_api.py
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    from pipeline.main import app
    return TestClient(app)


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_analyze_returns_garments(client):
    """Analyze endpoint returns structured garment results."""
    mock_detection = {
        "category": "shirt/blouse",
        "confidence": 0.87,
        "bbox": [10, 20, 200, 300],
    }

    with (
        patch("pipeline.main.fetch_image") as mock_fetch,
        patch("pipeline.main.detect_garments", return_value=[mock_detection]) as _,
        patch("pipeline.main.classify_attribute", side_effect=["navy", "cotton", "casual"]) as _,
        patch("pipeline.main.get_embedding", return_value=[0.1] * 768) as _,
    ):
        mock_fetch.return_value = MagicMock()  # PIL Image mock

        resp = client.post("/analyze", json={"image_url": "https://example.com/photo.jpg"})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["garments"]) == 1
    g = data["garments"][0]
    assert g["category"] == "shirt/blouse"
    assert g["colour"] == "navy"
    assert g["material"] == "cotton"
    assert g["style"] == "casual"
    assert g["tag"] == "navy cotton shirt/blouse"
    assert len(g["embedding"]) == 768


def test_analyze_no_detections(client):
    """Returns empty list when YOLOS finds nothing."""
    with (
        patch("pipeline.main.fetch_image") as mock_fetch,
        patch("pipeline.main.detect_garments", return_value=[]),
    ):
        mock_fetch.return_value = MagicMock()
        resp = client.post("/analyze", json={"image_url": "https://example.com/photo.jpg"})

    assert resp.status_code == 200
    assert resp.json()["garments"] == []


def test_analyze_image_fetch_failure(client):
    """Returns 422 when image cannot be fetched."""
    with patch("pipeline.main.fetch_image", side_effect=ValueError("bad url")):
        resp = client.post("/analyze", json={"image_url": "https://example.com/photo.jpg"})

    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests (expected: FAIL — module not found)**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
python -m pytest tests/test_api.py -v
```

Expected: `ImportError: cannot import name 'app' from 'pipeline.main'`

- [ ] **Step 3: Implement `pipeline/main.py`**

```python
# pipeline/main.py
"""
Fashion AI Pipeline — FastAPI service.

Endpoints:
  GET  /health    liveness probe
  POST /analyze   detect garments in an image and return attributes + embeddings
"""
from __future__ import annotations

import io
import requests
from fastapi import FastAPI, HTTPException

from pipeline.schema import AnalyzeRequest, AnalyzeResponse, GarmentResult
from pipeline.models import (
    COLOURS, MATERIALS, STYLES,
    detect_garments,
    classify_attribute,
    get_embedding,
)
from PIL import Image

app = FastAPI(title="Fashion Pipeline", version="1.0.0")


def fetch_image(url: str) -> Image.Image:
    """Download image from URL and return as PIL Image (RGB)."""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Failed to fetch image: {exc}") from exc


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    try:
        image = fetch_image(request.image_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    detections = detect_garments(image, threshold=request.threshold)

    garments: list[GarmentResult] = []
    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        crop = image.crop((x1, y1, x2, y2))

        colour = classify_attribute(crop, COLOURS)
        material = classify_attribute(crop, MATERIALS)
        style = classify_attribute(crop, STYLES)
        embedding = get_embedding(crop)

        garments.append(
            GarmentResult(
                category=det["category"],
                confidence=det["confidence"],
                bbox=det["bbox"],
                colour=colour,
                material=material,
                style=style,
                tag=f"{colour} {material} {det['category']}",
                embedding=embedding,
            )
        )

    return AnalyzeResponse(garments=garments)
```

- [ ] **Step 4: Run API tests**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
python -m pytest tests/test_api.py -v
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add pipeline/main.py pipeline/tests/test_api.py
git commit -m "feat(pipeline): add FastAPI app with /health and /analyze endpoints"
```

---

## Task 4: Python service — requirements and Dockerfile

**Files:**
- Create: `pipeline/requirements.txt`
- Create: `pipeline/Dockerfile`
- Create: `pipeline/pytest.ini`

- [ ] **Step 1: Create `pipeline/requirements.txt`**

```
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
torch>=2.0
transformers>=4.40
Pillow>=10.0
requests>=2.31.0
pydantic>=2.0
```

- [ ] **Step 2: Create `pipeline/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system deps for Pillow and torch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "pipeline.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Create `pipeline/pytest.ini`**

```ini
[pytest]
testpaths = tests
```

- [ ] **Step 4: Verify tests still pass with explicit requirements installed**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
pip install -r requirements.txt
python -m pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add pipeline/requirements.txt pipeline/Dockerfile pipeline/pytest.ini
git commit -m "feat(pipeline): add requirements, Dockerfile, and pytest config"
```

---

## Task 5: DB migration — fix embedding dimension

**Files:**
- Create: `supabase/migrations/002_pipeline.sql`

**Context:** The garments table has `embedding vector(1536)` but FashionSigLIP outputs 768-dim vectors. No existing rows have embeddings (feature is new), so this is safe.

- [ ] **Step 1: Create `supabase/migrations/002_pipeline.sql`**

```sql
-- 002_pipeline.sql
-- Change garments.embedding from vector(1536) to vector(768)
-- to match Marqo-FashionSigLIP output dimensions.
-- Safe to run: no existing rows have embeddings yet.

begin;

alter table public.garments
  drop column if exists embedding;

alter table public.garments
  add column embedding vector(768);

-- Index for similarity search (cosine distance)
create index if not exists garments_embedding_idx
  on public.garments
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

commit;
```

- [ ] **Step 2: Apply migration locally**

```bash
# If using Supabase CLI:
cd /Users/melarnmurphy/play-projects/fashionapp5
supabase db push
# Or apply directly via psql if running local Postgres
```

- [ ] **Step 3: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add supabase/migrations/002_pipeline.sql
git commit -m "feat(db): change garments.embedding from vector(1536) to vector(768) for FashionSigLIP"
```

---

## Task 6: Next.js — env setup

**Files:**
- Modify: `lib/env.ts`
- Modify: `.env.example`

**Context:** `lib/env.ts` uses Zod to validate env vars. The pipeline service URL must be added here so all callers get a validated value.

- [ ] **Step 1: Read current `lib/env.ts`** (already read — see file map above)

- [ ] **Step 2: Update `lib/env.ts`**

Replace the current `envSchema` to add `PIPELINE_SERVICE_URL`:

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  PIPELINE_SERVICE_URL: z.string().url().default("http://localhost:8000")
});

export type AppEnv = z.infer<typeof envSchema>;

export function getPublicEnv(): AppEnv {
  // PIPELINE_SERVICE_URL intentionally omitted — server-only, defaults via envSchema
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}

export function getServerEnv(): AppEnv {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PIPELINE_SERVICE_URL: process.env.PIPELINE_SERVICE_URL
  });
}
```

- [ ] **Step 3: Update `.env.example`**

Read `.env.example` first, then append:
```
PIPELINE_SERVICE_URL=http://localhost:8000
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add lib/env.ts .env.example
git commit -m "feat(config): add PIPELINE_SERVICE_URL to env schema"
```

---

## Task 7: Next.js — ingestion domain schemas

**Files:**
- Create: `lib/domain/ingestion/index.ts`

- [ ] **Step 1: Set up Vitest** (skip if already configured)

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm install -D vitest @vitest/coverage-v8
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 2: Write failing schema tests**

```typescript
// lib/domain/ingestion/__tests__/index.test.ts
import { describe, it, expect } from "vitest";
import {
  pipelineGarmentResultSchema,
  pipelineAnalyzeResponseSchema,
} from "@/lib/domain/ingestion";

describe("pipelineGarmentResultSchema", () => {
  it("parses a valid garment result", () => {
    const raw = {
      category: "shirt/blouse",
      confidence: 0.87,
      bbox: [10, 20, 100, 200],
      colour: "navy",
      material: "cotton",
      style: "casual",
      tag: "navy cotton shirt/blouse",
      embedding: Array(768).fill(0.1),
    };
    const result = pipelineGarmentResultSchema.parse(raw);
    expect(result.category).toBe("shirt/blouse");
    expect(result.embedding).toHaveLength(768);
  });

  it("rejects if embedding is wrong length", () => {
    const raw = {
      category: "shirt/blouse",
      confidence: 0.87,
      bbox: [10, 20, 100, 200],
      colour: "navy",
      material: "cotton",
      style: "casual",
      tag: "navy cotton shirt/blouse",
      embedding: Array(512).fill(0.1),  // wrong length
    };
    expect(() => pipelineGarmentResultSchema.parse(raw)).toThrow();
  });
});

describe("pipelineAnalyzeResponseSchema", () => {
  it("parses empty garments list", () => {
    const result = pipelineAnalyzeResponseSchema.parse({ garments: [] });
    expect(result.garments).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests (expected: FAIL)**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test lib/domain/ingestion/__tests__/index.test.ts
```

Expected: `Cannot find module '@/lib/domain/ingestion'`

- [ ] **Step 4: Create `lib/domain/ingestion/index.ts`**

```typescript
// lib/domain/ingestion/index.ts
import { z } from "zod";

export const pipelineGarmentResultSchema = z.object({
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]),
  colour: z.string().min(1),
  material: z.string().min(1),
  style: z.string().min(1),
  tag: z.string().min(1),
  embedding: z.array(z.number()).length(768),
});

export const pipelineAnalyzeResponseSchema = z.object({
  garments: z.array(pipelineGarmentResultSchema),
});

export const garmentDraftPayloadSchema = z.object({
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]),
  colour: z.string().min(1),
  material: z.string().min(1),
  style: z.string().min(1),
  tag: z.string().min(1),
  embedding: z.array(z.number()).length(768),
  source_id: z.string().uuid(),
});

export type PipelineGarmentResult = z.infer<typeof pipelineGarmentResultSchema>;
export type PipelineAnalyzeResponse = z.infer<typeof pipelineAnalyzeResponseSchema>;
export type GarmentDraftPayload = z.infer<typeof garmentDraftPayloadSchema>;
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test lib/domain/ingestion/__tests__/index.test.ts
```

Expected: all 3 tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add lib/domain/ingestion/index.ts lib/domain/ingestion/__tests__/index.test.ts vitest.config.ts package.json
git commit -m "feat(ingestion): add pipeline result Zod schemas"
```

---

## Task 8: Next.js — pipeline HTTP client

**Files:**
- Create: `lib/domain/ingestion/client.ts`
- Create: `lib/domain/ingestion/__tests__/client.test.ts`

- [ ] **Step 1: Write failing client tests**

```typescript
// lib/domain/ingestion/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("callPipelineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the pipeline service and returns parsed response", async () => {
    const { callPipelineService } = await import("@/lib/domain/ingestion/client");

    const mockResponse = {
      garments: [
        {
          category: "shirt/blouse",
          confidence: 0.87,
          bbox: [10, 20, 100, 200],
          colour: "navy",
          material: "cotton",
          style: "casual",
          tag: "navy cotton shirt/blouse",
          embedding: Array(768).fill(0.1),
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await callPipelineService({
      serviceUrl: "http://localhost:8000",
      imageUrl: "https://example.com/photo.jpg",
      threshold: 0.5,
    });

    expect(result.garments).toHaveLength(1);
    expect(result.garments[0].colour).toBe("navy");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/analyze",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("throws if pipeline service returns non-ok", async () => {
    const { callPipelineService } = await import("@/lib/domain/ingestion/client");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    await expect(
      callPipelineService({
        serviceUrl: "http://localhost:8000",
        imageUrl: "https://example.com/photo.jpg",
      })
    ).rejects.toThrow("Pipeline service error: 503");
  });
});
```

- [ ] **Step 2: Run tests (expected: FAIL)**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test lib/domain/ingestion/__tests__/client.test.ts
```

Expected: `Cannot find module '@/lib/domain/ingestion/client'`

- [ ] **Step 3: Implement `lib/domain/ingestion/client.ts`**

```typescript
// lib/domain/ingestion/client.ts
import { pipelineAnalyzeResponseSchema, type PipelineAnalyzeResponse } from "./index";

export interface CallPipelineServiceParams {
  serviceUrl: string;
  imageUrl: string;
  threshold?: number;
}

export async function callPipelineService(
  params: CallPipelineServiceParams
): Promise<PipelineAnalyzeResponse> {
  const { serviceUrl, imageUrl, threshold = 0.5 } = params;

  const response = await fetch(`${serviceUrl}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, threshold }),
  });

  if (!response.ok) {
    throw new Error(`Pipeline service error: ${response.status}`);
  }

  const raw = await response.json();
  return pipelineAnalyzeResponseSchema.parse(raw);
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test lib/domain/ingestion/__tests__/client.test.ts
```

Expected: all 2 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add lib/domain/ingestion/client.ts lib/domain/ingestion/__tests__/client.test.ts
git commit -m "feat(ingestion): add pipeline HTTP client with validation"
```

---

## Task 9: Next.js — draft creation service

**Files:**
- Create: `lib/domain/ingestion/service.ts`
- Create: `lib/domain/ingestion/__tests__/service.test.ts`

**Context:** `garment_drafts` table has columns: `id`, `user_id`, `source_id`, `draft_payload_json`, `confidence`, `status`. One draft row is created per detected garment. The `source_id` references the `garment_sources` row created by `addGarmentImage`.

- [ ] **Step 1: Write failing service tests**

```typescript
// lib/domain/ingestion/__tests__/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineAnalyzeResponse } from "@/lib/domain/ingestion";

// Mock Supabase
const mockInsert = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert.mockReturnValue({ select: mockSelect, error: null }),
});
const mockSupabase = { from: mockFrom };

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-uuid-123" }),
}));

describe("createDraftsFromPipelineResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: "draft-uuid-1" }], error: null }),
    });
  });

  it("inserts one draft per detected garment", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );

    const pipelineResult: PipelineAnalyzeResponse = {
      garments: [
        {
          category: "shirt/blouse",
          confidence: 0.87,
          bbox: [10, 20, 100, 200],
          colour: "navy",
          material: "cotton",
          style: "casual",
          tag: "navy cotton shirt/blouse",
          embedding: Array(768).fill(0.1),
        },
        {
          category: "pants",
          confidence: 0.75,
          bbox: [10, 210, 100, 400],
          colour: "black",
          material: "denim",
          style: "casual",
          tag: "black denim pants",
          embedding: Array(768).fill(0.2),
        },
      ],
    };

    const draftIds = await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      result: pipelineResult,
    });

    expect(mockFrom).toHaveBeenCalledWith("garment_drafts");
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(draftIds).toHaveLength(2);
  });

  it("returns empty array when no garments detected", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );

    const draftIds = await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      result: { garments: [] },
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(draftIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests (expected: FAIL)**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test lib/domain/ingestion/__tests__/service.test.ts
```

Expected: `Cannot find module '@/lib/domain/ingestion/service'`

- [ ] **Step 3: Implement `lib/domain/ingestion/service.ts`**

```typescript
// lib/domain/ingestion/service.ts
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import type { PipelineAnalyzeResponse } from "./index";
import type { Database, TablesInsert } from "@/types/database";

type GarmentDraftInsert = TablesInsert<"garment_drafts">;

export interface CreateDraftsParams {
  sourceId: string;
  result: PipelineAnalyzeResponse;
}

export async function createDraftsFromPipelineResult(
  params: CreateDraftsParams
): Promise<string[]> {
  const { sourceId, result } = params;

  if (result.garments.length === 0) {
    return [];
  }

  const user = await getRequiredUser();
  const supabase = await createClient();
  const sourceUuid = z.string().uuid().parse(sourceId);

  const draftIds: string[] = [];

  for (const garment of result.garments) {
    const payload: GarmentDraftInsert = {
      user_id: user.id,
      source_id: sourceUuid,
      draft_payload_json: {
        category: garment.category,
        confidence: garment.confidence,
        bbox: garment.bbox,
        colour: garment.colour,
        material: garment.material,
        style: garment.style,
        tag: garment.tag,
        embedding: garment.embedding,
      },
      confidence: garment.confidence,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("garment_drafts")
      .insert(payload as never)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }

    const parsed = z.object({ id: z.string().uuid() }).parse(data);
    draftIds.push(parsed.id);
  }

  return draftIds;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test lib/domain/ingestion/__tests__/service.test.ts
```

Expected: all 2 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add lib/domain/ingestion/service.ts lib/domain/ingestion/__tests__/service.test.ts
git commit -m "feat(ingestion): add createDraftsFromPipelineResult service"
```

---

## Task 10: Next.js — API route

**Files:**
- Create: `app/api/pipeline/analyze/route.ts`

**Context:** This is a Next.js Route Handler (not a Server Action). It authenticates the user, verifies the `garment_source` belongs to them, generates a signed URL for the stored image, calls the Python service, and creates drafts.

- [ ] **Step 1: Implement `app/api/pipeline/analyze/route.ts`**

```typescript
// app/api/pipeline/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequiredUser, AuthenticationError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import { createDraftsFromPipelineResult } from "@/lib/domain/ingestion/service";

const requestSchema = z.object({
  sourceId: z.string().uuid(),
  threshold: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getRequiredUser();
    const supabase = await createClient();

    const body = await request.json();
    const { sourceId, threshold } = requestSchema.parse(body);

    // Verify source belongs to user
    const { data: source, error: sourceError } = await supabase
      .from("garment_sources")
      .select("id, storage_path")
      .eq("id", sourceId)
      .eq("user_id", user.id)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: "Source not found." }, { status: 404 });
    }

    if (!source.storage_path) {
      return NextResponse.json(
        { error: "Source has no stored image." },
        { status: 422 }
      );
    }

    // Generate a signed URL (valid 5 minutes — enough for pipeline processing)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("garment-originals")
      .createSignedUrl(source.storage_path, 5 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate image URL." },
        { status: 500 }
      );
    }

    const env = getServerEnv();

    // Call Python pipeline service
    const pipelineResult = await callPipelineService({
      serviceUrl: env.PIPELINE_SERVICE_URL,
      imageUrl: signedUrlData.signedUrl,
      threshold,
    });

    // Persist drafts
    const draftIds = await createDraftsFromPipelineResult({
      sourceId,
      result: pipelineResult,
    });

    return NextResponse.json({
      draftIds,
      garmentCount: pipelineResult.garments.length,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add app/api/pipeline/analyze/route.ts
git commit -m "feat(api): add POST /api/pipeline/analyze route"
```

---

## Task 11: Next.js — wardrobe Server Action for pipeline

**Files:**
- Modify: `app/wardrobe/actions.ts`

**Context:** The API route handles the HTTP call, but the wardrobe page uses Server Actions for form submissions. Adding `analyzePipelineAction` here gives the UI a direct entry point after an image upload, consistent with the existing action pattern (`createGarmentAction`, `logWearAction`, etc.).

- [ ] **Step 1: Write failing action test**

```typescript
// app/wardrobe/__tests__/actions.test.ts
import { describe, it, expect, vi } from "vitest";

// We test that the action calls the correct API route and returns draft IDs.
// The API route and service layer are tested separately.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("analyzePipelineAction", () => {
  it("returns draftIds on success", async () => {
    const { analyzePipelineAction } = await import("@/app/wardrobe/actions");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draftIds: ["draft-1", "draft-2"], garmentCount: 2 }),
    });

    const formData = new FormData();
    formData.set("source_id", "source-uuid-abc");

    const result = await analyzePipelineAction({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(result.draftIds).toEqual(["draft-1", "draft-2"]);
  });

  it("returns error if source_id missing", async () => {
    const { analyzePipelineAction } = await import("@/app/wardrobe/actions");

    const result = await analyzePipelineAction({ status: "idle" }, new FormData());

    expect(result.status).toBe("error");
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test app/wardrobe/__tests__/actions.test.ts
```

Expected: `analyzePipelineAction is not a function`

- [ ] **Step 3: Add `analyzePipelineAction` to `app/wardrobe/actions.ts`**

Read `app/wardrobe/actions.ts` first, then append at the bottom:

```typescript
const analyzePipelineFormSchema = z.object({
  source_id: z.string().uuid()
});

export async function analyzePipelineAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = analyzePipelineFormSchema.parse({
      source_id: formData.get("source_id")
    });

    const response = await fetch("/api/pipeline/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: values.source_id })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Pipeline error: ${response.status}`);
    }

    const { draftIds, garmentCount } = await response.json();

    revalidatePath("/wardrobe");

    return {
      status: "success",
      message:
        garmentCount === 0
          ? "No garments detected in photo."
          : `${garmentCount} garment${garmentCount === 1 ? "" : "s"} detected. Review drafts to add them.`,
      draftIds
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Pipeline analysis failed."
    };
  }
}
```

**Note:** Also update `WardrobeActionState` in `lib/domain/wardrobe/action-state.ts` to include `draftIds?: string[]` if it is not already there.

- [ ] **Step 4: Check `lib/domain/wardrobe/action-state.ts` and add `draftIds` if missing**

Read the file. If `draftIds` is absent, add it:

```typescript
export type WardrobeActionState =
  | { status: "idle" }
  | { status: "success"; message: string; garmentId?: string; draftIds?: string[] }
  | { status: "partial"; garmentId: string; message: string }
  | { status: "error"; message: string };
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test app/wardrobe/__tests__/actions.test.ts
```

Expected: all 2 tests PASS

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm run typecheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add app/wardrobe/actions.ts lib/domain/wardrobe/action-state.ts app/wardrobe/__tests__/actions.test.ts
git commit -m "feat(wardrobe): add analyzePipelineAction Server Action"
```

---

## Task 12: Run all tests and verify

- [ ] **Step 1: Run all TypeScript tests**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test
```

Expected: all tests PASS

- [ ] **Step 2: Run all Python tests**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
python -m pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit (if any fixes were made)**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
git add -p
git commit -m "fix: resolve any issues from full test run"
```

---

## Task 13: Smoke test end-to-end (manual)

**Goal:** Start the pipeline service locally, upload an image, and verify drafts are created.

- [ ] **Step 1: Install Python dependencies and start pipeline service**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5/pipeline
pip install -r requirements.txt
uvicorn pipeline.main:app --reload --port 8000
```

Note: First start downloads ~1.3GB of model weights. Subsequent starts are fast (< 5s).

- [ ] **Step 2: Verify health endpoint**

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Start Next.js dev server**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
PIPELINE_SERVICE_URL=http://localhost:8000 npm run dev
```

- [ ] **Step 4: Upload an outfit photo via the existing wardrobe UI, then find the source ID**

```bash
# Get the most recent garment_source ID (run against your local Supabase or via Supabase dashboard SQL editor):
SELECT id, source_type, storage_path, created_at
FROM garment_sources
ORDER BY created_at DESC
LIMIT 1;
```

Copy the `id` value for use in the next step.

- [ ] **Step 5: Call the analyze endpoint**

```bash
# Replace <garment-source-id> and <your-session-cookie>:
curl -X POST http://localhost:3000/api/pipeline/analyze \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookie>" \
  -d '{"sourceId": "<garment-source-id>"}'
```

Expected:
```json
{
  "draftIds": ["<uuid>", "<uuid>"],
  "garmentCount": 2
}
```

- [ ] **Step 6: Check Supabase dashboard**

Verify `garment_drafts` table contains rows with `draft_payload_json` that has `category`, `colour`, `material`, `style`, `tag`, and `embedding` (768-element array).

---

## Notes for future work

- **Draft review UI:** The `garment_drafts` rows are created but no UI exists to review and confirm them yet. The next sprint should add a `/wardrobe/review` page that lists pending drafts.
- **Embed garments:** After a draft is confirmed, copy the `embedding` from `draft_payload_json` into `garments.embedding` for similarity search.
- **Similarity search:** With embeddings in `garments.embedding`, add `match_garments()` RPC using `<=>` cosine distance operator.
- **Outfit decomposition flow:** The `garment_source.source_type = 'outfit_decomposition'` flag can trigger the pipeline automatically when an image is uploaded, vs `direct_upload` which triggers it optionally.
- **Production deployment:** Replace `localhost:8000` with a deployed service URL. Docker Compose is already included for self-hosting.
