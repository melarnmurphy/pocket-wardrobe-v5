from __future__ import annotations

import io
import os
from pathlib import Path
from threading import Lock
from typing import Any

from PIL import Image

YOLOS_ID = "valentinafevu/yolos-fashionpedia"
SIGLIP_ID = "Marqo/marqo-fashionSigLIP"

CACHE_DIR = os.environ.get(
    "FASHION_PIPELINE_CACHE_DIR",
    str(Path.home() / ".cache" / "pocket-wardrobe" / "models"),
)

COLOURS = [
    "black",
    "white",
    "navy",
    "grey",
    "red",
    "green",
    "beige",
    "brown",
    "pink",
    "yellow",
    "blue",
]
MATERIALS = ["cotton", "wool", "silk", "linen", "polyester", "denim", "leather", "synthetic"]
STYLES = ["casual", "formal", "smart-casual", "sporty", "streetwear", "business"]


class FashionPipeline:
    def __init__(self) -> None:
        import torch
        from transformers import AutoModel, AutoProcessor, YolosForObjectDetection, YolosImageProcessor

        os.environ["TRANSFORMERS_CACHE"] = CACHE_DIR
        os.environ["HF_HOME"] = CACHE_DIR
        Path(CACHE_DIR).mkdir(parents=True, exist_ok=True)

        if torch.cuda.is_available():
            self.device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"

        print(f"Fashion pipeline using device: {self.device}", flush=True)
        print("Loading YOLOS-Fashionpedia...", flush=True)
        self.yolos_processor = YolosImageProcessor.from_pretrained(YOLOS_ID, cache_dir=CACHE_DIR)
        self.yolos_model = YolosForObjectDetection.from_pretrained(YOLOS_ID, cache_dir=CACHE_DIR).to(
            self.device
        )
        self.yolos_model.eval()

        print("Loading Marqo-FashionSigLIP...", flush=True)
        import open_clip.factory as open_clip_factory

        original_set_device = open_clip_factory._set_model_device_and_precision

        def meta_safe_set_device(model: Any, device: str, precision: str, is_timm_model: bool) -> None:
            params = list(model.parameters())
            if params and params[0].device.type == "meta":
                model.to_empty(device="cpu")
            else:
                original_set_device(model, device, precision, is_timm_model)

        open_clip_factory._set_model_device_and_precision = meta_safe_set_device
        try:
            siglip_model = AutoModel.from_pretrained(
                SIGLIP_ID,
                trust_remote_code=True,
                cache_dir=CACHE_DIR,
                low_cpu_mem_usage=False,
            )
        finally:
            open_clip_factory._set_model_device_and_precision = original_set_device

        self.siglip_model = siglip_model.to(self.device)
        self.siglip_processor = AutoProcessor.from_pretrained(
            SIGLIP_ID,
            trust_remote_code=True,
            cache_dir=CACHE_DIR,
        )
        self.siglip_model.eval()
        print("Fashion pipeline models ready.", flush=True)

    def _classify_attribute(self, crop: Image.Image, labels: list[str]) -> tuple[str, float]:
        import torch

        inputs = self.siglip_processor(
            text=labels,
            images=[crop],
            padding="max_length",
            return_tensors="pt",
        ).to(self.device)
        with torch.no_grad():
            image_features = self.siglip_model.get_image_features(
                inputs["pixel_values"],
                normalize=True,
            )
            text_features = self.siglip_model.get_text_features(inputs["input_ids"], normalize=True)
            probs = (100.0 * image_features @ text_features.T).softmax(dim=-1).squeeze(0)
        best_idx = probs.argmax().item()
        return labels[best_idx], round(probs[best_idx].item(), 3)

    def process(self, image_bytes: bytes, threshold: float = 0.5) -> list[dict[str, Any]]:
        import torch

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        inputs = self.yolos_processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.yolos_model(**inputs)

        target_sizes = torch.tensor([image.size[::-1]]).to(self.device)
        results = self.yolos_processor.post_process_object_detection(
            outputs,
            threshold=threshold,
            target_sizes=target_sizes,
        )[0]

        garments: list[dict[str, Any]] = []

        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            x1, y1, x2, y2 = [int(value) for value in box.tolist()]
            category = self.yolos_model.config.id2label[label.item()]
            confidence = round(score.item(), 3)
            crop = image.crop((x1, y1, x2, y2))

            colour, colour_conf = self._classify_attribute(crop, COLOURS)
            material, material_conf = self._classify_attribute(crop, MATERIALS)
            style, style_conf = self._classify_attribute(crop, STYLES)

            embedding_inputs = self.siglip_processor(images=[crop], return_tensors="pt").to(self.device)
            with torch.no_grad():
                embedding = (
                    self.siglip_model.get_image_features(
                        embedding_inputs["pixel_values"],
                        normalize=True,
                    )
                    .squeeze(0)
                    .cpu()
                    .tolist()
                )

            garments.append(
                {
                    "category": category,
                    "confidence": confidence,
                    "bbox": [x1, y1, x2, y2],
                    "colour": colour,
                    "colour_conf": colour_conf,
                    "material": material,
                    "material_conf": material_conf,
                    "style": style,
                    "style_conf": style_conf,
                    "tag": f"{colour} {material} {category}",
                    "embedding": embedding,
                }
            )

        return garments


_pipeline: FashionPipeline | None = None
_pipeline_lock = Lock()


def get_pipeline() -> FashionPipeline:
    global _pipeline

    if _pipeline is not None:
        return _pipeline

    with _pipeline_lock:
        if _pipeline is None:
            _pipeline = FashionPipeline()
        return _pipeline

