# Pipeline Draft Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the pipeline-to-wardrobe flow so draft review cards show cropped garment images, allow editing detected metadata before accepting, and attach the crop as the garment's image on accept.

**Architecture:** `sharp` crops each detected garment's bounding box at draft-creation time (server-side, parallel), storing crops in `garment-cutouts`. The review page serves signed URLs for those crops. On accept, `acceptDraftAction` reads the crop path server-side from the draft row, creates the garment, and attaches the crop as a `garment_images` record (`image_type: "cropped"`).

**Tech Stack:** Next.js App Router, TypeScript, Supabase Storage, `sharp` (image cropping), Vitest

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add `sharp` + `@types/sharp` |
| `lib/domain/ingestion/service.ts` | Add `storagePath` to `CreateDraftsParams`; two-phase crop logic; update `PendingDraft` type; read crop fields in `listPendingDrafts` |
| `lib/domain/ingestion/__tests__/service.test.ts` | Update `createDraftsFromPipelineResult` + `listPendingDrafts` tests |
| `app/page-actions.ts` | Pass `storagePath` to `createDraftsFromPipelineResult` |
| `app/wardrobe/review/page.tsx` | Generate signed crop URLs server-side; export `DraftWithImageUrl` type |
| `app/wardrobe/review/draft-review-list.tsx` | Editable fields; pass `{ draftId, fields }` to accept action |
| `app/wardrobe/review/actions.ts` | New `EditedFields` type; updated `acceptDraftAction` signature; crop image attachment; status guard on reject |
| `app/wardrobe/review/__tests__/actions.test.ts` | Update to match new action signatures and crop behavior |

---

## Task 1: Install sharp

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install sharp and its types**

```bash
npm install sharp
npm install --save-dev @types/sharp
```

- [ ] **Step 2: Verify sharp imports**

```bash
node -e "const sharp = require('sharp'); console.log('sharp ok', typeof sharp)"
```

Expected: `sharp ok function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sharp for server-side image cropping"
```

---

## Task 2: Update `createDraftsFromPipelineResult` with two-phase crop logic

**Files:**
- Modify: `lib/domain/ingestion/service.ts`
- Modify: `lib/domain/ingestion/__tests__/service.test.ts`

### Background

The function currently inserts one draft per detected garment in a sequential loop, no cropping. We add:
1. `storagePath` field to `CreateDraftsParams`
2. After all drafts are inserted, download the source image via a signed URL and crop each garment's bbox in parallel using `sharp`
3. Each successful crop is uploaded to `garment-cutouts` and the draft row is updated with `crop_path`, `crop_width`, `crop_height`
4. Individual crop failures are logged but do not abort other crops or throw

**bbox format:** `[x1, y1, x2, y2]` integers (left, top, right, bottom)

- [ ] **Step 1: Write failing tests for the two-phase crop behavior**

