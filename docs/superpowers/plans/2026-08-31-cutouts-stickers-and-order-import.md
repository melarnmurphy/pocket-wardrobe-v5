# Cut-outs, Stickers, Generous Paywall, and Order Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save a look immediately, lift garments as iPhone-style stickers (wardrobe / sheet / copy / paste), connect order sources without fake retailer APIs, and keep uploads + typed cost-per-wear free.

**Architecture:** Original photos stay on `lookbook_entries`. Canonical sticker is one alpha PNG (`garment_images.image_type = cutout` or `desired_item_json.cutout_path`). Detection still uses `/analyse`; matting is a separate step that is skipped for busy lifestyle frames. Sources are `retailer_connections` rows feeding existing `garment_sources` + drafts. Plus is scan/trends/packing/let-go/availability/analytics — not clothing count.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Vitest, Sharp (or pipeline matte), Supabase Storage (`garment-cutouts`, `lookbook-images`), existing fashion pipeline, iOS Vision (`VNGenerateForegroundInstanceMaskRequest`) later.

**Spec:** `docs/superpowers/specs/2026-08-31-cutouts-stickers-and-order-import-design.md`

**UI:** Claude design-agent HTML is the visual source of truth when copied into the repo. Until then, match the described gesture (hold → dim → white-edge lift → Wardrobe / Sticker / Copy) and the generous paywall copy.

## Global Constraints

- Wardrobe and lookbook stay separate tables.
- Do not invent retailer scrape integrations; email/URL/receipt adapters only until a real partner API exists.
- Do not gate unlimited uploads or user-typed prices on Plus.
- Structured detection over LLM-only isolation.
- Tests: `npx vitest run <file>` then `npx tsc --noEmit` after UI/schema tasks.
- Do not commit unless the user asked for a commit.

---

## File map

| File | Responsibility |
| --- | --- |
| `lib/domain/stickers/classify.ts` | Look vs packshot heuristic |
| `lib/domain/stickers/payload.ts` | Zod for sticker / desired-item cutout JSON |
| `lib/domain/stickers/edge.ts` | White ring compositing contract (pure or sharp-backed, tested) |
| `lib/domain/entitlements/index.ts` + `lib/domain/billing/service.ts` | Generous flag map + Plus copy |
| `components/sticker-lift.tsx` | Press-hold lift overlay |
| `components/sticker-sheet.tsx` | Floating sheet |
| `app/lookbook/actions.ts` + `lib/domain/lookbook/service.ts` | Confirm candidate → item + storage |
| `supabase/migrations/023_retailer_connections.sql` | Sources table + RLS |
| `lib/domain/sources/service.ts` | Connection CRUD; sync stubs that enqueue receipt/URL jobs |
| `app/account/sources/` | Connect UI |
| iOS (later task) | Vision foreground mask + paste |

---

### Task 1: Sticker payload schema

**Files:**
- Create: `lib/domain/stickers/payload.ts`
- Test: `lib/domain/stickers/__tests__/payload.test.ts`

**Interfaces:**
- Consumes: none
- Produces:

```ts
export const stickerCandidateSchema = z.object({
  status: z.enum(["pending", "confirmed", "dismissed"]),
  role: z.string().nullable(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  cutout_path: z.string().nullable(),
  original_look_path: z.string().nullable(),
  visual_kind: z.enum(["look", "packshot", "pasted_sticker"]),
  confidence: z.number().min(0).max(1),
  category: z.string().nullable(),
  colour: z.string().nullable()
});
export type StickerCandidate = z.infer<typeof stickerCandidateSchema>;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { stickerCandidateSchema } from "../payload";

describe("stickerCandidateSchema", () => {
  it("accepts a pending look-derived candidate without a cutout yet", () => {
    const parsed = stickerCandidateSchema.parse({
      status: "pending",
      role: "dress",
      bbox: [10, 20, 300, 800],
      cutout_path: null,
      original_look_path: "user/looks/a.jpg",
      visual_kind: "look",
      confidence: 0.72,
      category: "dress",
      colour: "cream"
    });
    expect(parsed.status).toBe("pending");
  });

  it("rejects confidence outside 0–1", () => {
    expect(() =>
      stickerCandidateSchema.parse({
        status: "pending",
        role: null,
        bbox: null,
        cutout_path: null,
        original_look_path: null,
        visual_kind: "packshot",
        confidence: 1.2,
        category: null,
        colour: null
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/stickers/__tests__/payload.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write `payload.ts` with the schema above**

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run lib/domain/stickers/__tests__/payload.test.ts && npx tsc --noEmit`

Expected: PASS

---

### Task 2: Look vs packshot classifier

**Files:**
- Create: `lib/domain/stickers/classify.ts`
- Test: `lib/domain/stickers/__tests__/classify.test.ts`

**Interfaces:**
- Consumes: detection summary (count, coverage, background variance)
- Produces:

