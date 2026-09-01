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


def _containment(a: list[int], b: list[int]) -> float:
    """Fraction of the SMALLER box covered by its intersection with the other.

    Catches the case where a small box sits (almost) entirely inside a larger
    same-class box but their global IoU is low because the boxes differ wildly
    in size (e.g. a tank-top box inside a whole-torso "top" box).
    """
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    smaller = min(area_a, area_b)
    return inter / smaller if smaller > 0 else 0.0


def nms_per_class(
    detections: list[dict],
    iou_threshold: float = 0.55,
    containment_threshold: float = 0.7,
) -> list[dict]:
    """Greedy non-max suppression, applied independently per category.

    `detections` is a list of dicts each with `category`, `confidence`, `bbox`.
    A detection is suppressed by a higher-confidence survivor of the same class
    if they overlap by IoU >= `iou_threshold` OR the smaller box is covered by
    >= `containment_threshold` (handles nested same-class boxes that IoU misses).
    Returns the subset to keep.
    """
    kept: list[dict] = []
    by_cat: dict[str, list[dict]] = {}
    for det in detections:
        by_cat.setdefault(det["category"], []).append(det)
    for cat, dets in by_cat.items():
        dets = sorted(dets, key=lambda d: -d["confidence"])
        survivors: list[dict] = []
        for det in dets:
            if all(
                _iou(det["bbox"], s["bbox"]) < iou_threshold
                and _containment(det["bbox"], s["bbox"]) < containment_threshold
                for s in survivors
            ):
                survivors.append(det)
        kept.extend(survivors)
    return kept


# Small accessories where a low-confidence detection is usually noise (e.g. a
# phone misread as glasses). Gated at a higher floor than garments because a
# missed accessory is cheap (user adds it) but a visible false label is not.
ACCESSORY_LABELS = {
    "glasses", "watch", "tie", "headband", "hair accessory", "glove",
    "umbrella", "wallet",
}


def drop_low_confidence_accessories(
    detections: list[dict], floor: float = 0.6
) -> list[dict]:
    """Drop accessory-class detections below `floor`. Garments are untouched."""
    return [
        d
        for d in detections
        if d["category"].lower() not in ACCESSORY_LABELS or d["confidence"] >= floor
    ]


# Fashionpedia "part" labels — structural sub-regions of a garment, not items.
# Reconciled against the canonical Fashionpedia 46-category set used by
# valentinafevu/yolos-fashionpedia (the model's config.id2label). Every name
# below is a real label in that set; the remaining 27 are garments/accessories
# that are kept by filter_parts.
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


def apply_confidence_floor(label: str, score: float, floor: float = 0.45) -> tuple[str, float]:
    return (label, score) if score >= floor else ("unknown", score)


# Classes a person normally wears in pairs; everything else is capped at one
# instance per photo (you wear one belt, one pair of pants, carry one bag).
PAIRED_CLASS_SUBSTRINGS = ("shoe", "glove")


def cap_instances_per_class(
    detections: list[dict], single_cap: int = 1, paired_cap: int = 2
) -> list[dict]:
    """Cap detections per category to a realistic count for a single outfit.

    Keeps the highest-confidence N per class: `paired_cap` for paired items
    (shoes, gloves), `single_cap` for everything else. Removes side-by-side
    duplicate boxes of the same class that NMS misses (e.g. a belt detected
    twice in non-overlapping regions).
    """
    by_cat: dict[str, list[dict]] = {}
    for det in detections:
        by_cat.setdefault(det["category"], []).append(det)
    kept: list[dict] = []
    for cat, dets in by_cat.items():
        cap = paired_cap if any(s in cat.lower() for s in PAIRED_CLASS_SUBSTRINGS) else single_cap
        kept.extend(sorted(dets, key=lambda d: -d["confidence"])[:cap])
    return kept


# Curated top-level garment categories for the SigLIP category sanity-check.
GARMENT_CATEGORY_LABELS = [
    "shirt", "t-shirt", "top", "blouse", "sweater", "cardigan", "jacket",
    "coat", "blazer", "dress", "pants", "jeans", "trousers", "skirt",
    "shorts", "jumpsuit", "shoe", "bag", "belt", "hat", "scarf",
]


def _norm_cat(label: str) -> str:
    """Normalise a category label for comparison (lowercase, first token)."""
    return label.lower().split(",")[0].strip()


def reconcile_category(
    yolos_label: str,
    yolos_conf: float,
    siglip_label: str,
    siglip_conf: float,
    override_floor: float = 0.45,
    yolos_trust: float = 0.85,
) -> str:
    """Let FashionSigLIP correct a weak YOLOS category guess.

    Override the detector's label with SigLIP's only when SigLIP is reasonably
    confident (>= override_floor), the two disagree, and YOLOS itself was not
    highly confident (< yolos_trust). Otherwise keep the detector's label.
    """
    if (
        _norm_cat(siglip_label) != _norm_cat(yolos_label)
        and siglip_conf >= override_floor
        and yolos_conf < yolos_trust
    ):
        return siglip_label
    return yolos_label


def build_tag(colour: str, material: str, category: str) -> str:
    parts = [p for p in (colour, material, category) if p and p != "unknown"]
    return " ".join(parts)