Replace the `createDraftsFromPipelineResult` describe block in `lib/domain/ingestion/__tests__/service.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineAnalyzeResponse } from "@/lib/domain/ingestion";

// ---- Supabase mock -----------------------------------------------------------
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert, update: mockUpdate });
const mockSupabase = { from: mockFrom };

const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockStorageUpload,
  remove: mockStorageRemove,
  createSignedUrl: mockStorageCreateSignedUrl,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    ...mockSupabase,
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-uuid-123" }),
}));

// ---- sharp mock --------------------------------------------------------------
const mockSharpInstance = {
  extract: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  toBuffer: vi.fn().mockResolvedValue({ data: Buffer.from("crop"), info: { width: 90, height: 180 } }),
};
vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue(mockSharpInstance),
}));

// ---- fetch mock --------------------------------------------------------------
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
}));

const validGarment = {
  category: "shirt/blouse",
  confidence: 0.87,
  bbox: [10, 20, 100, 200] as [number, number, number, number],
  colour: "navy",
  material: "cotton",
  style: "casual",
  tag: "navy cotton shirt/blouse",
  embedding: Array(768).fill(0.1),
};

describe("createDraftsFromPipelineResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: { id: "draft-uuid-1" }, error: null });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed" },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it("inserts one draft per detected garment and returns their IDs", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );
    const result: PipelineAnalyzeResponse = {
      garments: [validGarment, { ...validGarment, category: "pants", tag: "black denim pants" }],
    };

    const draftIds = await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      storagePath: "user-uuid-123/pipeline-uploads/outfit.jpg",
      result,
    });

    expect(mockFrom).toHaveBeenCalledWith("garment_drafts");
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(draftIds).toHaveLength(2);
  });

  it("returns empty array when no garments detected", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );
    const draftIds = await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      storagePath: "user-uuid-123/pipeline-uploads/outfit.jpg",
      result: { garments: [] },
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(draftIds).toEqual([]);
  });

  it("generates a signed URL for the source image and fetches bytes", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );
    await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      storagePath: "user-uuid-123/pipeline-uploads/outfit.jpg",
      result: { garments: [validGarment] },
    });

    expect(mockStorageFrom).toHaveBeenCalledWith("garment-originals");
    expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith(
      "user-uuid-123/pipeline-uploads/outfit.jpg",
      expect.any(Number)
    );
    expect(fetch).toHaveBeenCalledWith("https://example.com/signed");
  });

  it("uploads cropped image to garment-cutouts and updates draft with crop_path", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );
    await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      storagePath: "user-uuid-123/pipeline-uploads/outfit.jpg",
      result: { garments: [validGarment] },
    });

    expect(mockStorageFrom).toHaveBeenCalledWith("garment-cutouts");
    expect(mockStorageUpload).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("garment_drafts");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ draft_payload_json: expect.objectContaining({ crop_path: expect.any(String) }) })
    );
  });

  it("continues with other crops when one crop fails", async () => {
    const sharp = (await import("sharp")).default as ReturnType<typeof vi.fn>;
    sharp
      .mockReturnValueOnce({
        extract: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockRejectedValue(new Error("crop failed")),
      })
      .mockReturnValueOnce(mockSharpInstance);

    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );
    const result = await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      storagePath: "user-uuid-123/pipeline-uploads/outfit.jpg",
      result: { garments: [validGarment, { ...validGarment, category: "pants", tag: "black pants" }] },
    });

    // Both draft IDs returned despite one crop failing
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- lib/domain/ingestion/__tests__/service.test.ts 2>&1 | head -40
```

Expected: FAIL — `storagePath` not in `CreateDraftsParams`, no crop logic

- [ ] **Step 3: Implement the two-phase crop logic in `lib/domain/ingestion/service.ts`**

Add `sharp` import at the top:
```typescript
import sharp from "sharp";
```

Update `CreateDraftsParams`:
```typescript
export interface CreateDraftsParams {
  sourceId: string;
  storagePath: string;  // path in garment-originals bucket
  result: PipelineAnalyzeResponse;
}
```

Replace the `createDraftsFromPipelineResult` function body:

