from __future__ import annotations

from typing import Any

import trafilatura
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


app = FastAPI(title="Pocket Wardrobe Trafilatura Extractor")


class ExtractRequest(BaseModel):
    url: str
    max_chars: int = Field(default=5000, ge=500, le=20000)


class ExtractResponse(BaseModel):
    text: str
    title: str | None = None
    author: str | None = None
    publishedDate: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/extract", response_model=ExtractResponse)
def extract(request: ExtractRequest) -> ExtractResponse:
    downloaded = trafilatura.fetch_url(request.url)
    if not downloaded:
        raise HTTPException(status_code=422, detail="Unable to fetch URL")

    metadata = trafilatura.extract_metadata(downloaded)
    text = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=False,
        output_format="txt",
        favor_precision=True,
    )
    if not text:
        raise HTTPException(status_code=422, detail="Unable to extract text")

    normalized = " ".join(text.split())[: request.max_chars]
    return ExtractResponse(
        text=normalized,
        title=getattr(metadata, "title", None),
        author=getattr(metadata, "author", None),
        publishedDate=getattr(metadata, "date", None),
        metadata={
            "sitename": getattr(metadata, "sitename", None),
            "description": getattr(metadata, "description", None),
            "categories": getattr(metadata, "categories", None),
            "tags": getattr(metadata, "tags", None),
        },
    )
