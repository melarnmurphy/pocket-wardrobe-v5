# Receipt OCR Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the missing Modal OCR endpoint and harden the receipt parsing pipeline so that image and PDF receipts produce usable draft candidates.

**Architecture:** A new `ReceiptOcr` Modal class runs PaddleOCR on CPU with `keep_warm=1` to eliminate cold starts. PDF receipts hit a pdfplumber text-extraction fast path before falling through to OCR. The TypeScript parser gains four targeted fixes (multi-line merging, relaxed detection, scored retailer inference, field-level confidence), and silent error swallowing in the server action is replaced with user-facing messages.

**Tech Stack:** Python 3.11, Modal, PaddleOCR 2.7+, PaddlePaddle 2.6.1, pdfplumber, PyMuPDF (fitz), TypeScript, Vitest

---

## File Map

| File | Change |
|---|---|
| `modal_fashion_app.py` | New `ocr_image`, new `ReceiptOcr` class, new `/receipt-ocr` route, update capabilities |
| `lib/domain/ingestion/extractors.ts` | `ReceiptDraftCandidate` type (add `fieldConfidence`), `mergeMultiLineItems`, `looksLikeReceiptItem`, `inferReceiptRetailer`, `parseReceiptDraftCandidates` |
| `lib/domain/ingestion/adapters.ts` | `receiptAdapter.buildDraft` — use per-field confidence |
| `app/wardrobe/actions.ts` | `createReceiptDraftAction` — explicit OCR error handling, 0-item error |
| `lib/domain/ingestion/__tests__/extractors.test.ts` | Tests for multi-line merge, relaxed detection, retailer scoring, field-level confidence |

---

## Task 1: Multi-line item merging

Receipt lines like `"Cashmere Blend Sweater"` + `"149.00"` are currently parsed as two separate lines — the item gets no price.

**Files:**
- Modify: `lib/domain/ingestion/extractors.ts` (add `mergeMultiLineItems`, call it in `parseReceiptDraftCandidates`)
- Test: `lib/domain/ingestion/__tests__/extractors.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/domain/ingestion/__tests__/extractors.test.ts`:

```ts
it("merges item name and price when split across consecutive lines", () => {
  const result = parseReceiptDraftCandidates({
    receiptText: `
      COUNTRY ROAD
      Cashmere Blend Sweater
      149.00
      Linen Trousers
      89.00
      Total 238.00
    `
  });

  expect(result).toHaveLength(2);
  expect(result[0]?.title.toLowerCase()).toContain("cashmere blend sweater");
  expect(result[0]?.price).toBe(149);
  expect(result[1]?.title.toLowerCase()).toContain("linen trousers");
  expect(result[1]?.price).toBe(89);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run lib/domain/ingestion/__tests__/extractors.test.ts
```

Expected: FAIL — items extracted but prices are `null`.

- [ ] **Step 3: Add `mergeMultiLineItems` before the filter step**

In `lib/domain/ingestion/extractors.ts`, add this function near the other receipt helpers (after `looksLikeReceiptItem`):

```ts
function mergeMultiLineItems(lines: string[]): string[] {
  const merged: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const current = lines[i]!;
    const next = lines[i + 1];
    const currentHasPrice = /(?:\$|aud|usd|eur)?\s?\d+[.,]\d{2}$/i.test(current);
    const nextIsPriceOnly =
      next != null && /^\s*[$€£]?\s?\d+[.,]\d{2}\s*$/.test(next);
    if (!currentHasPrice && nextIsPriceOnly) {
      merged.push(`${current} ${next.trim()}`);
      i += 2;
    } else {
      merged.push(current);
      i += 1;
    }
  }
  return merged;
}
```

Then in `parseReceiptDraftCandidates`, apply it before the filter:

