# Wardrobe Piece and Grid Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the wardrobe piece and grid dialogs that `docs/design/design_handoff_garderobe/MODALS.md` marks "drawn" at phone turn 18 (18a–18d) and web turn w6 (w6a–w6c) — the set MODALS.md itself says is "now designed on both platforms" — so the piece-detail and grid screens stop inventing their own dialog behaviour and match the mockups.

**Architecture:** Two new DB concepts (a soft-delete window on `garments`, and a `collections` table) land in one migration first. New dialogs and sheets are built as standalone components under `components/garderobe/wardrobe/`, on top of the existing `Dialog` and `BottomSheet` primitives in `components/garderobe/dialog.tsx` and `components/garderobe/bottom-sheet.tsx`. They are wired into the existing `WardrobeShop` client component (`components/wardrobe-shop.tsx`) and the piece-detail page (`app/wardrobe/[id]/page.tsx`), replacing ad hoc inline dialog markup where it already exists (the file has its own `DialogShell`, `GarmentDetailDialog`, and an inline delete-confirm state) rather than duplicating it. Server actions follow the existing `WardrobeActionState` reducer pattern in `app/wardrobe/actions.ts`.

**Tech Stack:** Next.js App Router server actions, Zod validation, Supabase/Postgres with RLS, Vitest for unit tests, React Testing Library for component tests.

**Spec:** `docs/design/design_handoff_garderobe/MODALS.md` §1–2, `Garderobe Phone.dc.html#18a`–`#18d`, `Garderobe Web.dc.html#w6a`–`#w6c`, `docs/design/design_handoff_garderobe/DATA_MODEL.md` "Collection".

## Out of scope for this phase

MODALS.md marks these **missing** — they are not drawn yet, so there is nothing to build against. Leave them for a follow-on phase:
- Retire / store for the season (§1)
- Rename and delete a collection (§2 — only *new* collection is drawn)
- Everything in MODALS.md §3 onward: intake permissions, local threads dialogs, auth/account dialogs, and every empty/loading/offline/error state (README.md calls this last one the largest remaining design gap on both platforms).

## Global Constraints

- Deletion is undoable and says so in a toast (`BUILD_ORDER.md` standing rule 5). `deleteGarment` in `lib/domain/wardrobe/service.ts:629` currently hard-deletes with no undo — this plan replaces it with a soft delete.
- A null price is "add later", never `A$0` (standing rule 2).
- Low confidence renders as a question, never a fact (standing rule 3).
- Australian English, no em dashes, in all new UI copy (`~/.claude/CLAUDE.md`).
- Every new dialog/sheet is built on `Dialog` (`components/garderobe/dialog.tsx`) or `BottomSheet`/`SheetAction` (`components/garderobe/bottom-sheet.tsx`) — extend a primitive's props if a mockup needs something it can't currently do; don't fork a new one-off overlay pattern.
- Server actions take `(previousState: WardrobeActionState, formData: FormData)` and return `WardrobeActionState`, per every existing action in `app/wardrobe/actions.ts`.

---

## Task 1: Migration — soft delete and collections

**Files:**
- Create: `supabase/migrations/035_wardrobe_soft_delete_and_collections.sql`

**Interfaces:**
- Produces: `garments.deleted_at timestamptz`, `garments.merged_into_id uuid`; `public.collections` table (`id`, `user_id`, `name`, `kind`, `created_at`); `public.garment_collections` join table (`collection_id`, `garment_id`, `added_at`).

- [ ] **Step 1: Write the migration**

```sql
-- Phase 11 (wardrobe dialogs, turn 18 / w6): "delete N pieces" and "recently
-- deleted / restore" need a soft-delete window distinct from the archive/
-- let-go flow (archived_at, migration 024) — an archived piece stays in the
-- wardrobe and its counts on purpose; a deleted one should not. merged_into_id
-- gives "merge these two" an audit trail instead of silently vanishing a row.
alter table public.garments
  add column if not exists deleted_at timestamptz,
  add column if not exists merged_into_id uuid references public.garments(id);

create index if not exists garments_user_deleted_idx
  on public.garments (user_id) where deleted_at is not null;

-- Collection — DATA_MODEL.md "Collection". A join table rather than an
-- array column so a piece can sit in more than one collection and so RLS
-- can be scoped per row like every other user-owned table here.
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'user' check (kind in ('user', 'batch', 'packing')),
  created_at timestamptz not null default now()
);

create table if not exists public.garment_collections (
  collection_id uuid not null references public.collections(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, garment_id)
);

alter table public.collections enable row level security;
alter table public.garment_collections enable row level security;

create policy collections_select_own on public.collections
  for select using (auth.uid() = user_id);

create policy collections_insert_own on public.collections
  for insert with check (auth.uid() = user_id);

create policy collections_update_own on public.collections
  for update using (auth.uid() = user_id);

create policy collections_delete_own on public.collections
  for delete using (auth.uid() = user_id);

create policy garment_collections_select_own on public.garment_collections
  for select using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );

create policy garment_collections_insert_own on public.garment_collections
  for insert with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );

create policy garment_collections_delete_own on public.garment_collections
  for delete using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );
```

- [ ] **Step 2: Apply it to the local/dev Supabase project and confirm it runs clean**

