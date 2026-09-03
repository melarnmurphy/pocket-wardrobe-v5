# Retire-for-the-Season and Collection Rename/Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two dialogs `docs/design/design_handoff_garderobe/MODALS.md` §1–2 mark **missing** with no drawn mockup — "retire / store for the season" on the piece-detail page, and rename/delete for a collection on the wardrobe grid — designing their exact copy and interaction from MODALS.md's own standing rules since nothing exists to transcribe.

**Architecture:** One migration adds a single nullable `seasonally_stored_at timestamptz` column to `garments`, mirroring the existing `archived_at`/`let_go_added_at` reversible-flag pattern. No schema change is needed for collection rename/delete — the `collections` table from migration 035 already supports `update`/`delete` under its existing RLS policies. Both features follow the codebase's established shape: a `lib/domain/wardrobe/service.ts` function, a `WardrobeActionState`-returning server action in `app/wardrobe/actions.ts`, and a UI component built on the shared `Dialog` (`components/garderobe/dialog.tsx`) or `BottomSheet`/`SheetAction` (`components/garderobe/bottom-sheet.tsx`) primitives, wired into `app/wardrobe/[id]/page.tsx` (via `components/garderobe/wardrobe/piece-detail-panels.tsx`) or `components/wardrobe-shop.tsx` respectively.

**Tech Stack:** Next.js App Router server actions, Zod validation, Supabase/Postgres with RLS, Vitest, React Testing Library.

**Spec:** `docs/design/design_handoff_garderobe/MODALS.md` §1–2 and its "Standing rules for anything built from this list" section; `lib/domain/wardrobe/index.ts` (existing `AVAILABILITY_VALUES` invariant); `supabase/migrations/024_garment_availability_and_letgo.sql` and `035_wardrobe_soft_delete_and_collections.sql` (precedent this plan follows).

## Design decisions and one flagged ambiguity

**Retire / store for the season.** MODALS.md's own note on this row is *"the piece still counts in the totals"*. This matches an explicit, already-shipped invariant in this codebase: `lib/domain/wardrobe/index.ts` says outright *"Availability (9a) is distinct from wardrobe_status/archival: a piece stays in the wardrobe and in counts while merely unavailable"*, and migration 024's own comment repeats it almost verbatim for the existing `packed` availability value. So "seasonal storage" is designed here as a second, purpose-built reversible flag (distinct from the `packed` availability value, which the task brief asked to leave alone) that **never changes `getDashboardStats`, `listWardrobeGarments`'s row set, or any wear/cost-per-wear total** — it only adds a `seasonally_stored_at` timestamp a piece can carry, surfaced as a banner and a one-tap "bring it back" reversal on the piece-detail page, the same pattern `archived_at` already uses there.

**Flagged ambiguity, resolved conservatively:** a literal reading of "excluding it from active wardrobe totals/counts" (one possible paraphrase of this feature) would contradict both MODALS.md's own note and the codebase's documented invariant, and would require touching `getDashboardStats` and every cost-per-wear computation — a much larger, riskier, harder-to-reverse change. This plan takes the conservative, already-precedented reading: the piece is flagged and reversible, but counts and totals are untouched. If a future design pass wants seasonally-stored pieces hidden from the default grid or excluded from counts, that is a separate, explicit follow-up, not silently bundled here.

**Collection rename/delete.** MODALS.md lists "new collection" as a **sheet** (drawn at 18c) and says only "rename and delete" are missing, not the object kind. Rename is a single text-field edit, so it stays a sheet, matching the drawn `NewCollectionSheet`'s own shape and copy conventions (lowercase title, single input, one pill button). Delete is destructive but cheap to say plainly (standing rule 1: name the consequence, not the action) and asks exactly one yes/no question, so it is a `Dialog`, triggered from inside the same management sheet rather than a second entry point. Deleting a collection only removes the `collections` row (and its `garment_collections` links, which cascade) — it never touches a garment row, so the dialog's description says exactly that.

## Global Constraints

- Every new dialog/sheet is built on `Dialog` (`components/garderobe/dialog.tsx`) or `BottomSheet`/`SheetAction` (`components/garderobe/bottom-sheet.tsx`) — never a new one-off overlay.
- Destructive dialogs name the consequence, not the action (MODALS.md standing rule 1). Nothing destructive resolves in a toast alone (rule 2). A dialog asks one question; two answers means a sheet (rule 3).
- Sheets carry a 38×3px grab handle and 20px top corners; dialogs are 14px radius, centred, 44px buttons; both dim with the existing overlay treatment already in `Dialog`/`BottomSheet` (rule 7) — do not touch those primitives' existing dim colour.
- Australian English, no em dashes, lowercase sheet/dialog titles, terse copy — match `components/garderobe/wardrobe/new-collection-sheet.tsx` and `used-elsewhere-dialog.tsx`.
- Server actions take `(previousState: WardrobeActionState, formData: FormData)` and return `WardrobeActionState`, per every existing action in `app/wardrobe/actions.ts`.
- `revalidatePath` the same paths sibling actions already revalidate for the affected page (`/wardrobe`, `/wardrobe/${garmentId}` for piece-level changes).