```ts
export type FrameClass = "look" | "packshot";

export function classifySourceFrame(input: {
  garmentCount: number;
  maxBboxCoverage: number; // 0–1, largest bbox area / image area
  backgroundVariance: number; // 0–1, normalized luma variance of corners
}): FrameClass;
```

Rules (lock in tests):

- `backgroundVariance >= 0.18` → `look` (lifestyle / busy wall).
- else if `garmentCount === 1` and `maxBboxCoverage >= 0.35` → `packshot`.
- else → `look`.

- [ ] **Step 1: Write tests for the three branches** (busy background, single dominant garment on flat ground, multi-item studio still classified look if count > 1)

- [ ] **Step 2: Run to fail, implement, re-run**

Run: `npx vitest run lib/domain/stickers/__tests__/classify.test.ts`

---

### Task 3: Generous entitlements

**Files:**
- Modify: `lib/domain/billing/service.ts` (`deriveFeatureFlagsForPlan`, `getPremiumFeatureSummary`)
- Modify: `lib/domain/entitlements/service.ts` (`buildDefaultEntitlements` free defaults)
- Modify: `app/account/plan-section.tsx` copy
- Test: `lib/domain/entitlements/__tests__/service.test.ts` and any billing tests that assert free flags

**Interfaces:**
- Free: `product_url_ingestion_enabled: true`, `receipt_ocr_enabled: true` (manual + email import). `feature_labels_enabled: false`, `outfit_decomposition_enabled: false` (Plus scan).
- Pro/Plus and premium: all four true.
- `getPremiumFeatureSummary` becomes: scan labels, trend calls, packing, let-go list, availability, long-run analytics. **Not** “you may upload clothes” or “cost per wear”.

- [ ] **Step 1: Update tests that expect free ingest flags to be false** — they must expect URL + receipt on for free, labels off

- [ ] **Step 2: Flip `deriveFeatureFlagsForPlan` and default entitlements**

- [ ] **Step 3: Update account plan copy to the generous-end list**

- [ ] **Step 4:** `npx vitest run lib/domain/entitlements lib/domain/billing && npx tsc --noEmit`

Do **not** enable pipeline auto-tagging for free users in `createPhotoDraftAction`; that stays behind `feature_labels` / Plus scan.

---

### Task 4: Press-hold lift (web)

**Files:**
- Create: `components/sticker-lift.tsx`
- Create: `components/__tests__/sticker-lift.test.ts` (pure helpers only if extracted)
- Create: `lib/domain/stickers/hit-test.ts`

**Interfaces:**

```ts
export function hitTestGarment(
  px: number,
  py: number,
  displayed: { width: number; height: number },
  natural: { width: number; height: number },
  bboxes: Array<{ id: string; bbox: [number, number, number, number] }>
): string | null;
```

Bboxes are in natural image pixels `[x1,y1,x2,y2]`. Map pointer into natural space, return smallest containing bbox id.

Component behaviour:

- `onPointerDown` start 400ms timer; `onPointerUp` before 400ms = no lift.
- After hold: overlay `rgba(0,0,0,0.45)` on the look; selected region uses the cutout PNG if present else the original clipped to bbox.
- CSS: wrapper has rotation/position; inner has `@keyframes sticker-float` / lift translateY. White edge: `filter: drop-shadow(0 0 0 2px #fff)`.
- Release shows three actions calling callbacks: `onAddToWardrobe`, `onSaveSticker`, `onCopy`.

Wire a first consumer on the lookbook entry detail (or card expand) **without** waiting for the design HTML. When the HTML arrives, restyle only.

- [ ] **Step 1: Tests for `hitTestGarment`** (inside, outside, overlapping → smallest)

- [ ] **Step 2: Implement hit-test + `StickerLift`**

- [ ] **Step 3:** `npx vitest run lib/domain/stickers/__tests__/hit-test.test.ts && npx tsc --noEmit`

---

### Task 5: Confirm sticker into lookbook item + optional wardrobe

**Files:**
- Modify: `lib/domain/lookbook/service.ts`
- Modify: `app/lookbook/actions.ts`
- Test: extend lookbook service tests if present, else `lib/domain/lookbook/__tests__/sticker-confirm.test.ts`

**Interfaces:**

```ts
export async function confirmStickerCandidate(params: {
  lookbookEntryId: string;
  candidate: StickerCandidate;
  destination: "wardrobe" | "sticker" | "both";
}): Promise<{ lookbookItemId: string; garmentId: string | null }>;
```

- Always write `lookbook_items.desired_item_json` from `stickerCandidateSchema` with `status: "confirmed"`.
- If destination includes wardrobe, create garment via existing wardrobe create + attach `garment_images` `image_type: "cutout"` from `cutout_path`, and set `lookbook_items.garment_id`.
- Copy action is client-only (`navigator.clipboard.write` of the PNG); no extra row.

- [ ] **Step 1: Failing test** — confirm sticker-only does not insert `garments`

- [ ] **Step 2: Implement confirm helper used by the lookbook action**

