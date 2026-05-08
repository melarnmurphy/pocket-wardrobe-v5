# Modal Fashion Pipeline — Graceful Fallback Design

**Date:** 2026-05-08
**Status:** Approved

## Problem

The Modal `fashion-pipeline` app (`ap-vYd7PWgDUDUJq48nuugApu`) is deployed and reachable at `https://melarnmurphy--fashion-pipeline-api.modal.run`, but:

1. `/health` times out because `FashionPipeline()` is instantiated eagerly inside `api()`, triggering a full GPU cold start on every request — including lightweight health pings.
2. `callPipelineService()` has no timeout, so premium users wait indefinitely when the service is cold or down.
3. When the pipeline fails, premium users hit a dead end — no fallback, just an error message.

## Goals

- Fix health endpoint to respond fast without triggering GPU boot.
- Cap pipeline wait time at 30s for analysis requests.
- When the pipeline is unavailable, prompt the user to create a manual draft (already the free-plan path) rather than dead-ending.

## Out of Scope

- Receipt OCR (currently advertised as unavailable by the service; deferred).
- Circuit breaker / Edge Config tracking.
- Pre-flight health check on every upload.

---

## Design

### 1. Modal App Fix (`modal_fashion_app.py`)

**Change:** Move `FashionPipeline()` instantiation from module level inside `api()` to inside the `/analyse` handler only.

**Before:**
```python
@app.function(image=api_image)
@modal.asgi_app()
def api():
    pipeline = FashionPipeline()  # ← triggers GPU cold start for every route

    @web.get("/health")
    async def health():
        return {"status": "ok"}
```

**After:**
```python
@app.function(image=api_image)
@modal.asgi_app()
def api():
    # health and capabilities have no ML dependency — respond immediately

    @web.get("/health")
    async def health():
        return {"status": "ok"}

    @web.post("/analyse")
    async def analyse(...):
        pipeline = FashionPipeline()  # ← lazy, only on actual analysis requests
        ...
```

`/health` and `/capabilities` run in the lightweight `api_image` container with no GPU dependency. `/analyse` still calls `pipeline.process.remote.aio(...)` which dispatches to the GPU container via Modal's standard method dispatch — behaviour is unchanged.

### 2. Typed Error + Timeout (`lib/domain/ingestion/client.ts`)

**Add `PipelineUnavailableError`:**
```ts
export class PipelineUnavailableError extends Error {
  readonly code = "pipeline_unavailable" as const
  constructor(cause?: string) {
    super(cause ?? "Pipeline service unavailable")
  }
}
```

**Add 30s `AbortController` to the `/analyse` fetch:**
```ts
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30_000)
try {
  const res = await fetch(`${PIPELINE_URL}/analyse`, {
    method: "POST",
    body: formData,
    signal: controller.signal,
  })
  if (!res.ok) throw new PipelineUnavailableError(`${res.status}`)
  ...
} catch (err) {
  if (err instanceof PipelineUnavailableError) throw err
  throw new PipelineUnavailableError(String(err))
} finally {
  clearTimeout(timeout)
}
```

**In `createPhotoDraftAction` and `uploadAndAnalyseAction`:** catch `PipelineUnavailableError` specifically and return:
```ts
return { status: "error", code: "pipeline_unavailable", sourceId, fileName }
```
`sourceId` and `fileName` are included so the frontend can trigger manual-draft creation (`createManualPhotoReviewDraft({ sourceId, fileName })`) without re-uploading. `fileName` is already available from the original `File` object at the action call site.

All other errors continue to propagate as generic `"error"` status with a message string.

### 3. Frontend Fallback Dialog

**Trigger:** action state has `code === "pipeline_unavailable"`.

**Entry points affected:** `UploadCard` (`app/components/upload-card.tsx`) and `WardrobeShop` (`components/wardrobe-shop.tsx`).

**Dialog content:**
> **Analysis unavailable**
> The garment analysis service is currently busy. You can create a draft manually and fill in the details yourself.
>
> [Cancel] [Create manual draft]

**"Create manual draft":** calls `createManualPhotoReviewDraft({ sourceId, fileName })` — the same path free-plan users take. The source image is already in Supabase `garment-originals` storage; no re-upload required. Redirects to `/wardrobe/review` with a confidence-0.18 pending draft.

**"Cancel":** dismisses the dialog. The source record remains in storage; no draft is created (consistent with abandoned-upload behaviour today).

---

## Data Flow

```
User uploads photo
    ↓
createGarmentSource() → image stored in garment-originals
    ↓
[premium] callPipelineService() ── timeout: 30s ──┐
    │                                              │ PipelineUnavailableError
    │ success                                      ↓
    ↓                                   action returns { code: "pipeline_unavailable", sourceId }
createDraftsFromPipelineResult()                  ↓
    ↓                                   Frontend shows fallback dialog
redirect → /wardrobe/review              │
                               [Cancel]  │  [Create manual draft]
                                         ↓
                             createManualPhotoReviewDraft(sourceId)
                                         ↓
                             redirect → /wardrobe/review
```

---

## Files Changed

| File | Change |
|------|--------|
| `modal_fashion_app.py` | Move `FashionPipeline()` to lazy init inside `/analyse` handler |
| `lib/domain/ingestion/client.ts` | Add `PipelineUnavailableError`, add 30s AbortController timeout |
| `app/wardrobe/actions.ts` | Catch `PipelineUnavailableError`, return `{ code: "pipeline_unavailable", sourceId }` |
| `app/page-actions.ts` | Same catch as above |
| `app/components/upload-card.tsx` | Show fallback dialog on `pipeline_unavailable` code |
| `components/wardrobe-shop.tsx` | Show fallback dialog on `pipeline_unavailable` code |

---

## Testing

- **Happy path:** Upload photo, pipeline responds within 30s → drafts created, redirect to review. Unchanged.
- **Pipeline down:** Stop the Modal service, upload photo → dialog appears within 30s, click "Create manual draft" → lands on review with empty pending draft.
- **Pipeline timeout:** Slow the service past 30s → same dialog behaviour as above.
- **Cancel fallback:** Dialog cancel → no draft created, user remains on upload page.
- **Health check:** `GET /health` → responds in <1s without triggering GPU cold start.
