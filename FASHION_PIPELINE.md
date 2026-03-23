# Fashion App — AI Vision Pipeline Spec

## Overview

This app allows users to upload a photo of themselves (full-body or outfit). A computer vision pipeline detects, segments, and tags each visible clothing item, then generates rich semantic embeddings for each garment. These embeddings power attribute tagging, wardrobe management, and similarity-based recommendations.

---

## Pipeline Architecture

```
User uploads photo
        │
        ▼
┌─────────────────────────┐
│   YOLOS-Fashionpedia    │  ← Detection model
│  valentinafevu/yolos-   │
│     fashionpedia        │
│                         │
│  Output: bounding boxes │
│  + category labels for  │
│  each detected garment  │
└────────────┬────────────┘
             │
             ▼
    Crop each detection
    (one image per bbox)
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌──────────┐  ┌────────────────┐
│ Marqo-   │  │ Vector store   │
│ Fashion  │  │ (FAISS /       │
│ SigLIP   │  │  Pinecone /    │
│          │  │  Qdrant)       │
│ Zero-shot│  │                │
│ attribute│  │ Similarity     │
│ tagging  │  │ search index   │
└────┬─────┘  └───────┬────────┘
     │                │
     ▼                ▼
Rich tags         Similar items
per garment       (wardrobe / shop)
```

---

## Models

### 1. YOLOS-Fashionpedia
- **HuggingFace ID**: `valentinafevu/yolos-fashionpedia`
- **Task**: Object detection
- **Architecture**: YOLOS (Vision Transformer adapted for detection)
- **Training dataset**: Fashionpedia (46,781 images, expert-annotated)
- **Output**: Bounding boxes + category labels + confidence scores

**Supported categories (46 total)**:
- Major garments: shirt/blouse, top/t-shirt/sweatshirt, sweater, cardigan, jacket, vest, pants, shorts, skirt, coat, dress, jumpsuit, cape
- Footwear & accessories: shoe, sock, tights/stockings, leg warmer, glove, watch, belt, bag/wallet, scarf, umbrella, glasses, hat, headband/hair accessory, tie
- Garment parts: hood, collar, lapel, epaulette, sleeve, pocket, neckline
- Fine details: buckle, zipper, applique, bead, bow, flower, fringe, ribbon, rivet, ruffle, sequin, tassel

**Usage**:
```python
from transformers import YolosImageProcessor, YolosForObjectDetection
from PIL import Image
import torch

model_id = "valentinafevu/yolos-fashionpedia"
processor = YolosImageProcessor.from_pretrained(model_id)
model = YolosForObjectDetection.from_pretrained(model_id)

image = Image.open("user_photo.jpg")
inputs = processor(images=image, return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

target_sizes = torch.tensor([image.size[::-1]])
results = processor.post_process_object_detection(
    outputs,
    threshold=0.5,
    target_sizes=target_sizes
)[0]

for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
    print(f"{model.config.id2label[label.item()]}: {score:.2f} @ {box.tolist()}")
```

---

### 2. Marqo-FashionSigLIP (preferred) / Marqo-FashionCLIP
- **HuggingFace IDs**:
  - `Marqo/marqo-fashionSigLIP` ← recommended (57% better recall than FashionCLIP 2.0)
  - `Marqo/marqo-fashionCLIP` ← lighter alternative (512-dim vs 768-dim)
- **Task**: Multimodal embedding — image + text into shared vector space
- **Architecture**: ViT-B-16-SigLIP fine-tuned with Generalised Contrastive Learning (GCL)
- **Training**: 7 public fashion datasets (DeepFashion, Fashion200k, Polyvore, iMaterialist, Atlas, KAGL, DeepFashion Multimodal)
- **License**: Apache 2.0

**What GCL adds over standard CLIP**: Each training image is paired with multiple supervision signals simultaneously — category, colour, material, style, keywords, and fine details — rather than a single caption. This produces embeddings that understand fashion attributes at a granular level.

**Usage — zero-shot attribute classification**:
```python
from transformers import AutoModel, AutoProcessor
from PIL import Image
import torch

model = AutoModel.from_pretrained("Marqo/marqo-fashionSigLIP", trust_remote_code=True)
processor = AutoProcessor.from_pretrained("Marqo/marqo-fashionSigLIP", trust_remote_code=True)

image = Image.open("cropped_garment.jpg")

# Zero-shot colour classification
colour_labels = ["black", "white", "navy", "grey", "red", "green", "beige", "brown"]
inputs = processor(text=colour_labels, images=[image], padding="max_length", return_tensors="pt")

with torch.no_grad():
    img_features = model.get_image_features(inputs["pixel_values"], normalize=True)
    txt_features = model.get_text_features(inputs["input_ids"], normalize=True)
    probs = (100.0 * img_features @ txt_features.T).softmax(dim=-1)

colour = colour_labels[probs.argmax().item()]
print(f"Detected colour: {colour}")
```

