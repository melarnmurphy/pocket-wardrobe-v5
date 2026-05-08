# Modal Pipeline Graceful Fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Modal health endpoint cold-start bug, add a 30s timeout to pipeline calls, and show a prompted fallback dialog when the pipeline is unavailable — routing the user to manual draft creation instead of a dead-end error.

**Architecture:** Add a `PipelineUnavailableError` class to the pipeline client; both server actions (`uploadAndAnalyseAction`, `createPhotoDraftAction`) catch it and return a structured `code: "pipeline_unavailable"` result carrying `sourceId` + `fileName`; both frontend entry points (`UploadCard`, `WardrobeShop`) detect that code and show a dialog whose "Create manual draft" button calls a new `createManualFallbackDraftAction` server action. The Modal app fix moves `FashionPipeline()` instantiation inside the `/analyse` handler so `/health` responds without a GPU cold start.

**Tech Stack:** Python/Modal (backend fix), TypeScript/Next.js App Router, React `useState`/`useTransition`, Vitest

---

### Task 1: Fix Modal app — lazy FashionPipeline instantiation

**Files:**
- Modify: `modal_fashion_app.py:204`

No test for this task (the fix is a deployment-side change; verified by curl after deploy).

- [ ] **Step 1: Move `FashionPipeline()` instantiation to inside the `/analyse` handler**

In `modal_fashion_app.py`, the current `api()` function body looks like this:

```python
def api():
    from fastapi import FastAPI, File, UploadFile, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    web = FastAPI(title="Fashion Vision API")

    web.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    pipeline = FashionPipeline()          # ← REMOVE this line from here

    @web.get("/health")
    async def health():
        return {"status": "ok"}

    @web.get("/capabilities")
    async def capabilities():
        ...

    @web.post("/analyse")
    async def analyse(
        file: UploadFile = File(...),
        threshold: float = 0.5,
    ):
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        image_bytes = await file.read()
        garments = await pipeline.process.remote.aio(image_bytes, threshold=threshold)  # ← uses pipeline
```

Change it to:

```python
def api():
    from fastapi import FastAPI, File, UploadFile, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    web = FastAPI(title="Fashion Vision API")

    web.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @web.get("/health")
    async def health():
        return {"status": "ok"}

    @web.get("/capabilities")
    async def capabilities():
        return {
            "image_analysis": True,
            "product_page_scrape": True,
            "receipt_ocr": False,
            "outfit_decomposition": True,
            "endpoints": ["/health", "/capabilities", "/analyse", "/scrape"],
        }

    @web.post("/analyse")
    async def analyse(
        file: UploadFile = File(...),
        threshold: float = 0.5,
    ):
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        image_bytes = await file.read()
        pipeline = FashionPipeline()      # ← instantiate lazily here only
        garments = await pipeline.process.remote.aio(image_bytes, threshold=threshold)

        return {
            "filename":       file.filename,
            "garment_count":  len(garments),
            "garments":       garments,
        }
```

- [ ] **Step 2: Deploy to Modal**

```bash
.venv/bin/modal deploy modal_fashion_app.py
```

Expected output includes: `✓ Created objects.` and the deployment URL.

- [ ] **Step 3: Verify health responds quickly**

```bash
curl -s --max-time 10 https://melarnmurphy--fashion-pipeline-api.modal.run/health
```

Expected: `{"status":"ok"}` within ~1s (no GPU cold start required).

- [ ] **Step 4: Commit**

```bash
git add modal_fashion_app.py
git commit -m "fix(modal): lazy-init FashionPipeline so /health responds without GPU cold start"
```

---

### Task 2: Add `PipelineUnavailableError` + 30s timeout to client

