# Detection-Quality Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve real-world garment detection in `modal_fashion_app.py` via six staged fixes (auto-orient, person-crop ROI, NMS dedup, parts→garment rollup, attribute confidence floor, box clamping), with unit tests and a before/after eval harness, without touching the production Modal app.

**Architecture:** Refactor the detection math out of `FashionPipeline.process()` into pure, GPU-free helper functions in a new `pipeline_lib.py` so they are unit-testable. `process()` orchestrates: auto-orient → detect → person-crop ROI → NMS → parts rollup → attributes (with confidence floor). Eval deploys to a separate Modal app name `fashion-pipeline-dev`; the live `fashion-pipeline` app is never redeployed by this work. Promotion to prod is a human-gated step done later.

**Tech Stack:** Python 3.11, Modal, PyTorch + torchvision, transformers (YOLOS-Fashionpedia + Marqo-FashionSigLIP), Pillow, pytest.

**Reference spec:** `docs/superpowers/specs/2026-06-09-detection-quality-pipeline-design.md`

**Eval assets (already staged, outside git):**
- `~/.pocketwardrobe-eval/originals/` — 9 source images (HEIC/PNG) that carry EXIF orientation.
- `~/.pocketwardrobe-eval/images/` — naive JPEG conversions (sideways; demonstrate the pre-fix state).
- Personal photos: **never commit these to git.**

---

## File Structure

- **Create** `pipeline_lib.py` — pure helper functions (no torch import at module top where avoidable; `nms` uses `torchvision.ops`). One responsibility: detection post-processing math.
- **Create** `tests/test_pipeline_lib.py` — pytest unit tests for the helpers.
- **Create** `eval/run_eval.py` — eval harness: runs images through the deployed pipeline, scores against ground truth, prints before/after.
- **Create** `eval/ground_truth.json` (written to `~/.pocketwardrobe-eval/`, not git) — hand-labelled expected garments.
- **Modify** `modal_fashion_app.py` — import and call helpers from `process()`; add auto-orient; parameterise the app name for dev deploys.
- **Create** `requirements-dev.txt` — `pytest`, `torch`, `torchvision`, `Pillow` for the local test env.

---

## Task 0: Worktree, branch, and dev test env

**Files:** none (environment only)

- [ ] **Step 1: Confirm isolated worktree**

You should already be running in an isolated git worktree off `main`. Confirm:

Run: `git rev-parse --abbrev-ref HEAD && git status --short`
Expected: a feature branch (e.g. `feat/detection-quality`), clean or only plan/spec files.

- [ ] **Step 2: Create the dev Python env for unit tests**

Run:
```bash
python3.11 -m venv .venv-dev
./.venv-dev/bin/pip install -q pytest torch torchvision Pillow
```
Expected: installs succeed (CPU torch is fine; no GPU needed for unit tests).

- [ ] **Step 3: Confirm Modal CLI + auth for later dev deploy**

Run:
```bash
./.venv-dev/bin/pip install -q modal && ./.venv-dev/bin/modal --version && test -f ~/.modal.toml && echo "modal auth present"
```
Expected: a version string and `modal auth present`. (Do NOT deploy yet.)

- [ ] **Step 4: Commit the dev requirements**

```bash
printf "pytest\ntorch\ntorchvision\nPillow\nmodal\n" > requirements-dev.txt
git add requirements-dev.txt
git commit -m "chore(pipeline): add dev requirements for detection-quality work"
```

---

## Task 1: Box clamping helper

**Files:**
- Create: `pipeline_lib.py`
- Test: `tests/test_pipeline_lib.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_pipeline_lib.py
from pipeline_lib import clamp_box

def test_clamp_box_clamps_to_image_bounds():
    # box exceeds bounds on left (-11) and right (502 > 500)
    assert clamp_box([-11, 20, 502, 480], width=500, height=460) == [0, 20, 500, 460]

def test_clamp_box_keeps_valid_box():
    assert clamp_box([10, 20, 100, 200], width=500, height=460) == [10, 20, 100, 200]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -v`
Expected: FAIL — `ImportError: cannot import name 'clamp_box'`.

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline_lib.py
"""Pure, GPU-free helpers for fashion detection post-processing.

Kept importable without heavy ML deps where possible so the math can be
unit-tested quickly. Functions that need torchvision import it lazily.
"""
from __future__ import annotations


