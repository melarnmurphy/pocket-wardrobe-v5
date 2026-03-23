import modal
from pathlib import Path

# --- Modal app definition ---
app = modal.App("fashion-pipeline")

# Container image with all dependencies
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

    def _classify_attribute(self, crop, labels: list[str]) -> tuple[str, float]:
        import torch
        inputs = self.siglip_processor(
            text=labels, images=[crop], padding="max_length", return_tensors="pt"
        ).to(self.device)
        with torch.no_grad():
            img_f = self.siglip_model.get_image_features(inputs["pixel_values"], normalize=True)
            txt_f = self.siglip_model.get_text_features(inputs["input_ids"], normalize=True)
            probs = (100.0 * img_f @ txt_f.T).softmax(dim=-1).squeeze(0)
        best_idx = probs.argmax().item()
        return labels[best_idx], round(probs[best_idx].item(), 3)

    @modal.method()
    def process(self, image_bytes: bytes, threshold: float = 0.5) -> list[dict]:
        import io
        import torch
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Step 1: Detect garments
        inputs = self.yolos_processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.yolos_model(**inputs)

        target_sizes = torch.tensor([image.size[::-1]]).to(self.device)
        results = self.yolos_processor.post_process_object_detection(
            outputs, threshold=threshold, target_sizes=target_sizes
        )[0]

        garments = []

        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            x1, y1, x2, y2 = [int(v) for v in box.tolist()]
            category   = self.yolos_model.config.id2label[label.item()]
            confidence = round(score.item(), 3)

            # Step 2: Crop
            crop = image.crop((x1, y1, x2, y2))

            # Step 3: Zero-shot attribute tagging
            colour,   colour_conf   = self._classify_attribute(crop, COLOURS)
            material, material_conf = self._classify_attribute(crop, MATERIALS)
            style,    style_conf    = self._classify_attribute(crop, STYLES)

            # Step 4: Embedding (returned as a plain list for JSON serialisation)
            emb_inputs = self.siglip_processor(images=[crop], return_tensors="pt").to(self.device)
            with torch.no_grad():
                embedding = self.siglip_model.get_image_features(
                    emb_inputs["pixel_values"], normalize=True
                ).squeeze(0).cpu().tolist()

            garments.append({
                "category":        category,
                "confidence":      confidence,
                "bbox":            [x1, y1, x2, y2],
                "colour":          colour,
                "colour_conf":     colour_conf,
                "material":        material,
                "material_conf":   material_conf,
                "style":           style,
                "style_conf":      style_conf,
                "tag":             f"{colour} {material} {category}",
                "embedding":       embedding,   # 768-dim list — store in vector DB
            })

        return garments


# --- FastAPI web endpoint ---
@app.function(image=image)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, File, UploadFile, HTTPException
    from fastapi.middleware.cors import CORSMiddleware

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
