# Outfit Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/calendar` placeholder with a working month grid + day drawer where the user assigns one saved outfit per day (reads/writes `outfits.planned_for`).

**Architecture:** Pure date helpers (`lib/domain/outfits/calendar.ts`, TDD'd) drive a client `OutfitCalendar` component. The outfits domain gains `planned_for` on its schema/query plus a `setOutfitPlannedDate` service (one-per-day). Server actions wrap it; the `/calendar` server page fetches saved outfits and renders the calendar. The planner is untouched (assign-from-saved model).

**Tech Stack:** Next.js App Router (server components + server actions), TypeScript, Zod, Supabase, Vitest, lucide-react, Tailwind + CSS custom-property design tokens.

**Reference spec:** `docs/superpowers/specs/2026-06-09-outfit-calendar-design.md`

**Test command:** `npx vitest run <path>` · **Typecheck:** `npx tsc --noEmit`

---

## File Structure

- **Create** `lib/domain/outfits/calendar.ts` — pure helpers: `toDateKey`, `buildMonthGrid`, `bucketOutfitsByDate`.
- **Create** `lib/domain/outfits/__tests__/calendar.test.ts` — unit tests for the helpers.
- **Modify** `lib/domain/outfits/index.ts` — add `planned_for` to `outfitWithItemsSchema`.
- **Modify** `lib/domain/outfits/service.ts` — add `planned_for` to `listSavedOutfits` select; add `setOutfitPlannedDate`.
- **Create** `app/calendar/actions.ts` — `planOutfitForDateAction`, `unplanOutfitAction`.
- **Create** `components/outfit-calendar.tsx` — month grid + day drawer (client).
- **Modify** `app/calendar/page.tsx` — server page that fetches + renders the calendar.

---

## Task 1: Pure date helpers

**Files:**
- Create: `lib/domain/outfits/calendar.ts`
- Test: `lib/domain/outfits/__tests__/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/domain/outfits/__tests__/calendar.test.ts
import { describe, it, expect } from "vitest";
import { toDateKey, buildMonthGrid, bucketOutfitsByDate } from "@/lib/domain/outfits/calendar";

describe("toDateKey", () => {
  it("zero-pads month and day", () => {
    expect(toDateKey(2026, 6, 7)).toBe("2026-06-07");
    expect(toDateKey(2026, 12, 25)).toBe("2026-12-25");
  });
});

describe("buildMonthGrid", () => {
  it("lays June 2026 out Monday-first with leading blanks", () => {
    const grid = buildMonthGrid(2026, 6); // June 1 2026 is a Monday
    expect(grid.weeks[0][0]).toEqual({ date: "2026-06-01", day: 1 });
    // 30 days in June -> last day present, trailing cells null
    const flat = grid.weeks.flat();
    expect(flat.filter((c) => c !== null)).toHaveLength(30);
    expect(flat.find((c) => c?.day === 30)?.date).toBe("2026-06-30");
  });

  it("puts leading blanks when the month starts mid-week", () => {
    const grid = buildMonthGrid(2026, 7); // July 1 2026 is a Wednesday
    expect(grid.weeks[0][0]).toBeNull(); // Mon
    expect(grid.weeks[0][1]).toBeNull(); // Tue
    expect(grid.weeks[0][2]).toEqual({ date: "2026-07-01", day: 1 }); // Wed
  });
});

describe("bucketOutfitsByDate", () => {
  const mk = (id: string, planned_for: string | null, created_at: string) =>
    ({ id, planned_for, created_at, items: [] } as never);

  it("maps outfits by planned_for and ignores unplanned", () => {
    const map = bucketOutfitsByDate([
      mk("a", "2026-06-07", "2026-06-01T00:00:00Z"),
      mk("b", null, "2026-06-02T00:00:00Z"),
    ]);
    expect(map.get("2026-06-07")?.id).toBe("a");
    expect(map.size).toBe(1);
  });

  it("on a date collision keeps the newest created_at", () => {
    const map = bucketOutfitsByDate([
      mk("old", "2026-06-07", "2026-06-01T00:00:00Z"),
      mk("new", "2026-06-07", "2026-06-05T00:00:00Z"),
    ]);
    expect(map.get("2026-06-07")?.id).toBe("new");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/outfits/__tests__/calendar.test.ts`
Expected: FAIL — cannot resolve `@/lib/domain/outfits/calendar`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/domain/outfits/calendar.ts
import type { OutfitWithItems } from "./index";

export type DayCell = { date: string; day: number };
export type MonthGrid = { weeks: (DayCell | null)[][] };

export function toDateKey(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Monday-first weekday index (0=Mon … 6=Sun) for a given Y/M/D.
function mondayIndex(year: number, month: number, day: number): number {
  // getUTCDay: 0=Sun..6=Sat. Use UTC to avoid local-tz drift.
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (js + 6) % 7;
}

export function buildMonthGrid(year: number, month: number): MonthGrid {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = mondayIndex(year, month, 1);
  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: toDateKey(year, month, d), day: d });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks };
}