---

## Task 1: Migration and service layer — seasonal storage

**Files:**
- Create: `supabase/migrations/036_garment_seasonal_storage.sql`
- Modify: `lib/domain/wardrobe/service.ts`
- Test: `lib/domain/wardrobe/__tests__/seasonal-storage.test.ts`

**Interfaces:**
- Produces: `garments.seasonally_stored_at timestamptz` column; `setGarmentSeasonalStorage(garmentId: string, stored: boolean): Promise<void>` in `lib/domain/wardrobe/service.ts`; `GarmentListItem`/`GarmentListRow` gain a `seasonally_stored_at: string | null | undefined` field, populated by `listWardrobeGarments`, `getGarmentById`, `listRecentlyDeletedGarments`.

- [ ] **Step 1: Write the migration**

```sql
-- Phase 12 (missing wardrobe dialogs): "retire / store for the season" is a
-- second reversible flag alongside archived_at/let_go_added_at (migration
-- 024) and deleted_at (migration 035). Per MODALS.md's own note on this row
-- ("the piece still counts in the totals") and the standing invariant in
-- lib/domain/wardrobe/index.ts ("a piece stays in the wardrobe and in counts
-- while merely unavailable"), this column never changes what
-- getDashboardStats or listWardrobeGarments count — it only records that a
-- piece has been tucked away for the season, reversible with one tap.
alter table public.garments
  add column if not exists seasonally_stored_at timestamptz;

create index if not exists garments_user_seasonal_storage_idx
  on public.garments (user_id) where seasonally_stored_at is not null;
```

- [ ] **Step 2: Write the failing service test**

```typescript
// lib/domain/wardrobe/__tests__/seasonal-storage.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock, eq: eqMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("setGarmentSeasonalStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("sets seasonally_stored_at to a timestamp when storing", async () => {
    const { setGarmentSeasonalStorage } = await import("@/lib/domain/wardrobe/service");
    await setGarmentSeasonalStorage("22222222-2222-2222-2222-222222222222", true);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ seasonally_stored_at: expect.any(String) })
    );
  });

  it("clears seasonally_stored_at back to null when un-storing", async () => {
    const { setGarmentSeasonalStorage } = await import("@/lib/domain/wardrobe/service");
    await setGarmentSeasonalStorage("22222222-2222-2222-2222-222222222222", false);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ seasonally_stored_at: null })
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/domain/wardrobe/__tests__/seasonal-storage.test.ts`
Expected: FAIL with "setGarmentSeasonalStorage is not a function" or similar import error.

- [ ] **Step 4: Add `seasonally_stored_at` to the read path**

In `lib/domain/wardrobe/service.ts`:

1. Add `"seasonally_stored_at"` to the `GarmentListRow` `Pick<...>` union (near `"archived_at"` at line 43).
2. Add `seasonally_stored_at: timestampSchema.nullable().optional(),` to `garmentListItemSchema` (near the existing `archived_at: timestampSchema.nullable().optional(),` line).
3. Add `,seasonally_stored_at` to the `GARMENT_LIST_SELECT` string, right after `archived_at,archive_reason,`.

These three changes make `seasonally_stored_at` flow through `listWardrobeGarments`, `getGarmentById`, and `listRecentlyDeletedGarments`, which all reuse `GARMENT_LIST_SELECT` and `garmentListItemSchema`.

- [ ] **Step 5: Implement `setGarmentSeasonalStorage`**

Add near `addGarmentToLetGo`/`removeGarmentFromLetGo` in `lib/domain/wardrobe/service.ts`:

```typescript
/**
 * Retire / store for the season (missing from MODALS.md §1 — designed here).
 * Reversible with one tap, like archived_at/let_go_added_at. Deliberately
 * does NOT touch getDashboardStats or listWardrobeGarments's row set: per
 * MODALS.md's own note on this row and the AVAILABILITY_VALUES invariant in
 * lib/domain/wardrobe/index.ts, a stored piece stays fully counted.
 */
export async function setGarmentSeasonalStorage(garmentId: string, stored: boolean) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(garmentId);

  const { error } = await supabase
    .from("garments")
    .update(({
      seasonally_stored_at: stored ? new Date().toISOString() : null
    } satisfies Partial<GarmentInsert>) as never)
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/domain/wardrobe/__tests__/seasonal-storage.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/036_garment_seasonal_storage.sql lib/domain/wardrobe/service.ts lib/domain/wardrobe/__tests__/seasonal-storage.test.ts
git commit -m "Add a reversible seasonal-storage flag to garments, separate from archival and counts."
```

