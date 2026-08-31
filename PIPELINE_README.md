# Fashion Vision Pipeline

Self-hosted FastAPI service for garment detection, colour/material/style labels, and 768-dim image embeddings.

**Models:**
- [YOLOS-Fashionpedia](https://huggingface.co/valentinafevu/yolos-fashionpedia) for bounding-box garment detection.
- [Marqo-FashionSigLIP](https://huggingface.co/Marqo/marqo-fashionSigLIP) for zero-shot attribute labels and embeddings.

The Next.js app talks to this service through `PIPELINE_SERVICE_URL`. The default is `http://localhost:8000`.

## Run Locally

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn pipeline.server:app --host 0.0.0.0 --port 8000
```

First analysis downloads model weights into `~/.cache/pocket-wardrobe/models` unless `FASHION_PIPELINE_CACHE_DIR` is set.

Apple Silicon uses MPS when PyTorch exposes it. Linux GPU hosts use CUDA when available. Otherwise the service falls back to CPU, which is much slower but free.

## Run With Docker

```bash
docker compose -f docker-compose.pipeline.yml up --build
```

Then set:

```bash
PIPELINE_SERVICE_URL=http://localhost:8000
```

## API

### `GET /health`

```bash
curl http://localhost:8000/health
```

```json
{"status":"ok"}
```

### `GET /capabilities`

```bash
curl http://localhost:8000/capabilities
```

```json
{
  "image_analysis": true,
  "product_page_scrape": false,
  "receipt_ocr": false,
  "outfit_decomposition": true,
  "endpoints": ["/health", "/capabilities", "/analyse"]
}
```

### `POST /analyse`

```bash
curl -X POST \
  "http://localhost:8000/analyse?threshold=0.5" \
  -F "file=@outfit.jpg"
```

Response:

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
      "embedding": [0.0412, -0.0183, 0.0291]
    }
  ]
}
```

## Cost Notes

Modal is no longer required for the default pipeline. The legacy `modal_fashion_app.py` file is kept only for reference while you migrate or delete the deployed Modal app.

To stop new Modal calls from the web app, make sure `PIPELINE_SERVICE_URL` is not set to a `modal.run` URL in `.env.local`, Vercel, or any other deployment environment.
