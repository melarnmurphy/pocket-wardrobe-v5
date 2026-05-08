# Receipt OCR Hardening — Design Spec

**Date:** 2026-05-08
**Status:** Approved
**Scope:** Receipt ingestion only (URL extraction is a separate spec)

---

## Problem

Receipt OCR is listed as a core ingestion flow but is not implemented. The Modal `/receipt-ocr` endpoint does not exist (capabilities flag is `False`). When a user uploads a receipt image or PDF, the OCR call silently returns `null`, the server action falls back to the filename as the draft title, and a low-confidence draft is created. Only `.txt` and `.csv` uploads actually work today.

---

## Goals

- Image receipts (photos of paper receipts) produce usable draft candidates
- PDF receipts (email/digital) produce usable draft candidates
- Synchronous flow completes in 2–5 seconds (no cold start)
- Failures surface as actionable user messages, not silent low-confidence drafts

---

## Architecture

The pipeline splits on file type before touching Modal:

```
upload
  ├── .txt / .csv  →  existing text path (unchanged)
  ├── .pdf         →  pdfplumber text extraction
  │                      └── if no extractable text → PaddleOCR
  └── image        →  PaddleOCR
                          └── raw text → improved heuristic parser → draft candidates
```

**Modal endpoint** (`/receipt-ocr`):
- Accepts base64-encoded file + mime type
- Runs PaddleOCR, returns plain extracted text
- CPU only — no GPU needed for receipts
- `keep_warm=1` — container always hot, eliminates cold start (~$34/month overhead)
- Does not parse — returns raw text only; parsing stays in TypeScript

**PDF fast path**:
- Use `pdfplumber` to extract text layer from PDF
- If text is non-empty (digital/email receipt): return it directly, skip PaddleOCR
- If text is empty (scanned PDF): pass to PaddleOCR

**Parsing** stays in TypeScript (`extractors.ts`, `adapters.ts`) — Modal is OCR only.

---

## Improved Heuristic Parser

Four targeted fixes to `parseReceiptDraftCandidates` in `extractors.ts`:

### 1. Multi-line item merging
Receipts often split item name and price across consecutive lines. When a line has no price tail but the next line is price-only (matches `^\s*[$€£]?\d+[.,]\d{2}\s*$`), merge the pair before parsing.

### 2. Relaxed item detection
Current requirement: price tail OR clothing keyword. New rule: also accept lines that are 3–60 chars, contain no receipt-noise keywords (`subtotal`, `total`, `tax`, `gst`, `visa`, `eftpos`, `change`, `receipt`, `invoice`), and are not a store header. This catches items like "CASHMERE BLEND CREW" that have no price on the same line.

### 3. Retailer inference improvement
Scan the first 5 lines of the receipt text. Score each as a retailer candidate:
- +2 if it matches a known retailer name (case-insensitive)
- +1 if it's title case with no digits
- -1 if it contains a price pattern or receipt-noise keyword

Take the highest-scoring candidate. Fall back to `null` if no line scores above 0.

### 4. Field-level confidence
Replace the single per-candidate confidence score with per-field confidence:

| Field | Confidence rule |
|---|---|
| `price` | 0.75 if extracted directly from line; 0.30 if inferred |
| `brand` | 0.60 if matched known retailer; 0.25 if derived from title |
| `title` | 0.55 if cleaned item line; 0.20 if fallback |
| `category` | 0.30 always (derived, never extracted from receipt) |
| `retailer` | 0.65 if known retailer match; 0.20 if inferred |

---

## Error Handling

Replace all `.catch(() => null)` patterns in `createReceiptDraftAction` with explicit failure modes:

| Failure | New behaviour |
|---|---|
| Modal returns 5xx or network error | Return error: "Receipt scan failed — try again" |
| OCR succeeds, parser finds 0 items | Return error: "Couldn't read items — add them manually" |
| Non-image PDF (no text layer) | Falls through to PaddleOCR automatically |
| File too large / unsupported type | Reject at upload boundary with clear message |

`keep_warm=1` eliminates the cold-start timeout failure mode.

---

## Files Touched

| File | Change |
|---|---|
| `modal_fashion_app.py` | Add `/receipt-ocr` endpoint with PaddleOCR + pdfplumber, `keep_warm=1` |
| `lib/domain/ingestion/extractors.ts` | Fix `parseReceiptDraftCandidates` (4 improvements above) |
| `lib/domain/ingestion/adapters.ts` | Update receipt adapter for field-level confidence |
| `lib/domain/ingestion/client.ts` | Update `callReceiptOcrService` error handling |
| `app/wardrobe/actions.ts` | Replace `.catch(() => null)` with explicit error returns in `createReceiptDraftAction` |
| `lib/domain/ingestion/__tests__/extractors.test.ts` | Add tests: multi-line merge, relaxed detection, retailer scoring |

---

## Out of Scope

- Claude Vision for parsing (decided against — heuristic fix is sufficient for MVP)
- Additional currency support beyond AUD/USD/EUR
- `.doc`/`.docx` file support
- GPU acceleration (CPU is sufficient for receipt-scale workloads)
- URL extraction hardening (separate spec)