export function bucketOutfitsByDate(
  outfits: OutfitWithItems[]
): Map<string, OutfitWithItems> {
  const map = new Map<string, OutfitWithItems>();
  for (const o of outfits) {
    const key = o.planned_for;
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || (o.created_at ?? "") > (existing.created_at ?? "")) {
      map.set(key, o);
    }
  }
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/outfits/__tests__/calendar.test.ts`
Expected: PASS (5 passed). Note: `buildMonthGrid` uses `new Date(Date.UTC(...))` for weekday math only — this is allowed in app code (the Date.now/new Date() restriction applies to workflow scripts, not the app).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/calendar.ts lib/domain/outfits/__tests__/calendar.test.ts
git commit -m "feat(outfits): add pure calendar grid + date-bucketing helpers"
```

---

## Task 2: Data layer — `planned_for` on schema + query, and `setOutfitPlannedDate`

**Files:**
- Modify: `lib/domain/outfits/index.ts` (`outfitWithItemsSchema`)
- Modify: `lib/domain/outfits/service.ts` (`listSavedOutfits` select; new `setOutfitPlannedDate`)

- [ ] **Step 1: Add `planned_for` to the schema**

In `lib/domain/outfits/index.ts`, change `outfitWithItemsSchema` to include the date:

```typescript
export const outfitWithItemsSchema = outfitSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().optional(),
  planned_for: z.string().nullable().optional(),
  items: z.array(outfitItemSchema.extend({
    id: z.string().uuid(),
    garment: z.object({
      id: z.string().uuid(),
      title: z.string().nullable().optional(),
      category: z.string(),
      preview_url: z.string().nullable().optional()
    })
  }))
});
```

- [ ] **Step 2: Add `planned_for` to the `listSavedOutfits` select**

In `lib/domain/outfits/service.ts`, in `listSavedOutfits`, change the top-level
column list to include `planned_for` (add it after `created_at`):

```typescript
    .select(`
      id, user_id, title, occasion, dress_code, weather_context_json,
      explanation, explanation_json, source_type, created_at, planned_for,
      items:outfit_items(
        id, outfit_id, garment_id, role, created_at,
        garment:garments(id, title, category)
      )
    `)
```

- [ ] **Step 3: Add `setOutfitPlannedDate` (one-per-day)**

Append to `lib/domain/outfits/service.ts` (it already imports `getRequiredUser`
and `createClient` at the top — reuse them):

```typescript
export async function setOutfitPlannedDate(params: {
  outfitId: string;
  date: string | null; // "YYYY-MM-DD" to plan, null to un-plan
}): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  // Enforce one outfit per day: clear any other outfit already on this date.
  if (params.date) {
    const { error: clearError } = await supabase
      .from("outfits")
      .update({ planned_for: null } as never)
      .eq("user_id", user.id)
      .eq("planned_for", params.date)
      .neq("id", params.outfitId);
    if (clearError) throw new Error(clearError.message);
  }

  const { error } = await supabase
    .from("outfits")
    .update({ planned_for: params.date } as never)
    .eq("id", params.outfitId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Typecheck + existing outfit tests**

Run: `npx tsc --noEmit && npx vitest run lib/domain/outfits`
Expected: no type errors; existing outfit tests still pass (schema change is additive/optional).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/index.ts lib/domain/outfits/service.ts
git commit -m "feat(outfits): carry planned_for through schema/query + setOutfitPlannedDate (one per day)"
```

---

## Task 3: Server actions

**Files:**
- Create: `app/calendar/actions.ts`

- [ ] **Step 1: Write the actions**