```ts
const lines = normalizedText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const mergedLines = mergeMultiLineItems(lines);   // ← add this
const inferredRetailer = inferReceiptRetailer(mergedLines);   // ← pass mergedLines
const inferredBrand = inferBrandFromReceiptText(normalizedText);
const inferredCurrency = inferReceiptCurrency(normalizedText);

const candidates = mergedLines   // ← was `lines`
  .filter((line) => looksLikeReceiptItem(line))
  // ... rest unchanged
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run lib/domain/ingestion/__tests__/extractors.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/extractors.ts lib/domain/ingestion/__tests__/extractors.test.ts
git commit -m "feat(ingestion): merge split item+price lines before receipt parsing"
```

---

## Task 2: Relaxed item detection

Items like `"CASHMERE BLEND CREW"` have no price on the same line and no clothing keyword, so they are silently dropped.

**Files:**
- Modify: `lib/domain/ingestion/extractors.ts` (`looksLikeReceiptItem`)
- Test: `lib/domain/ingestion/__tests__/extractors.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/domain/ingestion/__tests__/extractors.test.ts`:

```ts
it("picks up item lines that have no price tail and no clothing keyword", () => {
  const result = parseReceiptDraftCandidates({
    receiptText: `
      DAVID JONES
      CASHMERE BLEND CREW AUD 189.00
      MERINO RIBBED TANK AUD 89.00
      WIDE LEG PULL-ON AUD 149.00
      Subtotal AUD 427.00
    `
  });

  // All three items should be extracted
  expect(result.length).toBeGreaterThanOrEqual(3);
});

it("does not include the retailer header line as an item", () => {
  const result = parseReceiptDraftCandidates({
    receiptText: `
      COUNTRY ROAD
      Linen Shirt AUD 89.00
      Total AUD 89.00
    `
  });

  expect(result).toHaveLength(1);
  const titles = result.map((r) => r.title.toLowerCase());
  expect(titles.every((t) => !t.includes("country road"))).toBe(true);
});
```

- [ ] **Step 2: Run test to confirm the first test fails**

```bash
npx vitest run lib/domain/ingestion/__tests__/extractors.test.ts
```

Expected: "picks up item lines" FAIL.

- [ ] **Step 3: Update `looksLikeReceiptItem`**

Replace the existing `looksLikeReceiptItem` in `extractors.ts`:

```ts
function looksLikeReceiptItem(line: string, inferredRetailer: string | null = null) {
  const normalized = line.toLowerCase();
  const trimmed = line.trim();

  if (trimmed.length < 3 || trimmed.length > 80) {
    return false;
  }

  if (/subtotal|total|tax|gst|visa|eftpos|change|receipt|invoice|auth|terminal/.test(normalized)) {
    return false;
  }

  // Exclude the retailer header line itself
  if (
    inferredRetailer &&
    normalized === inferredRetailer.toLowerCase()
  ) {
    return false;
  }

  const hasCurrencyTail = /(\$|aud|usd|eur)?\s?\d+[.,]\d{2}$/i.test(normalized);
  const mentionsClothing = CLOTHING_KEYWORDS.some((keyword) => normalized.includes(keyword));
  // Relaxed: also accept lines that look like product names (letters present, no pure-digit content)
  const looksLikeProductName =
    /[a-z]/i.test(trimmed) &&
    !/^\d+$/.test(trimmed) &&
    trimmed.length >= 3;

  return hasCurrencyTail || mentionsClothing || looksLikeProductName;
}
```

Then update the call site in `parseReceiptDraftCandidates` to pass the retailer:

```ts
const candidates = mergedLines
  .filter((line) => looksLikeReceiptItem(line, inferredRetailer))
  // ... rest unchanged
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx vitest run lib/domain/ingestion/__tests__/extractors.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/extractors.ts lib/domain/ingestion/__tests__/extractors.test.ts
git commit -m "feat(ingestion): relax receipt item detection to catch lines without price or clothing keyword"
```

---

## Task 3: Retailer scoring

The current `inferReceiptRetailer` takes the first qualifying line, which fails on multi-line headers or unusual receipt formatting.

**Files:**
- Modify: `lib/domain/ingestion/extractors.ts` (`inferReceiptRetailer`)
- Test: `lib/domain/ingestion/__tests__/extractors.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/domain/ingestion/__tests__/extractors.test.ts`:

