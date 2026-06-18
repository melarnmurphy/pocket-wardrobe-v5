# Detection-Quality Pipeline — Design

Date: 2026-06-09
Status: Approved (design); implementation pending
Owner area: `modal_fashion_app.py` (Modal fashion vision pipeline)

## Problem

Running a real-world test set of 9 outfit photos through the live pipeline
exposed systematic detection failures:

- **Rotation**: iPhone mirror selfies are stored landscape with an EXIF
  orientation flag. The detector is not rotation-invariant, so sideways input
  produces misses and garbage.
- **Over-detection**: one pair of jeans returned 5 boxes; a barefoot photo
  returned 7 "shoe" detections. No de-duplication exists.
- **Whole-garment misses**: clean shots where the subject is small in frame
  returned 0 detections (threshold too high for distant subjects).
- **Part fragmentation**: a clean runway shot returned `neckline`, `sleeve`,
  `collar`, `buckle` as separate "items" instead of coherent garments.
- **Forced attributes**: `_classify_attribute` always returns an argmax, so
  every garment gets a (often wrong) material/style even at low confidence.

The attribute head itself works well when detection locks on (denim 0.99 on
jeans, leather 0.96 on a shoe), so the fixes target **detection and framing**,
not attribute modelling.

## Goals

Improve detection precision/recall on real-world uploads via six staged fixes,
with measurable before/after evidence, and **zero risk to the production
`fashion-pipeline` Modal app** until a human promotes the result after the pitch.

## Non-goals

- Fine-tuning or replacing the YOLOS detector or FashionSigLIP model.
- Building a data flywheel / retraining loop (future work).
- Any change to the Next.js web app or the `/analyse` response contract
  (same JSON shape: `{ filename, garment_count, garments: [...] }`).

## Pipeline design

All changes live in `modal_fashion_app.py`. The detection math is refactored
into **pure, GPU-free helper functions** so it is unit-testable; `process()`
orchestrates them. New `process()` order:

1. **Auto-orient** — `PIL.ImageOps.exif_transpose()` on image load. Corrects
   EXIF-rotated uploads. No-op for images without an orientation flag.
2. **Detect** — existing YOLOS pass.
3. **Person-crop ROI (heuristic)** — if the union bounding box of the initial
   detections covers less than a threshold fraction of the frame area
   (e.g. < 0.4), crop to that union + padding, upscale, re-run detection once,
   and map resulting boxes back to original-image coordinates. Single pass; if
   the union is already large, skip. No new model/dependency.
4. **Class-aware NMS** — `torchvision.ops.nms` per category at IoU ≈ 0.55 to
   collapse duplicate overlapping boxes of the same class.
5. **Parts → garment rollup** — drop Fashionpedia *part* labels (sleeve,
   neckline, collar, lapel, pocket, zipper, buckle, applique, etc.); keep
   garments and meaningful accessories (bag, belt, shoe/footwear, hat, scarf,
   glasses, watch). If no garment survives, keep the highest-confidence
   detection as a fallback so the response is never needlessly empty.
6. **Attributes + confidence floor** — in `_classify_attribute`, return
   `"unknown"` (with the score) when the top softmax probability is below a
   floor (≈ 0.45) instead of forcing a wrong label. Use prompt templating
   (`"a photo of {label} clothing"`) for the zero-shot comparison.

The `tag` field becomes `f"{colour} {material} {category}"` with `unknown`
parts omitted (e.g. `"navy denim pants"`, or `"navy pants"` if material is
unknown).

## Tunable constants

Centralise as module constants so the eval can sweep them:
`ROI_AREA_FRACTION` (0.4), `ROI_PADDING` (0.08), `NMS_IOU` (0.55),
`ATTR_CONFIDENCE_FLOOR` (0.45), detection `threshold` default (unchanged, 0.5).

## Verification

`modal_fashion_app.py` currently has **no tests**. Two layers are added:

### Unit tests (TDD, no GPU)
Pure helpers are tested with synthetic inputs:
- NMS dedup: overlapping same-class boxes collapse; distinct boxes survive.
- ROI union/crop: union math, area-fraction gate, coordinate mapping back.
- Parts classification: known part labels dropped, garments/accessories kept,
  empty-result fallback.
- Confidence floor: below-floor → `"unknown"`; above-floor → label.
- Box clamping: negative / out-of-bounds coords clamped to image bounds.

Run with `pytest`. Choose the lightest setup that keeps these GPU-free
(extract helpers into a module importable without torch where practical; where
a helper needs `torchvision.ops`, install CPU torch in the test env).

### Eval harness (end-to-end, GPU)
A script runs the test set through the pipeline and reports per-image
detections plus aggregate metrics **before vs after**:
- duplicate rate (same-class overlapping boxes per image),
- missed-garment rate vs ground truth,
- part-noise count (part labels surfaced as items),
- empty-result count.

Ground truth (hand-labelled, committed as a small JSON in the eval dir, not in
git — see below) for the 9 images:

| Image | Ground-truth garments |
| --- | --- |
| IMG_3700 | top + wide trousers/skirt (full outfit) |
| IMG_4005 | trench coat + lace top + belt + wide trousers (runway) |
| IMG_4364 | full outfit incl. black leather shoes |
| IMG_4541 | white top + long black skirt (barefoot — no shoes) |
| IMG_4551 | blue jeans + lilac top + cream knit |
| IMG_4618 | full outfit |
| IMG_4790 | black shirt + white wide-leg trousers + belt |
| IMG_4881 | full outfit |
| IMG_4885 | full outfit |

The eval is run against the **dev** deployment (below), not prod.

## Isolation & safety

- Implementation happens in an **isolated git worktree**.
- GPU eval deploys to a **separate Modal app name `fashion-pipeline-dev`**
  (change `modal.App("fashion-pipeline")` → dev name only for eval deploys, or
  parameterise via env). The live `fashion-pipeline` app is never redeployed by
  this work.
- **Promotion to prod is a separate, human-gated step after the pitch**: review
  the before/after eval, then deploy to the prod app name. Not done by the agent.
- **Personal photos never enter git.** Eval images live at
  `~/.pocketwardrobe-eval/` (`originals/` = source HEIC/PNG with EXIF;
  `images/` = naive JPEG conversions). The eval reads from there via an
  absolute path; ground-truth JSON is written there too.

## Risks

- `exif_transpose` cannot fix pixels already baked sideways with **no** EXIF
  flag (e.g. the naive sips JPEGs). Real uploads carry the flag, so eval should
  convert from `originals/` preserving EXIF to exercise this honestly.
- Person-crop re-detection roughly doubles GPU work on small-subject images;
  bounded to one extra pass.
- Parts rollup depends on the exact Fashionpedia label set — confirm the 46
  class names from `yolos_model.config.id2label` at implementation time rather
  than hard-coding from memory.