**Usage — generate and store embeddings**:
```python
def get_embedding(image: Image.Image) -> torch.Tensor:
    inputs = processor(images=[image], return_tensors="pt")
    with torch.no_grad():
        embedding = model.get_image_features(inputs["pixel_values"], normalize=True)
    return embedding.squeeze(0)  # shape: [768]
```

---

## Full Pipeline

```python
from transformers import (
    YolosImageProcessor, YolosForObjectDetection,
    AutoModel, AutoProcessor
)
from PIL import Image
import torch

# --- Load models ---
YOLOS_ID = "valentinafevu/yolos-fashionpedia"
SIGLIP_ID = "Marqo/marqo-fashionSigLIP"

yolos_processor = YolosImageProcessor.from_pretrained(YOLOS_ID)
yolos_model = YolosForObjectDetection.from_pretrained(YOLOS_ID)

siglip_model = AutoModel.from_pretrained(SIGLIP_ID, trust_remote_code=True)
siglip_processor = AutoProcessor.from_pretrained(SIGLIP_ID, trust_remote_code=True)

# --- Attribute label sets for zero-shot tagging ---
COLOURS = ["black", "white", "navy", "grey", "red", "green", "beige", "brown", "pink", "yellow", "blue"]
MATERIALS = ["cotton", "wool", "silk", "linen", "polyester", "denim", "leather", "synthetic"]
STYLES = ["casual", "formal", "smart-casual", "sporty", "streetwear", "business"]

def classify_attribute(image: Image.Image, labels: list[str]) -> str:
    inputs = siglip_processor(text=labels, images=[image], padding="max_length", return_tensors="pt")
    with torch.no_grad():
        img_f = siglip_model.get_image_features(inputs["pixel_values"], normalize=True)
        txt_f = siglip_model.get_text_features(inputs["input_ids"], normalize=True)
        probs = (100.0 * img_f @ txt_f.T).softmax(dim=-1)
    return labels[probs.argmax().item()]

def process_photo(image_path: str) -> list[dict]:
    image = Image.open(image_path).convert("RGB")

    # Step 1: Detect garments with YOLOS
    inputs = yolos_processor(images=image, return_tensors="pt")
    with torch.no_grad():
        outputs = yolos_model(**inputs)

    target_sizes = torch.tensor([image.size[::-1]])
    results = yolos_processor.post_process_object_detection(
        outputs, threshold=0.5, target_sizes=target_sizes
    )[0]

    garments = []

    for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
        x1, y1, x2, y2 = [int(v) for v in box.tolist()]
        category = yolos_model.config.id2label[label.item()]
        confidence = round(score.item(), 3)

        # Step 2: Crop the detected region
        crop = image.crop((x1, y1, x2, y2))

        # Step 3: Zero-shot attribute tagging with FashionSigLIP
        colour = classify_attribute(crop, COLOURS)
        material = classify_attribute(crop, MATERIALS)
        style = classify_attribute(crop, STYLES)

        # Step 4: Generate embedding for similarity search
        emb_inputs = siglip_processor(images=[crop], return_tensors="pt")
        with torch.no_grad():
            embedding = siglip_model.get_image_features(
                emb_inputs["pixel_values"], normalize=True
            ).squeeze(0)

        garments.append({
            "category": category,
            "confidence": confidence,
            "bbox": [x1, y1, x2, y2],
            "colour": colour,
            "material": material,
            "style": style,
            "tag": f"{colour} {material} {category}",
            "embedding": embedding,  # torch.Tensor [768] — store in vector DB
        })

    return garments
```

---

## Datasets (for fine-tuning or evaluation)

| Dataset | HuggingFace ID | Description |
|---|---|---|
| Fashionpedia | `detection-datasets/fashionpedia` | 46,781 images, 46 categories, expert segmentation masks |
| Human Parsing | `mattmdjaga/human_parsing_dataset` | ATR dataset for clothing segmentation |
| DeepFashion Multimodal | `Marqo/deepfashion-multimodal` | Rich product metadata + images |

---

## Dependencies

```txt
torch>=2.0
transformers>=4.40
Pillow
faiss-cpu          # or faiss-gpu for production
```

---

## Extension Points

- **Segmentation**: Replace or augment YOLOS with `mattmdjaga/segformer_b2_clothes` for pixel-level masks instead of bounding boxes
- **Vector database**: Swap `faiss` for Pinecone or Qdrant for production-scale similarity search
- **Wardrobe management**: Store embeddings per user, group by category, query by text ("show me all my formal items")
- **Shop integration**: Index a product catalogue with FashionSigLIP embeddings; surface similar items to detected garments
- **Confidence threshold**: Tune the YOLOS `threshold` (currently `0.5`) — lower for more detections, higher for precision