```ts
it("infers retailer when header has an address line before the store name", () => {
  const result = parseReceiptDraftCandidates({
    receiptText: `
      123 Collins Street
      MYER
      Bardot Silk Midi Dress AUD 289.00
      Total AUD 289.00
    `
  });

  expect(result[0]?.retailer).toBe("Myer");
});

it("prefers a known retailer name over an unknown first line", () => {
  const result = parseReceiptDraftCandidates({
    receiptText: `
      PO Box 456
      THE ICONIC
      Linen blazer AUD 179.00
      Total AUD 179.00
    `
  });

  expect(result[0]?.retailer).toBe("The Iconic");
});
```

- [ ] **Step 2: Run test to confirm both fail**

```bash
npx vitest run lib/domain/ingestion/__tests__/extractors.test.ts
```

Expected: both new tests FAIL.

- [ ] **Step 3: Replace `inferReceiptRetailer` with a scoring approach**

Replace the existing `inferReceiptRetailer` function in `extractors.ts`:

```ts
const KNOWN_RETAILER_FRAGMENTS = [
  "david jones",
  "myer",
  "the iconic",
  "reformation",
  "viktoria & woods",
  "farfetch",
  "country road",
  "witchery",
  "seed heritage",
  "uniqlo",
  "zara",
  "h&m",
];

function inferReceiptRetailer(lines: string[]) {
  // Score each of the first 8 lines as a retailer candidate
  const candidates = lines.slice(0, 8).map((line) => {
    const normalized = line.toLowerCase().trim();
    let score = 0;

    // Strong signal: matches a known retailer
    if (KNOWN_RETAILER_FRAGMENTS.some((r) => normalized.includes(r))) {
      score += 2;
    }

    // Weak positive: title-case word(s) with no digits
    if (/^[A-Z][a-zA-Z &]+$/.test(line.trim()) && !/\d/.test(line)) {
      score += 1;
    }

    // Negative signals
    if (/subtotal|total|tax|gst|visa|eftpos|change|receipt|invoice|auth|terminal/.test(normalized)) {
      score -= 2;
    }
    if (/\d+[.,]\d{2}/.test(normalized)) {
      score -= 1;
    }
    // Address-like lines
    if (/\d{1,4}\s+[a-z]/i.test(normalized) || /\bst\b|\bave\b|\brd\b|\blane\b|\bpo box\b/i.test(normalized)) {
      score -= 2;
    }

    return { line, score };
  });

  const best = candidates.reduce(
    (acc, c) => (c.score > acc.score ? c : acc),
    { line: "", score: -1 }
  );

  return best.score > 0 ? normalizeReceiptMerchantLabel(best.line) : null;
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx vitest run lib/domain/ingestion/__tests__/extractors.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/extractors.ts lib/domain/ingestion/__tests__/extractors.test.ts
git commit -m "feat(ingestion): replace first-line retailer inference with scored candidate selection"
```

---

## Task 4: Field-level confidence

Currently all fields on a receipt draft get the same confidence score. Price extracted directly should be more trusted than a derived category.

**Files:**
- Modify: `lib/domain/ingestion/extractors.ts` (`ReceiptDraftCandidate` type, `parseReceiptDraftCandidates`)
- Modify: `lib/domain/ingestion/adapters.ts` (`receiptAdapter.buildDraft`)
- Test: `lib/domain/ingestion/__tests__/extractors.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/domain/ingestion/__tests__/extractors.test.ts`:

```ts
it("assigns higher confidence to price than to category", () => {
  const result = parseReceiptDraftCandidates({
    receiptText: `
      MYER
      Basque Floral Midi Dress AUD 189.00
      Total AUD 189.00
    `
  });

  expect(result).toHaveLength(1);
  const fc = result[0]!.fieldConfidence;
  expect(fc.price).toBeGreaterThan(fc.category);
  expect(fc.price).toBeGreaterThanOrEqual(0.70);
  expect(fc.category).toBeLessThan(0.40);
});

it("assigns lower confidence to brand when it is derived, not extracted", () => {
  const result = parseReceiptDraftCandidates({
    receiptText: `
      Some Unknown Store
      Floral Midi Dress AUD 189.00
      Total AUD 189.00
    `
  });

  expect(result).toHaveLength(1);
  const fc = result[0]!.fieldConfidence;
  // Brand is inferred from line, not a known retailer match
  expect(fc.brand).toBeLessThan(0.35);
});
```