---

## Task 2: Server action, dialog, and piece-detail wiring — seasonal storage

**Files:**
- Modify: `app/wardrobe/actions.ts`
- Create: `components/garderobe/wardrobe/seasonal-storage-dialog.tsx`
- Modify: `components/garderobe/wardrobe/piece-detail-panels.tsx`
- Modify: `app/wardrobe/[id]/page.tsx`
- Test: `app/wardrobe/__tests__/actions.test.ts` (append)
- Test: `components/garderobe/wardrobe/__tests__/seasonal-storage.test.tsx`

**Interfaces:**
- Consumes: `setGarmentSeasonalStorage(garmentId, stored)` from Task 1.
- Produces: `setSeasonalStorageAction(previousState: WardrobeActionState, formData: FormData): Promise<WardrobeActionState>` in `app/wardrobe/actions.ts` (reads `garment_id` and `stored` — `"true"` | `"false"` — from `formData`); `SeasonalStorageDialog` component; `SeasonalStorageControl` in `piece-detail-panels.tsx` taking `{ garmentId: string; pieceName: string; stored: boolean; setSeasonalStorageAction: ActionFn }`.

- [ ] **Step 1: Write the failing action test**

Append to `app/wardrobe/__tests__/actions.test.ts`:

```typescript
describe("setSeasonalStorageAction", () => {
  it("stores a piece for the season", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, setGarmentSeasonalStorage: vi.fn(async () => {}) };
    });
    const { setSeasonalStorageAction } = await import("@/app/wardrobe/actions");
    const { setGarmentSeasonalStorage } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("garment_id", "66666666-6666-6666-6666-666666666666");
    formData.set("stored", "true");

    const result = await setSeasonalStorageAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(setGarmentSeasonalStorage).toHaveBeenCalledWith(
      "66666666-6666-6666-6666-666666666666",
      true
    );
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });

  it("brings a piece back from seasonal storage", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, setGarmentSeasonalStorage: vi.fn(async () => {}) };
    });
    const { setSeasonalStorageAction } = await import("@/app/wardrobe/actions");
    const { setGarmentSeasonalStorage } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("garment_id", "66666666-6666-6666-6666-666666666666");
    formData.set("stored", "false");

    const result = await setSeasonalStorageAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(setGarmentSeasonalStorage).toHaveBeenCalledWith(
      "66666666-6666-6666-6666-666666666666",
      false
    );
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts -t setSeasonalStorageAction`
Expected: FAIL — `setSeasonalStorageAction` is not exported.

- [ ] **Step 3: Implement `setSeasonalStorageAction`**

In `app/wardrobe/actions.ts`, add the import `setGarmentSeasonalStorage` to the existing `from "@/lib/domain/wardrobe/service"` import block, add a schema near `setAvailabilityFormSchema`:

```typescript
const setSeasonalStorageFormSchema = z.object({
  garment_id: z.string().uuid(),
  stored: z.enum(["true", "false"])
});
```

and the action itself, near `setAvailabilityAction`:

