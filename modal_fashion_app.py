import modal
from pathlib import Path

# --- Modal app definition ---
# App name is parameterised so dev eval deploys use `fashion-pipeline-dev`
# (FASHION_APP_NAME=fashion-pipeline-dev) and never touch the prod app.
# Defaults to the prod name for the eventual human-gated promotion.
import os as _os
app = modal.App(_os.environ.get("FASHION_APP_NAME", "fashion-pipeline"))

# Heavy ML image — used by the GPU inference class only
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "torchvision",
        "transformers>=4.40,<5.0",
        "Pillow",
        "faiss-cpu",
        "fastapi",
        "python-multipart",
        "ftfy",
        "open_clip_torch",
    )
    # Make the pure post-processing helpers importable inside the GPU container.
    .add_local_python_source("pipeline_lib")
)

# Lightweight API image — used by the FastAPI wrapper (no GPU, adds Playwright)
api_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi",
        "python-multipart",
        "playwright",
    )
    .run_commands("playwright install chromium --with-deps")
)

# Model IDs
YOLOS_ID = "valentinafevu/yolos-fashionpedia"
SIGLIP_ID = "Marqo/marqo-fashionSigLIP"

# Persistent volume to cache downloaded model weights
# (avoids re-downloading on every cold start)
model_cache = modal.Volume.from_name("fashion-model-cache", create_if_missing=True)
CACHE_DIR = "/model-cache"

# --- Attribute label sets ---
COLOURS   = ["black", "white", "navy", "grey", "red", "green", "beige", "brown", "pink", "yellow", "blue"]
MATERIALS = ["cotton", "wool", "silk", "linen", "polyester", "denim", "leather", "synthetic"]
STYLES    = ["casual", "formal", "smart-casual", "sporty", "streetwear", "business"]


@app.cls(
    image=image,
    gpu="T4",                        # swap to "A10G" for faster inference
    volumes={CACHE_DIR: model_cache},
    scaledown_window=120,            # keep warm for 2 min between requests
    timeout=60,
)
class FashionPipeline:

    @modal.enter()
    def load_models(self):
        """Runs once when the container starts. Models are cached on the volume."""
        import os
        import torch
        from transformers import (
            YolosImageProcessor,
            YolosForObjectDetection,
            AutoModel,
            AutoProcessor,
        )

        os.environ["TRANSFORMERS_CACHE"] = CACHE_DIR
        os.environ["HF_HOME"] = CACHE_DIR

        if torch.cuda.is_available():
            self.device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"
        print(f"Using device: {self.device}")

        print("Loading YOLOS-Fashionpedia...")
        self.yolos_processor = YolosImageProcessor.from_pretrained(YOLOS_ID, cache_dir=CACHE_DIR)
        self.yolos_model = YolosForObjectDetection.from_pretrained(YOLOS_ID, cache_dir=CACHE_DIR).to(self.device)
        self.yolos_model.eval()

        print("Loading Marqo-FashionSigLIP...")
        # open_clip creates its internal model under transformers' init_empty_weights()
        # context, so the model lands on 'meta'. Patching _set_model_device_and_precision
        # to call to_empty('cpu') instead of model.to(device) avoids the meta-copy error.
        import open_clip.factory as _ocf
        _orig_set_dev = _ocf._set_model_device_and_precision

        def _meta_safe_set_device(model, device, precision, is_timm_model):
            params = list(model.parameters())
            if params and params[0].device.type == "meta":
                model.to_empty(device="cpu")
            else:
                _orig_set_dev(model, device, precision, is_timm_model)

        _ocf._set_model_device_and_precision = _meta_safe_set_device
        try:
            _siglip = AutoModel.from_pretrained(
                SIGLIP_ID,
                trust_remote_code=True,
                cache_dir=CACHE_DIR,
                low_cpu_mem_usage=False,
            )
        finally:
            _ocf._set_model_device_and_precision = _orig_set_dev

        self.siglip_model = _siglip.to(self.device)
        self.siglip_processor = AutoProcessor.from_pretrained(SIGLIP_ID, trust_remote_code=True, cache_dir=CACHE_DIR)
        self.siglip_model.eval()

        print("Models ready.")
        model_cache.commit()

    def _classify_attribute(self, crop, labels: list[str], floor: float = 0.45) -> tuple[str, float]:
        import torch
        from pipeline_lib import apply_confidence_floor
        prompts = [f"a photo of {label} clothing" for label in labels]
        inputs = self.siglip_processor(
            text=prompts, images=[crop], padding="max_length", return_tensors="pt"
        ).to(self.device)
        with torch.no_grad():
            img_f = self.siglip_model.get_image_features(inputs["pixel_values"], normalize=True)
            txt_f = self.siglip_model.get_text_features(inputs["input_ids"], normalize=True)
            probs = (100.0 * img_f @ txt_f.T).softmax(dim=-1).squeeze(0)
        best_idx = probs.argmax().item()
        label, score = apply_confidence_floor(labels[best_idx], round(probs[best_idx].item(), 3), floor)
        return label, score

    def _detect(self, image, threshold: float):
        import torch
        from pipeline_lib import clamp_box
        inputs = self.yolos_processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.yolos_model(**inputs)
        target_sizes = torch.tensor([image.size[::-1]]).to(self.device)
        results = self.yolos_processor.post_process_object_detection(
            outputs, threshold=threshold, target_sizes=target_sizes
        )[0]
        dets = []
        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            bbox = clamp_box([int(v) for v in box.tolist()], image.size[0], image.size[1])
            dets.append({
                "category": self.yolos_model.config.id2label[label.item()],
                "confidence": round(score.item(), 3),
                "bbox": bbox,
            })
        return dets

    @modal.method()
    def process(self, image_bytes: bytes, threshold: float = 0.5) -> list[dict]:
        import io
        import torch
        from PIL import Image, ImageOps
        from pipeline_lib import (
            nms_per_class, filter_parts, drop_low_confidence_accessories,
            cap_instances_per_class, union_box, should_crop, pad_box,
            map_box_to_original, build_tag,
        )

        image = ImageOps.exif_transpose(Image.open(io.BytesIO(image_bytes))).convert("RGB")
        width, height = image.size

        # Stage 1: initial detection
        dets = self._detect(image, threshold)

        # Stage 2: person-crop ROI — if subject is small, crop+upscale and re-detect once
        if dets:
            union = union_box([d["bbox"] for d in dets])
            if should_crop(union, width, height):
                padded = pad_box(union, width, height)
                crop = image.crop(tuple(padded))
                scale = 2.0
                upscaled = crop.resize((int(crop.size[0] * scale), int(crop.size[1] * scale)))
                recropped = self._detect(upscaled, threshold)
                if recropped:
                    for d in recropped:
                        d["bbox"] = map_box_to_original(d["bbox"], (padded[0], padded[1]), scale)
                    dets = recropped

        # Stage 3: de-duplicate, drop accessory phantoms, part labels, cap per-class counts
        dets = cap_instances_per_class(
            filter_parts(
                drop_low_confidence_accessories(nms_per_class(dets, iou_threshold=0.55))
            )
        )

        # Stage 4: attributes per surviving detection
        # NOTE: a SigLIP category-reconcile experiment (reconcile_category in
        # pipeline_lib) was trialled here but did NOT beat baseline — both models
        # share the same dress/skirt confusion — so it is intentionally not wired.
        # Category accuracy is the post-pitch fine-tuning task.
        garments = []
        for det in dets:
            x1, y1, x2, y2 = det["bbox"]
            crop = image.crop((x1, y1, x2, y2))
            category = det["category"]
            colour, colour_conf = self._classify_attribute(crop, COLOURS)
            material, material_conf = self._classify_attribute(crop, MATERIALS)
            style, style_conf = self._classify_attribute(crop, STYLES)
            emb_inputs = self.siglip_processor(images=[crop], return_tensors="pt").to(self.device)
            with torch.no_grad():
                embedding = self.siglip_model.get_image_features(
                    emb_inputs["pixel_values"], normalize=True
                ).squeeze(0).cpu().tolist()
            garments.append({
                "category": category,
                "confidence": det["confidence"],
                "bbox": det["bbox"],
                "colour": colour, "colour_conf": colour_conf,
                "material": material, "material_conf": material_conf,
                "style": style, "style_conf": style_conf,
                "tag": build_tag(colour, material, category),
                "embedding": embedding,
            })
        return garments


