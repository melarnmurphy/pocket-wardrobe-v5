# Calendar Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a representative garment hero image on each planned calendar day cell and a thumbnail row in the day drawer, reusing the existing signed-URL logic.

**Architecture:** A pure `pickHeroImage` helper chooses an outfit's representative image by role priority. `app/calendar/page.tsx` fetches saved outfits + `listWardrobeGarments()` (which already returns signed `preview_url`s), builds a `garmentId → preview_url` map, and enriches each outfit item's `garment.preview_url`. `OutfitCalendar` renders the hero as the cell background and a thumbnail row in the drawer, falling back to dot/placeholder when no image.

**Tech Stack:** Next.js App Router, TypeScript, Supabase signed URLs, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-10-calendar-thumbnails-design.md`

**Test command:** `npx vitest run <path>` · **Typecheck:** `npx tsc --noEmit` · **Build:** `npm run build`

---

## File Structure

- **Modify** `lib/domain/outfits/calendar.ts` — add `pickHeroImage(outfit)`.
- **Modify** `lib/domain/outfits/__tests__/calendar.test.ts` — tests for it.
- **Modify** `app/calendar/page.tsx` — fetch garments, build map, enrich outfits.
- **Modify** `components/outfit-calendar.tsx` — hero cell background + drawer thumbnail row.

---

## Task 1: `pickHeroImage` helper

**Files:**
- Modify: `lib/domain/outfits/calendar.ts`
- Test: `lib/domain/outfits/__tests__/calendar.test.ts`

- [ ] **Step 1: Write the failing test** (append to the existing test file)

```typescript
import { pickHeroImage } from "@/lib/domain/outfits/calendar";