```typescript
export async function setSeasonalStorageAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = setSeasonalStorageFormSchema.parse({
      garment_id: formData.get("garment_id"),
      stored: formData.get("stored")
    });
    const stored = values.stored === "true";

    await setGarmentSeasonalStorage(values.garment_id, stored);
    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${values.garment_id}`);

    return {
      status: "success",
      garmentId: values.garment_id,
      message: stored
        ? "Stored for the season. It still counts in your wardrobe."
        : "Back in the everyday wardrobe."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update seasonal storage."
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts -t setSeasonalStorageAction`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing component test for the dialog and control**

```tsx
// components/garderobe/wardrobe/__tests__/seasonal-storage.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SeasonalStorageControl } from "@/components/garderobe/wardrobe/piece-detail-panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

describe("SeasonalStorageControl", () => {
  it("asks for confirmation, then submits garment_id and stored=true", async () => {
    const setSeasonalStorageAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);

    render(
      <SeasonalStorageControl
        garmentId="77777777-7777-7777-7777-777777777777"
        pieceName="camel coat"
        stored={false}
        setSeasonalStorageAction={setSeasonalStorageAction}
      />
    );

    fireEvent.click(screen.getByText("store for the season"));
    fireEvent.click(await screen.findByText("store it"));

    await waitFor(() => expect(setSeasonalStorageAction).toHaveBeenCalled());
    const [, formData] = setSeasonalStorageAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("garment_id")).toBe("77777777-7777-7777-7777-777777777777");
    expect(formData.get("stored")).toBe("true");
  });

  it("brings a stored piece back with a single tap, no dialog", async () => {
    const setSeasonalStorageAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);

    render(
      <SeasonalStorageControl
        garmentId="77777777-7777-7777-7777-777777777777"
        pieceName="camel coat"
        stored={true}
        setSeasonalStorageAction={setSeasonalStorageAction}
      />
    );

    fireEvent.click(screen.getByText("bring it back"));

    await waitFor(() => expect(setSeasonalStorageAction).toHaveBeenCalled());
    const [, formData] = setSeasonalStorageAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("garment_id")).toBe("77777777-7777-7777-7777-777777777777");
    expect(formData.get("stored")).toBe("false");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/seasonal-storage.test.tsx`
Expected: FAIL — `SeasonalStorageControl` is not exported from `piece-detail-panels.tsx`.

- [ ] **Step 7: Create `SeasonalStorageDialog`**

```tsx
// components/garderobe/wardrobe/seasonal-storage-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type SeasonalStorageDialogProps = {
  open: boolean;
  pieceName: string;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Retire / store for the season — designed here, no mockup exists
 * (MODALS.md §1 marks it "missing"). One question, so a Dialog per the
 * standing rules. Names what does NOT happen (it is not archived, deleted,
 * or dropped from totals) rather than framing it as a warning, since
 * storing is a fully reversible, non-destructive action.
 */
export function SeasonalStorageDialog({ open, pieceName, onClose, onConfirm }: SeasonalStorageDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`store the ${pieceName} for the season?`}
      description="It stays in your wardrobe and still counts in your totals. This just tucks it out of the everyday grid until you bring it back."
      cancelLabel="cancel"
      confirmLabel="store it"
      onConfirm={onConfirm}
    />
  );
}
```

- [ ] **Step 8: Add `SeasonalStorageControl` to `piece-detail-panels.tsx`**

Add the import `import { SeasonalStorageDialog } from "./seasonal-storage-dialog";` and this export, near `DisposalControl`:

```tsx
type SeasonalStorageControlProps = {
  garmentId: string;
  pieceName: string;
  stored: boolean;
  setSeasonalStorageAction: ActionFn;
};

const idleSeasonalStorageState: WardrobeActionState = { status: "idle", message: null };

/**
 * Retire / store for the season — designed here (see the plan's ambiguity
 * note): storing asks one confirming question via SeasonalStorageDialog;
 * un-storing is a single reversing tap with no dialog, since it only ever
 * restores the default state.
 */
export function SeasonalStorageControl({
  garmentId,
  pieceName,
  stored,
  setSeasonalStorageAction
}: SeasonalStorageControlProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setSeasonalStorageAction, idleSeasonalStorageState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  if (stored) {
    return (
      <form action={formAction}>
        <input type="hidden" name="garment_id" value={garmentId} />
        <input type="hidden" name="stored" value="false" />
        <PillButton type="submit" variant="secondary">
          bring it back
        </PillButton>
        {state.status === "error" ? (
          <p className="pt-1 text-[11px] text-[var(--oxblood)]">{state.message}</p>
        ) : null}
      </form>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12.5px] text-[var(--oxblood)] underline"
      >
        store for the season
      </button>
      <SeasonalStorageDialog
        open={open}
        pieceName={pieceName}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          const formData = new FormData();
          formData.set("garment_id", garmentId);
          formData.set("stored", "true");
          formAction(formData);
        }}
      />
      {state.status === "error" ? (
        <p className="pt-1 text-[11px] text-[var(--oxblood)]">{state.message}</p>
      ) : null}
    </>
  );
}
```

- [ ] **Step 9: Run the component test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/seasonal-storage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 10: Wire `SeasonalStorageControl` into the piece-detail page**

In `app/wardrobe/[id]/page.tsx`:

1. Add `setSeasonalStorageAction` to the imports from `@/app/wardrobe/actions`.
2. Add `import { SeasonalStorageControl } from "@/components/garderobe/wardrobe/piece-detail-panels";` — it is already imported as part of the existing `piece-detail-panels` import block, so just add `SeasonalStorageControl` to that existing named-import list rather than a new import statement.
3. Compute `const isSeasonallyStored = Boolean(garment.seasonally_stored_at);` next to the existing `const isArchived = ...` line.
4. Immediately after the `isArchived` banner block (the `<div className="mt-4 rounded-[4px] border border-dashed ...">let go ...</div>` block), add a parallel banner for seasonal storage:

```tsx
{isSeasonallyStored ? (
  <div className="mt-4 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] bg-[var(--paper)] px-4 py-3 text-[12.5px] text-[var(--stone)]">
    stored for the season. Still counts in your wardrobe.
  </div>
) : null}
```

5. In the `!isArchived` availability `<section>` block (the one rendering `AVAILABILITY_VALUES` chips), add `SeasonalStorageControl` right after the chip row, so it sits alongside the piece's other reversible states:

```tsx
<div className="pt-3">
  <SeasonalStorageControl
    garmentId={garment.id as string}
    pieceName={pieceName}
    stored={isSeasonallyStored}
    setSeasonalStorageAction={setSeasonalStorageAction}
  />