- [ ] **Step 2: Run test to confirm both fail (type error expected)**

```bash
npx vitest run lib/domain/ingestion/__tests__/extractors.test.ts
```

Expected: TypeScript error — `fieldConfidence` does not exist on `ReceiptDraftCandidate`.

- [ ] **Step 3: Add `fieldConfidence` to `ReceiptDraftCandidate`**

In `lib/domain/ingestion/extractors.ts`, replace the type definition at line 139:

```ts
export type ReceiptDraftCandidateFieldConfidence = {
  title: number;
  category: number;
  colour: number;
  brand: number;
  retailer: number;
  price: number;
  currency: number;
};

export type ReceiptDraftCandidate = {
  title: string;
  category: string | null;
  colour: string | null;
  brand: string | null;
  retailer: string | null;
  price: number | null;
  currency: string | null;
  notes: string | null;
  confidence: number;
  fieldConfidence: ReceiptDraftCandidateFieldConfidence;
};
```

- [ ] **Step 4: Add a helper to build field confidence**

Add after the type definitions in `extractors.ts`:

```ts
function buildReceiptFieldConfidence(params: {
  hasDirectPrice: boolean;
  hasKnownRetailer: boolean;
  hasBrandFromRetailer: boolean;
}): ReceiptDraftCandidateFieldConfidence {
  return {
    title: 0.55,
    category: 0.30,
    colour: 0.35,
    brand: params.hasBrandFromRetailer ? 0.60 : params.hasKnownRetailer ? 0.45 : 0.25,
    retailer: params.hasKnownRetailer ? 0.65 : 0.20,
    price: params.hasDirectPrice ? 0.75 : 0.30,
    currency: params.hasDirectPrice ? 0.65 : 0.25,
  };
}
```

- [ ] **Step 5: Use per-field confidence in `parseReceiptDraftCandidates`**

In `parseReceiptDraftCandidates`, update the candidate mapping to compute and attach `fieldConfidence`. The relevant section currently reads:

```ts
const candidates = mergedLines
  .filter((line) => looksLikeReceiptItem(line, inferredRetailer))
  .map((line) => {
    const cleaned = cleanReceiptLine(line) || line.trim();
    const price = parseReceiptLinePrice(line);
    const parsedLine = parseReceiptLineMetadata({
      cleanedLine: cleaned,
      retailer: inferredRetailer,
      fallbackBrand: inferredBrand
    });

    return {
      title: parsedLine.title,
      category: deriveCategoryFromText(parsedLine.title),
      colour: deriveColourFromText(parsedLine.title),
      brand: parsedLine.brand,
      retailer: inferredRetailer,
      price,
      currency: inferredCurrency,
      notes: null,
      confidence: price != null ? 0.38 : 0.32
    } satisfies ReceiptDraftCandidate;
  });
```

Replace with:

```ts
const knownRetailers = KNOWN_RETAILER_FRAGMENTS;
const isKnownRetailer =
  inferredRetailer != null &&
  knownRetailers.some((r) => inferredRetailer.toLowerCase().includes(r));

const candidates = mergedLines
  .filter((line) => looksLikeReceiptItem(line, inferredRetailer))
  .map((line) => {
    const cleaned = cleanReceiptLine(line) || line.trim();
    const price = parseReceiptLinePrice(line);
    const parsedLine = parseReceiptLineMetadata({
      cleanedLine: cleaned,
      retailer: inferredRetailer,
      fallbackBrand: inferredBrand
    });

    const hasBrandFromRetailer =
      parsedLine.brand != null &&
      inferredRetailer != null &&
      parsedLine.brand.toLowerCase() === inferredRetailer.toLowerCase();

    return {
      title: parsedLine.title,
      category: deriveCategoryFromText(parsedLine.title),
      colour: deriveColourFromText(parsedLine.title),
      brand: parsedLine.brand,
      retailer: inferredRetailer,
      price,
      currency: inferredCurrency,
      notes: null,
      confidence: price != null ? 0.38 : 0.32,
      fieldConfidence: buildReceiptFieldConfidence({
        hasDirectPrice: price != null,
        hasKnownRetailer: isKnownRetailer,
        hasBrandFromRetailer,
      }),
    } satisfies ReceiptDraftCandidate;
  });
```