Run: `supabase db push` (or however this project applies migrations locally — see `HANDOFF.md` for the caveat that migrations 023–034 were, as of that note, unapplied against the live project; confirm the target project's current migration state before pushing).
Expected: migration `035_wardrobe_soft_delete_and_collections.sql` applies with no errors, `garments`, `collections`, and `garment_collections` all show the new columns/tables via `list_tables`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/035_wardrobe_soft_delete_and_collections.sql
git commit -m "Add soft-delete columns and a collections table for the wardrobe dialogs phase."
```

---

## Task 2: Soft delete, restore, and usage-blocker service functions

**Files:**
- Modify: `lib/domain/wardrobe/service.ts` (replace `deleteGarment` at line 629; add `restoreGarment`, `listRecentlyDeletedGarments`, `getGarmentUsageBlockers`)
- Modify: `lib/domain/wardrobe/service.ts` — `listWardrobeGarments` (line 400) and `getGarmentById` (line 646) must exclude `deleted_at is not null`
- Test: `lib/domain/wardrobe/__tests__/soft-delete.test.ts`

**Interfaces:**
- Consumes: existing `getRequiredUser()`, `createClient()` from `@/lib/supabase/server`, `GarmentListItem` type.
- Produces: `deleteGarment(garmentId: string): Promise<void>` (now soft, sets `deleted_at`), `restoreGarment(garmentId: string): Promise<void>` (clears `deleted_at`), `listRecentlyDeletedGarments(): Promise<GarmentListItem[]>`, `getGarmentUsageBlockers(garmentId: string): Promise<{ activeOutfitCount: number; activeListingId: string | null }>` — read by Task 5.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/domain/wardrobe/__tests__/soft-delete.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock, eq: eqMock, select: selectMock }));
const selectMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("deleteGarment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("sets deleted_at instead of removing the row", async () => {
    const { deleteGarment } = await import("@/lib/domain/wardrobe/service");
    await deleteGarment("22222222-2222-2222-2222-222222222222");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/wardrobe/__tests__/soft-delete.test.ts`
Expected: FAIL — `deleteGarment` still calls `.delete()`, never `.update()`.

- [ ] **Step 3: Replace the hard delete with a soft delete, and add restore/list/usage-blocker functions**

```typescript
// lib/domain/wardrobe/service.ts — replace the existing deleteGarment (line 629) with:

/** 18b / w6c — soft delete: sets deleted_at so "recently deleted" can restore it. */
export async function deleteGarment(garmentId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(garmentId);

  const { error } = await supabase
    .from("garments")
    .update(({ deleted_at: new Date().toISOString() } satisfies Partial<GarmentInsert>) as never)
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/** 18b / w6c — undoes deleteGarment from the "recently deleted" sheet. */
export async function restoreGarment(garmentId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(garmentId);

  const { error } = await supabase
    .from("garments")
    .update(({ deleted_at: null } satisfies Partial<GarmentInsert>) as never)
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/** 18b / w6c — the "recently deleted" sheet's list. */
export async function listRecentlyDeletedGarments(): Promise<GarmentListItem[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("garments")
    .select(GARMENT_LIST_SELECT)
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => garmentListItemSchema.parse(row as Record<string, unknown>));
}

/**
 * 18b / w6c — "piece is used elsewhere, refuse and offer archive" reads
 * this before delete/merge. An active outfit reference or a live local
 * listing means delete should refuse and offer archive instead.
 */
export async function getGarmentUsageBlockers(
  garmentId: string
): Promise<{ activeOutfitCount: number; activeListingId: string | null }> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(garmentId);

  const { count: outfitCount, error: outfitError } = await supabase
    .from("outfit_items")
    .select("id", { count: "exact", head: true })
    .eq("garment_id", parsedId);

  if (outfitError) {
    throw new Error(outfitError.message);
  }

  const { data: listing, error: listingError } = await supabase
    .from("local_listings")
    .select("id")
    .eq("garment_id", parsedId)
    .eq("user_id", user.id)
    .in("status", ["active", "pending_handover"])
    .maybeSingle();

  if (listingError) {
    throw new Error(listingError.message);
  }

  return {
    activeOutfitCount: outfitCount ?? 0,
    activeListingId: (listing as { id: string } | null)?.id ?? null
  };
}
```

Then, in `listWardrobeGarments` and `getGarmentById`, add `.is("deleted_at", null)` (or the schema-appropriate `.eq`/`.filter`) to the existing query chain so a soft-deleted piece stops appearing everywhere except the new recently-deleted list. Check the exact `local_listings.status` enum values against `supabase/migrations/029_local_listings.sql` before using `"active"`/`"pending_handover"` literally — match whatever that migration actually defines.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/wardrobe/__tests__/soft-delete.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/wardrobe/service.ts lib/domain/wardrobe/__tests__/soft-delete.test.ts
git commit -m "Turn wardrobe delete into a soft delete with restore and usage-blocker checks."
```

---

## Task 3: Server actions for delete, restore, bulk delete, and merge

**Files:**
- Modify: `app/wardrobe/actions.ts` (add `restoreGarmentAction`, `bulkDeleteGarmentsAction`, `mergeGarmentsAction`; `deleteGarmentAction` at line 808 keeps its shape since the service call underneath already changed in Task 2 — but it must now surface the usage-blocker refuse-and-offer-archive case)
- Test: `app/wardrobe/__tests__/actions.test.ts` (extend the existing file with new `describe` blocks, same style already there)

**Interfaces:**
- Consumes: `deleteGarment`, `restoreGarment`, `getGarmentUsageBlockers` from Task 2; `archiveGarment` (already exists).
- Produces: `restoreGarmentAction(prev, formData): Promise<WardrobeActionState>`, `bulkDeleteGarmentsAction(prev, formData): Promise<WardrobeActionState>` (formData carries repeated `garment_id` entries via `formData.getAll`), `mergeGarmentsAction(prev, formData): Promise<WardrobeActionState>` (formData: `source_garment_id`, `target_garment_id`). `deleteGarmentAction`'s `WardrobeActionState` gains a `blocked?: { activeOutfitCount: number; activeListingId: string | null }` field for the refuse-and-archive dialog to read — add this field to `WardrobeActionState` in `lib/domain/wardrobe/action-state.ts`.

- [ ] **Step 1: Extend `WardrobeActionState`**

```typescript
// lib/domain/wardrobe/action-state.ts
export type WardrobeActionState = {
  status: "idle" | "success" | "error" | "partial" | "blocked";
  message: string | null;
  garmentId?: string;
  draftIds?: string[];
  nextPath?: string;
  blocked?: { activeOutfitCount: number; activeListingId: string | null };
};
```

- [ ] **Step 2: Write the failing tests**

```typescript
// append to app/wardrobe/__tests__/actions.test.ts

describe("deleteGarmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status 'blocked' instead of deleting when the piece is used elsewhere", async () => {
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return {
        ...actual,
        getGarmentUsageBlockers: vi.fn(async () => ({ activeOutfitCount: 2, activeListingId: null })),
        deleteGarment: vi.fn()
      };
    });
    const { deleteGarmentAction } = await import("@/app/wardrobe/actions");
    const { deleteGarment } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("garment_id", "33333333-3333-3333-3333-333333333333");

    const result = await deleteGarmentAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("blocked");
    expect(result.blocked?.activeOutfitCount).toBe(2);
    expect(deleteGarment).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});