- [ ] **Step 3:** `npx vitest run lib/domain/lookbook && npx tsc --noEmit`

---

### Task 6: Sticker sheet + body collage

**Files:**
- Create: `components/sticker-sheet.tsx`
- Modify: `components/avatar-styler.tsx` **or** add `components/sticker-canvas.tsx` if avatar-styler is already too large — prefer a new canvas that **reads** avatar photo + `garment_images` cutouts rather than growing the 900-line styler
- Modify: `app/wardrobe/(closet)/avatar/page.tsx` or lookbook page to render the sheet

Behaviour:

- List garments (or lookbook items) that have a cutout signed URL.
- Each sticker: inner float animation, wrapper rotation, white ring, shadow.
- Canvas: user cut-out as base (avatar image; matte can be a CSS approximation until Vision/server matte exists), drag stickers using existing avatar tile positions if possible (`AvatarTilePosition`).
- Paste target: `onPaste` on the sheet — if `clipboardData.files[0]` is an image, upload via a new `pasteStickerAction` that sets `visual_kind: "pasted_sticker"` and skips rematting when the PNG has a useful alpha channel (heuristic: >5% transparent pixels).

- [ ] **Step 1: Unit test `hasUsefulAlpha(buffer)` in `lib/domain/stickers/alpha.ts`**

- [ ] **Step 2: Sheet + paste action + canvas**

- [ ] **Step 3:** typecheck; browser-verify lift, sheet float, paste if a local PNG is available

---

### Task 7: Retailer connections schema (no fake sync)

**Files:**
- Create: `supabase/migrations/023_retailer_connections.sql`
- Mirror the table in `schema.sql`
- Create: `lib/domain/sources/index.ts`, `lib/domain/sources/service.ts`
- Test: `lib/domain/sources/__tests__/service.test.ts` (mocked supabase)

Table as in the spec. RLS: user can CRUD own rows. `provider` check:

`'the_iconic' | 'depop' | 'vestiaire' | 'gmail' | 'other'`

- [ ] **Step 1: Migration + `schema.sql` + types** (`npx supabase` gen types if that is the repo convention; otherwise update `types/database.ts` by hand to match)

- [ ] **Step 2: `listConnections` / `upsertConnection` / `setDepopScopes`**

Depop scopes stored only; `list_from_let_go` requires paid plan (`hasPaidPlan`) or the action returns 403.

- [ ] **Step 3:** `npx vitest run lib/domain/sources && npx tsc --noEmit`

---

### Task 8: Sources screen

**Files:**
- Create: `app/account/sources/page.tsx`
- Create: `app/account/sources/actions.ts`
- Create: `components/source-connect-card.tsx`

UI (until design HTML lands):

- Connected: The Iconic, Depop, Vestiaire, Gmail — status, last sync, count.
- Five empty “Connect” slots using `provider: other` + display name.
- Fallback card: **Forward a receipt** showing the inbound address once `gmail` or inbound mail is configured; otherwise copy “Email your order confirmation to receipts@… (configured in env `RECEIPT_INBOUND_ADDRESS`)”.
- Modal copy: what is read (order lines, prices, dates) vs not (messages unrelated to purchases, payment card numbers).
- Connect for Iconic/Depop/Vestiaire **saves a pending connection** and explains v1 = “we import from order emails and product links you paste — not a password into their website.”
- Gmail connect: only if a real OAuth path exists; otherwise same pending + inbound address.

- [ ] **Step 1: Page lists connections from `listConnections`**

- [ ] **Step 2: Link from account plan section: “Connected stores”**

- [ ] **Step 3:** typecheck; do not add scraping jobs

---

### Task 9: iOS subject lift (after web gesture works)

**Files:**
- Create under `ios/PocketWardrobev5/`: `Services/ForegroundLift.swift`
- Wire from lookbook or wardrobe image viewer

Use `VNGenerateForegroundInstanceMaskRequest` + `generateMaskedImage` as in Apple Vision iOS 17. Export PNG with alpha. Share/copy via `UIPasteboard.general.image`. Per-garment lift still needs bbox from the server pipeline; v1 can lift the whole subject as a sticker.

- [ ] **Step 1: Pure Swift helper testable with a fixture PNG in unit tests if the target can host it; otherwise a Simulator smoke path documented in `docs/tester-handoff.md`**

- [ ] **Step 2: Hold-to-lift UI mirroring web actions**

---

## Spec coverage

| Spec section | Task |
| --- | --- |
| Flow C look + candidates | 1, 5 |
| Look vs packshot / skip bad mattes | 2 |
| Generous paywall | 3 |
| Photos-like lift + white edge | 4, 6 |
| Paste sticker | 6 |
| Sources + honest adapters | 7, 8 |
| iOS Vision | 9 |
| Ghost mannequin reconstruct | not in this plan (later) |

## Out of plan

- Live Depop listing API
- Generative ghost mannequin
- Perfect hole-filling matting
- Copying the Claude `.dc.html` into `design/` (do that as a follow-up when the file is in the workspace)