Also update the fallback candidate (at the bottom of `parseReceiptDraftCandidates`) to include `fieldConfidence`:

```ts
return params.fallbackTitle
  ? [
      {
        title: params.fallbackTitle,
        category: deriveCategoryFromText(params.fallbackTitle),
        colour: deriveColourFromText(params.fallbackTitle),
        brand: inferredBrand,
        retailer: inferredRetailer,
        price: null,
        currency: inferredCurrency,
        notes: normalizedText.slice(0, 300),
        confidence: 0.16,
        fieldConfidence: buildReceiptFieldConfidence({
          hasDirectPrice: false,
          hasKnownRetailer: isKnownRetailer,
          hasBrandFromRetailer: false,
        }),
      }
    ]
  : [];
```

And the empty-text fallback candidate near the top of the function:

```ts
return params.fallbackTitle
  ? [
      {
        title: params.fallbackTitle,
        category: deriveCategoryFromText(params.fallbackTitle),
        colour: deriveColourFromText(params.fallbackTitle),
        brand: null,
        retailer: null,
        price: null,
        currency: null,
        notes: null,
        confidence: 0.12,
        fieldConfidence: buildReceiptFieldConfidence({
          hasDirectPrice: false,
          hasKnownRetailer: false,
          hasBrandFromRetailer: false,
        }),
      }
    ]
  : [];
```

- [ ] **Step 6: Update `receiptAdapter.buildDraft` to use per-field confidence**

In `lib/domain/ingestion/adapters.ts`, find `receiptAdapter.buildDraft` and replace the `fieldConfidence` building block:

```ts
// Replace:
const c = input.candidate.confidence;
const fieldConfidence: Partial<Record<DraftFieldName, number>> = {};
const fieldProvenance: Partial<Record<DraftFieldName, string>> = {};

if (input.candidate.title) {
  fieldConfidence.title = c; fieldProvenance.title = "ai_text";
}
if (input.candidate.category) {
  fieldConfidence.category = c; fieldProvenance.category = "ai_text";
}
if (input.candidate.colour) {
  fieldConfidence.colour = c; fieldProvenance.colour = "ai_text";
}
if (input.candidate.brand) {
  fieldConfidence.brand = c; fieldProvenance.brand = "ai_text";
}
if (input.candidate.retailer) {
  fieldConfidence.retailer = c; fieldProvenance.retailer = "ai_text";
}
if (input.candidate.price !== null && input.candidate.price !== undefined) {
  fieldConfidence.purchase_price = c; fieldProvenance.purchase_price = "ai_text";
}
if (input.candidate.currency) {
  fieldConfidence.purchase_currency = c; fieldProvenance.purchase_currency = "ai_text";
}

// With:
const fc = input.candidate.fieldConfidence;
const fieldConfidence: Partial<Record<DraftFieldName, number>> = {};
const fieldProvenance: Partial<Record<DraftFieldName, string>> = {};

if (input.candidate.title) {
  fieldConfidence.title = fc.title; fieldProvenance.title = "ai_text";
}
if (input.candidate.category) {
  fieldConfidence.category = fc.category; fieldProvenance.category = "ai_text";
}
if (input.candidate.colour) {
  fieldConfidence.colour = fc.colour; fieldProvenance.colour = "ai_text";
}
if (input.candidate.brand) {
  fieldConfidence.brand = fc.brand; fieldProvenance.brand = "ai_text";
}
if (input.candidate.retailer) {
  fieldConfidence.retailer = fc.retailer; fieldProvenance.retailer = "ai_text";
}
if (input.candidate.price !== null && input.candidate.price !== undefined) {
  fieldConfidence.purchase_price = fc.price; fieldProvenance.purchase_price = "ai_text";
}
if (input.candidate.currency) {
  fieldConfidence.purchase_currency = fc.currency; fieldProvenance.purchase_currency = "ai_text";
}
```