describe("bulkDeleteGarmentsAction", () => {
  it("deletes every garment id it is given and reports the count", async () => {
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return {
        ...actual,
        getGarmentUsageBlockers: vi.fn(async () => ({ activeOutfitCount: 0, activeListingId: null })),
        deleteGarment: vi.fn(async () => {})
      };
    });
    const { bulkDeleteGarmentsAction } = await import("@/app/wardrobe/actions");

    const formData = new FormData();
    formData.append("garment_id", "44444444-4444-4444-4444-444444444444");
    formData.append("garment_id", "55555555-5555-5555-5555-555555555555");

    const result = await bulkDeleteGarmentsAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(result.message).toContain("2");
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts`
Expected: FAIL — `deleteGarmentAction` doesn't check usage blockers yet, `bulkDeleteGarmentsAction`/`mergeGarmentsAction` don't exist.

- [ ] **Step 4: Implement**

```typescript
// app/wardrobe/actions.ts — imports: add getGarmentUsageBlockers, restoreGarment to the
// existing import from "@/lib/domain/wardrobe/service", and add:
import { incrementWearCount, logWearEvent } from "@/lib/domain/wear-events/service";
// (already imported — no change needed there)

const bulkGarmentIdsFormSchema = z.object({
  garment_id: z.array(z.string().uuid()).min(1)
});

const mergeGarmentsFormSchema = z.object({
  source_garment_id: z.string().uuid(),
  target_garment_id: z.string().uuid()
});

// Replace the existing deleteGarmentAction body with:
export async function deleteGarmentAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteGarmentFormSchema.parse({
      garment_id: formData.get("garment_id")
    });

    const blockers = await getGarmentUsageBlockers(values.garment_id);
    if (blockers.activeOutfitCount > 0 || blockers.activeListingId) {
      return {
        status: "blocked",
        garmentId: values.garment_id,
        message: "This piece is used elsewhere. Archive it instead of deleting it.",
        blocked: blockers
      };
    }

    await deleteGarment(values.garment_id);
    revalidatePath("/wardrobe");

    return {
      status: "success",
      message: "Item deleted — you can restore it from recently deleted."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to delete item."
    };
  }
}

export async function restoreGarmentAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteGarmentFormSchema.parse({
      garment_id: formData.get("garment_id")
    });

    await restoreGarment(values.garment_id);
    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Restored to the wardrobe."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to restore item."
    };
  }
}

export async function bulkDeleteGarmentsAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = bulkGarmentIdsFormSchema.parse({
      garment_id: formData.getAll("garment_id")
    });

    const blocked: string[] = [];
    for (const garmentId of values.garment_id) {
      const blockers = await getGarmentUsageBlockers(garmentId);
      if (blockers.activeOutfitCount > 0 || blockers.activeListingId) {
        blocked.push(garmentId);
        continue;
      }
      await deleteGarment(garmentId);
    }

    revalidatePath("/wardrobe");

    const deletedCount = values.garment_id.length - blocked.length;
    return {
      status: blocked.length ? "partial" : "success",
      message: blocked.length
        ? `${deletedCount} deleted. ${blocked.length} used elsewhere and were skipped.`
        : `${deletedCount} item${deletedCount === 1 ? "" : "s"} deleted — you can restore from recently deleted.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to delete items."
    };
  }
}

/**
 * 18a / w6c — "merge these two": the source's wear history moves to the
 * target (wear_count/cost_per_wear are trigger-derived from wear_events,
 * so reassigning wear_events.garment_id recomputes both automatically),
 * then the source is soft-deleted with merged_into_id set for the audit trail.
 */
export async function mergeGarmentsAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = mergeGarmentsFormSchema.parse({
      source_garment_id: formData.get("source_garment_id"),
      target_garment_id: formData.get("target_garment_id")
    });

    await mergeGarments(values.source_garment_id, values.target_garment_id);
    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${values.target_garment_id}`);

    return {
      status: "success",
      garmentId: values.target_garment_id,
      message: "Merged into one piece."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to merge these pieces."
    };
  }
}
```

Add the corresponding `mergeGarments(sourceId, targetId)` function to `lib/domain/wardrobe/service.ts`:

```typescript
/** 18a / w6c — moves wear_events to target, then soft-deletes source. */
export async function mergeGarments(sourceGarmentId: string, targetGarmentId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedSource = z.string().uuid().parse(sourceGarmentId);
  const parsedTarget = z.string().uuid().parse(targetGarmentId);

  const { error: reassignError } = await supabase
    .from("wear_events")
    .update(({ garment_id: parsedTarget } satisfies Partial<WearEventUpdate>) as never)
    .eq("garment_id", parsedSource)
    .eq("user_id", user.id);

  if (reassignError) {
    throw new Error(reassignError.message);
  }

  const { error: deleteError } = await supabase
    .from("garments")
    .update(({
      deleted_at: new Date().toISOString(),
      merged_into_id: parsedTarget
    } satisfies Partial<GarmentInsert>) as never)
    .eq("id", parsedSource)
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}
```

Add `import type { TablesUpdate } from "@/types/database";` and a `type WearEventUpdate = TablesUpdate<"wear_events">;` alongside the file's other row/insert type aliases if one doesn't already exist for updates.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/wardrobe/actions.ts lib/domain/wardrobe/service.ts lib/domain/wardrobe/action-state.ts app/wardrobe/__tests__/actions.test.ts
git commit -m "Add restore, bulk delete, and merge server actions with a used-elsewhere refuse path."
```

---

## Task 4: Wear-event correction and collections service + actions

**Files:**
- Modify: `lib/domain/wear-events/service.ts` (add `updateWearEvent`, `deleteWearEvent`)
- Modify: `lib/domain/wardrobe/service.ts` (add `createCollection`, `listCollections`)
- Modify: `app/wardrobe/actions.ts` (add `updateWearEventAction`, `deleteWearEventAction`, `createCollectionAction`)
- Test: `lib/domain/wear-events/__tests__/service.test.ts` (new — check for an existing `__tests__` dir under `lib/domain/wear-events/` first; create it if absent), extend `app/wardrobe/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `wearEventSchema` from `@/lib/domain/wear-events` (Task import already exists), `getRequiredUser`, `createClient`.
- Produces: `updateWearEvent(input: { wearEventId: string; wornAt?: string; occasion?: string | null; notes?: string | null }): Promise<void>`, `deleteWearEvent(wearEventId: string): Promise<void>`, `createCollection(input: { name: string; kind?: "user" | "batch" | "packing"; garmentIds?: string[] }): Promise<{ id: string }>`, `listCollections(): Promise<Array<{ id: string; name: string; kind: string; garmentIds: string[] }>>`.

- [ ] **Step 1: Write the failing test for wear-event correction**

```typescript
// lib/domain/wear-events/__tests__/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn(() => ({ eq: eqMock, error: null }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const deleteChainMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock, delete: deleteChainMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("updateWearEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates only the fields given", async () => {
    const { updateWearEvent } = await import("@/lib/domain/wear-events/service");
    await updateWearEvent({
      wearEventId: "66666666-6666-6666-6666-666666666666",
      occasion: "work"
    });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ occasion: "work" }));
  });
});