```typescript
// app/calendar/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setOutfitPlannedDate } from "@/lib/domain/outfits/service";

export type CalendarActionResult =
  | { status: "success" }
  | { status: "error"; message: string };

const planSchema = z.object({
  outfitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function planOutfitForDateAction(
  outfitId: string,
  date: string
): Promise<CalendarActionResult> {
  try {
    const parsed = planSchema.parse({ outfitId, date });
    await setOutfitPlannedDate({ outfitId: parsed.outfitId, date: parsed.date });
    revalidatePath("/calendar");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not plan outfit."
    };
  }
}

export async function unplanOutfitAction(
  outfitId: string
): Promise<CalendarActionResult> {
  try {
    const id = z.string().uuid().parse(outfitId);
    await setOutfitPlannedDate({ outfitId: id, date: null });
    revalidatePath("/calendar");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not remove plan."
    };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/calendar/actions.ts
git commit -m "feat(calendar): add plan/unplan server actions"
```

---

## Task 4: `OutfitCalendar` client component

**Files:**
- Create: `components/outfit-calendar.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/outfit-calendar.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OutfitWithItems } from "@/lib/domain/outfits";
import { buildMonthGrid, bucketOutfitsByDate } from "@/lib/domain/outfits/calendar";
import { planOutfitForDateAction, unplanOutfitAction } from "@/app/calendar/actions";
import { showAppToast } from "@/lib/ui/app-toast";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function outfitChips(outfit: OutfitWithItems) {
  return outfit.items.map((it) => it.garment.category);
}

export function OutfitCalendar({
  outfits,
  todayKey
}: {
  outfits: OutfitWithItems[];
  todayKey: string;
}) {
  const [year, month] = todayKey.split("-").map(Number); // month is 1-based
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);
  const [selected, setSelected] = useState<string | null>(todayKey);
  const [isPending, startTransition] = useTransition();

  const byDate = useMemo(() => bucketOutfitsByDate(outfits), [outfits]);
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function plan(outfitId: string, date: string) {
    startTransition(async () => {
      const res = await planOutfitForDateAction(outfitId, date);
      showAppToast(res.status === "success" ? "Outfit planned." : res.message, res.status);
    });
  }
  function unplan(outfitId: string) {
    startTransition(async () => {
      const res = await unplanOutfitAction(outfitId);
      showAppToast(res.status === "success" ? "Plan removed." : res.message, res.status);
    });
  }

  const selectedOutfit = selected ? byDate.get(selected) : undefined;
  const unplanned = outfits.filter((o) => !o.planned_for);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <button onClick={() => shiftMonth(-1)} aria-label="Previous month"
          className="rounded-full p-2" style={{ border: "1px solid var(--line)" }}>
          <ChevronLeft size={18} />
        </button>
        <h2 className="italic" style={{ fontFamily: "var(--font-display), serif", fontSize: "1.6rem" }}>
          {MONTHS[viewMonth - 1]} {viewYear}
        </h2>
        <button onClick={() => shiftMonth(1)} aria-label="Next month"
          className="rounded-full p-2" style={{ border: "1px solid var(--line)" }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[0.7rem] font-semibold uppercase"
            style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>{w}</div>
        ))}
        {grid.weeks.flat().map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const has = byDate.has(cell.date);
          const isToday = cell.date === todayKey;
          const isSel = cell.date === selected;
          return (
            <button
              key={cell.date}
              onClick={() => setSelected(cell.date)}
              className="relative aspect-square rounded-lg text-sm"
              style={{
                border: isSel ? "1px solid var(--accent)" : "1px solid var(--line)",
                background: isToday ? "var(--surface, transparent)" : "transparent",
                fontWeight: isToday ? 700 : 400
              }}
            >
              {cell.day}
              {has && (
                <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                  style={{ background: "var(--accent)" }} />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 rounded-2xl p-5" style={{ border: "1px solid var(--line)" }}>
          <p className="text-[0.72rem] font-semibold uppercase"
            style={{ color: "var(--muted)", letterSpacing: "0.2em" }}>{selected}</p>

          {selectedOutfit ? (
            <div className="mt-3">
              <p className="text-lg" style={{ fontFamily: "var(--font-display), serif" }}>
                {selectedOutfit.title ?? "Planned outfit"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {outfitChips(selectedOutfit).map((c, i) => (
                  <span key={i} className="rounded-full px-2.5 py-1 text-[0.72rem]"
                    style={{ background: "var(--surface, #00000008)", border: "1px solid var(--line)" }}>{c}</span>
                ))}
              </div>
              <button
                disabled={isPending}
                onClick={() => unplan(selectedOutfit.id)}
                className="mt-4 rounded-full px-4 py-2 text-[0.74rem] font-semibold uppercase"
                style={{ border: "1px solid var(--line)", letterSpacing: "0.14em" }}>
                Remove from this day
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <p style={{ color: "var(--muted)" }}>No outfit planned. Choose a saved outfit:</p>
              {unplanned.length === 0 ? (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  No unplanned saved outfits — save one in the planner first.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {unplanned.map((o) => (
                    <li key={o.id}>
                      <button
                        disabled={isPending}
                        onClick={() => plan(o.id, selected)}
                        className="w-full rounded-xl px-4 py-3 text-left"
                        style={{ border: "1px solid var(--line)" }}>
                        <span className="text-sm font-medium">{o.title ?? "Saved outfit"}</span>
                        <span className="ml-2 text-[0.72rem]" style={{ color: "var(--muted)" }}>
                          {outfitChips(o).join(" · ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify `showAppToast` signature**

Run: `grep -n "export function showAppToast\|export const showAppToast" lib/ui/app-toast.ts`
Expected: a match. Confirm it accepts `(message, status)` or similar; if its signature differs (e.g. `showAppToast({ message, tone })`), adjust the two call sites in Step 1 to match. Do not invent a signature.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/outfit-calendar.tsx
git commit -m "feat(calendar): add OutfitCalendar month grid + day drawer component"
```