describe("pickHeroImage", () => {
  const item = (role: string, preview_url: string | null) =>
    ({ id: "00000000-0000-0000-0000-000000000000", outfit_id: "x", garment_id: "g",
       role, garment: { id: "g", category: role, preview_url } } as never);
  const outfit = (items: unknown[]) => ({ id: "o", items } as never);

  it("returns the dress image when present", () => {
    expect(pickHeroImage(outfit([item("shoes", "shoe.jpg"), item("dress", "dress.jpg")])))
      .toBe("dress.jpg");
  });

  it("respects role priority (outerwear over shoes)", () => {
    expect(pickHeroImage(outfit([item("shoes", "shoe.jpg"), item("outerwear", "coat.jpg")])))
      .toBe("coat.jpg");
  });

  it("skips items with no image and picks the next priority", () => {
    expect(pickHeroImage(outfit([item("dress", null), item("top", "top.jpg")])))
      .toBe("top.jpg");
  });

  it("returns null when no item has an image", () => {
    expect(pickHeroImage(outfit([item("top", null), item("shoes", "")]))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/outfits/__tests__/calendar.test.ts -t pickHeroImage`
Expected: FAIL — `pickHeroImage` is not exported.

- [ ] **Step 3: Add the implementation** to `lib/domain/outfits/calendar.ts`

```typescript
const HERO_ROLE_PRIORITY = [
  "dress", "outerwear", "top", "bottom", "shoes", "bag", "accessory", "jewellery", "other"
];

export function pickHeroImage(outfit: OutfitWithItems): string | null {
  for (const role of HERO_ROLE_PRIORITY) {
    const match = outfit.items.find(
      (it) => it.role === role && !!it.garment.preview_url
    );
    if (match?.garment.preview_url) return match.garment.preview_url;
  }
  // Any item with an image, regardless of role.
  const anyWithImage = outfit.items.find((it) => !!it.garment.preview_url);
  return anyWithImage?.garment.preview_url ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/outfits/__tests__/calendar.test.ts`
Expected: PASS (9 passed — 5 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/calendar.ts lib/domain/outfits/__tests__/calendar.test.ts
git commit -m "feat(outfits): add pickHeroImage helper (role-priority representative image)"
```

---

## Task 2: Enrich outfit items with signed preview_urls on the page

**Files:**
- Modify: `app/calendar/page.tsx`

- [ ] **Step 1: Fetch garments, build the map, enrich outfits**

Replace the body of the `try` block (the `const outfits = await listSavedOutfits();`
line and the `return (...)`) so it fetches both sources and enriches. Add the
`listWardrobeGarments` import at the top:

```tsx
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
```

Then inside the `try`:

```tsx
    const [outfits, garments] = await Promise.all([
      listSavedOutfits(),
      listWardrobeGarments()
    ]);

    const previewByGarmentId = new Map<string, string | null>();
    for (const g of garments) previewByGarmentId.set(g.id as string, g.preview_url);

    const enriched = outfits.map((o) => ({
      ...o,
      items: o.items.map((it) => ({
        ...it,
        garment: {
          ...it.garment,
          preview_url: previewByGarmentId.get(it.garment.id) ?? it.garment.preview_url ?? null
        }
      }))
    }));
```

Then pass `enriched` to the component:

```tsx
          <OutfitCalendar outfits={enriched} todayKey={localTodayKey()} />
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`GarmentListItem` has `id` and `preview_url: string | null`;
the enriched object structurally matches `OutfitWithItems` since `garment.preview_url`
is part of its schema.)

- [ ] **Step 3: Commit**

```bash
git add app/calendar/page.tsx
git commit -m "feat(calendar): enrich outfit items with signed garment preview_urls"
```

---

## Task 3: Render hero on cells + thumbnail row in drawer

**Files:**
- Modify: `components/outfit-calendar.tsx`

- [ ] **Step 1: Import the helper**

Change the calendar helper import to include `pickHeroImage`:

```tsx
import { buildMonthGrid, bucketOutfitsByDate, pickHeroImage } from "@/lib/domain/outfits/calendar";
```

- [ ] **Step 2: Render the hero image as the cell background**

In the grid `.map`, replace the cell `<button>` body. Compute the day's outfit and
its hero, and render the image (with a scrim under the day number) or fall back to
the dot:

```tsx
        {grid.weeks.flat().map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const dayOutfit = byDate.get(cell.date);
          const hero = dayOutfit ? pickHeroImage(dayOutfit) : null;
          const isToday = cell.date === todayKey;
          const isSel = cell.date === selected;
          return (
            <button
              key={cell.date}
              onClick={() => setSelected(cell.date)}
              className="relative aspect-square overflow-hidden rounded-lg text-sm"
              style={{
                border: isSel ? "1px solid var(--accent)" : "1px solid var(--line)",
                fontWeight: isToday ? 700 : 400
              }}
            >
              {hero && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <span
                className="absolute left-1 top-1 rounded px-1"
                style={hero ? { background: "rgba(0,0,0,0.55)", color: "#fff" } : undefined}
              >
                {cell.day}
              </span>
              {dayOutfit && !hero && (
                <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                  style={{ background: "var(--accent)" }} />
              )}
            </button>
          );
        })}
```

- [ ] **Step 3: Replace the drawer category chips with a thumbnail row**

In the `selectedOutfit ?` branch, replace the chips `<div className="mt-2 flex flex-wrap gap-1.5">…</div>`
block with a thumbnail row:

```tsx
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {selectedOutfit.items.map((it) => (
                  <div key={it.id} className="flex w-16 shrink-0 flex-col items-center gap-1">
                    <div className="h-16 w-16 overflow-hidden rounded-lg"
                      style={{ border: "1px solid var(--line)" }}>
                      {it.garment.preview_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.garment.preview_url} alt={it.garment.title ?? it.garment.category}
                          className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <span className="text-center text-[0.62rem]" style={{ color: "var(--muted)" }}>
                      {it.garment.category}
                    </span>
                  </div>
                ))}
              </div>
```

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run lib/domain/outfits`
Expected: no type errors; 9 outfit calendar tests pass.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: exit 0; `/calendar` compiles. (Plain `<img>` with `eslint-disable` for
`@next/next/no-img-element` keeps the lint step clean.)

- [ ] **Step 6: Commit**

```bash
git add components/outfit-calendar.tsx
git commit -m "feat(calendar): render hero image on day cells + thumbnail row in drawer"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** `pickHeroImage` role priority + fallback → Task 1; page enrichment reusing `listWardrobeGarments` signed URLs → Task 2; hero cell background w/ scrim + dot fallback → Task 3 Step 2; drawer thumbnail row w/ placeholder fallback → Task 3 Step 3; TDD of helper → Task 1; build/typecheck verification → Task 3. Picker left unchanged (out of scope per spec). All covered.
- **Placeholder scan:** none — full code in every code step.
- **Type consistency:** `pickHeroImage(outfit: OutfitWithItems): string | null` used in Task 3; `previewByGarmentId: Map<string, string | null>`; `it.garment.preview_url` / `it.garment.id` / `it.garment.category` / `it.role` match `outfitWithItemsSchema`; `GarmentListItem.id`/`.preview_url` match the wardrobe service. `enriched` is structurally `OutfitWithItems[]`.