describe("deleteWearEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the wear_events row scoped to the current user", async () => {
    const { deleteWearEvent } = await import("@/lib/domain/wear-events/service");
    await deleteWearEvent("77777777-7777-7777-7777-777777777777");

    expect(deleteChainMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/wear-events/__tests__/service.test.ts`
Expected: FAIL — `updateWearEvent`/`deleteWearEvent` are not exported yet.

- [ ] **Step 3: Implement wear-event correction**

```typescript
// lib/domain/wear-events/service.ts — add:

const updateWearEventSchema = z.object({
  wornAt: z.string().min(1).optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

/** 18a / w6b — "remove or correct a logged wear". */
export async function updateWearEvent(params: {
  wearEventId: string;
  wornAt?: string;
  occasion?: string | null;
  notes?: string | null;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(params.wearEventId);
  const values = updateWearEventSchema.parse({
    wornAt: params.wornAt,
    occasion: params.occasion,
    notes: params.notes
  });

  const patch: Partial<WearEventInsert> = {};
  if (values.wornAt !== undefined) patch.worn_at = values.wornAt;
  if (values.occasion !== undefined) patch.occasion = values.occasion;
  if (values.notes !== undefined) patch.notes = values.notes;

  const { error } = await supabase
    .from("wear_events")
    .update(patch as never)
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/** 18a / w6b — the delete half of "remove or correct a logged wear". */
export async function deleteWearEvent(wearEventId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(wearEventId);

  const { error } = await supabase
    .from("wear_events")
    .delete()
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/wear-events/__tests__/service.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for collections, then implement `createCollection`/`listCollections`**

```typescript
// append to app/wardrobe/__tests__/actions.test.ts

describe("createCollectionAction", () => {
  it("creates a collection with the given name and garment ids", async () => {
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, createCollection: vi.fn(async () => ({ id: "collection-1" })) };
    });
    const { createCollectionAction } = await import("@/app/wardrobe/actions");

    const formData = new FormData();
    formData.set("name", "Capsule");
    formData.append("garment_id", "88888888-8888-8888-8888-888888888888");

    const result = await createCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });

  it("rejects an empty name", async () => {
    const { createCollectionAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("name", "");

    const result = await createCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
  });
});
```

```typescript
// lib/domain/wardrobe/service.ts — add:

/** 18c / w6a — "new collection" sheet on the grid's select mode. */
export async function createCollection(params: {
  name: string;
  kind?: "user" | "batch" | "packing";
  garmentIds?: string[];
}): Promise<{ id: string }> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const name = z.string().trim().min(1).max(120).parse(params.name);
  const kind = z.enum(["user", "batch", "packing"]).default("user").parse(params.kind ?? "user");
  const garmentIds = z.array(z.string().uuid()).default([]).parse(params.garmentIds ?? []);

  const { data, error } = await supabase
    .from("collections")
    .insert(({ user_id: user.id, name, kind } satisfies Record<string, unknown>) as never)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create collection.");
  }

  const collectionId = (data as { id: string }).id;

  if (garmentIds.length) {
    const rows = garmentIds.map((garmentId) => ({ collection_id: collectionId, garment_id: garmentId }));
    const { error: linkError } = await supabase.from("garment_collections").insert(rows as never);
    if (linkError) {
      throw new Error(linkError.message);
    }
  }

  return { id: collectionId };
}

/** 18c / w6a — collections list for the grid's collection picker/filter. */
export async function listCollections(): Promise<
  Array<{ id: string; name: string; kind: string; garmentIds: string[] }>
> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collections")
    .select("id,name,kind,garment_collections(garment_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const typed = row as { id: string; name: string; kind: string; garment_collections: Array<{ garment_id: string }> | null };
    return {
      id: typed.id,
      name: typed.name,
      kind: typed.kind,
      garmentIds: (typed.garment_collections ?? []).map((link) => link.garment_id)
    };
  });
}
```

```typescript
// app/wardrobe/actions.ts — add:

const updateWearEventFormSchema = z.object({
  wear_event_id: z.string().uuid(),
  worn_at: nullableText(40),
  occasion: nullableText(120),
  notes: nullableText(2000)
});

const deleteWearEventFormSchema = z.object({
  wear_event_id: z.string().uuid()
});

const createCollectionFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  garment_id: z.array(z.string().uuid()).default([])
});

export async function updateWearEventAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = updateWearEventFormSchema.parse({
      wear_event_id: formData.get("wear_event_id"),
      worn_at: formData.get("worn_at"),
      occasion: formData.get("occasion"),
      notes: formData.get("notes")
    });

    await updateWearEvent({
      wearEventId: values.wear_event_id,
      wornAt: values.worn_at ?? undefined,
      occasion: values.occasion,
      notes: values.notes
    });
    revalidatePath("/wardrobe");

    return { status: "success", message: "Wear updated." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update that wear."
    };
  }
}

export async function deleteWearEventAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteWearEventFormSchema.parse({
      wear_event_id: formData.get("wear_event_id")
    });

    await deleteWearEvent(values.wear_event_id);
    revalidatePath("/wardrobe");

    return { status: "success", message: "Wear removed." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to remove that wear."
    };
  }
}

export async function createCollectionAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = createCollectionFormSchema.parse({
      name: formData.get("name"),
      garment_id: formData.getAll("garment_id")
    });

    await createCollection({ name: values.name, garmentIds: values.garment_id });
    revalidatePath("/wardrobe");

    return { status: "success", message: "Collection created." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create the collection."
    };
  }
}
```

Add `updateWearEvent`, `deleteWearEvent` to the import from `@/lib/domain/wear-events/service`, and `createCollection` to the import from `@/lib/domain/wardrobe/service`, at the top of `app/wardrobe/actions.ts`.

- [ ] **Step 6: Run all new/extended tests to verify they pass**

Run: `npx vitest run lib/domain/wear-events/__tests__/service.test.ts app/wardrobe/__tests__/actions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/domain/wear-events/service.ts lib/domain/wardrobe/service.ts app/wardrobe/actions.ts lib/domain/wear-events/__tests__/service.test.ts app/wardrobe/__tests__/actions.test.ts
git commit -m "Add wear-event correction and collections service functions and actions."
```

---

## Task 5: Piece-level dialogs — merge, disposal, price panel, picker sheet, recut, wear correction

**Files:**
- Create: `components/garderobe/wardrobe/merge-dialog.tsx`
- Create: `components/garderobe/wardrobe/disposal-sheet.tsx`
- Create: `components/garderobe/wardrobe/price-panel.tsx`
- Create: `components/garderobe/wardrobe/picker-sheet.tsx` (shared by category, colour, fabric — MODALS.md: "category and colour follow the same pattern" as fabric)
- Create: `components/garderobe/wardrobe/recut-sheet.tsx`
- Create: `components/garderobe/wardrobe/wear-correction-sheet.tsx`
- Create: `components/garderobe/wardrobe/used-elsewhere-dialog.tsx`
- Modify: `app/wardrobe/[id]/page.tsx` (wire all of the above in; replace the inline `setPriceFormAction` form under the "price" section with `PricePanel`)
- Test: `components/garderobe/wardrobe/__tests__/price-panel.test.tsx`, `components/garderobe/wardrobe/__tests__/picker-sheet.test.tsx` (follow the pattern in `app/wardrobe/review/__tests__/draft-review-list-field.test.tsx`)

**Interfaces:**
- Consumes: `Dialog` from `components/garderobe/dialog.tsx`, `BottomSheet`/`SheetAction` from `components/garderobe/bottom-sheet.tsx`; `mergeGarmentsAction`, `deleteGarmentAction` (for the blocked/refuse path), `archiveGarmentAction`, `setPriceManuallyAction`, `updateGarmentAction`, `updateWearEventAction`, `deleteWearEventAction`, `addGarmentImageAction`, `setGarmentFeatureImageAction` from `@/app/wardrobe/actions`.
- Produces: `<MergeDialog open target candidate onConfirm />`, `<DisposalSheet open garmentId onClose />`, `<PricePanel garment mode="sheet"|"panel" />`, `<PickerSheet open title options value onSelect field="category"|"primary_colour_family"|"material" garmentId />`, `<RecutSheet open garmentId onClose />`, `<WearCorrectionSheet open wearEvent onClose />`, `<UsedElsewhereDialog open blockers onArchiveInstead onClose />` — consumed by Task 6 and 7.

- [ ] **Step 1: Write the failing component test for `PricePanel`**

```typescript
// components/garderobe/wardrobe/__tests__/price-panel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricePanel } from "@/components/garderobe/wardrobe/price-panel";

const noopAction = async (state: unknown) => state as never;

describe("PricePanel", () => {
  it("shows 'add later' rather than A$0 when there is no price", () => {
    render(
      <PricePanel
        garmentId="99999999-9999-9999-9999-999999999999"
        currentPrice={null}
        currentCurrency={null}
        mode="panel"
        setPriceAction={noopAction}
      />
    );

    expect(screen.getByText(/add later/i)).toBeInTheDocument();
    expect(screen.queryByText("A$0.00")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/price-panel.test.tsx`
Expected: FAIL — `components/garderobe/wardrobe/price-panel.tsx` does not exist.

- [ ] **Step 3: Implement `PricePanel`**

```tsx
// components/garderobe/wardrobe/price-panel.tsx
"use client";

import { useActionState } from "react";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

type PricePanelProps = {
  garmentId: string;
  currentPrice: number | null;
  currentCurrency: string | null;
  mode: "sheet" | "panel";
  open?: boolean;
  onClose?: () => void;
  setPriceAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/** 18a / w6b — "add or edit a price": a sheet on phone, a persistent side panel on desktop. */
export function PricePanel({
  garmentId,
  currentPrice,
  currentCurrency,
  mode,
  open = true,
  onClose,
  setPriceAction
}: PricePanelProps) {
  const [state, formAction] = useActionState(setPriceAction, idleState);

  const form = (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="garment_id" value={garmentId} />
      <label className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
        price
        <input
          type="number"
          name="price"
          step="0.01"
          min="0"
          defaultValue={currentPrice ?? ""}
          placeholder="add later"
          className="mt-1 w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
        />
      </label>
      <input type="hidden" name="currency" value={currentCurrency ?? "AUD"} />
      <button
        type="submit"
        className="rounded-[100px] bg-[var(--oxblood)] px-4 py-[10px] text-[12.5px] text-[var(--cream)]"
      >
        save price
      </button>
      {state.status === "error" ? (
        <p className="text-[11px] text-[var(--oxblood)]">{state.message}</p>
      ) : null}
    </form>
  );

  if (mode === "panel") {
    return <div className="rounded-[4px] border border-[rgba(30,26,23,.14)] p-4">{form}</div>;
  }

  return (
    <BottomSheet open={open} onClose={onClose ?? (() => {})} title="price">
      {form}
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/price-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing component test for `PickerSheet`, then implement it**

```typescript
// components/garderobe/wardrobe/__tests__/picker-sheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PickerSheet } from "@/components/garderobe/wardrobe/picker-sheet";

describe("PickerSheet", () => {
  it("calls onSelect with the chosen option", () => {
    const onSelect = vi.fn();
    render(
      <PickerSheet
        open
        title="fabric"
        options={["cotton", "wool", "silk"]}
        value="cotton"
        onSelect={onSelect}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByText("wool"));
    expect(onSelect).toHaveBeenCalledWith("wool");
  });
});
```

```tsx
// components/garderobe/wardrobe/picker-sheet.tsx
"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

type PickerSheetProps = {
  open: boolean;
  title: string;
  options: string[];
  value: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
};

/** 18d / w6b — category, colour, and fabric all use this same picker pattern. */
export function PickerSheet({ open, title, options, value, onSelect, onClose }: PickerSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div>
        {options.map((option, index) => (
          <SheetAction
            key={option}
            last={index === options.length - 1}
            onClick={() => {
              onSelect(option);
              onClose();
            }}
          >
            {option}
            {option === value ? " ✓" : ""}
          </SheetAction>
        ))}
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/picker-sheet.test.tsx`
Expected: PASS

- [ ] **Step 7: Implement the remaining piece-level components against the existing primitives (no new tests beyond what's above — these are thin wrappers exercised by Task 7's integration test)**

```tsx
// components/garderobe/wardrobe/merge-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type MergeDialogProps = {
  open: boolean;
  sourceTitle: string;
  targetTitle: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** 18a / w6c — "merge these two". */
export function MergeDialog({ open, sourceTitle, targetTitle, onClose, onConfirm }: MergeDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="merge these two?"
      description={`"${sourceTitle}" will merge into "${targetTitle}". Wear history moves across; this can't be undone.`}
      confirmLabel="merge"
      onConfirm={onConfirm}
    />
  );
}
```

```tsx
// components/garderobe/wardrobe/used-elsewhere-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type UsedElsewhereDialogProps = {
  open: boolean;
  activeOutfitCount: number;
  hasActiveListing: boolean;
  onClose: () => void;
  onArchiveInstead: () => void;
};

/** 18b / w6c — refuse to delete a piece that's used elsewhere; offer to archive it. */
export function UsedElsewhereDialog({
  open,
  activeOutfitCount,
  hasActiveListing,
  onClose,
  onArchiveInstead
}: UsedElsewhereDialogProps) {
  const parts = [
    activeOutfitCount > 0 ? `${activeOutfitCount} saved look${activeOutfitCount === 1 ? "" : "s"}` : null,
    hasActiveListing ? "a live local listing" : null
  ].filter(Boolean);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="this piece is used elsewhere"
      description={`It's in ${parts.join(" and ")}. Archive it instead, so it leaves the wardrobe without breaking those.`}
      cancelLabel="cancel"
      confirmLabel="archive instead"
      onConfirm={onArchiveInstead}
    />
  );
}
```

```tsx
// components/garderobe/wardrobe/disposal-sheet.tsx
"use client";

import { useActionState } from "react";
import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

const DISPOSAL_REASONS = ["sold", "given away", "damaged", "lost"] as const;

type DisposalSheetProps = {
  open: boolean;
  garmentId: string;
  onClose: () => void;
  archiveAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/** 18a / w6c — "what happened to it": sold, given away, damaged, or lost. */
export function DisposalSheet({ open, garmentId, onClose, archiveAction }: DisposalSheetProps) {
  const [, formAction] = useActionState(archiveAction, idleState);

  return (
    <BottomSheet open={open} onClose={onClose} title="what happened to it?">
      <form action={formAction}>
        <input type="hidden" name="garment_id" value={garmentId} />
        {DISPOSAL_REASONS.map((reason, index) => (
          <button key={reason} type="submit" name="reason" value={reason} className="w-full text-left">
            <SheetAction last={index === DISPOSAL_REASONS.length - 1}>{reason}</SheetAction>
          </button>
        ))}
      </form>
    </BottomSheet>
  );
}
```

```tsx
// components/garderobe/wardrobe/wear-correction-sheet.tsx
"use client";

import { useActionState } from "react";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

type WearCorrectionSheetProps = {
  open: boolean;
  wearEventId: string;
  wornAt: string;
  occasion: string | null;
  onClose: () => void;
  updateAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
  deleteAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/** 18a / w6b — "remove or correct a logged wear". */
export function WearCorrectionSheet({
  open,
  wearEventId,
  wornAt,
  occasion,
  onClose,
  updateAction,
  deleteAction
}: WearCorrectionSheetProps) {
  const [, updateFormAction] = useActionState(updateAction, idleState);
  const [, deleteFormAction] = useActionState(deleteAction, idleState);

  return (
    <BottomSheet open={open} onClose={onClose} title="this wear">
      <form action={updateFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="wear_event_id" value={wearEventId} />
        <label className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          worn on
          <input
            type="date"
            name="worn_at"
            defaultValue={wornAt.slice(0, 10)}
            className="mt-1 w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
          />
        </label>
        <label className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          occasion
          <input
            type="text"
            name="occasion"
            defaultValue={occasion ?? ""}
            className="mt-1 w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
          />
        </label>
        <button type="submit" className="rounded-[100px] bg-[var(--oxblood)] px-4 py-[10px] text-[12.5px] text-[var(--cream)]">
          save
        </button>
      </form>
      <form action={deleteFormAction} className="pt-3">
        <input type="hidden" name="wear_event_id" value={wearEventId} />
        <button type="submit" className="text-[12.5px] text-[var(--oxblood)]">
          remove this wear
        </button>
      </form>
    </BottomSheet>
  );
}
```

```tsx
// components/garderobe/wardrobe/recut-sheet.tsx
"use client";

import { useActionState } from "react";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

type RecutSheetProps = {
  open: boolean;
  garmentId: string;
  onClose: () => void;
  addImageAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/** 18d / w6c — "recut the photo": replace the hero image with a fresh upload. */
export function RecutSheet({ open, garmentId, onClose, addImageAction }: RecutSheetProps) {
  const [state, formAction] = useActionState(addImageAction, idleState);

  return (
    <BottomSheet open={open} onClose={onClose} title="recut the photo" description="upload a clearer shot to cut out again">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="garment_id" value={garmentId} />
        <input type="file" name="image" accept="image/*" required />
        <button type="submit" className="rounded-[100px] bg-[var(--oxblood)] px-4 py-[10px] text-[12.5px] text-[var(--cream)]">
          recut
        </button>
        {state.status === "error" ? <p className="text-[11px] text-[var(--oxblood)]">{state.message}</p> : null}
      </form>
    </BottomSheet>
  );
}
```

- [ ] **Step 8: Wire the piece-detail page**

In `app/wardrobe/[id]/page.tsx`, replace the inline `setPriceFormAction`/price `<form>` block with `<PricePanel garmentId={garment.id} currentPrice={garment.purchase_price} currentCurrency={garment.purchase_currency} mode="panel" setPriceAction={setPriceManuallyAction} />`. This page is a server component, so `PricePanel`, `RecutSheet`, `DisposalSheet`, and `WearCorrectionSheet` (all client components using `useActionState`) need a thin client wrapper on this page, or the page needs a `"use client"` sub-component that receives the server actions as props — follow the existing pattern already used for `ArchiveControl` (imported from `@/components/garderobe` at the top of this file) to see how a client island is already composed into this server page, and match it rather than inventing a new composition style.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this task's files.

- [ ] **Step 10: Commit**

```bash
git add components/garderobe/wardrobe/ app/wardrobe/[id]/page.tsx
git commit -m "Add merge, disposal, price, picker, recut, and wear-correction dialogs to the piece detail page."
```

---

## Task 6: Recently deleted / restore sheet

**Files:**
- Create: `components/garderobe/wardrobe/recently-deleted-sheet.tsx`
- Modify: `components/wardrobe-shop.tsx` (add an entry point to open this sheet, e.g. from the existing filter bar area, and pass `listRecentlyDeletedGarments`/`restoreGarmentAction` in)
- Modify: `app/wardrobe/(closet)/page.tsx` (fetch `listRecentlyDeletedGarments()` alongside the existing `Promise.all` and pass to `WardrobeShop`)
- Test: `components/garderobe/wardrobe/__tests__/recently-deleted-sheet.test.tsx`

**Interfaces:**
- Consumes: `restoreGarmentAction` from Task 3, `GarmentListItem[]`.
- Produces: `<RecentlyDeletedSheet open items={GarmentListItem[]} onClose restoreAction />`.

- [ ] **Step 1: Write the failing test**

```typescript
// components/garderobe/wardrobe/__tests__/recently-deleted-sheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecentlyDeletedSheet } from "@/components/garderobe/wardrobe/recently-deleted-sheet";

const noopAction = async (state: unknown) => state as never;

describe("RecentlyDeletedSheet", () => {
  it("shows each deleted item's title and a restore action", () => {
    render(
      <RecentlyDeletedSheet
        open
        onClose={() => {}}
        restoreAction={noopAction}
        items={[
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            title: "camel coat",
            category: "coat"
          } as never
        ]}
      />
    );

    expect(screen.getByText("camel coat")).toBeInTheDocument();
    expect(screen.getByText(/restore/i)).toBeInTheDocument();
  });

  it("shows an empty state with no deleted items", () => {
    render(<RecentlyDeletedSheet open onClose={() => {}} restoreAction={noopAction} items={[]} />);
    expect(screen.getByText(/nothing recently deleted/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/recently-deleted-sheet.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement**

```tsx
// components/garderobe/wardrobe/recently-deleted-sheet.tsx
"use client";

import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import { PillButton } from "@/components/garderobe/pill-button";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

type RecentlyDeletedSheetProps = {
  open: boolean;
  items: GarmentListItem[];
  onClose: () => void;
  restoreAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

/** 18b / w6c — "recently deleted / restore". */
export function RecentlyDeletedSheet({ open, items, onClose, restoreAction }: RecentlyDeletedSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="recently deleted">
      {items.length === 0 ? (
        <p className="py-4 text-[12.5px] text-[var(--stone)]">nothing recently deleted</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between border-b border-[rgba(30,26,23,.11)] py-2">
              <span className="text-[14.5px] text-[var(--ink)]">{item.title || item.category}</span>
              <form action={restoreAction}>
                <input type="hidden" name="garment_id" value={item.id} />
                <PillButton type="submit" variant="secondary" className="h-8 px-3 text-[11px]">
                  restore
                </PillButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
```

Check `components/garderobe/pill-button.tsx` for `PillButton`'s actual prop names (`variant`, `className`, native `type`) before finalising — match what `Dialog`/`BottomSheet` already assume of it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/recently-deleted-sheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire it into the grid**

In `app/wardrobe/(closet)/page.tsx`, add `listRecentlyDeletedGarments()` to the existing `Promise.all([...])` and pass the result plus `restoreGarmentAction` (imported alongside the other actions already imported from `@/app/wardrobe/actions`) as new props to `<WardrobeShop />`. In `components/wardrobe-shop.tsx`, accept these two new props, add a small amount of local `useState` to open/close the sheet, and add a text entry point (e.g. a `PillButton` near the existing sort/filter controls around line 643) that opens it.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add components/garderobe/wardrobe/recently-deleted-sheet.tsx components/garderobe/wardrobe/__tests__/recently-deleted-sheet.test.tsx components/wardrobe-shop.tsx "app/wardrobe/(closet)/page.tsx"
git commit -m "Add the recently deleted / restore sheet to the wardrobe grid."
```

---

## Task 7: Grid select mode — bulk bar, delete N, new collection, and sort sheet

**Files:**
- Create: `components/garderobe/wardrobe/select-mode-bar.tsx`
- Create: `components/garderobe/wardrobe/new-collection-sheet.tsx`
- Create: `components/garderobe/wardrobe/sort-sheet.tsx`
- Modify: `components/wardrobe-shop.tsx` (add select-mode state, wire the new components in, replace the inline delete-confirm state in `GarmentCard` around line 1039 with the shared `Dialog`-based confirm for the single-delete path so single- and bulk-delete share one visual language; replace the phone sort control to use `SortSheet` while keeping the existing inline `FilterSelect` for desktop, per MODALS.md "sheet (phone). Inline on desktop")
- Test: `components/garderobe/wardrobe/__tests__/select-mode-bar.test.tsx`

**Interfaces:**
- Consumes: `bulkDeleteGarmentsAction`, `createCollectionAction` from Task 3/4; `GarmentListItem[]`.
- Produces: select-mode local state pattern in `WardrobeShop` (`selectedIds: Set<string>`, `isSelectMode: boolean`) that Task 6's recently-deleted entry point and any future bulk actions can reuse.

- [ ] **Step 1: Write the failing test**

```typescript
// components/garderobe/wardrobe/__tests__/select-mode-bar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectModeBar } from "@/components/garderobe/wardrobe/select-mode-bar";

describe("SelectModeBar", () => {
  it("shows the selected count and calls onDelete when confirmed", () => {
    const onRequestDelete = vi.fn();
    render(<SelectModeBar selectedCount={3} onRequestDelete={onRequestDelete} onRequestNewCollection={() => {}} onExit={() => {}} />);

    expect(screen.getByText(/3/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/delete/i));
    expect(onRequestDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/select-mode-bar.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `SelectModeBar`, `NewCollectionSheet`, `SortSheet`**

```tsx
// components/garderobe/wardrobe/select-mode-bar.tsx
"use client";

type SelectModeBarProps = {
  selectedCount: number;
  onRequestDelete: () => void;
  onRequestNewCollection: () => void;
  onExit: () => void;
};

/** 18c / w6a — select mode's bulk-action bar. */
export function SelectModeBar({ selectedCount, onRequestDelete, onRequestNewCollection, onExit }: SelectModeBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-between gap-3 border-t border-[rgba(30,26,23,.14)] bg-[var(--cream)] px-5 py-3">
      <span className="text-[12.5px] text-[var(--slate)]">{selectedCount} selected</span>
      <div className="flex gap-2">
        <button type="button" onClick={onRequestNewCollection} className="text-[12.5px] text-[var(--ink)]">
          new collection
        </button>
        <button type="button" onClick={onRequestDelete} className="text-[12.5px] text-[var(--oxblood)]">
          delete {selectedCount}
        </button>
        <button type="button" onClick={onExit} className="text-[12.5px] text-[var(--stone)]">
          done
        </button>
      </div>
    </div>
  );
}
```

```tsx
// components/garderobe/wardrobe/new-collection-sheet.tsx
"use client";

import { useActionState } from "react";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

type NewCollectionSheetProps = {
  open: boolean;
  garmentIds: string[];
  onClose: () => void;
  createAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/** 18c / w6a — "new collection". */
export function NewCollectionSheet({ open, garmentIds, onClose, createAction }: NewCollectionSheetProps) {
  const [state, formAction] = useActionState(createAction, idleState);

  return (
    <BottomSheet open={open} onClose={onClose} title="new collection">
      <form action={formAction} className="flex flex-col gap-3">
        {garmentIds.map((id) => (
          <input key={id} type="hidden" name="garment_id" value={id} />
        ))}
        <input
          type="text"
          name="name"
          placeholder="name this collection"
          required
          className="w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
        />
        <button type="submit" className="rounded-[100px] bg-[var(--oxblood)] px-4 py-[10px] text-[12.5px] text-[var(--cream)]">
          create
        </button>
        {state.status === "error" ? <p className="text-[11px] text-[var(--oxblood)]">{state.message}</p> : null}
      </form>
    </BottomSheet>
  );
}
```

```tsx
// components/garderobe/wardrobe/sort-sheet.tsx
"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "newest", label: "newest first" },
  { value: "least_worn", label: "least worn" },
  { value: "most_worn", label: "most worn" },
  { value: "price_high", label: "price, high to low" },
  { value: "price_low", label: "price, low to high" }
];

type SortSheetProps = {
  open: boolean;
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

/** 18c — sort as a sheet on phone; desktop keeps the existing inline FilterSelect. */
export function SortSheet({ open, value, onSelect, onClose }: SortSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="sort">
      {SORT_OPTIONS.map((option, index) => (
        <SheetAction
          key={option.value}
          last={index === SORT_OPTIONS.length - 1}
          onClick={() => {
            onSelect(option.value);
            onClose();
          }}
        >
          {option.label}
          {option.value === value ? " ✓" : ""}
        </SheetAction>
      ))}
    </BottomSheet>
  );
}
```

Cross-check `SORT_OPTIONS`' values against whatever `sortBy` values `components/wardrobe-shop.tsx`'s existing `switch (sortBy)` block (around line 258) already switches on — use the same value strings so this sheet drives the existing sort logic rather than introducing a second, divergent set of sort keys.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/select-mode-bar.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire select mode, bulk delete, new collection, and the sort sheet into `WardrobeShop`**

Add to `components/wardrobe-shop.tsx`: `isSelectMode`/`setIsSelectMode`, `selectedIds`/`setSelectedIds` (a `Set<string>`) state near the existing `useState` block (around line 123); a way to toggle a card into selected (checkbox overlay on `GarmentCard` when `isSelectMode` is true, gated behind the existing card click handler); `isDeleteConfirmOpen` and `isNewCollectionOpen` state to drive `Dialog`/`NewCollectionSheet`; and a mobile-only sort trigger that opens `SortSheet` instead of (or alongside) the existing desktop `FilterSelect` for sort, using the same `sortBy`/`setSortBy` state that already exists. Pass `bulkDeleteGarmentsAction` and `createCollectionAction` in as new props from `app/wardrobe/(closet)/page.tsx`, alongside the other actions already passed at lines 134–144.

Also, in `GarmentCard` (around line 1039), replace the existing `isDeleteConfirming` boolean and its ad hoc confirm UI with the shared `Dialog` primitive (`title="delete this piece?"`, `confirmVariant="primary"`), so the single-item delete path and Task 3's `deleteGarmentAction` blocked-status path both render through `Dialog`/`UsedElsewhereDialog` consistently, instead of the file's own bespoke confirm markup.

- [ ] **Step 6: Typecheck and run the full wardrobe test suite**

Run: `npx tsc --noEmit && npx vitest run app/wardrobe components/garderobe`
Expected: no new type errors; all wardrobe and garderobe component tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/garderobe/wardrobe/ components/wardrobe-shop.tsx "app/wardrobe/(closet)/page.tsx"
git commit -m "Add select mode, bulk delete, new collection, and a phone sort sheet to the wardrobe grid."
```

---

## Task 8: Manual verification pass

**Files:** none — this task runs the app, it does not change it.

- [ ] **Step 1: Start the dev server and sign in**

Run: `npm run dev`, sign in with a real Supabase session.

- [ ] **Step 2: Walk the piece-detail dialogs**

On `/wardrobe/[id]` for a real piece: open the price panel and confirm a null price shows "add later", not `A$0.00`; open a category/colour/fabric picker sheet and confirm the selection round-trips through `updateGarmentAction`; log a wear, then open its wear-correction sheet and both edit and remove it; use "what happened to it" to archive a piece and confirm the archived-with-undo banner still works (this reuses the existing `archiveGarmentAction`/`undoArchiveGarmentAction` flow, unchanged by this plan); attempt to delete a piece that is in a saved outfit and confirm the used-elsewhere dialog appears and offers archive instead of deleting.

- [ ] **Step 3: Walk the grid dialogs**

On `/wardrobe`: enter select mode, select several pieces, create a new collection from the selection, then bulk-delete a different selection and confirm a "recently deleted" entry appears for each and can be restored; on a narrow/mobile viewport, confirm sort opens as a sheet, and on a desktop viewport confirm it stays inline per MODALS.md.

- [ ] **Step 4: Report results**

Note any screen where the mockup and the wired behaviour diverge, so it can be triaged as a follow-up rather than silently left inconsistent with `Garderobe Phone.dc.html#18a`–`#18d` / `Garderobe Web.dc.html#w6a`–`#w6c`.

---

## Self-Review

**Spec coverage** — every MODALS.md §1–2 "drawn" item maps to a task: unsaved-changes dialog is deliberately left as a Task 5 follow-up note below (see Known Gap); recut → Task 5; merge → Task 3 (service/action) + Task 5 (dialog); price → Task 5; category/colour/fabric picker → Task 5; disposal ("what happened to it") → Task 5; wear correction → Task 4 (service/action) + Task 5 (sheet); recently deleted/restore → Task 2 (service) + Task 3 (actions) + Task 6 (sheet); select mode bar, delete N, new collection → Task 3/4 (actions) + Task 7 (components); used-elsewhere refuse-and-archive → Task 2 (service) + Task 3 (action) + Task 5 (dialog); archived toast with undo → already exists, confirmed reused in Task 8 rather than rebuilt; sort → Task 7.

**Known gap surfaced by self-review:** "unsaved changes on edit piece" is pure client-side dirty-state tracking inside `GarmentDetailDialog` in `components/wardrobe-shop.tsx` (around line 1293), which this plan does not open in Task 5–7. Add it as a small follow-up task before considering this phase fully done: track a `isDirty` flag across the edit form's fields in `GarmentDetailDialog`, and show a `Dialog` ("discard changes?") when the sheet is closed while dirty, calling the existing close handler only on confirm.

**Placeholder scan:** no TBD/TODO markers; every step above has runnable code, not a description of code.

**Type consistency:** `WardrobeActionState` is extended once in Task 3 and reused with the same shape by every later task; `GarmentListItem` is reused from `lib/domain/wardrobe/service.ts` rather than redefined; sort values in Task 7's `SortSheet` are called out to be checked against the existing `switch (sortBy)` rather than invented fresh.