```typescript
export async function createDraftsFromPipelineResult(
  params: CreateDraftsParams
): Promise<string[]> {
  const { sourceId, storagePath, result } = params;

  if (result.garments.length === 0) {
    return [];
  }

  const user = await getRequiredUser();
  const supabase = await createClient();

  // Phase 1: insert all draft rows
  const drafts: Array<{ draftId: string; bbox: [number, number, number, number] }> = [];

  for (const garment of result.garments) {
    const draftInsert: GarmentDraftInsert = {
      user_id: user.id,
      source_id: sourceId,
      draft_payload_json: {
        category: garment.category,
        confidence: garment.confidence,
        bbox: garment.bbox,
        colour: garment.colour,
        material: garment.material,
        style: garment.style,
        tag: garment.tag,
        embedding: garment.embedding,
        crop_path: null,
        crop_width: null,
        crop_height: null,
      },
      confidence: garment.confidence,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("garment_drafts")
      .insert(draftInsert as never)
      .select("id")
      .single();

    if (error) throw new Error(`Failed to create draft: ${error.message}`);

    drafts.push({
      draftId: (data as { id: string }).id,
      bbox: garment.bbox,
    });
  }

  // Phase 2: crop in parallel
  // Download source image once via signed URL (sharp needs bytes, not a storage path)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("garment-originals")
    .createSignedUrl(storagePath, 60);

  if (signedError || !signedData?.signedUrl) {
    console.warn("createDraftsFromPipelineResult: could not generate signed URL for crop, skipping crops");
    return drafts.map((d) => d.draftId);
  }

  const imageResponse = await fetch(signedData.signedUrl);
  if (!imageResponse.ok) {
    console.warn("createDraftsFromPipelineResult: failed to fetch source image for crop, skipping crops");
    return drafts.map((d) => d.draftId);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  await Promise.all(
    drafts.map(async ({ draftId, bbox }) => {
      try {
        const [x1, y1, x2, y2] = bbox;
        const { data: cropBuffer, info } = await sharp(imageBuffer)
          .extract({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 })
          .jpeg()
          .toBuffer({ resolveWithObject: true });

        const cropPath = `${user.id}/crops/${draftId}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("garment-cutouts")
          .upload(cropPath, cropBuffer, { contentType: "image/jpeg", upsert: true });

        if (uploadError) {
          console.warn(`createDraftsFromPipelineResult: crop upload failed for draft ${draftId}:`, uploadError.message);
          return;
        }

        await supabase
          .from("garment_drafts")
          .update({
            draft_payload_json: {
              crop_path: cropPath,
              crop_width: info.width,
              crop_height: info.height,
            },
          } as never)
          .eq("id", draftId);
      } catch (err) {
        console.warn(`createDraftsFromPipelineResult: crop failed for draft ${draftId}:`, err);
      }
    })
  );

  return drafts.map((d) => d.draftId);
}
```

> **Note on the draft_payload_json UPDATE:** Supabase's `.update()` replaces the whole column value, so the update must merge with the existing payload. In practice, use the Postgres `||` operator via a raw query, or re-fetch the current payload and merge in JS before updating. The simplest approach for this codebase: fetch the current `draft_payload_json` in the Phase 2 step for each draft, merge the crop fields, and update the full object. Alternatively, since we control the initial insert, we can just UPDATE the entire `draft_payload_json` by re-constructing it from the known garment data + the crop fields.
>
> Since the garment data is already in scope (we're inside the `drafts.map` closure where we have `bbox` but not the full garment), a cleaner approach: after Phase 1 inserts, keep the full garment alongside draftId:
> ```typescript
> const drafts: Array<{ draftId: string; garment: PipelineGarmentResult }> = [];
> // ... store garment alongside draftId in Phase 1
> // In Phase 2 UPDATE, reconstruct the full payload:
> .update({ draft_payload_json: { ...garment, crop_path, crop_width, crop_height } } as never)
> ```
> This avoids a re-fetch and avoids the partial-update JSON issue.

- [ ] **Step 4: Fix the draft storage approach — keep full garment in the Phase 2 closure**

Update Phase 1 to store the full garment:

```typescript
const drafts: Array<{ draftId: string; garment: PipelineGarmentResult }> = [];
// inside the loop:
drafts.push({ draftId: (data as { id: string }).id, garment });
```

Update Phase 2 to use `garment` in the UPDATE:

```typescript
drafts.map(async ({ draftId, garment }) => {
  try {
    const [x1, y1, x2, y2] = garment.bbox;
    const { data: cropBuffer, info } = await sharp(imageBuffer)
      .extract({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 })
      .jpeg()
      .toBuffer({ resolveWithObject: true });

    const cropPath = `${user.id}/crops/${draftId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("garment-cutouts")
      .upload(cropPath, cropBuffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.warn(`crop upload failed for draft ${draftId}:`, uploadError.message);
      return;
    }

    await supabase
      .from("garment_drafts")
      .update({
        draft_payload_json: {
          category: garment.category,
          confidence: garment.confidence,
          bbox: garment.bbox,
          colour: garment.colour,
          material: garment.material,
          style: garment.style,
          tag: garment.tag,
          embedding: garment.embedding,
          crop_path: cropPath,
          crop_width: info.width,
          crop_height: info.height,
        },
      } as never)
      .eq("id", draftId);
  } catch (err) {
    console.warn(`crop failed for draft ${draftId}:`, err);
  }
})
```

- [ ] **Step 5: Run tests and confirm they pass**

```bash
npm test -- lib/domain/ingestion/__tests__/service.test.ts
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/domain/ingestion/service.ts lib/domain/ingestion/__tests__/service.test.ts
git commit -m "feat(ingestion): crop garment bboxes at draft creation time using sharp"
```

---

## Task 3: Update `PendingDraft` type and `listPendingDrafts`

**Files:**
- Modify: `lib/domain/ingestion/service.ts`
- Modify: `lib/domain/ingestion/__tests__/service.test.ts`

- [ ] **Step 1: Write failing tests for updated `listPendingDrafts`**

Add/update the `listPendingDrafts` describe block in `lib/domain/ingestion/__tests__/service.test.ts`:

```typescript
describe("listPendingDrafts", () => {
  const draftRows = [
    {
      id: "draft-1",
      source_id: "src-1",
      confidence: 0.87,
      draft_payload_json: {
        category: "shirt/blouse",
        colour: "navy",
        material: "cotton",
        style: "casual",
        tag: "navy cotton shirt",
        confidence: 0.87,
        crop_path: "user-uuid-123/crops/draft-1.jpg",
        crop_width: 90,
        crop_height: 180,
      },
    },
    {
      id: "draft-2",
      source_id: "src-1",
      confidence: 0.51,
      draft_payload_json: {
        category: "pants",
        colour: "black",
        material: null,
        style: "casual",
        tag: "black denim pants",
        confidence: 0.51,
        crop_path: null,
        crop_width: null,
        crop_height: null,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    const mockOrderResult = vi.fn().mockResolvedValue({ data: draftRows, error: null });
    const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrderResult });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqStatus });
    const mockSelectDrafts = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockFrom.mockReturnValue({ select: mockSelectDrafts });
  });

  it("returns pending drafts with parsed payload including crop fields", async () => {
    const { listPendingDrafts } = await import(
      "@/lib/domain/ingestion/service"
    );
    const drafts = await listPendingDrafts();

    expect(drafts).toHaveLength(2);
    expect(drafts[0].cropPath).toBe("user-uuid-123/crops/draft-1.jpg");
    expect(drafts[0].cropWidth).toBe(90);
    expect(drafts[0].cropHeight).toBe(180);
    expect(drafts[1].cropPath).toBeNull();
    expect(drafts[1].cropWidth).toBeNull();
  });

  it("returns empty array when no pending drafts", async () => {
    const mockOrderResult = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrderResult });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqStatus });
    const mockSelectDrafts = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockFrom.mockReturnValue({ select: mockSelectDrafts });

    const { listPendingDrafts } = await import("@/lib/domain/ingestion/service");
    const drafts = await listPendingDrafts();
    expect(drafts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- lib/domain/ingestion/__tests__/service.test.ts 2>&1 | grep "cropPath"
```

Expected: FAIL — `cropPath` is undefined

- [ ] **Step 3: Update `PendingDraft` type and `listPendingDrafts` mapping**

Update the `PendingDraft` interface:

```typescript
export interface PendingDraft {
  id: string;
  sourceId: string;
  confidence: number | null;
  cropPath: string | null;
  cropWidth: number | null;
  cropHeight: number | null;
  payload: {
    tag: string;
    category: string;
    colour: string;
    material: string | null;
    style: string;
    confidence: number;
  };
}
```

Update the mapping in `listPendingDrafts`:

```typescript
return data.map((row) => {
  const p = row.draft_payload_json;
  return {
    id: row.id,
    sourceId: row.source_id,
    confidence: row.confidence,
    cropPath: p.crop_path ? String(p.crop_path) : null,
    cropWidth: p.crop_width ? Number(p.crop_width) : null,
    cropHeight: p.crop_height ? Number(p.crop_height) : null,
    payload: {
      tag: String(p.tag ?? ""),
      category: String(p.category ?? ""),
      colour: String(p.colour ?? ""),
      material: p.material ? String(p.material) : null,
      style: String(p.style ?? ""),
      confidence: Number(p.confidence ?? row.confidence ?? 0),
    },
  };
});
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- lib/domain/ingestion/__tests__/service.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/service.ts lib/domain/ingestion/__tests__/service.test.ts
git commit -m "feat(ingestion): add cropPath/cropWidth/cropHeight to PendingDraft type"
```

---

## Task 4: Pass `storagePath` in `uploadAndAnalyseAction`

**Files:**
- Modify: `app/page-actions.ts`

`createGarmentSource` already returns `{ sourceId, storagePath }`. Just pass it through.

- [ ] **Step 1: Update the call in `app/page-actions.ts`**

Change:
```typescript
await createDraftsFromPipelineResult({ sourceId, result });
```
To:
```typescript
await createDraftsFromPipelineResult({ sourceId, storagePath, result });
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck 2>&1 | grep -E "error|page-actions"
```

Expected: no errors on `page-actions.ts`

- [ ] **Step 3: Commit**

```bash
git add app/page-actions.ts
git commit -m "feat(upload): pass storagePath to createDraftsFromPipelineResult"
```

---

## Task 5: Update review page — signed crop URLs + `DraftWithImageUrl` type

**Files:**
- Modify: `app/wardrobe/review/page.tsx`

- [ ] **Step 1: Update `app/wardrobe/review/page.tsx`**

```typescript
import { listPendingDrafts, type PendingDraft } from "@/lib/domain/ingestion/service";
import { getOptionalUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DraftReviewList from "./draft-review-list";

export interface DraftWithImageUrl extends PendingDraft {
  cropUrl: string | null;
}

export default async function ReviewPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/");

  const drafts = await listPendingDrafts();
  const supabase = await createClient();

  const draftsWithUrls: DraftWithImageUrl[] = await Promise.all(
    drafts.map(async (draft) => {
      if (!draft.cropPath) return { ...draft, cropUrl: null };
      const { data, error } = await supabase.storage
        .from("garment-cutouts")
        .createSignedUrl(draft.cropPath, 60 * 60);
      return { ...draft, cropUrl: error || !data?.signedUrl ? null : data.signedUrl };
    })
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a1a]">
            Review Detections
          </h1>
          <p className="mt-1 text-[13px] text-[#999]">
            {draftsWithUrls.length > 0
              ? `${draftsWithUrls.length} garment${draftsWithUrls.length === 1 ? "" : "s"} detected · Accept to add to your wardrobe`
              : "No pending drafts"}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-[#e8d8c8] px-3.5 py-1.5 text-xs text-[#c17a3a]"
        >
          ← Back to dashboard
        </Link>
      </div>

      <DraftReviewList drafts={draftsWithUrls} />
    </main>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck 2>&1 | grep -E "error|review/page"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/wardrobe/review/page.tsx
git commit -m "feat(review): generate signed crop URLs server-side for draft cards"
```

---

## Task 6: Rewrite `acceptDraftAction` and fix `rejectDraftAction`

**Files:**
- Modify: `app/wardrobe/review/actions.ts`
- Modify: `app/wardrobe/review/__tests__/actions.test.ts`

### Background on the new `acceptDraftAction`

The new signature is `acceptDraftAction(input: { draftId: string; fields: EditedFields })`. Crop data (`cropPath`, `cropWidth`, `cropHeight`) is read server-side from `draft.draft_payload_json` — never trusted from the client. On success it:
1. Creates the garment with edited field values
2. Inserts a `garment_images` row (`image_type: "cropped"`) if `cropPath` is non-null
3. Updates `garment_sources.garment_id` to link source → garment
4. Marks the draft `status: "confirmed"`

`rejectDraftAction` gains a pending-status guard (currently missing).

- [ ] **Step 1: Write failing tests**

Replace `app/wardrobe/review/__tests__/actions.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase mock -----------------------------------------------------------
const mockSingle = vi.fn();
const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
const mockSelectChain = vi.fn().mockReturnValue({ eq: mockEqId });

const mockUpdateEq2 = vi.fn().mockResolvedValue({ error: null });
const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq1 });

// garment_images insert mock
const mockImageInsertSingle = vi.fn().mockResolvedValue({ data: { id: "img-uuid" }, error: null });
const mockImageInsertSelect = vi.fn().mockReturnValue({ single: mockImageInsertSingle });
const mockImageInsert = vi.fn().mockReturnValue({ select: mockImageInsertSelect });

const mockFrom = vi.fn((table: string) => {
  if (table === "garment_drafts") return { select: mockSelectChain, update: mockUpdate };
  if (table === "garment_images") return { insert: mockImageInsert };
  if (table === "garment_sources") return { update: mockUpdate };
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateGarment = vi.fn().mockResolvedValue({ id: "new-garment-uuid" });
vi.mock("@/lib/domain/wardrobe/service", () => ({
  createGarment: mockCreateGarment,
}));

// ---- Draft rows ----------------------------------------------------------------

const pendingDraftWithCrop = {
  id: "22222222-2222-4222-8222-222222222222",
  source_id: "src-uuid-111",
  status: "pending",
  draft_payload_json: {
    category: "shirt/blouse",
    colour: "blue",
    material: "cotton",
    style: "casual",
    tag: "blue cotton shirt",
    confidence: 0.87,
    crop_path: "user/crops/draft-uuid.jpg",
    crop_width: 90,
    crop_height: 180,
  },
};

const pendingDraftNoCrop = {
  ...pendingDraftWithCrop,
  draft_payload_json: { ...pendingDraftWithCrop.draft_payload_json, crop_path: null, crop_width: null, crop_height: null },
};

const editedFields = {
  title: "Blue Cotton Shirt",
  category: "shirt/blouse",
  colour: "blue",
  material: "cotton",
  style: "casual",
};

describe("acceptDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: pendingDraftWithCrop, error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 });
    mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
    mockUpdateEq2.mockResolvedValue({ error: null });
    mockCreateGarment.mockResolvedValue({ id: "new-garment-uuid" });
  });

  it("creates garment with edited field values and marks draft confirmed", async () => {
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction({ draftId: pendingDraftWithCrop.id, fields: editedFields });

    expect(result.status).toBe("success");
    expect(mockCreateGarment).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Blue Cotton Shirt", category: "shirt/blouse" }),
      expect.anything()
    );
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "confirmed" }));
  });

  it("attaches crop image as garment_images record when crop_path is present", async () => {
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    await acceptDraftAction({ draftId: pendingDraftWithCrop.id, fields: editedFields });

    expect(mockFrom).toHaveBeenCalledWith("garment_images");
    expect(mockImageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        image_type: "cropped",
        storage_path: "user/crops/draft-uuid.jpg",
        width: 90,
        height: 180,
      })
    );
  });

  it("links garment_sources to the new garment", async () => {
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    await acceptDraftAction({ draftId: pendingDraftWithCrop.id, fields: editedFields });

    expect(mockFrom).toHaveBeenCalledWith("garment_sources");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ garment_id: "new-garment-uuid" }));
  });

  it("skips garment_images insert when crop_path is null", async () => {
    mockSingle.mockResolvedValue({ data: pendingDraftNoCrop, error: null });
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    await acceptDraftAction({ draftId: pendingDraftNoCrop.id, fields: editedFields });

    expect(mockFrom).not.toHaveBeenCalledWith("garment_images");
  });

  it("silently skips draft that is already actioned (stale page guard)", async () => {
    mockSingle.mockResolvedValue({ data: { ...pendingDraftWithCrop, status: "confirmed" }, error: null });
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction({ draftId: pendingDraftWithCrop.id, fields: editedFields });

    expect(result.status).toBe("success");
    expect(mockCreateGarment).not.toHaveBeenCalled();
  });

  it("returns error when draft not found", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction({ draftId: pendingDraftWithCrop.id, fields: editedFields });

    expect(result.status).toBe("error");
  });
});

describe("rejectDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: "draft-id", status: "pending" }, error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 });
    mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
    mockUpdateEq2.mockResolvedValue({ error: null });
  });

  it("marks draft as rejected", async () => {
    const { rejectDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await rejectDraftAction("22222222-2222-4222-8222-222222222222");

    expect(result.status).toBe("success");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("silently succeeds when draft is already actioned", async () => {
    mockSingle.mockResolvedValue({ data: { id: "draft-id", status: "confirmed" }, error: null });
    const { rejectDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await rejectDraftAction("22222222-2222-4222-8222-222222222222");

    expect(result.status).toBe("success");
    // Should NOT update since already actioned
    expect(mockUpdate).not.toHaveBeenCalledWith({ status: "rejected" });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- app/wardrobe/review/__tests__/actions.test.ts 2>&1 | head -30
```

Expected: FAIL — signature mismatch, missing garment_images insert, missing garment_sources update

- [ ] **Step 3: Rewrite `app/wardrobe/review/actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createGarment } from "@/lib/domain/wardrobe/service";
import { getCanonicalWardrobeColour } from "@/lib/domain/wardrobe/colours";

export type DraftActionResult =
  | { status: "success"; garmentId?: string }
  | { status: "error"; message: string };

interface EditedFields {
  title: string;
  category: string;
  colour: string;
  material: string;
  style: string;
}

export async function acceptDraftAction(input: {
  draftId: string;
  fields: EditedFields;
}): Promise<DraftActionResult> {
  try {
    const { draftId, fields } = input;
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error } = await supabase
      .from("garment_drafts")
      .select("id, source_id, draft_payload_json, status")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (error || !draft) return { status: "error", message: "Draft not found." };

    // Idempotency guard
    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const p = (draft as { draft_payload_json: Record<string, unknown> }).draft_payload_json;
    const sourceId = (draft as { source_id: string }).source_id;

    // Read crop data server-side — never trust client-supplied paths
    const cropPath = p.crop_path ? String(p.crop_path) : null;
    const cropWidth = p.crop_width ? Number(p.crop_width) : null;
    const cropHeight = p.crop_height ? Number(p.crop_height) : null;

    const canonicalColour = getCanonicalWardrobeColour(fields.colour);

    const garment = await createGarment(
      {
        category: fields.category,
        title: fields.title,
        material: fields.material || undefined,
      },
      { primaryColourFamily: canonicalColour ? canonicalColour.family : null }
    );

    const garmentId = garment.id as string;

    if (cropPath) {
      await supabase
        .from("garment_images")
        .insert({
          garment_id: garmentId,
          image_type: "cropped",
          storage_path: cropPath,
          width: cropWidth,
          height: cropHeight,
        } as never)
        .select("id")
        .single();

      await supabase
        .from("garment_sources")
        .update({ garment_id: garmentId } as never)
        .eq("id", sourceId)
        .eq("user_id", user.id);
    }

    await supabase
      .from("garment_drafts")
      .update({ status: "confirmed" } as never)
      .eq("id", draftId)
      .eq("user_id", user.id);

    revalidatePath("/wardrobe");
    revalidatePath("/wardrobe/review");
    revalidatePath("/");

    return { status: "success", garmentId };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to accept draft.",
    };
  }
}

export async function rejectDraftAction(draftId: string): Promise<DraftActionResult> {
  try {
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error: fetchError } = await supabase
      .from("garment_drafts")
      .select("id, status")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !draft) return { status: "error", message: "Draft not found." };

    // Idempotency guard
    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const { error: updateError } = await supabase
      .from("garment_drafts")
      .update({ status: "rejected" } as never)
      .eq("id", draftId)
      .eq("user_id", user.id);

    if (updateError) return { status: "error", message: updateError.message };

    revalidatePath("/");
    revalidatePath("/wardrobe/review");

    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to reject draft.",
    };
  }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- app/wardrobe/review/__tests__/actions.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add app/wardrobe/review/actions.ts app/wardrobe/review/__tests__/actions.test.ts
git commit -m "feat(review): attach crop image on accept; add status guard to reject"
```

---

## Task 7: Update `DraftReviewList` with editable fields

**Files:**
- Modify: `app/wardrobe/review/draft-review-list.tsx`

This is a client component — no automated tests. Verify manually after implementation.

- [ ] **Step 1: Rewrite `app/wardrobe/review/draft-review-list.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { acceptDraftAction, rejectDraftAction } from "./actions";
import type { DraftWithImageUrl } from "./page";

interface Props {
  drafts: DraftWithImageUrl[];
}

interface EditState {
  title: string;
  category: string;
  colour: string;
  material: string;
  style: string;
}

export default function DraftReviewList({ drafts }: Props) {
  const router = useRouter();
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>(() =>
    Object.fromEntries(
      drafts.map((d) => [
        d.id,
        {
          title: d.payload.tag,
          category: d.payload.category,
          colour: d.payload.colour,
          material: d.payload.material ?? "",
          style: d.payload.style,
        },
      ])
    )
  );

  const remaining = drafts.filter((d) => !actionedIds.has(d.id));

  function markActioned(id: string) {
    setActionedIds((prev) => new Set([...prev, id]));
  }

  useEffect(() => {
    if (drafts.length > 0 && actionedIds.size === drafts.length) {
      router.push("/wardrobe");
    }
  }, [actionedIds, drafts.length, router]);

  function handleFieldChange(draftId: string, field: keyof EditState, value: string) {
    setEditStates((prev) => ({
      ...prev,
      [draftId]: { ...prev[draftId], [field]: value },
    }));
  }

  function handleAccept(draftId: string) {
    setPendingId(draftId);
    const fields = editStates[draftId];
    acceptDraftAction({ draftId, fields }).then((result) => {
      setPendingId(null);
      if (result.status === "error") {
        setErrors((prev) => ({ ...prev, [draftId]: result.message }));
      } else {
        markActioned(draftId);
      }
    });
  }

  function handleReject(draftId: string) {
    setPendingId(draftId);
    rejectDraftAction(draftId).then((result) => {
      setPendingId(null);
      if (result.status === "error") {
        setErrors((prev) => ({ ...prev, [draftId]: result.message }));
      } else {
        markActioned(draftId);
      }
    });
  }

  if (remaining.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--muted)]">No pending drafts.</p>
        <a href="/" className="mt-4 text-sm text-[var(--accent)] underline">
          Upload a photo to get started
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {remaining.map((draft) => {
        const isLowConfidence = draft.payload.confidence < 0.6;
        const error = errors[draft.id];
        const edit = editStates[draft.id];

        return (
          <div
            key={draft.id}
            className="grid grid-cols-[80px_1fr] gap-4 rounded-[18px] border border-[var(--line)] bg-white p-4"
            style={{ opacity: isLowConfidence ? 0.85 : 1 }}
          >
            {/* Cropped garment image */}
            {draft.cropUrl ? (
              <img
                src={draft.cropUrl}
                alt={draft.payload.tag}
                className="h-[110px] w-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="h-[110px] w-[80px] rounded-xl bg-[#e8e0d8]" />
            )}

            {/* Editable fields */}
            <div className="flex flex-col gap-2 min-w-0">
              <input
                value={edit.title}
                onChange={(e) => handleFieldChange(draft.id, "title", e.target.value)}
                disabled={pendingId === draft.id}
                className="w-full rounded-lg border border-[#e0d8d0] bg-[#faf8f5] px-2 py-1.5 text-[13px] font-semibold text-[#1a1a1a] disabled:opacity-50"
                placeholder="Title"
              />
              <div className="grid grid-cols-2 gap-1.5">
                {(["category", "colour", "material", "style"] as const).map((field) => (
                  <input
                    key={field}
                    value={edit[field]}
                    onChange={(e) => handleFieldChange(draft.id, field, e.target.value)}
                    disabled={pendingId === draft.id}
                    className="rounded-lg border border-[#e0d8d0] bg-[#faf8f5] px-2 py-1 text-[11px] text-[#555] disabled:opacity-50"
                    placeholder={field}
                  />
                ))}
              </div>
              <p className={`text-[10px] ${isLowConfidence ? "text-[#e09060]" : "text-[#aaa]"}`}>
                {Math.round(draft.payload.confidence * 100)}% confidence
                {isLowConfidence && " · low"}
              </p>
              {error && <p className="text-[11px] text-red-500">{error}</p>}
              <div className="flex gap-2 mt-0.5">
                <button
                  onClick={() => handleReject(draft.id)}
                  disabled={pendingId === draft.id}
                  className="flex-1 rounded-full border border-[var(--line)] py-1.5 text-[11px] text-[#999] disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAccept(draft.id)}
                  disabled={pendingId === draft.id}
                  className="flex-[2] rounded-full bg-[#c17a3a] py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck 2>&1 | grep -E "error|draft-review"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/wardrobe/review/draft-review-list.tsx
git commit -m "feat(review): editable fields + cropped image on draft review cards"
```

---

## Task 8: Full test suite + manual smoke test

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 2: Typecheck everything**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Manual smoke test**

1. Start the dev server: `npm run dev`
2. Open the app, upload an outfit photo via the Upload card on the homepage
3. Observe the "Analysing…" spinner — this now also runs cropping
4. Get redirected to `/wardrobe/review`
5. Verify each card shows a cropped garment image (or placeholder if crop failed)
6. Edit a field (e.g., change category) and click Accept
7. Verify you land in `/wardrobe` and the new garment appears with the cropped image
8. Upload another photo, reject all drafts — verify redirect to `/wardrobe`

- [ ] **Step 4: Final commit if any fixups were needed**

```bash
git add -p
git commit -m "fix(review): smoke test fixups"
```