def clamp_box(box: list[int], width: int, height: int) -> list[int]:
    x1, y1, x2, y2 = box
    return [
        max(0, min(int(x1), width)),
        max(0, min(int(y1), height)),
        max(0, min(int(x2), width)),
        max(0, min(int(y2), height)),
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add pipeline_lib.py tests/test_pipeline_lib.py
git commit -m "feat(pipeline): add box clamping helper"
```

---

## Task 2: Class-aware NMS de-duplication

**Files:**
- Modify: `pipeline_lib.py`
- Test: `tests/test_pipeline_lib.py`

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_pipeline_lib.py
from pipeline_lib import nms_per_class

def test_nms_collapses_overlapping_same_class():
    # Three near-identical "pants" boxes + one distinct "shoe" box.
    dets = [
        {"category": "pants", "confidence": 0.86, "bbox": [570, 279, 925, 492]},
        {"category": "pants", "confidence": 0.70, "bbox": [560, 277, 920, 480]},
        {"category": "pants", "confidence": 0.65, "bbox": [575, 279, 903, 470]},
        {"category": "shoe",  "confidence": 0.55, "bbox": [300, 800, 360, 860]},
    ]
    kept = nms_per_class(dets, iou_threshold=0.55)
    cats = sorted(d["category"] for d in kept)
    assert cats == ["pants", "shoe"]  # one pants survives, shoe survives
    # the surviving pants is the highest-confidence one
    pants = [d for d in kept if d["category"] == "pants"][0]
    assert pants["confidence"] == 0.86

def test_nms_keeps_distinct_boxes_same_class():
    dets = [
        {"category": "shoe", "confidence": 0.8, "bbox": [10, 10, 60, 60]},
        {"category": "shoe", "confidence": 0.7, "bbox": [500, 500, 560, 560]},
    ]
    kept = nms_per_class(dets, iou_threshold=0.55)
    assert len(kept) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -k nms -v`
Expected: FAIL — `cannot import name 'nms_per_class'`.

- [ ] **Step 3: Write minimal implementation**

```python
# add to pipeline_lib.py

def _iou(a: list[int], b: list[int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def nms_per_class(detections: list[dict], iou_threshold: float = 0.55) -> list[dict]:
    """Greedy non-max suppression, applied independently per category.

    `detections` is a list of dicts each with `category`, `confidence`, `bbox`.
    Returns the subset to keep, highest-confidence first within each class.
    """
    kept: list[dict] = []
    by_cat: dict[str, list[dict]] = {}
    for det in detections:
        by_cat.setdefault(det["category"], []).append(det)
    for cat, dets in by_cat.items():
        dets = sorted(dets, key=lambda d: -d["confidence"])
        survivors: list[dict] = []
        for det in dets:
            if all(_iou(det["bbox"], s["bbox"]) < iou_threshold for s in survivors):
                survivors.append(det)
        kept.extend(survivors)
    return kept
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -k nms -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add pipeline_lib.py tests/test_pipeline_lib.py
git commit -m "feat(pipeline): add class-aware NMS de-duplication"
```

---

## Task 3: Parts → garment rollup

**Files:**
- Modify: `pipeline_lib.py`
- Test: `tests/test_pipeline_lib.py`

> **NOTE for implementer:** Before finalising the part/garment sets, print the
> real label set from the model at dev-deploy time and reconcile:
> `python -c "from transformers import YolosForObjectDetection; print(YolosForObjectDetection.from_pretrained('valentinafevu/yolos-fashionpedia').config.id2label)"`
> The lists below are the Fashionpedia main categories; correct any mismatch.

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_pipeline_lib.py
from pipeline_lib import filter_parts

def test_filter_parts_drops_part_labels_keeps_garments():
    dets = [
        {"category": "neckline", "confidence": 0.99, "bbox": [0, 0, 10, 10]},
        {"category": "sleeve",   "confidence": 0.94, "bbox": [0, 0, 10, 10]},
        {"category": "collar",   "confidence": 0.60, "bbox": [0, 0, 10, 10]},
        {"category": "dress",    "confidence": 0.79, "bbox": [0, 0, 10, 10]},
        {"category": "belt",     "confidence": 0.85, "bbox": [0, 0, 10, 10]},
    ]
    kept = filter_parts(dets)
    cats = sorted(d["category"] for d in kept)
    assert cats == ["belt", "dress"]  # parts dropped, garment + accessory kept

def test_filter_parts_fallback_when_only_parts():
    dets = [
        {"category": "sleeve", "confidence": 0.40, "bbox": [0, 0, 10, 10]},
        {"category": "collar", "confidence": 0.70, "bbox": [0, 0, 10, 10]},
    ]
    kept = filter_parts(dets)
    # No garment present -> keep the single highest-confidence detection
    assert len(kept) == 1
    assert kept[0]["category"] == "collar"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -k filter_parts -v`
Expected: FAIL — `cannot import name 'filter_parts'`.

- [ ] **Step 3: Write minimal implementation**

```python
# add to pipeline_lib.py

# Fashionpedia "part" labels — structural sub-regions of a garment, not items.
PART_LABELS = {
    "sleeve", "neckline", "collar", "lapel", "pocket", "zipper", "buckle",
    "applique", "bead", "bow", "flower", "fringe", "ribbon", "rivet",
    "ruffle", "sequin", "tassel", "epaulette", "hood",
}

def filter_parts(detections: list[dict]) -> list[dict]:
    """Drop Fashionpedia part labels, keeping garments and accessories.

    If every detection is a part (no garment/accessory survives), keep the
    single highest-confidence detection so the result is never needlessly empty.
    """
    garments = [d for d in detections if d["category"].lower() not in PART_LABELS]
    if garments:
        return garments
    if not detections:
        return []
    return [max(detections, key=lambda d: d["confidence"])]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -k filter_parts -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add pipeline_lib.py tests/test_pipeline_lib.py
git commit -m "feat(pipeline): roll up Fashionpedia part labels"
```

---

## Task 4: Person-crop ROI geometry

**Files:**
- Modify: `pipeline_lib.py`
- Test: `tests/test_pipeline_lib.py`

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_pipeline_lib.py
from pipeline_lib import union_box, should_crop, pad_box, map_box_to_original

def test_union_box():
    boxes = [[10, 10, 50, 50], [40, 60, 100, 120]]
    assert union_box(boxes) == [10, 10, 100, 120]

def test_should_crop_when_subject_small():
    # union area 100x100 = 10_000 in a 1000x1000 (1_000_000) image -> 0.01 < 0.4
    assert should_crop([100, 100, 200, 200], width=1000, height=1000, area_fraction=0.4) is True

def test_should_not_crop_when_subject_large():
    assert should_crop([0, 0, 900, 900], width=1000, height=1000, area_fraction=0.4) is False

def test_pad_box_expands_and_clamps():
    # 8% padding on a 100-wide/100-tall box near the edge clamps to bounds
    assert pad_box([0, 0, 100, 100], width=1000, height=1000, padding=0.08) == [0, 0, 108, 108]

def test_map_box_to_original_offsets_and_scales():
    # crop origin (100,100), crop scaled 2x before re-detection.
    # a box at (20,20,40,40) in the upscaled crop maps back to original coords.
    mapped = map_box_to_original([20, 20, 40, 40], crop_origin=(100, 100), scale=2.0)
    assert mapped == [110, 110, 120, 120]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -k "union_box or should_crop or pad_box or map_box" -v`
Expected: FAIL — import errors for the new names.

- [ ] **Step 3: Write minimal implementation**

```python
# add to pipeline_lib.py

def union_box(boxes: list[list[int]]) -> list[int]:
    xs1 = min(b[0] for b in boxes)
    ys1 = min(b[1] for b in boxes)
    xs2 = max(b[2] for b in boxes)
    ys2 = max(b[3] for b in boxes)
    return [xs1, ys1, xs2, ys2]


def should_crop(union: list[int], width: int, height: int, area_fraction: float = 0.4) -> bool:
    x1, y1, x2, y2 = union
    area = max(0, x2 - x1) * max(0, y2 - y1)
    return (area / (width * height)) < area_fraction


def pad_box(box: list[int], width: int, height: int, padding: float = 0.08) -> list[int]:
    x1, y1, x2, y2 = box
    pad_w = int((x2 - x1) * padding)
    pad_h = int((y2 - y1) * padding)
    return clamp_box([x1 - pad_w, y1 - pad_h, x2 + pad_w, y2 + pad_h], width, height)


def map_box_to_original(box: list[int], crop_origin: tuple[int, int], scale: float) -> list[int]:
    ox, oy = crop_origin
    x1, y1, x2, y2 = box
    return [
        int(x1 / scale) + ox,
        int(y1 / scale) + oy,
        int(x2 / scale) + ox,
        int(y2 / scale) + oy,
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -k "union_box or should_crop or pad_box or map_box" -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add pipeline_lib.py tests/test_pipeline_lib.py
git commit -m "feat(pipeline): add person-crop ROI geometry helpers"
```

---

## Task 5: Attribute confidence floor

**Files:**
- Modify: `pipeline_lib.py`
- Test: `tests/test_pipeline_lib.py`

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_pipeline_lib.py
from pipeline_lib import apply_confidence_floor, build_tag

def test_confidence_floor_returns_unknown_below_floor():
    assert apply_confidence_floor("leather", 0.28, floor=0.45) == ("unknown", 0.28)

def test_confidence_floor_keeps_label_above_floor():
    assert apply_confidence_floor("denim", 0.99, floor=0.45) == ("denim", 0.99)

def test_build_tag_omits_unknown_parts():
    assert build_tag(colour="navy", material="unknown", category="pants") == "navy pants"
    assert build_tag(colour="navy", material="denim", category="pants") == "navy denim pants"
    assert build_tag(colour="unknown", material="unknown", category="shoe") == "shoe"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -k "confidence_floor or build_tag" -v`
Expected: FAIL — import errors.

- [ ] **Step 3: Write minimal implementation**

```python
# add to pipeline_lib.py

def apply_confidence_floor(label: str, score: float, floor: float = 0.45) -> tuple[str, float]:
    return (label, score) if score >= floor else ("unknown", score)


def build_tag(colour: str, material: str, category: str) -> str:
    parts = [p for p in (colour, material, category) if p and p != "unknown"]
    return " ".join(parts)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -k "confidence_floor or build_tag" -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add pipeline_lib.py tests/test_pipeline_lib.py
git commit -m "feat(pipeline): add attribute confidence floor and tag builder"
```

---

## Task 6: Wire helpers + auto-orient into `process()`

**Files:**
- Modify: `modal_fashion_app.py` (the `FashionPipeline` class: `load_models`, `_classify_attribute`, `process`)

- [ ] **Step 1: Add auto-orient on image load**

In `process()`, change the image load to apply EXIF orientation. Locate:
```python
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
```
Replace with:
```python
        from PIL import ImageOps
        image = ImageOps.exif_transpose(
            Image.open(io.BytesIO(image_bytes))
        ).convert("RGB")
```

- [ ] **Step 2: Add prompt templating + confidence floor to `_classify_attribute`**

Replace the body of `_classify_attribute` so it (a) templates the prompts and (b) applies the floor via the helper. New version:
```python
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
```

- [ ] **Step 3: Refactor `process()` to a detection sub-method and orchestrate the stages**

Add a private helper that runs raw YOLOS detection on a PIL image and returns a list of `{category, confidence, bbox}` dicts (clamped). Then rewrite `process()` to: detect → ROI crop+re-detect if needed → NMS → parts rollup → attributes. Full replacement for the detection+process section:

```python
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
            nms_per_class, filter_parts, union_box, should_crop, pad_box,
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

        # Stage 3: de-duplicate, then drop part labels
        dets = filter_parts(nms_per_class(dets, iou_threshold=0.55))

        # Stage 4: attributes per surviving detection
        garments = []
        for det in dets:
            x1, y1, x2, y2 = det["bbox"]
            crop = image.crop((x1, y1, x2, y2))
            colour, colour_conf = self._classify_attribute(crop, COLOURS)
            material, material_conf = self._classify_attribute(crop, MATERIALS)
            style, style_conf = self._classify_attribute(crop, STYLES)
            emb_inputs = self.siglip_processor(images=[crop], return_tensors="pt").to(self.device)
            with torch.no_grad():
                embedding = self.siglip_model.get_image_features(
                    emb_inputs["pixel_values"], normalize=True
                ).squeeze(0).cpu().tolist()
            garments.append({
                "category": det["category"],
                "confidence": det["confidence"],
                "bbox": det["bbox"],
                "colour": colour, "colour_conf": colour_conf,
                "material": material, "material_conf": material_conf,
                "style": style, "style_conf": style_conf,
                "tag": build_tag(colour, material, det["category"]),
                "embedding": embedding,
            })
        return garments
```

- [ ] **Step 4: Add `pipeline_lib.py` to the Modal image**

In `modal_fashion_app.py`, ensure `pipeline_lib.py` is available inside the container. Add to the GPU `image` definition (the `modal.Image...` assigned to `image`) a source mount. After the `.pip_install(...)` chain for `image`, append:
```python
    .add_local_python_source("pipeline_lib")
```
(If the installed Modal version lacks `add_local_python_source`, use `.add_local_file("pipeline_lib.py", "/root/pipeline_lib.py")` and confirm `/root` is on `sys.path`, or copy via `image.add_local_dir`. Verify import works in Step 5 of Task 7.)

- [ ] **Step 5: Commit**

```bash
git add modal_fashion_app.py
git commit -m "feat(pipeline): orchestrate auto-orient, ROI crop, NMS, parts rollup, confidence floor in process()"
```

---

## Task 7: Eval harness + ground truth

**Files:**
- Create: `eval/run_eval.py`
- Create (outside git): `~/.pocketwardrobe-eval/ground_truth.json`

- [ ] **Step 1: Write ground truth**

Write `~/.pocketwardrobe-eval/ground_truth.json` with the hand-labelled expectations:
```json
{
  "IMG_3700": {"garments": ["top", "trousers"], "has_shoes": true},
  "IMG_4005": {"garments": ["coat", "top", "trousers"], "has_shoes": true},
  "IMG_4364": {"garments": ["top", "trousers"], "has_shoes": true},
  "IMG_4541": {"garments": ["top", "skirt"], "has_shoes": false},
  "IMG_4551": {"garments": ["top", "pants"], "has_shoes": false},
  "IMG_4618": {"garments": ["top", "trousers"], "has_shoes": true},
  "IMG_4790": {"garments": ["shirt", "trousers"], "has_shoes": true},
  "IMG_4881": {"garments": ["top", "trousers"], "has_shoes": true},
  "IMG_4885": {"garments": ["top", "trousers"], "has_shoes": true}
}
```

- [ ] **Step 2: Write the eval harness**

```python
# eval/run_eval.py
"""Run the eval image set through a deployed pipeline endpoint and score it.

Usage:
  python eval/run_eval.py --endpoint https://<user>--fashion-pipeline-dev.modal.run
Reads images from ~/.pocketwardrobe-eval/originals (converting HEIC->JPEG via sips,
preserving EXIF orientation) and ground truth from ~/.pocketwardrobe-eval/ground_truth.json.
"""
import argparse, json, os, subprocess, tempfile, glob
import urllib.request

EVAL_DIR = os.path.expanduser("~/.pocketwardrobe-eval")

def to_jpeg(src: str, dst: str) -> None:
    # sips preserves EXIF orientation in the JPEG so the server's exif_transpose runs.
    subprocess.run(["sips", "-s", "format", "jpeg", src, "--out", dst],
                   check=True, capture_output=True)

def analyse(endpoint: str, jpeg_path: str) -> dict:
    import requests  # pip install requests in the dev env
    with open(jpeg_path, "rb") as f:
        r = requests.post(f"{endpoint}/analyse",
                          files={"file": (os.path.basename(jpeg_path), f, "image/jpeg")},
                          timeout=120)
    r.raise_for_status()
    return r.json()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", required=True)
    args = ap.parse_args()
    gt = json.load(open(os.path.join(EVAL_DIR, "ground_truth.json")))
    originals = sorted(glob.glob(os.path.join(EVAL_DIR, "originals", "*")))
    rows, dup_total, empty_total = [], 0, 0
    with tempfile.TemporaryDirectory() as tmp:
        for src in originals:
            name = os.path.splitext(os.path.basename(src))[0]
            jpg = os.path.join(tmp, name + ".jpg")
            to_jpeg(src, jpg)
            result = analyse(args.endpoint, jpg)
            gs = result.get("garments", [])
            cats = [g["category"] for g in gs]
            dups = len(cats) - len(set(cats))
            dup_total += max(0, dups)
            if not gs:
                empty_total += 1
            rows.append((name, len(gs), cats))
    print(f"{'image':<10} {'#det':>4}  categories")
    for name, n, cats in rows:
        print(f"{name:<10} {n:>4}  {cats}")
    print(f"\nempty results: {empty_total}/{len(rows)}   duplicate detections: {dup_total}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit (harness only — not the photos or ground truth)**

```bash
git add eval/run_eval.py
git commit -m "feat(eval): add detection eval harness"
```

---

## Task 8: Dev deploy + before/after eval

**Files:**
- Modify: `modal_fashion_app.py` (parameterise app name)

- [ ] **Step 1: Parameterise the Modal app name for dev**

Change:
```python
app = modal.App("fashion-pipeline")
```
to:
```python
import os as _os
app = modal.App(_os.environ.get("FASHION_APP_NAME", "fashion-pipeline"))
```
This lets a dev deploy use `fashion-pipeline-dev` without touching prod, and defaults to prod for the eventual promotion.

- [ ] **Step 2: Capture the BEFORE baseline (current prod)**

Run against the live prod endpoint (read-only — just calls `/analyse`):
```bash
./.venv-dev/bin/pip install -q requests
./.venv-dev/bin/python eval/run_eval.py --endpoint https://melarnmurphy--fashion-pipeline-api.modal.run | tee eval/before.txt
```
Expected: a table showing the current poor results (empties, duplicates). Keep `eval/before.txt`.

- [ ] **Step 3: Deploy the dev app**

```bash
FASHION_APP_NAME=fashion-pipeline-dev ./.venv-dev/bin/modal deploy modal_fashion_app.py
```
Expected: deploy succeeds and prints the dev web URL (note it). If the web function name differs, derive the `/analyse` base URL from Modal's output.

- [ ] **Step 4: Verify `pipeline_lib` imported inside the container**

Hit the dev `/health` then `/analyse` on one image:
```bash
DEV=<dev-analyse-base-url>
curl -s "$DEV/health"
./.venv-dev/bin/python eval/run_eval.py --endpoint "$DEV"
```
Expected: `/health` returns `{"status":"ok"}`; `/analyse` returns garments (no `ModuleNotFoundError: pipeline_lib`). If import fails, fix Task 6 Step 4 and redeploy.

- [ ] **Step 5: Capture the AFTER results**

```bash
./.venv-dev/bin/python eval/run_eval.py --endpoint "$DEV" | tee eval/after.txt
```
Expected: fewer empties, fewer duplicates, garments instead of parts, oriented images detected.

- [ ] **Step 6: Run the full unit suite once more**

Run: `./.venv-dev/bin/pytest tests/test_pipeline_lib.py -v`
Expected: all pass.

- [ ] **Step 7: Commit the before/after evidence**

```bash
git add eval/before.txt eval/after.txt modal_fashion_app.py
git commit -m "chore(eval): capture before/after detection eval and parameterise app name"
```

---

## Task 9: Report (no prod promotion)

**Files:** none

- [ ] **Step 1: Summarise results**

Produce a short written summary (in the final agent message, not a file): per-image before→after, and the aggregate deltas (empties, duplicates, part-noise). Explicitly note any image that did NOT improve and the likely cause.

- [ ] **Step 2: Do NOT promote to prod**

Promotion (`modal deploy` with the default `fashion-pipeline` app name) is a human-gated step performed after the pitch. Leave the prod app untouched. State clearly in the summary that prod is unchanged and provide the exact promote command for later:
```bash
./.venv-dev/bin/modal deploy modal_fashion_app.py   # default app name = fashion-pipeline (PROD)
```

- [ ] **Step 3: Optionally tear down the dev app to stop idle cost**

```bash
./.venv-dev/bin/modal app stop fashion-pipeline-dev
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** auto-orient (Task 6.1), person-crop ROI (Tasks 4 + 6.3), NMS (Tasks 2 + 6.3), parts rollup (Tasks 3 + 6.3), confidence floor + templating (Tasks 5 + 6.2), box clamping (Tasks 1 + 6 `_detect`), eval harness + ground truth (Tasks 7-8), isolation/dev-app/no-prod-promotion (Tasks 0, 8, 9), photos-out-of-git (Tasks 7, 9). All covered.
- **Placeholder scan:** none — every code step contains full code; the one runtime-verification note (Fashionpedia labels) is an explicit instruction with the command to run, not a placeholder.
- **Type consistency:** detection dicts use `{category, confidence, bbox}` throughout; helper names (`nms_per_class`, `filter_parts`, `union_box`, `should_crop`, `pad_box`, `map_box_to_original`, `apply_confidence_floor`, `build_tag`, `clamp_box`) are used consistently across Tasks 1-7.