- [ ] **Step 7: Run all tests to confirm they pass**

```bash
npx vitest run lib/domain/ingestion/__tests__/extractors.test.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/domain/ingestion/extractors.ts lib/domain/ingestion/adapters.ts lib/domain/ingestion/__tests__/extractors.test.ts
git commit -m "feat(ingestion): add per-field confidence to receipt draft candidates"
```

---

## Task 5: Explicit error handling in server action

Silent `.catch(() => null)` means OCR failures are invisible to the user.

**Files:**
- Modify: `app/wardrobe/actions.ts` (`createReceiptDraftAction`)

- [ ] **Step 1: Replace the OCR call with explicit error handling**

In `app/wardrobe/actions.ts`, find the OCR block (~lines 459–465):

```ts
const ocrText =
  fileText || !shouldAttemptReceiptOcr(file)
    ? null
    : await callReceiptOcrService({
        serviceUrl: getServerEnv().PIPELINE_SERVICE_URL,
        file
      }).catch(() => null);
```

Replace with:

```ts
let ocrText: string | null = null;
const needsOcr = !fileText && shouldAttemptReceiptOcr(file);
if (needsOcr) {
  try {
    ocrText = await callReceiptOcrService({
      serviceUrl: getServerEnv().PIPELINE_SERVICE_URL,
      file
    });
  } catch {
    return {
      status: "error",
      message: "Receipt scan failed — try again."
    };
  }
}
```

- [ ] **Step 2: Add a 0-item error after candidate parsing**

After the `parseReceiptDraftCandidates` call, add a guard before the draft-creation loop. Find:

```ts
const draftIds: string[] = [];

for (const candidate of candidates) {
```

Replace with:

```ts
// If OCR ran but parsing produced nothing useful, tell the user
if (needsOcr && ocrText && candidates.length === 0) {
  return {
    status: "error",
    message: "Couldn't read items from this receipt — you can add them manually."
  };
}

const draftIds: string[] = [];

for (const candidate of candidates) {
```

- [ ] **Step 3: Run the full test suite to confirm nothing is broken**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/wardrobe/actions.ts
git commit -m "fix(ingestion): surface OCR and parse failures as user-facing errors instead of silent fallback"
```

---

## Task 6: Modal OCR endpoint

Implement the missing `/receipt-ocr` endpoint in the Modal backend.

**Files:**
- Modify: `modal_fashion_app.py`

- [ ] **Step 1: Add the OCR image definition**

In `modal_fashion_app.py`, add `ocr_image` after the existing `api_image` definition (~line 32):

```python
# OCR image — PaddleOCR + pdfplumber for receipt scanning (CPU-only, keep-warm)
ocr_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "libgomp1")
    .pip_install(
        "paddlepaddle==2.6.1",
        "paddleocr>=2.7.0,<3.0",
        "pdfplumber",
        "pymupdf",
        "Pillow",
        "fastapi",
        "python-multipart",
    )
)
```

- [ ] **Step 2: Add the `ReceiptOcr` Modal class**

Add after the `FashionPipeline` class definition and before the `# --- FastAPI web endpoint ---` comment:

