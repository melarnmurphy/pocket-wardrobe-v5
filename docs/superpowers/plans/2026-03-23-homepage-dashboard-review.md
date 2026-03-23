# Homepage Dashboard & Draft Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scaffold homepage with a real user dashboard (stats + upload card + recent garments) and build `/wardrobe/review` where users accept or reject AI-detected garment drafts.

**Architecture:** Six tasks build the feature bottom-up: service layer functions first, then server actions, then UI pages. Each task is independently testable. The upload card is a client component that calls a server action and then navigates on success; the review page uses a client `DraftReviewList` component fed by a server component that pre-fetches pending drafts.

**Tech Stack:** Next.js 15 App Router, React Server Components, Server Actions, Supabase JS v2, Tailwind CSS, Zod, Vitest

---

## File Map

| Status | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/domain/wardrobe/service.ts` | Add `getDashboardStats`, `getRecentGarments` |
| Create | `lib/domain/wardrobe/__tests__/service.test.ts` | Tests for new wardrobe service functions |
| Modify | `lib/domain/ingestion/service.ts` | Add `createGarmentSource`, `listPendingDrafts` |
| Modify | `lib/domain/ingestion/__tests__/service.test.ts` | Tests for new ingestion service functions |
| Create | `app/page-actions.ts` | `uploadAndAnalyseAction` server action |
| Create | `app/wardrobe/review/actions.ts` | `acceptDraftAction`, `rejectDraftAction` |
| Create | `app/wardrobe/review/__tests__/actions.test.ts` | Tests for accept/reject actions |
| Replace | `app/page.tsx` | Real dashboard (server component + UploadCard) |
| Create | `app/components/upload-card.tsx` | Client component — file input, loading state, error display |
| Create | `app/wardrobe/review/page.tsx` | Review page server component |
| Create | `app/wardrobe/review/draft-review-list.tsx` | Client component — accept/reject interactions |

---

## Task 1: Wardrobe service — getDashboardStats and getRecentGarments

**Files:**
- Modify: `lib/domain/wardrobe/service.ts`
- Create: `lib/domain/wardrobe/__tests__/service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/domain/wardrobe/__tests__/service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- minimal Supabase mock ------------------------------------------------
// The chained Supabase query builder is mocked per-table.
// Count queries resolve directly from the chain terminus (.eq / .gt).
// The select-with-join query resolves from .limit().

const mockCountResult = (count: number) =>
  vi.fn().mockResolvedValue({ count, error: null });

// Separate builders per table so we can return different counts.
let garmentCountBuilder: ReturnType<typeof vi.fn>;
let draftsCountBuilder: ReturnType<typeof vi.fn>;
let recentGarmentsBuilder: ReturnType<typeof vi.fn>;

const mockFrom = vi.fn((table: string) => {
  if (table === "garment_drafts") return draftsCountBuilder();
  if (table === "garments") return garmentCountBuilder();
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom, storage: { from: vi.fn() } }),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-uuid-123" }),
}));

describe("getDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Garments table: first call = total count, second call = favourites count
    let garmentCallCount = 0;
    garmentCountBuilder = vi.fn(() => {
      garmentCallCount++;
      const selectResult =
        garmentCallCount === 1
          ? { eq: mockCountResult(42) }
          : {
              eq: vi.fn().mockReturnValue({
                gt: mockCountResult(8),
              }),
            };
      return { select: vi.fn().mockReturnValue(selectResult) };
    });

    draftsCountBuilder = vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: mockCountResult(3),
        }),
      }),
    }));
  });

  it("returns garment count, favourites count, and pending draft count", async () => {
    const { getDashboardStats } = await import("@/lib/domain/wardrobe/service");
    const stats = await getDashboardStats();
    expect(stats.garmentCount).toBe(42);
    expect(stats.favouritesCount).toBe(8);
    expect(stats.pendingDraftsCount).toBe(3);
  });

  it("returns zero counts when queries return null", async () => {
    let garmentCallCount = 0;
    garmentCountBuilder = vi.fn(() => {
      garmentCallCount++;
      const selectResult =
        garmentCallCount === 1
          ? { eq: vi.fn().mockResolvedValue({ count: null, error: null }) }
          : { eq: vi.fn().mockReturnValue({ gt: vi.fn().mockResolvedValue({ count: null, error: null }) }) };
      return { select: vi.fn().mockReturnValue(selectResult) };
    });
    draftsCountBuilder = vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: null, error: null }),
        }),
      }),
    }));

    const { getDashboardStats } = await import("@/lib/domain/wardrobe/service");
    const stats = await getDashboardStats();
    expect(stats.garmentCount).toBe(0);
    expect(stats.favouritesCount).toBe(0);
    expect(stats.pendingDraftsCount).toBe(0);
  });
});

