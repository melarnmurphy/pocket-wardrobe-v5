from __future__ import annotations

import io
import os
import socket
from urllib.parse import urlparse

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import httpx
import pytesseract

from pipeline.fashion_pipeline import get_pipeline

app = FastAPI(title="Pocket Wardrobe Fashion Vision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in os.environ.get("PIPELINE_ALLOWED_ORIGINS", "").split(",") if origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/capabilities")
async def capabilities() -> dict[str, object]:
    return {
        "image_analysis": True,
        "product_page_scrape": True,
        "receipt_ocr": True,
        "outfit_decomposition": True,
        "endpoints": ["/health", "/capabilities", "/analyse"],
    }


def assert_safe_remote_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Only web addresses can be read")
    if parsed.hostname == "localhost" or parsed.hostname.endswith(".localhost"):
        raise HTTPException(status_code=400, detail="Private addresses cannot be read")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="That address could not be reached") from exc
    for address in addresses:
        host = address[4][0]
        if host.startswith(("10.", "127.", "192.168.", "169.254.", "::1", "fc", "fd", "fe80")):
            raise HTTPException(status_code=400, detail="Private addresses cannot be read")
    return raw_url


@app.post("/scrape")
async def scrape_product_page(request: Request) -> dict[str, str]:
    body = await request.json()
    raw_url = body.get("url") if isinstance(body, dict) else None
    if not isinstance(raw_url, str) or len(raw_url) > 2048:
        raise HTTPException(status_code=400, detail="A valid product address is required")
    safe_url = assert_safe_remote_url(raw_url)
    async with httpx.AsyncClient(follow_redirects=False, timeout=10) as client:
        response = await client.get(safe_url, headers={"user-agent": "GarderobeBot/1.0"})
    if response.is_redirect:
        raise HTTPException(status_code=400, detail="That product page redirected unexpectedly")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="That product page could not be read")
    if len(response.content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="That product page is too large to read")
    return {"html": response.text}


@app.post("/receipt-ocr")
async def receipt_ocr(file: UploadFile = File(...)) -> dict[str, str]:
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Receipt OCR reads JPEG, PNG, and WEBP images")
    image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Receipt image is too large")
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("L")
        text = pytesseract.image_to_string(image).strip()
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Receipt image could not be read") from exc
    return {"text": text}


@app.get("/ready")
async def ready() -> dict[str, str]:
    try:
        get_pipeline()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The fashion model is still loading.") from exc
    return {"status": "ready"}


@app.post("/analyse")
async def analyse(request: Request, file: UploadFile = File(...), threshold: float = 0.5) -> dict[str, object]:
    if not file.content_type or file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="File must be an image")

    if threshold < 0 or threshold > 1:
        raise HTTPException(status_code=400, detail="threshold must be between 0 and 1")

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large")

    image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large")

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.verify()
        image = Image.open(io.BytesIO(image_bytes))
        width, height = image.size
        if width * height > MAX_IMAGE_PIXELS:
            raise HTTPException(status_code=413, detail="Image dimensions are too large")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Image could not be read") from exc

    pipeline = get_pipeline()
    garments = pipeline.process(image_bytes, threshold=threshold)

    return {
        "filename": file.filename,
        "garment_count": len(garments),
        "garments": garments,
    }
