# Fashion Vision Pipeline

Detects garments in a photo, classifies colour / material / style via zero-shot inference, and returns 768-dim embeddings for similarity search.

**Models:**
- [YOLOS-Fashionpedia](https://huggingface.co/valentinafevu/yolos-fashionpedia) — bounding-box detection across 46 garment categories
- [Marqo-FashionSigLIP](https://huggingface.co/Marqo/marqo-fashionSigLIP) — zero-shot attribute tagging + 768-dim embeddings

**Deployment:** [Modal](https://modal.com) — serverless GPU containers with a persistent model-weight cache volume.

---

## Prerequisites

- Python 3.11+
- A [Modal](https://modal.com) account (free tier is sufficient for development)

---

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Authenticate with Modal (one-time)
modal setup
```

---

## Local MPS dev (Apple Silicon)

Run the pipeline locally using MPS without sending anything to Modal's cloud:

```bash
modal run modal_fashion_app.py --image-path test.jpg
```

First run downloads ~1.3 GB of model weights into `~/.cache/huggingface/`. Subsequent runs use the cache and start in seconds.

To test with a custom threshold:

```bash
modal run modal_fashion_app.py --image-path outfit.jpg --threshold 0.4
```

**Expected output:**

```
Using device: mps
Loading YOLOS-Fashionpedia...
Loading Marqo-FashionSigLIP...
Models ready.

Found 3 garments:

  navy cotton shirt/blouse  (style: casual, conf: 0.872)  bbox: [45, 30, 310, 280]  embedding[:4]: [0.0412, -0.0183, 0.0291, 0.0654]...
  black denim pants  (style: casual, conf: 0.841)  bbox: [60, 285, 295, 620]  embedding[:4]: [-0.0217, 0.0389, -0.0142, 0.0521]...
  white cotton shoe  (style: casual, conf: 0.763)  bbox: [70, 625, 230, 740]  embedding[:4]: [0.0318, -0.0091, 0.0473, -0.0207]...
```

---

## Deploy to Modal

```bash
# Deploy the ASGI web endpoint as a persistent Modal app
modal deploy modal_fashion_app.py
```

Modal prints the deployment URL when it finishes, e.g.:
```
✓ Created app fashion-pipeline
  https://<your-workspace>--fashion-pipeline-api.modal.run
```

---

## API reference

### `GET /health`

Liveness probe.

```bash
curl https://<your-workspace>--fashion-pipeline-api.modal.run/health
```

```json
{"status": "ok"}
```

---

### `POST /analyse`

Detect garments in an uploaded image.

**Parameters:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `file` | file (multipart) | required | Image file (JPEG, PNG, WEBP) |
| `threshold` | float (query) | `0.5` | YOLOS confidence threshold (0–1). Lower = more detections. |

**Example:**

```bash
curl -X POST \
  "https://<your-workspace>--fashion-pipeline-api.modal.run/analyse?threshold=0.5" \
  -F "file=@outfit.jpg"
```

**Response:**

```json
{
  "filename": "outfit.jpg",
  "garment_count": 2,
  "garments": [
    {
      "category": "shirt/blouse",
      "confidence": 0.872,
      "bbox": [45, 30, 310, 280],
      "colour": "navy",
      "colour_conf": 0.841,
      "material": "cotton",
      "material_conf": 0.612,
      "style": "casual",
      "style_conf": 0.734,
      "tag": "navy cotton shirt/blouse",
      "embedding": [0.0412, -0.0183, 0.0291, "...768 floats total"]
    }
  ]
}
```

**Local test (after `modal serve modal_fashion_app.py`):**

```bash
curl -X POST \
  "http://localhost:8000/analyse" \
  -F "file=@test.jpg"
```

---

## Architecture

```
POST /analyse
     │
     ▼
api() [Modal ASGI function, no GPU]
  → reads file bytes
  → calls FashionPipeline.process.remote()
     │
     ▼
FashionPipeline [Modal class, T4 GPU, model-weight volume]
  1. YOLOS-Fashionpedia → bounding boxes + categories
  2. Per garment crop:
     a. FashionSigLIP → colour / material / style (zero-shot)
     b. FashionSigLIP → 768-dim embedding
  3. Returns list of garment dicts
```

Model weights are cached in a Modal persistent volume (`fashion-model-cache`) — downloaded once, reused on every cold start.

---

## Tuning

| Parameter | Where | Effect |
|-----------|-------|--------|
| `threshold` | API query param | Lower → more garment detections (more false positives) |
| `gpu="T4"` | `@app.cls` in `modal_fashion_app.py` | Swap to `"A10G"` for ~2× faster inference |
| `container_idle_timeout=120` | `@app.cls` | Seconds the GPU container stays warm between requests |
| `COLOURS` / `MATERIALS` / `STYLES` | top of `modal_fashion_app.py` | Extend label sets for finer-grained classification |

---

## Extension points

- **Segmentation:** Replace or augment YOLOS with `mattmdjaga/segformer_b2_clothes` for pixel masks instead of bounding boxes.
- **Vector store:** Store `embedding` fields in pgvector, Pinecone, or Qdrant for similarity search across a user's wardrobe.
- **Wardrobe integration:** Pass `garment_source_id` alongside the image; write results to `garment_drafts` for user review.