**Files:**
- Modify: `lib/domain/ingestion/client.ts`
- Test: `lib/domain/ingestion/__tests__/client.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `lib/domain/ingestion/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callPipelineService, PipelineUnavailableError } from "../client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("callPipelineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws PipelineUnavailableError when the service returns a non-2xx status", async () => {
    // First fetch (image download) succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["img"], { type: "image/jpeg" }),
      })
      // Second fetch (pipeline call) returns 503
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      });

    await expect(
      callPipelineService({
        serviceUrl: "http://localhost:8000",
        imageUrl: "http://example.com/img.jpg",
      })
    ).rejects.toBeInstanceOf(PipelineUnavailableError);
  });

  it("throws PipelineUnavailableError on fetch timeout (AbortError)", async () => {
    // First fetch (image download) succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["img"], { type: "image/jpeg" }),
      })
      // Second fetch (pipeline call) never resolves — simulate abort
      .mockImplementationOnce((_url: string, opts: RequestInit) => {
        return new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => {
            const err = new DOMException("The operation was aborted.", "AbortError");
            reject(err);
          });
        });
      });

    const promise = callPipelineService({
      serviceUrl: "http://localhost:8000",
      imageUrl: "http://example.com/img.jpg",
    });

    // Advance past 30s timeout
    await vi.advanceTimersByTimeAsync(31_000);

    await expect(promise).rejects.toBeInstanceOf(PipelineUnavailableError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/domain/ingestion/__tests__/client.test.ts
```

Expected: FAIL — `PipelineUnavailableError` is not exported.

- [ ] **Step 3: Add `PipelineUnavailableError` and 30s timeout to `client.ts`**

Replace the `callPipelineService` function in `lib/domain/ingestion/client.ts` with:

```typescript
export class PipelineUnavailableError extends Error {
  readonly code = "pipeline_unavailable" as const;
  constructor(cause?: string) {
    super(cause ?? "Pipeline service unavailable");
    this.name = "PipelineUnavailableError";
  }
}

export async function callPipelineService(
  params: CallPipelineServiceParams
): Promise<PipelineAnalyzeResponse> {
  const { serviceUrl, imageUrl, threshold = 0.5 } = params;

  // Download the image from the signed Supabase URL
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }
  const imageBlob = await imageResponse.blob();

  // Re-upload as multipart to Modal's /analyse endpoint
  const formData = new FormData();
  formData.append("file", imageBlob, "image.jpg");

  const url = new URL("/analyse", serviceUrl);
  url.searchParams.set("threshold", String(threshold));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new PipelineUnavailableError(
        `${response.status}${text ? ` — ${text}` : ""}`
      );
    }

    // Modal returns { filename, garment_count, garments: [...] }
    const raw = await response.json() as Record<string, unknown>;
    return pipelineAnalyzeResponseSchema.parse({ garments: raw["garments"] ?? [] });
  } catch (err) {
    if (err instanceof PipelineUnavailableError) throw err;
    // AbortError from timeout, network error, etc.
    throw new PipelineUnavailableError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/domain/ingestion/__tests__/client.test.ts
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/client.ts lib/domain/ingestion/__tests__/client.test.ts
git commit -m "feat(pipeline): add PipelineUnavailableError with 30s abort timeout"
```

---

### Task 3: Add `pipeline_unavailable` fields to shared types

**Files:**
- Modify: `lib/domain/wardrobe/action-state.ts`
- Modify: `app/page-actions.ts` (UploadActionResult type only)

- [ ] **Step 1: Extend `WardrobeActionState`**

In `lib/domain/wardrobe/action-state.ts`, change the type to:

```typescript
export type WardrobeActionState = {
  status: "idle" | "success" | "error" | "partial";
  message: string | null;
  garmentId?: string;
  draftIds?: string[];
  nextPath?: string;
  code?: "pipeline_unavailable";
  sourceId?: string;
  fileName?: string;
};

export const wardrobeActionState: WardrobeActionState = {
  status: "idle",
  message: null
};
```

- [ ] **Step 2: Extend `UploadActionResult`**

In `app/page-actions.ts`, change the type to:

```typescript
export type UploadActionResult =
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "error"; code: "pipeline_unavailable"; sourceId: string; fileName: string };
```

- [ ] **Step 3: Commit**

```bash
git add lib/domain/wardrobe/action-state.ts app/page-actions.ts
git commit -m "feat(types): add pipeline_unavailable code fields to action state types"
```

---

### Task 4: Update `createPhotoDraftAction` to return `pipeline_unavailable`

**Files:**
- Modify: `app/wardrobe/actions.ts:268-351`
- Test: `app/wardrobe/__tests__/photo-draft-entitlements.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `app/wardrobe/__tests__/photo-draft-entitlements.test.ts` (inside the existing `describe` block, after the existing test):