</div>
```

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 12: Commit**

```bash
git add app/wardrobe/actions.ts app/wardrobe/__tests__/actions.test.ts app/wardrobe/[id]/page.tsx components/garderobe/wardrobe/seasonal-storage-dialog.tsx components/garderobe/wardrobe/piece-detail-panels.tsx components/garderobe/wardrobe/__tests__/seasonal-storage.test.tsx
git commit -m "Add the retire / store for the season dialog, reversible and outside the wardrobe totals."
```

---

## Task 3: Service layer — collection rename and delete

**Files:**
- Modify: `lib/domain/wardrobe/service.ts`
- Test: `lib/domain/wardrobe/__tests__/collections.test.ts`

**Interfaces:**
- Produces: `renameCollection(params: { collectionId: string; name: string }): Promise<void>`; `deleteCollection(collectionId: string): Promise<void>` in `lib/domain/wardrobe/service.ts`.

- [ ] **Step 1: Write the failing service test**

```typescript
// lib/domain/wardrobe/__tests__/collections.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const deleteMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock, delete: deleteMock, eq: eqMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("renameCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("updates the collection's name, scoped to the owning user", async () => {
    const { renameCollection } = await import("@/lib/domain/wardrobe/service");
    await renameCollection({
      collectionId: "22222222-2222-2222-2222-222222222222",
      name: "  weekend capsule  "
    });

    expect(fromMock).toHaveBeenCalledWith("collections");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "weekend capsule" })
    );
  });

  it("rejects an empty name", async () => {
    const { renameCollection } = await import("@/lib/domain/wardrobe/service");
    await expect(
      renameCollection({ collectionId: "22222222-2222-2222-2222-222222222222", name: "   " })
    ).rejects.toThrow();
  });
});