```python
@app.cls(
    image=ocr_image,
    cpu=2,
    keep_warm=1,
    scaledown_window=600,
    timeout=120,
)
class ReceiptOcr:
    """CPU-only receipt OCR. keep_warm=1 eliminates cold starts for this user-facing flow."""

    @modal.enter()
    def load_ocr(self):
        from paddleocr import PaddleOCR
        self.ocr = PaddleOCR(use_angle_cls=True, lang="en", use_gpu=False, show_log=False)

    @modal.method()
    def extract_text(self, file_bytes: bytes, mime_type: str) -> str:
        import io
        import pdfplumber
        import fitz  # pymupdf
        import numpy as np
        from PIL import Image

        if mime_type == "application/pdf":
            # Fast path: try text layer extraction first
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                pages_text = [page.extract_text() or "" for page in pdf.pages]
            text = "\n".join(pages_text).strip()
            if text:
                return text
            # Fall through: render pages as images for PaddleOCR
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            images = []
            for page in doc:
                mat = fitz.Matrix(2, 2)  # 2× scale for readability
                pix = page.get_pixmap(matrix=mat)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                images.append(np.array(img))
        else:
            img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            images = [np.array(img)]

        lines = []
        for img_array in images:
            result = self.ocr.ocr(img_array, cls=True)
            if not result:
                continue
            for block in result:
                if not block:
                    continue
                for line in block:
                    if line and len(line) >= 2:
                        text_val = (
                            line[1][0]
                            if isinstance(line[1], (list, tuple))
                            else line[1]
                        )
                        if isinstance(text_val, str) and text_val.strip():
                            lines.append(text_val.strip())

        return "\n".join(lines)
```

- [ ] **Step 3: Add the `/receipt-ocr` route to the FastAPI app**

Inside the `api()` function, add `ocr_instance = ReceiptOcr()` alongside `pipeline = FashionPipeline()`:

```python
pipeline = FashionPipeline()
ocr_instance = ReceiptOcr()   # ← add this line
```

Then add the route after the `/scrape` route (before `return web`):

```python
RECEIPT_OCR_ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
}
RECEIPT_OCR_MAX_BYTES = 20 * 1024 * 1024  # 20 MB

@web.post("/receipt-ocr")
async def receipt_ocr(file: UploadFile = File(...)):
    content_type = file.content_type or ""
    if content_type not in RECEIPT_OCR_ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: image/jpeg, image/png, image/webp, image/heic, application/pdf"
        )
    file_bytes = await file.read()
    if len(file_bytes) > RECEIPT_OCR_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    text = await ocr_instance.extract_text.remote.aio(file_bytes, content_type)
    return {"text": text}
```

- [ ] **Step 4: Update the `/capabilities` endpoint**

Find the `capabilities()` function and update:

```python
@web.get("/capabilities")
async def capabilities():
    return {
        "image_analysis": True,
        "product_page_scrape": True,
        "receipt_ocr": True,   # ← was False
        "outfit_decomposition": True,
        "endpoints": ["/health", "/capabilities", "/analyse", "/scrape", "/receipt-ocr"],
    }
```

- [ ] **Step 5: Deploy to Modal**

```bash
modal deploy modal_fashion_app.py
```

Expected output includes: `✓ Created function ReceiptOcr` and the `/receipt-ocr` endpoint listed.

- [ ] **Step 6: Smoke-test the endpoint**

Download a test receipt image (any JPEG will do) and test:

```bash
curl -X POST \
  "$(modal app logs fashion-pipeline --url)/receipt-ocr" \
  -F "file=@/path/to/test-receipt.jpg" \
  | python3 -m json.tool
```

Expected: JSON response with a `"text"` key containing extracted receipt lines.

- [ ] **Step 7: Run the full TypeScript test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add modal_fashion_app.py
git commit -m "feat(modal): add /receipt-ocr endpoint with PaddleOCR, pdfplumber fast path, keep_warm=1"
```

---

## Self-review notes

- Task 1–4 cover all four heuristic parser improvements from the spec
- Task 5 covers both error rows in the spec's error-handling table (5xx/network → "Receipt scan failed"; 0 items → "Couldn't read items")
- Task 6 covers the Modal endpoint, PDF fast path, file-size/type validation, and capabilities update
- `KNOWN_RETAILER_FRAGMENTS` is defined in Task 3 and referenced in Task 4 — both are in `extractors.ts`, no cross-file dependency issue
- `needsOcr` is declared in Task 5 and reused in the 0-item guard — both are within the same function scope
