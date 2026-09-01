# Label-Event Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every wardrobe draft review action (confirm / correct / reject) as a labeled training example in a user-scoped table, so a future fine-tune has data — without changing the review UX or blocking the user.

**Architecture:** A new append-only Supabase table `garment_label_events` (RLS by `user_id`). A new domain module `lib/domain/training/label-events.ts` with a pure `computeLabelEvent(model, final)` (TDD'd) and a best-effort `recordLabelEvent(supabase, row)` writer. `acceptDraftAction` and `rejectDraftAction` call the writer; accept reads the model's original labels from `draft_payload_json` BEFORE it overwrites them.

**Tech Stack:** Next.js App Router server actions, Supabase (Postgres + RLS), TypeScript, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-09-label-event-capture-design.md`

**Test command:** `npx vitest run <path>` · **Typecheck:** `npx tsc --noEmit`

---

## File Structure

- **Create** `supabase/migrations/020_garment_label_events.sql` — the table + RLS.
- **Create** `lib/domain/training/label-events.ts` — `computeLabelEvent` (pure) + `recordLabelEvent` (writer) + the `LabelEventRow` type.
- **Create** `lib/domain/training/__tests__/label-events.test.ts` — unit tests for `computeLabelEvent`.
- **Modify** `app/wardrobe/review/actions.ts` — call `recordLabelEvent` from `acceptDraftAction` (before payload overwrite) and `rejectDraftAction` (widen its draft select).

---

## Task 1: `computeLabelEvent` pure function

**Files:**
- Create: `lib/domain/training/label-events.ts`
- Test: `lib/domain/training/__tests__/label-events.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/domain/training/__tests__/label-events.test.ts
import { describe, it, expect } from "vitest";
import { computeLabelEvent } from "@/lib/domain/training/label-events";

describe("computeLabelEvent", () => {
  const model = { category: "dress", colour: "black", material: "", style: "", brand: "", title: "Black dress" };

  it("returns confirmed with no corrected fields when values match", () => {
    const result = computeLabelEvent(model, { ...model });
    expect(result.eventType).toBe("confirmed");
    expect(result.correctedFields).toEqual([]);
  });

  it("flags a single changed field as corrected", () => {
    const result = computeLabelEvent(model, { ...model, category: "shirt" });
    expect(result.eventType).toBe("corrected");
    expect(result.correctedFields).toEqual(["category"]);
  });

  it("collects all changed fields", () => {
    const result = computeLabelEvent(model, { ...model, category: "shirt", colour: "white" });
    expect(result.eventType).toBe("corrected");
    expect(result.correctedFields.sort()).toEqual(["category", "colour"]);
  });

  it("ignores case and surrounding whitespace", () => {
    const result = computeLabelEvent(model, { ...model, category: "  Dress " });
    expect(result.eventType).toBe("confirmed");
    expect(result.correctedFields).toEqual([]);
  });

  it("treats empty model value vs set final value as a correction", () => {
    const result = computeLabelEvent(model, { ...model, material: "cotton" });
    expect(result.correctedFields).toEqual(["material"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/training/__tests__/label-events.test.ts`
Expected: FAIL — cannot resolve `@/lib/domain/training/label-events`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/domain/training/label-events.ts
export type LabelFields = {
  category: string;
  colour: string;
  material: string;
  style: string;
  brand: string;
  title: string;
};

const COMPARABLE_FIELDS: (keyof LabelFields)[] = [
  "category", "colour", "material", "style", "brand", "title",
];

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export type LabelEventComputation = {
  eventType: "confirmed" | "corrected";
  correctedFields: string[];
};

export function computeLabelEvent(
  model: Partial<LabelFields>,
  final: Partial<LabelFields>
): LabelEventComputation {
  const correctedFields = COMPARABLE_FIELDS.filter(
    (f) => norm(model[f]) !== norm(final[f])
  );
  return {
    eventType: correctedFields.length > 0 ? "corrected" : "confirmed",
    correctedFields,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/training/__tests__/label-events.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/training/label-events.ts lib/domain/training/__tests__/label-events.test.ts
git commit -m "feat(training): add computeLabelEvent for review-correction diffing"
```

---

## Task 2: `recordLabelEvent` best-effort writer + row type

**Files:**
- Modify: `lib/domain/training/label-events.ts`

- [ ] **Step 1: Add the row type and writer**

Append to `lib/domain/training/label-events.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type LabelEventRow = {
  user_id: string;
  draft_id: string;
  garment_id: string | null;
  source_id: string | null;
  event_type: "confirmed" | "corrected" | "rejected";
  corrected_fields: string[];
  source_storage_path: string | null;
  crop_path: string | null;
  bbox: number[] | null;
  crop_width: number | null;
  crop_height: number | null;
  model_category: string | null;
  model_colour: string | null;
  model_material: string | null;
  model_style: string | null;
  model_brand: string | null;
  model_confidence: number | null;
  model_field_confidence: Record<string, unknown> | null;
  final_category: string | null;
  final_colour: string | null;
  final_material: string | null;
  final_style: string | null;
  final_brand: string | null;
  final_title: string | null;
};

// Best-effort training-data capture. MUST NOT throw — a logging failure must
// never break the user's accept/reject. Errors are logged and swallowed.
export async function recordLabelEvent(
  supabase: SupabaseClient,
  row: LabelEventRow
): Promise<void> {
  try {
    const { error } = await supabase.from("garment_label_events").insert(row as never);
    if (error) {
      console.error("recordLabelEvent insert failed:", error.message);
    }
  } catch (err) {
    console.error("recordLabelEvent threw:", err);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`@supabase/supabase-js` is already a dependency — confirm the import resolves; if the project re-exports a typed client, prefer that import path.)

- [ ] **Step 3: Run existing tests still pass**

Run: `npx vitest run lib/domain/training`
Expected: PASS (5 passed) — the writer has no new unit test (it is thin I/O; the pure logic is covered).

- [ ] **Step 4: Commit**

```bash
git add lib/domain/training/label-events.ts
git commit -m "feat(training): add best-effort recordLabelEvent writer + LabelEventRow"
```

---

## Task 3: Migration — `garment_label_events` table + RLS

**Files:**
- Create: `supabase/migrations/020_garment_label_events.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Captures every wardrobe draft review action (confirm / correct / reject) as a
-- labeled training example for future detector fine-tuning. Append-only, RLS by user.
create table if not exists public.garment_label_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  draft_id uuid,
  garment_id uuid,
  source_id uuid,
  event_type text not null check (event_type in ('confirmed', 'corrected', 'rejected')),
  corrected_fields text[] not null default '{}',
  source_storage_path text,
  crop_path text,
  bbox jsonb,
  crop_width integer,
  crop_height integer,
  model_category text,
  model_colour text,
  model_material text,
  model_style text,
  model_brand text,
  model_confidence numeric,
  model_field_confidence jsonb,
  final_category text,
  final_colour text,
  final_material text,
  final_style text,
  final_brand text,
  final_title text,
  created_at timestamptz not null default now()
);

create index if not exists garment_label_events_user_created_idx
  on public.garment_label_events (user_id, created_at);

alter table public.garment_label_events enable row level security;

create policy garment_label_events_select_own on public.garment_label_events
  for select using (auth.uid() = user_id);

create policy garment_label_events_insert_own on public.garment_label_events
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 2: Validate SQL locally (syntax)**

Run: `grep -c "create policy" supabase/migrations/020_garment_label_events.sql`
Expected: `2`. (If a local Supabase/psql is available, apply it; otherwise the SQL mirrors the `garment_drafts` pattern in `001_initial.sql` and is applied via the normal migration flow.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/020_garment_label_events.sql
git commit -m "feat(schema): add garment_label_events table for training-data capture"
```

---

## Task 4: Capture on accept (before payload overwrite)

**Files:**
- Modify: `app/wardrobe/review/actions.ts` (`acceptDraftAction`)

- [ ] **Step 1: Add the import**

At the top of `app/wardrobe/review/actions.ts`, after the existing imports, add:

```typescript
import { computeLabelEvent, recordLabelEvent } from "@/lib/domain/training/label-events";
```

- [ ] **Step 2: Capture the event before the draft payload is overwritten**

In `acceptDraftAction`, immediately AFTER the `garment` is created and `sourceId`
is resolved, and BEFORE the `garment_drafts` `update(...)` that overwrites
`draft_payload_json` (the block starting `const { error: updateError } = await supabase.from("garment_drafts").update({ status: "confirmed", ...`), insert:

```typescript
    // Capture the model-vs-human label delta as training data (best-effort).
    const finalLabels = {
      category: values.category,
      colour: colour ?? "",
      material: values.material?.trim() ?? "",
      style: values.style?.trim() ?? "",
      brand: brand ?? "",
      title: values.title,
    };
    const modelLabels = {
      category: String(p.category ?? ""),
      colour: String(p.colour ?? ""),
      material: String(p.material ?? ""),
      style: String(p.style ?? ""),
      brand: String(p.brand ?? ""),
      title: String(p.title ?? p.tag ?? ""),
    };
    const { eventType, correctedFields } = computeLabelEvent(modelLabels, finalLabels);
    await recordLabelEvent(supabase, {
      user_id: user.id,
      draft_id: draftId,
      garment_id: garment.id as string,
      source_id: sourceId ?? null,
      event_type: eventType,
      corrected_fields: correctedFields,
      source_storage_path: source?.storage_path ?? null,
      crop_path: typeof p.crop_path === "string" ? p.crop_path : null,
      bbox: Array.isArray(p.bbox) ? (p.bbox as number[]) : null,
      crop_width: typeof p.crop_width === "number" ? p.crop_width : null,
      crop_height: typeof p.crop_height === "number" ? p.crop_height : null,
      model_category: modelLabels.category || null,
      model_colour: modelLabels.colour || null,
      model_material: modelLabels.material || null,
      model_style: modelLabels.style || null,
      model_brand: modelLabels.brand || null,
      model_confidence: typeof p.confidence === "number" ? p.confidence : null,
      model_field_confidence:
        p.field_confidence && typeof p.field_confidence === "object"
          ? (p.field_confidence as Record<string, unknown>)
          : null,
      final_category: finalLabels.category || null,
      final_colour: finalLabels.colour || null,
      final_material: finalLabels.material || null,
      final_style: finalLabels.style || null,
      final_brand: finalLabels.brand || null,
      final_title: finalLabels.title || null,
    });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`p`, `values`, `colour`, `brand`, `source`, `sourceId`, `garment`, `user` are all already in scope at this point in `acceptDraftAction`.)

- [ ] **Step 4: Run review tests still pass**

Run: `npx vitest run app/wardrobe/review`
Expected: PASS (capture is additive + best-effort; existing accept behavior unchanged).

- [ ] **Step 5: Commit**

```bash
git add app/wardrobe/review/actions.ts
git commit -m "feat(review): capture confirm/correct label events on draft accept"
```

---

## Task 5: Capture on reject (widen the draft select)

**Files:**
- Modify: `app/wardrobe/review/actions.ts` (`rejectDraftAction`)

- [ ] **Step 1: Widen the reject select to include payload + image source**

In `rejectDraftAction`, replace the existing draft fetch:

```typescript
    const { data: draft, error: fetchError } = await supabase
      .from("garment_drafts")
      .select("status")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();
```

with:

```typescript
    const { data: draft, error: fetchError } = await supabase
      .from("garment_drafts")
      .select("status, source_id, draft_payload_json, garment_sources(storage_path)")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();
```

- [ ] **Step 2: Record the rejection after the status update succeeds**

In `rejectDraftAction`, immediately AFTER the `if (updateError) { return ... }`
block (i.e. once the status is set to `"rejected"`), and BEFORE the
`revalidatePath` calls, insert:

```typescript
    // Capture the rejection as a hard-negative training example (best-effort).
    const rp = (draft as { draft_payload_json?: Record<string, unknown> }).draft_payload_json ?? {};
    const rejectSource = (draft as {
      garment_sources?: { storage_path: string | null } | null;
    }).garment_sources;
    await recordLabelEvent(supabase, {
      user_id: user.id,
      draft_id: draftId,
      garment_id: null,
      source_id: (draft as { source_id?: string | null }).source_id ?? null,
      event_type: "rejected",
      corrected_fields: [],
      source_storage_path: rejectSource?.storage_path ?? null,
      crop_path: typeof rp.crop_path === "string" ? rp.crop_path : null,
      bbox: Array.isArray(rp.bbox) ? (rp.bbox as number[]) : null,
      crop_width: typeof rp.crop_width === "number" ? rp.crop_width : null,
      crop_height: typeof rp.crop_height === "number" ? rp.crop_height : null,
      model_category: rp.category ? String(rp.category) : null,
      model_colour: rp.colour ? String(rp.colour) : null,
      model_material: rp.material ? String(rp.material) : null,
      model_style: rp.style ? String(rp.style) : null,
      model_brand: rp.brand ? String(rp.brand) : null,
      model_confidence: typeof rp.confidence === "number" ? rp.confidence : null,
      model_field_confidence:
        rp.field_confidence && typeof rp.field_confidence === "object"
          ? (rp.field_confidence as Record<string, unknown>)
          : null,
      final_category: null,
      final_colour: null,
      final_material: null,
      final_style: null,
      final_brand: null,
      final_title: null,
    });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run review tests + full suite**

Run: `npx vitest run app/wardrobe/review && npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/wardrobe/review/actions.ts
git commit -m "feat(review): capture rejection hard-negatives on draft reject"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** data model → Task 3; `computeLabelEvent` → Task 1; `recordLabelEvent` best-effort → Task 2; accept capture before overwrite → Task 4; reject capture + widened select → Task 5; testing (TDD pure fn + existing suite) → Tasks 1, 4, 5. All spec sections covered.
- **Placeholder scan:** none — every code step is complete; the Task 2 note about the Supabase client import path is a real verification instruction, not a placeholder.
- **Type consistency:** `LabelFields` keys (`category, colour, material, style, brand, title`) and `LabelEventRow` columns are used identically in Tasks 1, 2, 4, 5; `event_type` values (`confirmed/corrected/rejected`) match the migration's check constraint in Task 3; `recordLabelEvent(supabase, row)` signature is consistent across caller tasks.
