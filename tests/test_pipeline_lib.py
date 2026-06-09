from pipeline_lib import (
    clamp_box, nms_per_class, filter_parts, drop_low_confidence_accessories,
    union_box, should_crop, pad_box, map_box_to_original,
    apply_confidence_floor, build_tag,
)


def test_nms_suppresses_contained_same_class_box():
    # A large low-confidence "top" box and a higher-confidence smaller "top"
    # box sitting fully inside it. Their global IoU is low (~0.2) so plain IoU
    # NMS keeps both; containment-aware NMS must collapse to the higher-conf one.
    dets = [
        {"category": "top", "confidence": 0.72, "bbox": [100, 100, 400, 600]},
        {"category": "top", "confidence": 0.85, "bbox": [150, 300, 300, 500]},
    ]
    kept = nms_per_class(dets, iou_threshold=0.55)
    assert len(kept) == 1
    assert kept[0]["confidence"] == 0.85


def test_reconcile_category_overrides_weak_yolos_with_confident_siglip():
    from pipeline_lib import reconcile_category
    # YOLOS weakly said "dress" (0.56); SigLIP confidently says "shirt" -> override
    assert reconcile_category("dress", 0.56, "shirt", 0.60) == "shirt"


def test_reconcile_category_trusts_confident_yolos():
    from pipeline_lib import reconcile_category
    # YOLOS very confident -> keep it even if SigLIP disagrees
    assert reconcile_category("pants", 0.94, "skirt", 0.70) == "pants"


def test_reconcile_category_ignores_weak_siglip():
    from pipeline_lib import reconcile_category
    assert reconcile_category("dress", 0.56, "shirt", 0.30) == "dress"


def test_cap_instances_per_class():
    from pipeline_lib import cap_instances_per_class
    dets = [
        {"category": "belt",  "confidence": 0.62, "bbox": [0, 0, 10, 10]},
        {"category": "belt",  "confidence": 0.55, "bbox": [20, 0, 30, 10]},  # dup belt -> dropped
        {"category": "shoe",  "confidence": 0.96, "bbox": [0, 0, 10, 10]},
        {"category": "shoe",  "confidence": 0.55, "bbox": [20, 0, 30, 10]},  # pair -> both kept
        {"category": "pants", "confidence": 0.74, "bbox": [0, 0, 10, 10]},
    ]
    kept = cap_instances_per_class(dets)
    from collections import Counter
    c = Counter(d["category"] for d in kept)
    assert c["belt"] == 1 and c["shoe"] == 2 and c["pants"] == 1
    # the surviving belt is the higher-confidence one
    assert [d for d in kept if d["category"] == "belt"][0]["confidence"] == 0.62


def test_drop_low_confidence_accessories():
    dets = [
        {"category": "glasses", "confidence": 0.51, "bbox": [0, 0, 10, 10]},  # phone phantom
        {"category": "watch",   "confidence": 0.80, "bbox": [0, 0, 10, 10]},  # confident -> keep
        {"category": "pants",   "confidence": 0.40, "bbox": [0, 0, 10, 10]},  # garment -> keep
        {"category": "shoe",    "confidence": 0.50, "bbox": [0, 0, 10, 10]},  # not gated -> keep
    ]
    kept = drop_low_confidence_accessories(dets, floor=0.6)
    assert sorted(d["category"] for d in kept) == ["pants", "shoe", "watch"]


def test_clamp_box_clamps_to_image_bounds():
    # box exceeds bounds on left (-11) and right (502 > 500)
    assert clamp_box([-11, 20, 502, 480], width=500, height=460) == [0, 20, 500, 460]


def test_clamp_box_keeps_valid_box():
    assert clamp_box([10, 20, 100, 200], width=500, height=460) == [10, 20, 100, 200]


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


def test_confidence_floor_returns_unknown_below_floor():
    assert apply_confidence_floor("leather", 0.28, floor=0.45) == ("unknown", 0.28)


def test_confidence_floor_keeps_label_above_floor():
    assert apply_confidence_floor("denim", 0.99, floor=0.45) == ("denim", 0.99)


def test_build_tag_omits_unknown_parts():
    assert build_tag(colour="navy", material="unknown", category="pants") == "navy pants"
    assert build_tag(colour="navy", material="denim", category="pants") == "navy denim pants"
    assert build_tag(colour="unknown", material="unknown", category="shoe") == "shoe"