describe("deleteCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("deletes the collection row, scoped to the owning user", async () => {
    const { deleteCollection } = await import("@/lib/domain/wardrobe/service");
    await deleteCollection("22222222-2222-2222-2222-222222222222");

    expect(fromMock).toHaveBeenCalledWith("collections");
    expect(deleteMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/domain/wardrobe/__tests__/collections.test.ts`
Expected: FAIL — `renameCollection`/`deleteCollection` are not exported.

- [ ] **Step 3: Implement `renameCollection` and `deleteCollection`**

Add near `listCollections` in `lib/domain/wardrobe/service.ts`:

```typescript
/**
 * Rename a collection (missing from MODALS.md §2 — "new collection" is
 * drawn at 18c, rename/delete are not). A single text edit, so its UI is a
 * sheet like NewCollectionSheet, not a dialog.
 */
export async function renameCollection(params: { collectionId: string; name: string }): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const collectionId = z.string().uuid().parse(params.collectionId);
  const name = z.string().trim().min(1).max(120).parse(params.name);

  const { error } = await supabase
    .from("collections")
    .update(({ name } satisfies Record<string, unknown>) as never)
    .eq("id", collectionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Delete a collection (missing from MODALS.md §2). Only removes the
 * collections row — garment_collections links cascade (migration 035) but
 * garments themselves are never touched, so this never removes a piece from
 * the wardrobe. Destructive but cheap: names that consequence plainly in
 * the confirming dialog rather than treating it as a warning.
 */
export async function deleteCollection(collectionId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(collectionId);

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/domain/wardrobe/__tests__/collections.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/domain/wardrobe/service.ts lib/domain/wardrobe/__tests__/collections.test.ts
git commit -m "Add renameCollection and deleteCollection to the wardrobe service."
```

---

## Task 4: Server actions, sheet, and grid wiring — collection rename/delete

**Files:**
- Modify: `app/wardrobe/actions.ts`
- Create: `components/garderobe/wardrobe/manage-collection-sheet.tsx`
- Modify: `components/wardrobe-shop.tsx`
- Modify: `app/wardrobe/(closet)/page.tsx`
- Test: `app/wardrobe/__tests__/actions.test.ts` (append)
- Test: `components/garderobe/wardrobe/__tests__/manage-collection-sheet.test.tsx`

**Interfaces:**
- Consumes: `renameCollection`, `deleteCollection` from Task 3.
- Produces: `renameCollectionAction`, `deleteCollectionAction` (both `(previousState: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>`) in `app/wardrobe/actions.ts`; `ManageCollectionSheet` component taking `{ open: boolean; collection: { id: string; name: string } | null; onClose: () => void; onDeleted: () => void; renameAction: ActionFn; deleteAction: ActionFn }` (`ActionFn` = the same alias already defined in `piece-detail-panels.tsx`; define it locally here too since this file does not import from there).

- [ ] **Step 1: Write the failing action tests**

Append to `app/wardrobe/__tests__/actions.test.ts`:

```typescript
describe("renameCollectionAction", () => {
  it("renames the collection", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, renameCollection: vi.fn(async () => {}) };
    });
    const { renameCollectionAction } = await import("@/app/wardrobe/actions");
    const { renameCollection } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("collection_id", "99999999-9999-9999-9999-999999999999");
    formData.set("name", "weekend capsule");

    const result = await renameCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(renameCollection).toHaveBeenCalledWith({
      collectionId: "99999999-9999-9999-9999-999999999999",
      name: "weekend capsule"
    });
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });

  it("rejects an empty name", async () => {
    const { renameCollectionAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("collection_id", "99999999-9999-9999-9999-999999999999");
    formData.set("name", "");

    const result = await renameCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
  });
});

describe("deleteCollectionAction", () => {
  it("deletes the collection and reports the pieces are unaffected", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, deleteCollection: vi.fn(async () => {}) };
    });
    const { deleteCollectionAction } = await import("@/app/wardrobe/actions");
    const { deleteCollection } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("collection_id", "99999999-9999-9999-9999-999999999999");

    const result = await deleteCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(deleteCollection).toHaveBeenCalledWith("99999999-9999-9999-9999-999999999999");
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts -t "CollectionAction"`
Expected: FAIL — actions not exported.

- [ ] **Step 3: Implement `renameCollectionAction` and `deleteCollectionAction`**

Add `renameCollection` and `deleteCollection` to the existing `from "@/lib/domain/wardrobe/service"` import block in `app/wardrobe/actions.ts`. Add schemas near `createCollectionFormSchema`:

```typescript
const renameCollectionFormSchema = z.object({
  collection_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120)
});

const deleteCollectionFormSchema = z.object({
  collection_id: z.string().uuid()
});
```

and the actions, near `createCollectionAction`:

```typescript
export async function renameCollectionAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = renameCollectionFormSchema.parse({
      collection_id: formData.get("collection_id"),
      name: formData.get("name")
    });

    await renameCollection({ collectionId: values.collection_id, name: values.name });
    revalidatePath("/wardrobe");

    return { status: "success", message: "Collection renamed." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to rename the collection."
    };
  }
}

export async function deleteCollectionAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteCollectionFormSchema.parse({
      collection_id: formData.get("collection_id")
    });

    await deleteCollection(values.collection_id);
    revalidatePath("/wardrobe");

    return { status: "success", message: "Collection deleted. The pieces stay in your wardrobe." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to delete the collection."
    };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts -t "CollectionAction"`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing component test for `ManageCollectionSheet`**

```tsx
// components/garderobe/wardrobe/__tests__/manage-collection-sheet.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManageCollectionSheet } from "@/components/garderobe/wardrobe/manage-collection-sheet";