---

## Task 5: Wire the `/calendar` page

**Files:**
- Modify: `app/calendar/page.tsx` (replace the placeholder body)

- [ ] **Step 1: Replace the page with a server component that fetches + renders**

```tsx
// app/calendar/page.tsx
import { AuthenticationError } from "@/lib/auth";
import { listSavedOutfits } from "@/lib/domain/outfits/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { OutfitCalendar } from "@/components/outfit-calendar";

export const metadata = {
  title: "Calendar — Pocket Wardrobe"
};

function localTodayKey(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export default async function CalendarPage() {
  try {
    const outfits = await listSavedOutfits();
    return (
      <main className="pw-shell">
        <div className="mx-auto max-w-2xl pt-6 text-center">
          <p className="text-[0.72rem] font-semibold uppercase"
            style={{ letterSpacing: "0.32em", color: "var(--muted)" }}>
            The Calendar
          </p>
          <h1 className="mt-3 italic"
            style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(2rem,6vw,3rem)", fontWeight: 400 }}>
            Plan your week.
          </h1>
        </div>
        <div className="mt-8">
          <OutfitCalendar outfits={outfits} todayKey={localTodayKey()} />
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <main className="pw-shell">
          <AuthRequiredCard />
        </main>
      );
    }
    throw error;
  }
}
```

- [ ] **Step 2: Verify `AuthRequiredCard` import + usage match the codebase**

Run: `grep -rn "AuthRequiredCard" app/outfits/page.tsx components/auth-required-card.tsx | head`
Expected: confirm the import path and whether it needs props. Mirror exactly how `app/outfits/page.tsx` uses it; adjust if it takes props.

- [ ] **Step 3: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass (incl. the 5 new calendar helper tests).

- [ ] **Step 4: Build check (catches client/server boundary issues)**

Run: `npx next build` (or `npm run build`)
Expected: `/calendar` compiles as a server page importing the client `OutfitCalendar`. If it complains about a server action import in a client component, confirm `app/calendar/actions.ts` has `"use server"` (it does).

- [ ] **Step 5: Commit**

```bash
git add app/calendar/page.tsx
git commit -m "feat(calendar): wire /calendar page to the OutfitCalendar"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** pure helpers (grid, bucketing, dateKey) → Task 1; `planned_for` on schema/query + `setOutfitPlannedDate` one-per-day → Task 2; actions → Task 3; month grid + day drawer + assign/swap/remove picker + tokens/toasts → Task 4; server page + auth → Task 5; TDD of pure helpers → Task 1. Deferred items (thumbnails, multi-per-day, planner targeting) intentionally absent. All covered.
- **Placeholder scan:** none — full code in every code step. The `showAppToast`/`AuthRequiredCard` steps are real verification instructions (confirm-then-match), not placeholders.
- **Type consistency:** `OutfitWithItems` (with added `planned_for`/`created_at`), `DayCell`/`MonthGrid`, `buildMonthGrid(year, month)`, `bucketOutfitsByDate`, `setOutfitPlannedDate({outfitId, date})`, `planOutfitForDateAction(outfitId, date)` / `unplanOutfitAction(outfitId)` are used consistently across tasks. `todayKey`/`date` are `YYYY-MM-DD` throughout.
