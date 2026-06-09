# Outfit Calendar — Design

Date: 2026-06-09
Status: Approved (design); implementation pending
Owner area: `/calendar` route, outfits domain.

## Problem

`app/calendar/page.tsx` is a "Coming shortly" placeholder. The data model
already supports day planning — `outfits.planned_for` exists (migration `019`) —
but nothing in the web app reads or writes it: `saveOutfit`/`listSavedOutfits`
don't touch it, and the planner never assigns a date. The planning loop the app
advertises ("the plan you make in the Planner will land here") is unclosed.

## Goal

A working calendar: a month grid where the user assigns one of their saved
outfits to a day, sees it, and can swap or remove it. One outfit per day.

## Non-goals (YAGNI)

- Garment **thumbnails** on cells/drawer (current query fetches only garment
  id/title/category; fetching feature images is a clean fast-follow).
- Multiple outfits per day.
- Planner-driven date targeting (we use assign-from-saved, so the 2,227-line
  `outfit-planner.tsx` is **not** touched).
- Recurring plans, drag-and-drop, sharing.

## Data layer (`lib/domain/outfits/`)

- **`outfitWithItemsSchema`** (`index.ts`): add `planned_for: z.string().nullable().optional()`
  (a `YYYY-MM-DD` date string).
- **`listSavedOutfits`** (`service.ts`): add `planned_for` to the select column list.
- **`setOutfitPlannedDate({ outfitId, date })`** (`service.ts`, new): user-scoped.
  Enforces one-per-day — when `date` is non-null, first clears `planned_for` on
  any *other* of the user's outfits already on that date, then sets it on
  `outfitId`. `date: null` un-plans `outfitId`. Verifies the outfit belongs to
  the user (RLS + explicit `user_id` filter).
- **Actions** (`app/calendar/actions.ts`, new): `planOutfitForDateAction(outfitId, date)`
  and `unplanOutfitAction(outfitId)`, each `revalidatePath("/calendar")`.

## Pure helpers (`lib/domain/outfits/calendar.ts`, new — TDD'd)

- **`buildMonthGrid(year, month)`** → `{ weeks: (DayCell | null)[][] }` where a
  `DayCell` is `{ date: "YYYY-MM-DD", day: number }` and leading/trailing cells
  are `null`. Month is 1-based. Weeks start Monday (matches the placeholder's
  `Mo Tu We …` preview).
- **`bucketOutfitsByDate(outfits)`** → `Map<"YYYY-MM-DD", OutfitWithItems>`.
  Collision (shouldn't happen given one-per-day enforcement, but defensively):
  keep the most recently created (`created_at` desc).
- **`toDateKey(year, month, day)`** / parsing — all dates handled as plain
  `YYYY-MM-DD` strings; never construct `Date` from them for storage/compare, to
  avoid timezone off-by-one.

## UI

- **`components/outfit-calendar.tsx`** (client): props `{ outfits: OutfitWithItems[]; todayKey: string }`.
  - Month state (year/month), `‹ ›` prev/next nav, header `Month YYYY`.
  - 7-column grid from `buildMonthGrid`; today highlighted; days present in the
    date→outfit map render a **filled marker**.
  - Selected day → **drawer** below the grid:
    - has outfit → title + item **category chips** (from `items[].garment.category`)
      + **Swap** (opens picker) and **Remove** (`unplanOutfitAction`).
    - empty → **picker**: list of saved outfits (title + chips); choosing one
      calls `planOutfitForDateAction(outfitId, dateKey)`.
  - Uses existing tokens (`--accent`, `--line`, `--muted`, `--font-display`,
    `pw-shell`) to match the app; toasts via `showAppToast` on success/error.
- **`app/calendar/page.tsx`**: server component — auth (`AuthRequiredCard` on
  `AuthenticationError`, matching `/outfits`), `listSavedOutfits()`, compute
  `todayKey`, render `<OutfitCalendar>`.

## Error handling

- Actions return `{ status: "success" | "error", message? }`; the client shows a
  toast and reverts optimistic state on error.
- `setOutfitPlannedDate` throws on a DB error / non-owned outfit; the action
  catches and returns an error result.

## Testing

- **TDD** the pure helpers in `lib/domain/outfits/__tests__/calendar.test.ts`:
  - `buildMonthGrid`: correct number of weeks, Monday-leading blanks, last day in
    the right cell, a known month (e.g. June 2026 starts Monday).
  - `bucketOutfitsByDate`: maps by `planned_for`, ignores null, collision keeps
    newest `created_at`.
- DB writes (`setOutfitPlannedDate` one-per-day clearing) verified by typecheck +
  manual, matching the repo's existing service-layer test pattern.