describe("ManageCollectionSheet", () => {
  it("submits the edited name on save", async () => {
    const renameAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const deleteAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const onDeleted = vi.fn();

    render(
      <ManageCollectionSheet
        open={true}
        collection={{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "weekend capsule" }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
        renameAction={renameAction}
        deleteAction={deleteAction}
      />
    );

    const input = screen.getByDisplayValue("weekend capsule");
    fireEvent.change(input, { target: { value: "work capsule" } });
    fireEvent.click(screen.getByText("save name"));

    await waitFor(() => expect(renameAction).toHaveBeenCalled());
    const [, formData] = renameAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("collection_id")).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(formData.get("name")).toBe("work capsule");
  });

  it("asks for confirmation before deleting, then submits the collection id", async () => {
    const renameAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const deleteAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const onDeleted = vi.fn();

    render(
      <ManageCollectionSheet
        open={true}
        collection={{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "weekend capsule" }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
        renameAction={renameAction}
        deleteAction={deleteAction}
      />
    );

    fireEvent.click(screen.getByText("delete collection"));
    fireEvent.click(await screen.findByText("delete collection", { selector: "button" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalled());
    const [, formData] = deleteAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("collection_id")).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/manage-collection-sheet.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Create `ManageCollectionSheet`**

```tsx
// components/garderobe/wardrobe/manage-collection-sheet.tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";
import { Dialog } from "@/components/garderobe/dialog";
import { PillButton } from "@/components/garderobe/pill-button";
import { showAppToast } from "@/lib/ui/app-toast";
import {
  wardrobeActionState,
  type WardrobeActionState
} from "@/lib/domain/wardrobe/action-state";

type ActionFn = (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;

type ManageCollectionSheetProps = {
  open: boolean;
  collection: { id: string; name: string } | null;
  onClose: () => void;
  onDeleted: () => void;
  renameAction: ActionFn;
  deleteAction: ActionFn;
};

/**
 * Rename and delete a collection — designed here, no mockup exists
 * (MODALS.md §2 marks it "missing"; only "new collection" is drawn at 18c).
 * Rename is a single text edit, so it stays inside this sheet like
 * NewCollectionSheet's own input. Delete asks one yes/no question, so it
 * opens a nested Dialog rather than resolving from a SheetAction tap alone.
 */
export function ManageCollectionSheet({
  open,
  collection,
  onClose,
  onDeleted,
  renameAction,
  deleteAction
}: ManageCollectionSheetProps) {
  const [name, setName] = useState(collection?.name ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [renameState, renameFormAction] = useActionState(renameAction, wardrobeActionState);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, wardrobeActionState);

  useEffect(() => {
    setName(collection?.name ?? "");
  }, [collection]);

  useEffect(() => {
    if (open && renameState.status === "success") {
      showAppToast({ message: renameState.message || "Collection renamed.", tone: "success" });
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameState.status]);

  useEffect(() => {
    if (open && deleteState.status === "success") {
      showAppToast({ message: deleteState.message || "Collection deleted.", tone: "success" });
      setConfirmingDelete(false);
      onDeleted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteState.status]);

  if (!collection) return null;

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="manage collection">
        <form action={renameFormAction} className="flex flex-col gap-3">
          <input type="hidden" name="collection_id" value={collection.id} />
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
          />
          <PillButton type="submit" className="h-11">
            save name
          </PillButton>
          {renameState.status === "error" ? (
            <p className="text-[11px] text-[var(--oxblood)]">{renameState.message}</p>
          ) : null}
        </form>
        <div className="pt-3">
          <SheetAction destructive last onClick={() => setConfirmingDelete(true)}>
            delete collection
          </SheetAction>
        </div>
        {deleteState.status === "error" ? (
          <p className="pt-2 text-[11px] text-[var(--oxblood)]">{deleteState.message}</p>
        ) : null}
      </BottomSheet>

      <Dialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={`delete "${collection.name}"?`}
        description="The pieces in it stay in your wardrobe. They just won't be grouped under this collection anymore."
        cancelLabel="cancel"
        confirmLabel="delete collection"
        onConfirm={() => {
          const formData = new FormData();
          formData.set("collection_id", collection.id);
          deleteFormAction(formData);
        }}
      />
    </>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/manage-collection-sheet.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Wire `ManageCollectionSheet` into `WardrobeShop`**

In `components/wardrobe-shop.tsx`:

1. Add the import: `import { ManageCollectionSheet } from "@/components/garderobe/wardrobe/manage-collection-sheet";` and `import { Pencil } from "lucide-react";` (add `Pencil` to any existing `lucide-react` import if one already exists in this file — check before adding a second import statement).
2. Add two new props to the `WardrobeShop` function signature and its type block, alongside `createCollectionAction`: `renameCollectionAction` and `deleteCollectionAction`, both typed the same as `createCollectionAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>`.
3. Add state near `isNewCollectionOpen`: `const [managingCollection, setManagingCollection] = useState<{ id: string; name: string } | null>(null);`.
4. In the collections filter chip row (the `{collections.length > 0 ? (...) : null}` block, around where `collections.map((collection) => {...})` renders each `pw-swatch` button), wrap each collection's chip and add a management trigger that only appears when that chip is the active filter:

```tsx
{collections.map((collection) => {
  const active = collectionFilter === collection.id;
  return (
    <span key={collection.id} className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-pressed={active}
        onClick={() =>
          setCollectionFilter((current) =>
            current === collection.id ? "all" : collection.id
          )
        }
        className="pw-swatch"
        data-active={active ? "true" : "false"}
      >
        {collection.name}
      </button>
      {active ? (
        <button
          type="button"
          aria-label={`manage ${collection.name}`}
          onClick={() => setManagingCollection({ id: collection.id, name: collection.name })}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--stone)]"
        >
          <Pencil size={12} strokeWidth={1.5} />
        </button>
      ) : null}
    </span>
  );
})}
```

This replaces the existing `collections.map((collection) => { ... return <button key={collection.id} ...>{collection.name}</button>; })` block — the chip's own `onClick`/filter behaviour is unchanged, only wrapped and given a sibling edit affordance.

5. Render the sheet near the other sheets at the bottom of the component (alongside `<NewCollectionSheet ... />`):

```tsx
<ManageCollectionSheet
  open={Boolean(managingCollection)}
  collection={managingCollection}
  onClose={() => setManagingCollection(null)}
  onDeleted={() => {
    setCollectionFilter((current) =>
      managingCollection && current === managingCollection.id ? "all" : current
    );
    setManagingCollection(null);
    router.refresh();
  }}
  renameAction={renameCollectionAction}
  deleteAction={deleteCollectionAction}
/>
```

6. On successful rename, the sheet already closes itself (Step 7's `onClose()` on `renameState.status === "success"`), but the parent's `collections` prop is server data — add `router.refresh()` there too, in the same effect-driven place: since `ManageCollectionSheet` doesn't have access to `router`, instead pass an `onRenamed={() => router.refresh()}` prop through to `ManageCollectionSheet` (add this prop, call it in the same effect block as the existing rename-success toast in Step 7, right after `onClose()`), and thread it from `WardrobeShop`:

```tsx
<ManageCollectionSheet
  ...
  onRenamed={() => router.refresh()}
/>
```

Update `ManageCollectionSheetProps` and the rename-success effect in `manage-collection-sheet.tsx` (from Step 7) to accept and call this new `onRenamed: () => void` prop after `onClose()`.

- [ ] **Step 10: Wire the new props through `app/wardrobe/(closet)/page.tsx`**

Add `renameCollectionAction` and `deleteCollectionAction` to the import from `@/app/wardrobe/actions` and pass them through to `<WardrobeShop ... renameCollectionAction={renameCollectionAction} deleteCollectionAction={deleteCollectionAction} />`, alongside the existing `createCollectionAction={createCollectionAction}` prop.

- [ ] **Step 11: Typecheck and run the full wardrobe test suite**

Run: `npx tsc --noEmit && npx vitest run app/wardrobe lib/domain/wardrobe components/garderobe`
Expected: no new type errors; all wardrobe and garderobe tests pass.

- [ ] **Step 12: Commit**

```bash
git add app/wardrobe/actions.ts app/wardrobe/__tests__/actions.test.ts "app/wardrobe/(closet)/page.tsx" components/wardrobe-shop.tsx components/garderobe/wardrobe/manage-collection-sheet.tsx components/garderobe/wardrobe/__tests__/manage-collection-sheet.test.tsx
git commit -m "Add rename and delete for a collection, surfaced from its active filter chip."
```

---

## Task 5: Full-suite verification

**Files:** none — this task runs checks, it does not change code.

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors anywhere in the repo (not just the files this plan touched).

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: every test passes, including the new `seasonal-storage.test.ts`, `collections.test.ts`, `manage-collection-sheet.test.tsx`, and the appended `actions.test.ts` cases.

- [ ] **Step 3: Report the final test count**

Note the total pass count from Step 2's output for the final report.

---

## Self-Review

**Spec coverage:** MODALS.md §1's "retire / store for the season" → Task 1 (migration + service) + Task 2 (action, dialog, wiring). MODALS.md §2's "rename and delete a collection" → Task 3 (service) + Task 4 (actions, sheet, wiring). Both features' designed copy and interaction are recorded inline in each task's docstrings, and the one genuine ambiguity (whether seasonal storage should change wardrobe totals) is called out and resolved conservatively in "Design decisions and one flagged ambiguity" above, matching MODALS.md's own note and the codebase's existing `AVAILABILITY_VALUES` invariant rather than guessing past it silently.

**Placeholder scan:** no TBD/TODO markers; every step has runnable code, not a description of code.

**Type consistency:** `ActionFn` in Task 4's `manage-collection-sheet.tsx` is defined locally (matching the alias already used in `piece-detail-panels.tsx`, not imported from it, since that file does not export the type). `WardrobeActionState`/`wardrobeActionState` are reused from `lib/domain/wardrobe/action-state.ts` exactly as every existing sheet does. `SeasonalStorageControl`'s `setSeasonalStorageAction` prop and `ManageCollectionSheet`'s `renameAction`/`deleteAction` props all share the same `(state, formData) => Promise<WardrobeActionState>` shape used throughout `app/wardrobe/actions.ts`, so they compose with `useActionState` the same way every other control in this codebase already does.