```typescript
import { PipelineUnavailableError } from "@/lib/domain/ingestion/client";

// Add this import alongside the existing vi.mock for ingestion/client:
// vi.mock("@/lib/domain/ingestion/client", ...) already mocks callPipelineService

it("returns pipeline_unavailable when the pipeline service is down", async () => {
  const { createPhotoDraftAction } = await import("@/app/wardrobe/actions");

  canUseFeatureLabels.mockResolvedValue(true);
  createGarmentSource.mockResolvedValue({
    sourceId: "11111111-1111-4111-8111-111111111111",
    storagePath: "user/pipeline-uploads/test-top.jpg"
  });

  // Mock Supabase signed URL
  const { createClient } = await import("@/lib/supabase/server");
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/signed-url.jpg" },
          error: null,
        }),
      }),
    },
  });

  callPipelineService.mockRejectedValue(
    new PipelineUnavailableError("connection timeout")
  );

  const formData = new FormData();
  formData.set("image", new File(["binary"], "test-top.jpg", { type: "image/jpeg" }));

  const result = await createPhotoDraftAction(
    { status: "idle", message: null },
    formData
  );

  expect(result.status).toBe("error");
  expect(result.code).toBe("pipeline_unavailable");
  expect(result.sourceId).toBe("11111111-1111-4111-8111-111111111111");
  expect(result.fileName).toBe("test-top.jpg");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run app/wardrobe/__tests__/photo-draft-entitlements.test.ts
```

Expected: FAIL — `result.code` is undefined.

- [ ] **Step 3: Update `createPhotoDraftAction` to catch `PipelineUnavailableError`**

In `app/wardrobe/actions.ts`, add the import at the top alongside the existing `callPipelineService` import:

```typescript
import {
  callPipelineService,
  callReceiptOcrService,
  PipelineUnavailableError
} from "@/lib/domain/ingestion/client";
```

Then in `createPhotoDraftAction`, replace the existing pipeline call block (lines ~310–350) with:

```typescript
    const env = getServerEnv();
    let result;
    try {
      result = await callPipelineService({
        serviceUrl: env.PIPELINE_SERVICE_URL,
        imageUrl: signedUrlData.signedUrl
      });
    } catch (err) {
      if (err instanceof PipelineUnavailableError) {
        return {
          status: "error",
          code: "pipeline_unavailable",
          message: "Analysis service unavailable.",
          sourceId,
          fileName: file.name,
        };
      }
      throw err;
    }

    const draftIds = await createDraftsFromPipelineResult({
      sourceId,
      storagePath,
      result
    });

    revalidatePath("/wardrobe/review");

    return {
      status: "success",
      draftIds,
      nextPath: "/wardrobe/review",
      message:
        draftIds.length > 0
          ? `${draftIds.length} draft${draftIds.length === 1 ? "" : "s"} ready to review.`
          : "No garments detected from that image."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not analyse photo."
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/wardrobe/__tests__/photo-draft-entitlements.test.ts
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/wardrobe/actions.ts app/wardrobe/__tests__/photo-draft-entitlements.test.ts
git commit -m "feat(actions): return pipeline_unavailable from createPhotoDraftAction"
```

---

### Task 5: Update `uploadAndAnalyseAction` to return `pipeline_unavailable`

**Files:**
- Modify: `app/page-actions.ts`

No additional test file — the action uses a redirect pattern that makes unit testing tricky. Manual verification in Task 8 covers this.

- [ ] **Step 1: Add `PipelineUnavailableError` import and update the action**

In `app/page-actions.ts`, update imports:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { createGarmentSource } from "@/lib/domain/ingestion/service";
import { createDraftsFromPipelineResult } from "@/lib/domain/ingestion/service";
import { createManualPhotoReviewDraft } from "@/lib/domain/ingestion/service";
import {
  callPipelineService,
  PipelineUnavailableError
} from "@/lib/domain/ingestion/client";
import { canUseFeatureLabels } from "@/lib/domain/entitlements/service";
import { redirect } from "next/navigation";
```

Replace the `try` block inside `uploadAndAnalyseAction`:

```typescript
  try {
    const { sourceId, storagePath } = await createGarmentSource({ file });
    const featureLabelsEnabled = await canUseFeatureLabels();

    if (!featureLabelsEnabled) {
      await createManualPhotoReviewDraft({
        sourceId,
        fileName: file.name
      });
      redirect("/wardrobe/review");
    }

    const supabase = await createClient();
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("garment-originals")
      .createSignedUrl(storagePath, 5 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return { status: "error", message: "Failed to prepare image for analysis." };
    }

    const env = getServerEnv();
    try {
      const result = await callPipelineService({
        serviceUrl: env.PIPELINE_SERVICE_URL,
        imageUrl: signedUrlData.signedUrl,
      });
      await createDraftsFromPipelineResult({ sourceId, storagePath, result });
    } catch (err) {
      if (err instanceof PipelineUnavailableError) {
        return {
          status: "error",
          code: "pipeline_unavailable",
          sourceId,
          fileName: file.name,
        };
      }
      throw err;
    }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Upload and analysis failed.",
    };
  }

  // redirect() is outside try/catch so NEXT_REDIRECT propagates correctly.
  redirect("/wardrobe/review");