describe("getRecentGarments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    const rows = [
      { id: "g1", title: "Navy shirt", category: "shirt/blouse", garment_images: [{ storage_path: "user/g1/img.jpg" }] },
      { id: "g2", title: null, category: "pants", garment_images: [] },
    ];

    garmentCountBuilder = vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      }),
    }));

    // getRecentGarments uses garments table only (drafts builder unused here)
    draftsCountBuilder = vi.fn(() => ({ select: vi.fn() }));
  });

  it("returns garments with storagePath from first image", async () => {
    const { getRecentGarments } = await import("@/lib/domain/wardrobe/service");
    const result = await getRecentGarments(6);
    expect(result).toHaveLength(2);
    expect(result[0].storagePath).toBe("user/g1/img.jpg");
    expect(result[1].storagePath).toBeNull();
  });

  it("limits to requested count", async () => {
    const { getRecentGarments } = await import("@/lib/domain/wardrobe/service");
    await getRecentGarments(3);
    // Verify limit was called with 3 (the mock chain records calls)
    expect(mockFrom).toHaveBeenCalledWith("garments");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/domain/wardrobe/__tests__/service.test.ts
```

Expected: FAIL — `getDashboardStats is not a function` / `getRecentGarments is not a function`

- [ ] **Step 3: Implement getDashboardStats and getRecentGarments**

Add to the bottom of `lib/domain/wardrobe/service.ts` (before the closing of the module):

```typescript
export async function getDashboardStats(): Promise<{
  garmentCount: number;
  favouritesCount: number;
  pendingDraftsCount: number;
}> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const [garments, favourites, drafts] = await Promise.all([
    supabase
      .from("garments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("garments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("favourite_score", 0),
    supabase
      .from("garment_drafts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);

  return {
    garmentCount: garments.count ?? 0,
    favouritesCount: favourites.count ?? 0,
    pendingDraftsCount: drafts.count ?? 0,
  };
}

export async function getRecentGarments(n: number): Promise<
  Array<{
    id: string;
    title: string | null;
    category: string;
    storagePath: string | null;
  }>
> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("garments")
    .select("id, title, category, garment_images(storage_path)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(n);

  if (error) throw new Error(error.message);

  return (data ?? []).map((g) => {
    const images = g.garment_images as Array<{ storage_path: string }> | null;
    return {
      id: g.id,
      title: g.title ?? null,
      category: g.category,
      storagePath: images && images.length > 0 ? images[0].storage_path : null,
    };
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/domain/wardrobe/__tests__/service.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Run full typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add lib/domain/wardrobe/service.ts lib/domain/wardrobe/__tests__/service.test.ts
git commit -m "feat: add getDashboardStats and getRecentGarments to wardrobe service"
```

---

## Task 2: Ingestion service — createGarmentSource and listPendingDrafts

**Files:**
- Modify: `lib/domain/ingestion/service.ts`
- Modify: `lib/domain/ingestion/__tests__/service.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to the existing `lib/domain/ingestion/__tests__/service.test.ts` (after the last `});`):

```typescript
// ---- createGarmentSource tests -------------------------------------------

const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockStorageUpload,
  remove: mockStorageRemove,
}));

describe("createGarmentSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({});
    mockSingle.mockResolvedValue({ data: { id: "source-uuid-xyz" }, error: null });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    // Patch supabase mock to include storage
    vi.mock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({
        from: mockFrom,
        storage: { from: mockStorageFrom },
      }),
    }));
  });

  it("uploads file, inserts garment_source with garment_id null, returns sourceId and storagePath", async () => {
    const { createGarmentSource } = await import("@/lib/domain/ingestion/service");
    const file = new File(["data"], "outfit.jpg", { type: "image/jpeg" });

    const result = await createGarmentSource({ file });

    expect(mockStorageFrom).toHaveBeenCalledWith("garment-originals");
    expect(mockStorageUpload).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("garment_sources");

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.garment_id).toBeNull();
    expect(insertCall.source_type).toBe("direct_upload");

    expect(result.sourceId).toBe("source-uuid-xyz");
    expect(typeof result.storagePath).toBe("string");
  });

  it("removes uploaded file if garment_source insert fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "insert failed" } });

    const { createGarmentSource } = await import("@/lib/domain/ingestion/service");
    const file = new File(["data"], "outfit.jpg", { type: "image/jpeg" });

    await expect(createGarmentSource({ file })).rejects.toThrow("insert failed");
    expect(mockStorageRemove).toHaveBeenCalled();
  });
});

// ---- listPendingDrafts tests -----------------------------------------------

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

  it("returns pending drafts with parsed payload", async () => {
    const { listPendingDrafts } = await import("@/lib/domain/ingestion/service");
    const drafts = await listPendingDrafts();

    expect(drafts).toHaveLength(2);
    expect(drafts[0].id).toBe("draft-1");
    expect(drafts[0].payload.category).toBe("shirt/blouse");
    expect(drafts[0].payload.colour).toBe("navy");
    expect(drafts[1].payload.material).toBeNull();
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

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/domain/ingestion/__tests__/service.test.ts
```

Expected: FAIL — `createGarmentSource is not a function` / `listPendingDrafts is not a function`

- [ ] **Step 3: Implement createGarmentSource and listPendingDrafts**

Append to `lib/domain/ingestion/service.ts`:

```typescript
export interface PendingDraft {
  id: string;
  sourceId: string;
  confidence: number | null;
  payload: {
    category: string;
    colour: string;
    material: string | null;
    style: string;
    tag: string;
    confidence: number;
  };
}

export async function createGarmentSource(params: {
  file: File;
}): Promise<{ sourceId: string; storagePath: string }> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const safeFileName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${user.id}/pipeline-uploads/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("garment-originals")
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || undefined,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("garment_sources")
    .insert(({
      user_id: user.id,
      garment_id: null,
      source_type: "direct_upload",
      storage_path: storagePath,
      parse_status: "pending",
      source_metadata_json: {
        filename: params.file.name,
        mime_type: params.file.type || null,
      },
    }) as never)
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from("garment-originals").remove([storagePath]);
    throw new Error(error.message);
  }

  return { sourceId: (data as { id: string }).id, storagePath };
}

export async function listPendingDrafts(): Promise<PendingDraft[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("garment_drafts")
    .select("id, source_id, confidence, draft_payload_json")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const p = row.draft_payload_json as Record<string, unknown>;
    return {
      id: row.id,
      sourceId: row.source_id,
      confidence: row.confidence ?? null,
      payload: {
        category: String(p.category ?? ""),
        colour: String(p.colour ?? ""),
        material: p.material ? String(p.material) : null,
        style: String(p.style ?? ""),
        tag: String(p.tag ?? ""),
        confidence: Number(p.confidence ?? row.confidence ?? 0),
      },
    };
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/domain/ingestion/__tests__/service.test.ts
```

Expected: all tests pass (original 2 + new 4 = 6 total)

- [ ] **Step 5: Run full typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add lib/domain/ingestion/service.ts lib/domain/ingestion/__tests__/service.test.ts
git commit -m "feat: add createGarmentSource and listPendingDrafts to ingestion service"
```

---

## Task 3: Review page actions — acceptDraftAction and rejectDraftAction

**Files:**
- Create: `app/wardrobe/review/actions.ts`
- Create: `app/wardrobe/review/__tests__/actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/wardrobe/review/__tests__/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase mock -----------------------------------------------------------
const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockEqUser = vi.fn().mockReturnValue({ select: mockSelect });
const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
const mockSelectChain = vi.fn().mockReturnValue({ eq: mockEqId });

const mockUpdate = vi.fn();
const mockUpdateEq1 = vi.fn();
const mockUpdateEq2 = vi.fn().mockResolvedValue({ error: null });

mockUpdate.mockReturnValue({ eq: mockUpdateEq1 });
mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });

const mockFrom = vi.fn((table: string) => {
  if (table === "garment_drafts") {
    return {
      select: mockSelectChain,
      update: mockUpdate,
    };
  }
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-uuid-123" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ---- createGarment mock — returns a garment with an id -------------------
const mockCreateGarment = vi.fn().mockResolvedValue({ id: "new-garment-uuid" });
vi.mock("@/lib/domain/wardrobe/service", () => ({
  createGarment: mockCreateGarment,
}));

// ---- Pending draft row -------------------------------------------------------
const pendingDraft = {
  id: "draft-uuid-1",
  status: "pending",
  draft_payload_json: {
    category: "shirt/blouse",
    colour: "blue",
    material: "cotton",
    style: "casual",
    tag: "blue cotton shirt",
    confidence: 0.87,
  },
};

describe("acceptDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: pendingDraft, error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 });
    mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
    mockUpdateEq2.mockResolvedValue({ error: null });
    mockCreateGarment.mockResolvedValue({ id: "new-garment-uuid" });
  });

  it("creates a garment from draft payload and marks draft confirmed", async () => {
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction("draft-uuid-1");

    expect(result.status).toBe("success");
    expect(result.garmentId).toBe("new-garment-uuid");

    expect(mockCreateGarment).toHaveBeenCalledWith(
      expect.objectContaining({ category: "shirt/blouse", title: "blue cotton shirt" }),
      expect.objectContaining({ primaryColourFamily: "blue" })
    );

    expect(mockUpdate).toHaveBeenCalledWith({ status: "confirmed" });
  });

  it("passes null primaryColourFamily for non-canonical colours like 'navy'", async () => {
    mockSingle.mockResolvedValue({
      data: {
        ...pendingDraft,
        draft_payload_json: { ...pendingDraft.draft_payload_json, colour: "navy" },
      },
      error: null,
    });

    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    await acceptDraftAction("draft-uuid-1");

    expect(mockCreateGarment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ primaryColourFamily: null })
    );
  });

  it("silently skips draft that is already actioned (stale page guard)", async () => {
    mockSingle.mockResolvedValue({
      data: { ...pendingDraft, status: "confirmed" },
      error: null,
    });

    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction("draft-uuid-1");

    expect(result.status).toBe("success");
    expect(mockCreateGarment).not.toHaveBeenCalled();
  });

  it("returns error when draft not found", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction("draft-uuid-1");

    expect(result.status).toBe("error");
  });
});

describe("rejectDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 });
    mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
    mockUpdateEq2.mockResolvedValue({ error: null });
  });

  it("marks draft as rejected", async () => {
    const { rejectDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await rejectDraftAction("draft-uuid-1");

    expect(result.status).toBe("success");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "rejected" });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run app/wardrobe/review/__tests__/actions.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the actions file**

Create `app/wardrobe/review/actions.ts`:

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

export async function acceptDraftAction(draftId: string): Promise<DraftActionResult> {
  try {
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error } = await supabase
      .from("garment_drafts")
      .select("id, draft_payload_json, status")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (error || !draft) return { status: "error", message: "Draft not found." };

    // Stale page guard: already actioned
    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const p = (draft as { draft_payload_json: Record<string, unknown> }).draft_payload_json;
    const colour = p.colour ? String(p.colour) : null;
    const canonicalColour = getCanonicalWardrobeColour(colour);

    const garment = await createGarment(
      {
        category: String(p.category ?? ""),
        title: String(p.tag ?? ""),
        material: p.material ? String(p.material) : undefined,
      },
      { primaryColourFamily: canonicalColour ? canonicalColour.family : null }
    );

    await supabase
      .from("garment_drafts")
      .update({ status: "confirmed" })
      .eq("id", draftId)
      .eq("user_id", user.id);

    revalidatePath("/wardrobe");
    revalidatePath("/");

    return { status: "success", garmentId: garment.id as string };
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

    await supabase
      .from("garment_drafts")
      .update({ status: "rejected" })
      .eq("id", draftId)
      .eq("user_id", user.id);

    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to reject draft.",
    };
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run app/wardrobe/review/__tests__/actions.test.ts
```

Expected: all 5 tests pass

- [ ] **Step 5: Run full typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/wardrobe/review/actions.ts app/wardrobe/review/__tests__/actions.test.ts
git commit -m "feat: add acceptDraftAction and rejectDraftAction for review page"
```

---

## Task 4: Upload server action — uploadAndAnalyseAction

**Files:**
- Create: `app/page-actions.ts`

No unit tests for this action — it orchestrates service calls that are already tested. Manual test is in Task 6.

- [ ] **Step 1: Create the action file**

Create `app/page-actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { createGarmentSource } from "@/lib/domain/ingestion/service";
import { createDraftsFromPipelineResult } from "@/lib/domain/ingestion/service";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import { redirect } from "next/navigation";

export type UploadActionResult =
  | { status: "success" }
  | { status: "error"; message: string };

// Called by the UploadCard client component.
// On success, the client component calls router.push("/wardrobe/review").
// redirect() is called here only for the no-garments-detected empty state.
export async function uploadAndAnalyseAction(
  formData: FormData
): Promise<UploadActionResult> {
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Select an image file to upload." };
  }

  try {
    const { sourceId, storagePath } = await createGarmentSource({ file });

    const supabase = await createClient();
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("garment-originals")
      .createSignedUrl(storagePath, 5 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return { status: "error", message: "Failed to prepare image for analysis." };
    }

    const env = getServerEnv();
    const result = await callPipelineService({
      serviceUrl: env.PIPELINE_SERVICE_URL,
      imageUrl: signedUrlData.signedUrl,
    });

    await createDraftsFromPipelineResult({ sourceId, result });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Upload and analysis failed.",
    };
  }

  // Redirect must be outside try/catch so NEXT_REDIRECT is not swallowed.
  redirect("/wardrobe/review");
}
```

- [ ] **Step 2: Run full typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/page-actions.ts
git commit -m "feat: add uploadAndAnalyseAction server action"
```

---

## Task 5: Review page — list and action drafts

**Files:**
- Create: `app/wardrobe/review/page.tsx`
- Create: `app/wardrobe/review/draft-review-list.tsx`

- [ ] **Step 1: Create the DraftReviewList client component**

Create `app/wardrobe/review/draft-review-list.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptDraftAction, rejectDraftAction } from "./actions";
import type { PendingDraft } from "@/lib/domain/ingestion/service";

interface Props {
  drafts: PendingDraft[];
}

export default function DraftReviewList({ drafts }: Props) {
  const router = useRouter();
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const remaining = drafts.filter((d) => !actionedIds.has(d.id));

  function markActioned(id: string) {
    setActionedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      // If all drafts actioned, redirect to wardrobe
      if (next.size === drafts.length) {
        router.push("/wardrobe");
      }
      return next;
    });
  }

  function handleAccept(draftId: string) {
    startTransition(async () => {
      const result = await acceptDraftAction(draftId);
      if (result.status === "error") {
        setErrors((prev) => ({ ...prev, [draftId]: result.message }));
      } else {
        markActioned(draftId);
      }
    });
  }

  function handleReject(draftId: string) {
    startTransition(async () => {
      const result = await rejectDraftAction(draftId);
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

        return (
          <div
            key={draft.id}
            className="grid grid-cols-[80px_1fr_auto] gap-4 rounded-[18px] border border-[var(--line)] bg-white p-5"
            style={{ opacity: isLowConfidence ? 0.85 : 1 }}
          >
            {/* Placeholder image */}
            <div className="h-[100px] w-[80px] rounded-xl bg-[#e8e0d8]" />

            {/* Garment details */}
            <div>
              <p className="mb-1.5 text-[15px] font-semibold text-[#1a1a1a]">
                {draft.payload.tag}
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[
                  draft.payload.category,
                  draft.payload.colour,
                  draft.payload.material,
                  draft.payload.style,
                ]
                  .filter(Boolean)
                  .map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full bg-[#f0ece5] px-2.5 py-0.5 text-[11px] text-[#666]"
                    >
                      {pill}
                    </span>
                  ))}
              </div>
              <p
                className={`text-[11px] ${isLowConfidence ? "text-[#e09060]" : "text-[#aaa]"}`}
              >
                Confidence: {Math.round(draft.payload.confidence * 100)}%
                {isLowConfidence && " · low confidence"}
              </p>
              {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleAccept(draft.id)}
                disabled={isPending}
                className="rounded-full bg-[#c17a3a] px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleReject(draft.id)}
                disabled={isPending}
                className="rounded-full border border-[var(--line)] px-5 py-2 text-xs text-[#999] disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create the review page server component**

Create `app/wardrobe/review/page.tsx`:

```typescript
import { listPendingDrafts } from "@/lib/domain/ingestion/service";
import { getOptionalUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import DraftReviewList from "./draft-review-list";

export default async function ReviewPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/sign-in");

  const drafts = await listPendingDrafts();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a1a]">
            Review Detections
          </h1>
          <p className="mt-1 text-[13px] text-[#999]">
            {drafts.length > 0
              ? `${drafts.length} garment${drafts.length === 1 ? "" : "s"} detected · Accept to add to your wardrobe`
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

      <DraftReviewList drafts={drafts} />
    </main>
  );
}
```

- [ ] **Step 3: Run full typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Manually verify the review page renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000/wardrobe/review`. With no pending drafts it should show the empty state. With pending drafts from a previous pipeline run you should see draft cards.

- [ ] **Step 5: Commit**

```bash
git add app/wardrobe/review/page.tsx app/wardrobe/review/draft-review-list.tsx
git commit -m "feat: build /wardrobe/review page with accept/reject draft UI"
```

---

## Task 6: Homepage dashboard

**Files:**
- Replace: `app/page.tsx`
- Create: `app/components/upload-card.tsx`

- [ ] **Step 1: Create the UploadCard client component**

Create `app/components/upload-card.tsx`:

```typescript
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAndAnalyseAction } from "@/app/page-actions";

export default function UploadCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const formData = new FormData();
    formData.append("image", file);

    startTransition(async () => {
      const result = await uploadAndAnalyseAction(formData);
      if ("status" in result && result.status === "error") {
        setError(result.message);
      } else {
        // Success path: redirect() in server action handles navigation,
        // but if it returns (e.g. no redirect thrown), push manually.
        router.push("/wardrobe/review");
      }
    });
  }

  return (
    <div
      className="flex cursor-pointer flex-col justify-between rounded-2xl bg-[#c17a3a] p-5"
      onClick={() => !isPending && inputRef.current?.click()}
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">New</p>
        <p className="mt-2 text-base font-semibold text-white">
          Upload Outfit / Garment Photo
        </p>
        <p className="mt-1 text-[12px] text-white/75">AI detects garments automatically</p>
      </div>

      {isPending ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span className="text-xs text-white/80">Analysing…</span>
        </div>
      ) : (
        <div className="mt-3 w-fit rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-white">
          Upload Photo ↑
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
  );
}
```

- [ ] **Step 2: Replace the homepage**

Replace `app/page.tsx` entirely:

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { getDashboardStats, getRecentGarments } from "@/lib/domain/wardrobe/service";
import { createClient } from "@/lib/supabase/server";
import UploadCard from "@/app/components/upload-card";

export default async function HomePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/sign-in");

  const [stats, recentGarments] = await Promise.all([
    getDashboardStats(),
    getRecentGarments(6),
  ]);

  // Generate signed URLs for thumbnails (batch)
  const supabase = await createClient();
  const garmentThumbnails = await Promise.all(
    recentGarments.map(async (g) => {
      if (!g.storagePath) return { ...g, imageUrl: null };
      const { data } = await supabase.storage
        .from("garment-originals")
        .createSignedUrl(g.storagePath, 60 * 60); // 1 hour
      return { ...g, imageUrl: data?.signedUrl ?? null };
    })
  );

  const hasDrafts = stats.pendingDraftsCount > 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Stats row */}
      <div className="mb-4 grid grid-cols-[1fr_1fr_1fr_1.6fr] gap-3">
        {/* Wardrobe */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#999]">Wardrobe</p>
          <p className="mt-1.5 text-[28px] font-bold text-[#1a1a1a]">{stats.garmentCount}</p>
          <p className="mt-0.5 text-[11px] text-[#999]">items</p>
        </div>

        {/* Favourites */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#999]">Favourites</p>
          <p className="mt-1.5 text-[28px] font-bold text-[#1a1a1a]">{stats.favouritesCount}</p>
          <p className="mt-0.5 text-[11px] text-[#999]">items</p>
        </div>

        {/* Drafts */}
        {hasDrafts ? (
          <Link
            href="/wardrobe/review"
            className="rounded-2xl border border-[#e8d8c8] bg-[#fff8f0] p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#c17a3a]">Drafts</p>
            <p className="mt-1.5 text-[28px] font-bold text-[#c17a3a]">{stats.pendingDraftsCount}</p>
            <p className="mt-0.5 text-[11px] text-[#c17a3a]">ready to review →</p>
          </Link>
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#999]">Drafts</p>
            <p className="mt-1.5 text-[28px] font-bold text-[#1a1a1a]">0</p>
            <p className="mt-0.5 text-[11px] text-[#999]">items</p>
          </div>
        )}

        {/* Upload card */}
        <UploadCard />
      </div>

      {/* Recent additions */}
      <div className="rounded-[20px] border border-[var(--line)] bg-white p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold">Recent additions</p>
          <Link href="/wardrobe" className="text-[12px] text-[#c17a3a]">
            View all →
          </Link>
        </div>

        {garmentThumbnails.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#999]">
            No garments yet — upload a photo to get started.
          </p>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {garmentThumbnails.map((g) =>
              g.imageUrl ? (
                <Link
                  key={g.id}
                  href={`/wardrobe`}
                  className="aspect-[3/4] overflow-hidden rounded-[10px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.imageUrl}
                    alt={g.title ?? g.category}
                    className="h-full w-full object-cover"
                  />
                </Link>
              ) : (
                <div
                  key={g.id}
                  className="aspect-[3/4] rounded-[10px] bg-[#e8e0d8]"
                  title={g.title ?? g.category}
                />
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run full typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Verify:
1. `http://localhost:3000` loads the dashboard with stats and recent garments
2. Click "Upload Photo ↑" — file picker opens
3. Select an outfit photo — loading spinner shows while Modal analyses (~5–50s)
4. After analysis — browser navigates to `/wardrobe/review`
5. Draft cards appear, Accept button creates garment, Reject marks it rejected
6. After actioning all drafts — redirects to `/wardrobe`
7. Drafts count card on homepage shows amber tint when pending count > 0

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/components/upload-card.tsx
git commit -m "feat: replace scaffold homepage with real dashboard and UploadCard"
```

---

## Final checks

- [ ] Run `npm test` — all tests pass
- [ ] Run `npx tsc --noEmit` — no type errors
- [ ] Manual smoke test upload flow end-to-end
- [ ] Use superpowers:finishing-a-development-branch to complete
