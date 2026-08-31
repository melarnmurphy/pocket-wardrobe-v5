from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from pipeline.fashion_pipeline import get_pipeline

app = FastAPI(title="Pocket Wardrobe Fashion Vision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/capabilities")
async def capabilities() -> dict[str, object]:
    return {
        "image_analysis": True,
        "product_page_scrape": False,
        "receipt_ocr": False,
        "outfit_decomposition": True,
        "endpoints": ["/health", "/capabilities", "/analyse"],
    }


@app.post("/analyse")
async def analyse(file: UploadFile = File(...), threshold: float = 0.5) -> dict[str, object]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    if threshold < 0 or threshold > 1:
        raise HTTPException(status_code=400, detail="threshold must be between 0 and 1")

    image_bytes = await file.read()
    pipeline = get_pipeline()
    garments = pipeline.process(image_bytes, threshold=threshold)

    return {
        "filename": file.filename,
        "garment_count": len(garments),
        "garments": garments,
    }