```

- [ ] **Step 2: Run the full test suite to check nothing is broken**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/page-actions.ts
git commit -m "feat(actions): return pipeline_unavailable from uploadAndAnalyseAction"
```

---

### Task 6: Add `createManualFallbackDraftAction` server action

**Files:**
- Modify: `app/page-actions.ts`

This shared server action is called by both frontend components when the user confirms the fallback dialog.

- [ ] **Step 1: Add the action at the bottom of `app/page-actions.ts`**

```typescript
export async function createManualFallbackDraftAction(
  sourceId: string,
  fileName: string
): Promise<{ status: "success" } | { status: "error"; message: string }> {
  try {
    await createManualPhotoReviewDraft({ sourceId, fileName });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not create manual draft.",
    };
  }
  redirect("/wardrobe/review");
}
```

- [ ] **Step 2: Run the test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/page-actions.ts
git commit -m "feat(actions): add createManualFallbackDraftAction for pipeline fallback"
```

---

### Task 7: Add fallback dialog to `UploadCard`

**Files:**
- Modify: `app/components/upload-card.tsx`

- [ ] **Step 1: Update `UploadCard` to handle `pipeline_unavailable` and show a dialog**

Replace the entire contents of `app/components/upload-card.tsx` with:

```typescript
"use client";

import { useRef, useState, useTransition } from "react";
import { uploadAndAnalyseAction, createManualFallbackDraftAction } from "@/app/page-actions";
import type { PlanTier } from "@/lib/domain/entitlements";