# --- FastAPI web endpoint ---
@app.function(image=api_image)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, File, UploadFile, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    web = FastAPI(title="Fashion Vision API")

    web.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    pipeline = FashionPipeline()

    @web.get("/health")
    async def health():
        return {"status": "ok"}

    @web.get("/capabilities")
    async def capabilities():
        return {
            "image_analysis": True,
            "product_page_scrape": True,
            "receipt_ocr": False,
            "outfit_decomposition": True,
            "endpoints": ["/health", "/capabilities", "/analyse", "/scrape"],
        }

    @web.post("/analyse")
    async def analyse(
        file: UploadFile = File(...),
        threshold: float = 0.5,
    ):
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        image_bytes = await file.read()
        garments = await pipeline.process.remote.aio(image_bytes, threshold=threshold)

        return {
            "filename":       file.filename,
            "garment_count":  len(garments),
            "garments":       garments,
        }

    class ScrapeRequest(BaseModel):
        url: str

    @web.post("/scrape")
    async def scrape(req: ScrapeRequest):
        """
        Render a product page with a headless Chromium browser and return the
        fully-rendered HTML. Used as a fallback when static fetch returns a JS
        shell (Zara, H&M, SSENSE, etc.) with no meaningful product content.
        """
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            page = await browser.new_page()
            await page.set_extra_http_headers({
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            })

            try:
                await page.goto(req.url, wait_until="domcontentloaded", timeout=30_000)

                # Brief pause for JS frameworks to render initial content
                await page.wait_for_timeout(2_500)

                # Dismiss common cookie / consent banners without navigating away
                consent_selectors = [
                    "button[id*='accept']",
                    "button[class*='accept']",
                    "button[id*='cookie-accept']",
                    "[data-testid*='cookie'] button",
                    "[class*='cookie-banner'] button",
                    "[class*='consent'] button",
                    "[aria-label*='Accept']",
                ]
                for selector in consent_selectors:
                    try:
                        await page.click(selector, timeout=1_000)
                        break  # stop after first successful dismissal
                    except Exception:
                        pass

                html = await page.content()
            finally:
                await browser.close()

        return {"html": html, "url": req.url}

    return web


# --- Local dev entrypoint (uses MPS on Apple Silicon) ---
@app.local_entrypoint()
def main(image_path: str = "test.jpg", threshold: float = 0.5):
    from PIL import Image
    import io

    path = Path(image_path)
    if not path.exists():
        print(f"File not found: {image_path}")
        return

    image_bytes = path.read_bytes()
    pipeline = FashionPipeline()
    results = pipeline.process.local(image_bytes, threshold=threshold)

    print(f"\nFound {len(results)} garments:\n")
    for g in results:
        emb_preview = g["embedding"][:4]
        print(
            f"  {g['tag']}"
            f"  (style: {g['style']}, conf: {g['confidence']})"
            f"  bbox: {g['bbox']}"
            f"  embedding[:4]: {[round(v,4) for v in emb_preview]}..."
        )