export default function UploadCard({
  canUseFeatureLabels,
  planTier
}: {
  canUseFeatureLabels: boolean;
  planTier: PlanTier;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isFallbackPending, startFallbackTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<{
    sourceId: string;
    fileName: string;
  } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const formData = new FormData();
    formData.append("image", file);

    startTransition(async () => {
      const result = await uploadAndAnalyseAction(formData);
      if (result.status === "error") {
        if ("code" in result && result.code === "pipeline_unavailable") {
          setFallbackInfo({ sourceId: result.sourceId, fileName: result.fileName });
        } else {
          setError(result.message);
        }
      }
      // On success, the server action's redirect() handles navigation
    });
  }

  function handleFallbackConfirm() {
    if (!fallbackInfo) return;
    startFallbackTransition(async () => {
      const result = await createManualFallbackDraftAction(
        fallbackInfo.sourceId,
        fallbackInfo.fileName
      );
      if (result.status === "error") {
        setFallbackInfo(null);
        setError(result.message);
      }
      // On success, redirect() inside the action handles navigation
    });
  }

  function handleFallbackCancel() {
    setFallbackInfo(null);
    // Reset the file input so the user can try again
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <div
        className="pw-hero flex cursor-pointer flex-col justify-between p-5"
        onClick={() => !isPending && !fallbackInfo && inputRef.current?.click()}
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">New</p>
          <p className="mt-2 text-base font-semibold text-white">
            {canUseFeatureLabels ? "Analyse Outfit / Garment Photo" : "Upload Garment Photo"}
          </p>
          <p className="mt-1 text-[12px] text-white/75">
            {canUseFeatureLabels
              ? "Premium feature labelling detects garments automatically"
              : "Free plan uploads go to manual review"}
          </p>
          {!canUseFeatureLabels ? (
            <p className="mt-2 text-[11px] text-white/80">
              Automatic feature labelling is available on {planTier === "pro" ? "Premium" : "Premium"}.
            </p>
          ) : null}
        </div>

        {isPending ? (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span className="text-xs text-white/80">
              {canUseFeatureLabels ? "Analysing…" : "Uploading…"}
            </span>
          </div>
        ) : (
          <div className="mt-3 w-fit rounded-full border border-white/18 bg-white/12 px-4 py-2 text-xs font-semibold text-white">
            {canUseFeatureLabels ? "Analyse Photo ↑" : "Upload Photo ↑"}
          </div>
        )}

        {error && (
          <p className="mt-2 text-[11px] text-white/90">{error}</p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {fallbackInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[12px] bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Analysis unavailable
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              The garment analysis service is currently busy. You can create a draft manually and fill in the details yourself.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleFallbackCancel}
                className="flex-1 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFallbackConfirm}
                disabled={isFallbackPending}
                className="flex-1 rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isFallbackPending ? "Creating…" : "Create manual draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Run the test suite**

```bash
npx vitest run
```

Expected: all tests pass (this is a UI-only change, no new unit tests needed).

- [ ] **Step 3: Commit**

```bash
git add app/components/upload-card.tsx
git commit -m "feat(ui): show pipeline unavailable fallback dialog in UploadCard"
```

---

### Task 8: Add fallback dialog to `WardrobeShop` photo form

**Files:**
- Modify: `components/wardrobe-shop.tsx` (two sections: state + dialog render)

The `photoDraftState` is already wired via `useActionState`. We need to detect `code === "pipeline_unavailable"` and show the dialog.

- [ ] **Step 1: Import `createManualFallbackDraftAction`**

Near the top of `components/wardrobe-shop.tsx`, add to the imports section (alongside other action imports or wherever the file imports from `@/app/page-actions` if it does — otherwise add a new import):

```typescript
import { createManualFallbackDraftAction } from "@/app/page-actions";
```

- [ ] **Step 2: Add fallback state inside `WardrobeShop`**

Inside the `WardrobeShop` function body, after the existing `useTransition`/`useState` declarations, add:

```typescript
  const [isFallbackPending, startFallbackTransition] = useTransition();
  const [photoPipelineFallback, setPhotoPipelineFallback] = useState<{
    sourceId: string;
    fileName: string;
  } | null>(null);
```

- [ ] **Step 3: Detect `pipeline_unavailable` in the photoDraftState effect**

Find the existing `useEffect` that handles `photoDraftState` (around line 385). After it, add a new effect:

```typescript
  useEffect(() => {
    if (
      photoDraftState.status === "error" &&
      photoDraftState.code === "pipeline_unavailable" &&
      photoDraftState.sourceId &&
      photoDraftState.fileName
    ) {
      setPhotoPipelineFallback({
        sourceId: photoDraftState.sourceId,
        fileName: photoDraftState.fileName,
      });
    }
  }, [photoDraftState.status, photoDraftState.code, photoDraftState.sourceId, photoDraftState.fileName]);
```

- [ ] **Step 4: Add fallback dialog handlers**

Inside `WardrobeShop`, add these two handlers alongside the other handler functions:

```typescript
  function handlePhotoPipelineFallbackConfirm() {
    if (!photoPipelineFallback) return;
    startFallbackTransition(async () => {
      const result = await createManualFallbackDraftAction(
        photoPipelineFallback.sourceId,
        photoPipelineFallback.fileName
      );
      if (result.status === "error") {
        setPhotoPipelineFallback(null);
      }
      // On success, redirect() inside the action navigates to /wardrobe/review
    });
  }

  function handlePhotoPipelineFallbackCancel() {
    setPhotoPipelineFallback(null);
  }
```

- [ ] **Step 5: Render the fallback dialog**

Find the closing `</div>` or `</>` at the very end of the `WardrobeShop` return statement. Just before it, add:

```typescript
      {photoPipelineFallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[12px] bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Analysis unavailable
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              The garment analysis service is currently busy. You can create a draft manually and fill in the details yourself.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handlePhotoPipelineFallbackCancel}
                className="flex-1 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePhotoPipelineFallbackConfirm}
                disabled={isFallbackPending}
                className="flex-1 rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isFallbackPending ? "Creating…" : "Create manual draft"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Run the test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/wardrobe-shop.tsx
git commit -m "feat(ui): show pipeline unavailable fallback dialog in WardrobeShop photo form"
```

---

## Self-Review

**Spec coverage:**
- ✓ Modal health fix (Task 1)
- ✓ 30s timeout + `PipelineUnavailableError` (Task 2)
- ✓ `createPhotoDraftAction` returns `pipeline_unavailable` (Task 4)
- ✓ `uploadAndAnalyseAction` returns `pipeline_unavailable` (Task 5)
- ✓ `createManualFallbackDraftAction` shared action (Task 6)
- ✓ UploadCard fallback dialog (Task 7)
- ✓ WardrobeShop fallback dialog (Task 8)

**Type consistency check:**
- `PipelineUnavailableError` defined in Task 2, imported in Tasks 4 and 5 ✓
- `createManualFallbackDraftAction(sourceId: string, fileName: string)` defined in Task 6, called with same signature in Tasks 7 and 8 ✓
- `WardrobeActionState.code`, `.sourceId`, `.fileName` added in Task 3, used in Tasks 4 and 8 ✓
- `UploadActionResult` third variant defined in Task 3, returned in Task 5, read in Task 7 ✓

**No placeholders found.**
