# Account, Billing, and Data Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the six dialogs/sheet/toast `docs/design/design_handoff_garderobe/MODALS.md` §5 marks **missing** (sign out, delete my photos, close the account, export started/ready, paywall interrupt, payment failed/subscription lapsed), and resolve the two placeholder-copy problems in §5b (the w7c pricing overclaim, and the A$49/A$69 price conflict), grounding every new dialog in the account/billing infrastructure that already exists in this codebase.

**Architecture:** All new destructive/confirmation UI is built on the existing `Dialog` (`components/garderobe/dialog.tsx`) and `BottomSheet`/`SheetAction` (`components/garderobe/bottom-sheet.tsx`) primitives, following the `components/garderobe/wardrobe/*` convention of one file per dialog. `Dialog` gains an optional `children` slot and `confirmDisabled` prop (backward compatible) so the close-account type-to-confirm input can live inside it without forking a new overlay. New rows live in `app/account/you-section.tsx` (the w3e-equivalent section already built in the Garderobe design language) rather than the older, pre-redesign parts of `app/account/page.tsx`. Two pieces of billing/entitlements plumbing already exist and are extended rather than replaced: `lib/domain/entitlements` (`plan_tier`, `hasPaidPlan`) and `lib/domain/billing` (the generic `/api/billing/sync` webhook). The local-threads schema (`local_listings.status`, `threads.state`) is queried directly for the close-account consequence copy, reusing `listMyThreads` from `lib/domain/local-threads/threads-service.ts` where possible.

**Tech Stack:** Next.js App Router server actions, Zod validation, Supabase/Postgres with RLS, Vitest for unit tests, React Testing Library for component tests.

**Spec:** `docs/design/design_handoff_garderobe/MODALS.md` §5 and §5b, `docs/design/design_handoff_garderobe/README.md` (README.md:160, README.md:331 — the price-conflict note), `docs/design/design_handoff_garderobe/Garderobe Web.dc.html` lines 212, 232, 472, 491, 1212, 1954 (pricing hero and plan-card copy), `HANDOFF.md` (state of phases 0–10).

## Investigation findings this plan is grounded in

- **The account page is a hybrid.** `app/account/page.tsx` still uses the pre-Garderobe visual language (`pw-` prefixed classes) for its shell, `AccountProfileForm`, and `PlanSection`. Only `YouSection` (`app/account/you-section.tsx`, tagged "17a / w3e" in its own doc comment) is built in the Garderobe design system. New rows for this plan go in `YouSection` (or new sibling sections in the same file, same visual language) — a full restyle of `app/account/page.tsx` is a separate, larger gap (parallel to the `components/wardrobe-shop.tsx` restyle gap `HANDOFF.md` already calls out) and is out of scope here.
- **No page in `app/` currently uses `Dialog`/`BottomSheet`/`SheetAction` except the primitives showcase** (`app/garderobe-primitives/page.tsx`) before this plan — every dialog built in this plan is the first real usage of these primitives inside `app/account/`.
- **Two separate entitlements/paywall concepts exist and neither matches the drawn mockups exactly.** The real, wired-up one is `lib/domain/entitlements` + `lib/domain/billing`: a `user_entitlements` table with `plan_tier` (`free`/`pro`/`premium`) and four feature flags (`feature_labels_enabled`, `receipt_ocr_enabled`, `product_url_ingestion_enabled`, `outfit_decomposition_enabled`), synced from an external billing provider via `POST /api/billing/sync` (a shared-secret webhook, `BILLING_PROVIDER` typed to `"stripe"` only but no Stripe SDK anywhere in the repo — nothing calls this endpoint today). `hasPaidPlan()` and `assertPaidPlanAccess()` (`lib/domain/entitlements/service.ts`) already exist but are **not called from any page** — only `FeatureAccessError` (a different check, `assertFeatureLabelsAccess`) is caught once, in `app/api/pipeline/analyse/route.ts`. The mockups' "plus" concept (analytics, in-store scan, trend calls/packing/let-go list, availability) has **no gating code anywhere** and no dedicated pricing/paywall route exists in `app/` at all — `9h` is drawn only in `Garderobe Phone.dc.html`, never built. This plan reuses `plan_tier`/`hasPaidPlan` as the mechanism for the new "plus" gates, since building a second, parallel entitlements table would be pure duplication.
- **Of the four "plus" features named in MODALS.md §5b, three have real UI to gate and one does not:** the let-go list (`app/wardrobe/let-go/page.tsx`) and in-store scan (`app/wardrobe/scan/page.tsx`) are full pages; the trend detail page's "how covered you are" section (`app/trends/[id]/page.tsx`) is the closest real analogue to "trend calls". "Availability" has a working server action (`setAvailabilityAction` in `app/wardrobe/actions.ts`) but **no UI control anywhere calls it** — it is already orphaned, independent of this plan. "Analytics" has no code at all — not a page, not a component, not a data source. This plan gates the three real surfaces with the full interrupt-sheet UX, adds a server-side hook (`assertPaidPlanAccess`) to the already-orphaned availability action as a defensive measure, and leaves analytics alone (there is nothing to gate).
- **Pricing conflict is entirely inside the mockups, not the codebase.** No app code contains "A$49" or "A$69" anywhere — grep across `app/`, `components/`, `lib/` returns nothing. Inside `docs/design/design_handoff_garderobe/`, A$69/year appears in the phone paywall (`Garderobe Phone.dc.html:2602`), the w7c pricing hero and price display (`Garderobe Web.dc.html:212,232,472,1212`), and both `README.md:160` and its own price-conflict note (`README.md:331`); A$49 appears exactly once, in the w3e account-rail plan card (`Garderobe Web.dc.html:1954`). **This plan adopts A$69/year** on that count (five occurrences vs. one) for every price string it writes. **This is a placeholder business decision, not a final one** — see the report for the explicit flag to the human partner.
- **"Delete my photos, keep the records" has a clean, real target.** Garment photos live in `garment_images` (`storage_path`, `image_type` in `original`/`cutout`/`cropped`/`thumbnail`), in the `garment-originals` and `garment-cutouts` storage buckets (`supabase/migrations/002_storage_policies.sql`). Deleting every `garment_images` row (and best-effort removing the storage objects) for a user's garments, while leaving `garments` rows untouched, is exactly "keep the records."
- **"Close the account" has a concrete, real consequence to describe.** `local_listings.status` (`supabase/migrations/029_local_listings.sql`) is `'live'`, `'reserved'`, or `'handover arranged'` for an active listing; `threads.state` (`supabase/migrations/031_local_threads_transactional.sql`) is `'open'` or `'handover arranged'` for an active conversation. `lib/domain/local-threads/threads-service.ts` already has `listMyThreads()` and `withdrawLocalListing(listingId)`; there is no existing "list my own listings" query, so this plan adds one.
- **No data-export mechanism exists at all** (no route, no table, no job). Per the task's own scope note, this plan builds the toast UI pattern and a minimal server action that records an export request (a new `data_export_requests` table), fires the "export started" toast for real, and exposes the "export ready" state as a hook a real export worker would flip — it does not generate any actual export file. This is flagged again in the final report.
- **No payment provider is wired up** (`BILLING_PROVIDER` is typed but nothing sets it; no Stripe SDK dependency in `package.json`). This plan adds a `billing_status` column to `user_entitlements` (nullable, `'active'` / `'payment_failed'` / `'lapsed'`, already committed as Task 1/2) that a real billing webhook would set via the *existing* `/api/billing/sync` endpoint, an `isBillingLapsed()` helper, and the dialog UI — it does not add a payment integration.

## Global Constraints

- Deletion/closure dialogs name the consequence, not just ask "are you sure?" (`MODALS.md` standing rule 1).
- Nothing destructive resolves in a toast alone — close-account and delete-photos are dialogs, never toasts (standing rule 2).
- A dialog asks one question; if it needs two, it is a sheet (standing rule 3).
- Price is optional and a null price never renders as A$0 (standing rule 6) — not directly exercised by this plan's dialogs, but the pricing copy this plan writes must not contradict it.
- Sheets carry a 38×3px grab handle and 20px top corners; dialogs are 14px radius, centred — both already implemented by `BottomSheet`/`Dialog`; do not override this per-component.
- Australian English, no em dashes, in all new UI copy (`~/.claude/CLAUDE.md`).
- Every new dialog/sheet is built on `Dialog` or `BottomSheet`/`SheetAction` — extend a primitive's props if a mockup needs something it can't currently do (this plan does, for `Dialog`); don't fork a new one-off overlay pattern.
- Server actions in `app/wardrobe/actions.ts` take `(previousState: WardrobeActionState, formData: FormData)`; server actions in `app/account/` take `(previousState: AccountActionState, formData: FormData)` — this plan follows whichever family a given action extends.

---

## Task 1 & 2: Migration and generated database types — ALREADY DONE, reconciled below

**This work is already implemented and committed** (commit `9a4c252`, "Add billing_status and data_export_requests for the account dialogs"), from an earlier pass of this same plan before a context compaction. The text below is corrected to describe what actually shipped, so later tasks in this document reference real column names and values rather than a superseded draft. Do not redo this work; do not re-run its steps.

**What actually exists, as committed:**
- `supabase/migrations/036_account_billing_data_dialogs.sql`:
  - `user_entitlements.billing_status text` — **nullable, no default** — `check (billing_status in ('active', 'payment_failed', 'lapsed'))`. Note the values are `payment_failed`/`lapsed`, not `past_due`/`canceled` — every later task in this plan that mentions `billing_status` values MUST use `'active' | 'payment_failed' | 'lapsed'`.
  - `public.data_export_requests` table: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `status text not null default 'requested' check (status in ('requested', 'ready'))`, `requested_at timestamptz not null default now()`, `ready_at timestamptz`. There is **no `download_url` column** — later tasks must not reference one.
  - RLS: `data_export_requests_select_own` (select, `user_id = auth.uid()`) and `data_export_requests_insert_own` (insert, same check).
- `types/database.ts`: `user_entitlements` `Row`/`Insert`/`Update` gained `billing_status: string | null` (optional on Insert/Update); a new `data_export_requests` table block was added with `Row: { id, user_id, status, requested_at, ready_at }` (matching the migration above, `ready_at: string | null`).

**Reconciliation ruling (see ledger):** this plan's later tasks (originally drafted against `past_due`/`canceled` and a `download_url` column) are corrected in place, below, to match what is actually in the database and in `types/database.ts`. Where a later task's code sample still shows the old values, treat the values in this section as authoritative and the later sample as needing the substitution `past_due` → `payment_failed`, `canceled` → `lapsed`, and drop any reference to `download_url`.

---

## Task 3: Extend the Dialog primitive with an optional body slot

**Files:**
- Modify: `components/garderobe/dialog.tsx`
- Test: `components/garderobe/__tests__/dialog.test.tsx`

**Interfaces:**
- Produces: `Dialog` gains `children?: ReactNode` (rendered between `description` and the button row) and `confirmDisabled?: boolean` (disables and dims the confirm `PillButton`). Both optional and backward compatible with every existing `Dialog` caller.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
// components/garderobe/__tests__/dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "@/components/garderobe/dialog";

describe("Dialog", () => {
  it("renders children between the description and the buttons", () => {
    render(
      <Dialog
        open
        onClose={vi.fn()}
        title="close your account?"
        description="This is permanent."
        confirmLabel="close account"
        onConfirm={vi.fn()}
      >
        <input aria-label="type close to confirm" />
      </Dialog>
    );

    expect(screen.getByLabelText("type close to confirm")).toBeInTheDocument();
  });

  it("disables the confirm button when confirmDisabled is true", () => {
    const onConfirm = vi.fn();

    render(
      <Dialog
        open
        onClose={vi.fn()}
        title="close your account?"
        confirmLabel="close account"
        onConfirm={onConfirm}
        confirmDisabled
      />
    );

    const confirmButton = screen.getByRole("button", { name: "close account" });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirmDisabled defaults to false so every existing Dialog caller is unaffected", () => {
    const onConfirm = vi.fn();
    render(
      <Dialog open onClose={vi.fn()} title="sign out?" confirmLabel="sign out" onConfirm={onConfirm} />
    );

    expect(screen.getByRole("button", { name: "sign out" })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/__tests__/dialog.test.tsx`
Expected: FAIL — `children` is not rendered and `confirmDisabled` does not exist on `DialogProps`.

- [ ] **Step 3: Implement it**

Check `PillButton`'s props first (`components/garderobe/pill-button.tsx`) to confirm it accepts a `disabled` prop passed through to the underlying `<button>` before wiring this — if it does not already forward `disabled`, add that forwarding as part of this step (it is a one-line addition, `disabled` is a standard button prop every button-like component in this codebase should support).

In `components/garderobe/dialog.tsx`:

```typescript
type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void;
  confirmVariant?: "primary" | "on-blush";
  /** Extra content between the description and the button row — e.g. a type-to-confirm input. */
  children?: ReactNode;
  /** Disables and dims the confirm button, e.g. until a type-to-confirm input matches. */
  confirmDisabled?: boolean;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  cancelLabel = "cancel",
  confirmLabel,
  onConfirm,
  confirmVariant = "primary",
  children,
  confirmDisabled = false
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(12,10,9,.55)]"
      />
      <div className="gw-pop relative w-full max-w-[340px] rounded-[14px] bg-[var(--cream)] px-[22px] py-6 text-center">
        {icon ? (
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--blush)] text-[var(--blush-ink)]">
            {icon}
          </div>
        ) : null}
        <div className="text-[21px] font-light leading-[1.25] text-[var(--ink)]">{title}</div>
        {description ? (
          <div className="px-0 py-[10px] pb-5 text-[12.5px] leading-[1.5] text-[var(--stone)]">
            {description}
          </div>
        ) : null}
        {children ? <div className="pb-4 text-left">{children}</div> : null}
        <div className="flex gap-[9px] pt-1">
          <PillButton variant="secondary" onClick={onClose} className="h-11">
            {cancelLabel}
          </PillButton>
          <PillButton
            variant={confirmVariant}
            onClick={onConfirm}
            className="h-11"
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/__tests__/dialog.test.tsx`
Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add components/garderobe/dialog.tsx components/garderobe/pill-button.tsx components/garderobe/__tests__/dialog.test.tsx
git commit -m "Add an optional body slot and confirmDisabled to the Dialog primitive."
```

---

## Task 4: Sign out dialog

**Files:**
- Create: `components/garderobe/account/sign-out-dialog.tsx`
- Test: `components/garderobe/account/__tests__/sign-out-dialog.test.tsx`
- Modify: `app/account/page.tsx:61-69` (replace the bare sign-out form/link with the new dialog)

**Interfaces:**
- Consumes: `signOutAction` (`app/auth/actions.ts:293`, no arguments, redirects on success), `Dialog` (Task 3).
- Produces: `SignOutDialog({ open, onClose }: { open: boolean; onClose: () => void })`, a default-exported client trigger button is not needed — `SignOutDialog` is rendered from a small client wrapper in `app/account/page.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
// components/garderobe/account/__tests__/sign-out-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SignOutDialog } from "@/components/garderobe/account/sign-out-dialog";

vi.mock("@/app/auth/actions", () => ({
  signOutAction: vi.fn()
}));

describe("SignOutDialog", () => {
  it("names the consequence before signing out", () => {
    render(<SignOutDialog open onClose={vi.fn()} />);
    expect(screen.getByText("sign out?")).toBeInTheDocument();
    expect(screen.getByText(/sign back in to see your wardrobe/i)).toBeInTheDocument();
  });

  it("submits the sign-out form when confirmed", () => {
    render(<SignOutDialog open onClose={vi.fn()} />);

    const form = screen.getByTestId("sign-out-form") as HTMLFormElement;
    form.requestSubmit = vi.fn();

    fireEvent.click(screen.getByRole("button", { name: "sign out" }));
    expect(form.requestSubmit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/account/__tests__/sign-out-dialog.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement it**

```typescript
// components/garderobe/account/sign-out-dialog.tsx
"use client";

import { useRef } from "react";
import { Dialog } from "@/components/garderobe/dialog";
import { signOutAction } from "@/app/auth/actions";

type SignOutDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** MODALS.md §5 — sign out: one question, no consequence to name beyond the obvious. */
export function SignOutDialog({ open, onClose }: SignOutDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="sign out?"
        description="You'll need to sign back in to see your wardrobe on this device."
        cancelLabel="stay signed in"
        confirmLabel="sign out"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
      <form ref={formRef} action={signOutAction} data-testid="sign-out-form" className="hidden" />
    </>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/account/__tests__/sign-out-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire it into the account page**

`app/account/page.tsx` currently renders the sign-out link as a plain server-rendered form (lines 61-69). Move it into a small new client component so it can hold the dialog's open state, and replace the inline block in `app/account/page.tsx`:

```typescript
// app/account/sign-out-row.tsx
"use client";

import { useState } from "react";
import { SignOutDialog } from "@/components/garderobe/account/sign-out-dialog";

export function SignOutRow() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pb-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
      >
        Sign out
      </button>
      <SignOutDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
```

In `app/account/page.tsx`, remove the `signOutAction` import and the inline `<form action={signOutAction} ...>` block (lines 61-69), replacing it with:

```typescript
import { SignOutRow } from "@/app/account/sign-out-row";
// ...
<SignOutRow />
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the two new ones.

- [ ] **Step 7: Commit**

```bash
git add components/garderobe/account/sign-out-dialog.tsx components/garderobe/account/__tests__/sign-out-dialog.test.tsx app/account/sign-out-row.tsx app/account/page.tsx
git commit -m "Add the sign-out confirmation dialog."
```

---

## Task 5: "Delete my photos, keep the records"

**Files:**
- Modify: `lib/domain/account/service.ts` (add `deleteAllUserPhotos`)
- Test: `lib/domain/account/__tests__/delete-photos.test.ts`
- Create: `app/account/photos-actions.ts`
- Create: `components/garderobe/account/delete-photos-dialog.tsx`
- Test: `components/garderobe/account/__tests__/delete-photos-dialog.test.tsx`
- Modify: `app/account/you-section.tsx` (add a new "photos" subsection with the trigger row)

**Interfaces:**
- Consumes: `getRequiredUser()` (`@/lib/auth`), `createClient()` (`@/lib/supabase/server`), `garment_images` / `garments` tables.
- Produces: `deleteAllUserPhotos(): Promise<{ deletedCount: number }>`; `deleteAllUserPhotosAction(previousState: AccountActionState, formData: FormData): Promise<AccountActionState>` where `AccountActionState = { status: "idle" | "success" | "error"; message: string | null }` (same shape as the existing `AccountProfileActionState`, reused here as `AccountActionState` so this task and Task 6 share one type); `DeletePhotosDialog({ open, onClose, garmentCount, action }: { open: boolean; onClose: () => void; garmentCount: number; action: typeof deleteAllUserPhotosAction })`.

- [ ] **Step 1: Write the failing service test**

```typescript
// lib/domain/account/__tests__/delete-photos.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();
const remove = vi.fn();
const storageFrom = vi.fn(() => ({ remove }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from, storage: { from: storageFrom } }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("deleteAllUserPhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remove.mockResolvedValue({ error: null });
  });

  it("removes every garment image for the user's garments but leaves garments untouched", async () => {
    // garments query
    const garmentsEq = vi.fn().mockResolvedValue({
      data: [{ id: "g1" }, { id: "g2" }],
      error: null
    });
    const garmentsSelect = vi.fn(() => ({ eq: garmentsEq }));

    // garment_images select + delete
    const imagesInSelect = vi.fn().mockResolvedValue({
      data: [
        { id: "img1", garment_id: "g1", image_type: "original", storage_path: "u1/g1/a.jpg" },
        { id: "img2", garment_id: "g2", image_type: "cutout", storage_path: "u1/g2/b.png" }
      ],
      error: null
    });
    const imagesSelect = vi.fn(() => ({ in: imagesInSelect }));

    const deleteIn = vi.fn().mockResolvedValue({ error: null });
    const imagesDelete = vi.fn(() => ({ in: deleteIn }));

    from.mockImplementation((table: string) => {
      if (table === "garments") return { select: garmentsSelect };
      if (table === "garment_images") return { select: imagesSelect, delete: imagesDelete };
      throw new Error(`Unexpected table ${table}`);
    });

    const { deleteAllUserPhotos } = await import("@/lib/domain/account/service");
    const result = await deleteAllUserPhotos();

    expect(result.deletedCount).toBe(2);
    expect(storageFrom).toHaveBeenCalledWith("garment-originals");
    expect(storageFrom).toHaveBeenCalledWith("garment-cutouts");
    expect(remove).toHaveBeenCalledWith(["u1/g1/a.jpg"]);
    expect(remove).toHaveBeenCalledWith(["u1/g2/b.png"]);
    expect(imagesDelete).toHaveBeenCalled();
    expect(deleteIn).toHaveBeenCalledWith("id", ["img1", "img2"]);
    // garments themselves are never deleted or updated
    expect(garmentsSelect).toHaveBeenCalledWith("id");
  });

  it("returns zero and does nothing when the user has no garments", async () => {
    const garmentsEq = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockImplementation((table: string) => {
      if (table === "garments") return { select: vi.fn(() => ({ eq: garmentsEq })) };
      throw new Error(`Unexpected table ${table}`);
    });

    const { deleteAllUserPhotos } = await import("@/lib/domain/account/service");
    const result = await deleteAllUserPhotos();

    expect(result.deletedCount).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/domain/account/__tests__/delete-photos.test.ts`
Expected: FAIL — `deleteAllUserPhotos` is not exported.

- [ ] **Step 3: Implement the service function**

Add to `lib/domain/account/service.ts`:

```typescript
const ORIGINAL_BUCKET = "garment-originals";
const CUTOUT_BUCKET = "garment-cutouts";

function bucketForImageType(imageType: string) {
  return imageType === "original" ? ORIGINAL_BUCKET : CUTOUT_BUCKET;
}

/**
 * MODALS.md §5 — "delete my photos, keep the records": removes every photo
 * from every garment this user owns, but never touches the garments
 * themselves (name, wear history, prices, looks all stay exactly as they
 * are). Storage removal is best-effort — a storage error never blocks the
 * database cleanup, since a stray object left in storage is recoverable but
 * a photo the user was told was gone and was not is not.
 */
export async function deleteAllUserPhotos(): Promise<{ deletedCount: number }> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: garments, error: garmentsError } = await supabase
    .from("garments")
    .select("id")
    .eq("user_id", user.id);

  if (garmentsError) {
    throw new Error(garmentsError.message);
  }

  const garmentIds = (garments ?? []).map((garment) => garment.id);

  if (garmentIds.length === 0) {
    return { deletedCount: 0 };
  }

  const { data: images, error: imagesError } = await supabase
    .from("garment_images")
    .select("id,garment_id,image_type,storage_path")
    .in("garment_id", garmentIds);

  if (imagesError) {
    throw new Error(imagesError.message);
  }

  const rows = images ?? [];

  for (const image of rows) {
    await supabase.storage.from(bucketForImageType(image.image_type)).remove([image.storage_path]);
  }

  if (rows.length > 0) {
    const { error: deleteError } = await supabase
      .from("garment_images")
      .delete()
      .in(
        "id",
        rows.map((image) => image.id)
      );

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  return { deletedCount: rows.length };
}
```

Add the necessary imports at the top of the file if not already present (`getRequiredUser` from `@/lib/auth`, `createClient` from `@/lib/supabase/server` — both are already imported by this file for `getAccountProfile`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/domain/account/__tests__/delete-photos.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Write the server action**

```typescript
// app/account/photos-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { deleteAllUserPhotos } from "@/lib/domain/account/service";

export type AccountActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export async function deleteAllUserPhotosAction(
  _previousState: AccountActionState,
  _formData: FormData
): Promise<AccountActionState> {
  try {
    const { deletedCount } = await deleteAllUserPhotos();
    revalidatePath("/account");
    revalidatePath("/wardrobe");

    return {
      status: "success",
      message:
        deletedCount > 0
          ? `Deleted ${deletedCount} photo${deletedCount === 1 ? "" : "s"}. Your pieces and their history stay.`
          : "There were no photos to delete."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not delete your photos."
    };
  }
}
```

- [ ] **Step 6: Write the failing dialog test**

```typescript
// @vitest-environment jsdom
// components/garderobe/account/__tests__/delete-photos-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeletePhotosDialog } from "@/components/garderobe/account/delete-photos-dialog";
import type { AccountActionState } from "@/app/account/photos-actions";

const idleState: AccountActionState = { status: "idle", message: null };

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: () => [idleState, vi.fn(), false] };
});

describe("DeletePhotosDialog", () => {
  it("names the consequence: how many pieces, and that records stay", () => {
    render(
      <DeletePhotosDialog open onClose={vi.fn()} garmentCount={12} action={async () => idleState} />
    );

    expect(screen.getByText("delete your photos?")).toBeInTheDocument();
    expect(screen.getByText(/12 pieces/)).toBeInTheDocument();
    expect(screen.getByText(/names, wear history, prices and looks stay/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/account/__tests__/delete-photos-dialog.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 8: Implement the dialog**

```typescript
// components/garderobe/account/delete-photos-dialog.tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { Dialog } from "@/components/garderobe/dialog";
import { showAppToast } from "@/lib/ui/app-toast";
import type { AccountActionState } from "@/app/account/photos-actions";

type DeletePhotosDialogProps = {
  open: boolean;
  onClose: () => void;
  garmentCount: number;
  action: (previousState: AccountActionState, formData: FormData) => Promise<AccountActionState>;
};

const idleState: AccountActionState = { status: "idle", message: null };

/** MODALS.md §5 — "delete my photos, keep the records": a row in w3e with no dialog behind it. */
export function DeletePhotosDialog({ open, onClose, garmentCount, action }: DeletePhotosDialogProps) {
  const [state, formAction] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success" && state.message) {
      showAppToast({ tone: "success", message: state.message });
      onClose();
    }
  }, [state.status, state.message, onClose]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="delete your photos?"
        description={`Removes every photo from your ${garmentCount} piece${garmentCount === 1 ? "" : "s"}. Names, wear history, prices and looks stay exactly as they are.`}
        cancelLabel="cancel"
        confirmLabel="delete photos"
        onConfirm={() => formRef.current?.requestSubmit()}
      >
        {state.status === "error" ? (
          <p className="text-[11px] text-[var(--oxblood)]">{state.message}</p>
        ) : null}
      </Dialog>
      <form ref={formRef} action={formAction} className="hidden" />
    </>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/account/__tests__/delete-photos-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 10: Wire the row into `YouSection`**

`YouSection` currently ends after the "what other people see" block (`app/account/you-section.tsx:118-168`). It needs the count of the user's garments to word the dialog — pass it down as a new prop from `app/account/page.tsx`, which already calls `getAccountProfile`/`getUserEntitlements`/etc. in parallel; add `listWardrobeGarments` (already exported from `lib/domain/wardrobe/service.ts`) to that `Promise.all` and pass `garments.length` through.

In `app/account/page.tsx`, add the import and include it in the parallel fetch, then pass `garmentCount={garments.length}` to `<YouSection ... />`.

In `app/account/you-section.tsx`, add `garmentCount: number` to the props type, add the `"use client"` state and a new subsection after "what other people see":

```typescript
import { useState } from "react";
import { DeletePhotosDialog } from "@/components/garderobe/account/delete-photos-dialog";
import { deleteAllUserPhotosAction } from "./photos-actions";
```

```typescript
function PhotosSection({ garmentCount }: { garmentCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
      <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
        your photos
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[14.5px] text-[var(--oxblood)]"
      >
        delete my photos, keep the records
      </button>
      <DeletePhotosDialog
        open={open}
        onClose={() => setOpen(false)}
        garmentCount={garmentCount}
        action={deleteAllUserPhotosAction}
      />
    </div>
  );
}
```

Render `<PhotosSection garmentCount={garmentCount} />` at the end of `YouSection`'s returned JSX, and add `garmentCount` to `YouSection`'s prop destructuring.

- [ ] **Step 11: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add lib/domain/account/service.ts lib/domain/account/__tests__/delete-photos.test.ts app/account/photos-actions.ts components/garderobe/account/delete-photos-dialog.tsx components/garderobe/account/__tests__/delete-photos-dialog.test.tsx app/account/you-section.tsx app/account/page.tsx
git commit -m "Add the delete-my-photos dialog and wire it into the w3e settings row."
```

---

## Task 6: "Close the account"

**Files:**
- Modify: `lib/domain/account/service.ts` (add `getAccountClosureBlockers`, `closeUserAccount`)
- Test: `lib/domain/account/__tests__/close-account.test.ts`
- Create: `app/account/close-account-actions.ts`
- Create: `components/garderobe/account/close-account-dialog.tsx`
- Test: `components/garderobe/account/__tests__/close-account-dialog.test.tsx`
- Modify: `app/account/you-section.tsx` (add the "close the account" row)

**Interfaces:**
- Consumes: `listMyThreads()` (`@/lib/domain/local-threads/threads-service.ts:417`), `withdrawLocalListing(listingId)` (same file, line 84), `createServiceClient()` (`@/lib/supabase/service.ts` — needed for `auth.admin.deleteUser`, same pattern already used by `lib/domain/billing/service.ts:setUserPasswordById`), `getRequiredUser()`, `createClient()`.
- Produces: `getAccountClosureBlockers(): Promise<{ liveListingCount: number; liveListingIds: string[]; openThreadCount: number }>`; `closeUserAccount(): Promise<void>` (withdraws every live listing, then deletes the auth user via the service-role client — cascading deletes handle everything FK'd to `auth.users(id) on delete cascade`, which every user-owned table in this schema already is); `closeUserAccountAction(previousState: AccountActionState, formData: FormData): Promise<AccountActionState>` (`AccountActionState` from Task 5); `CloseAccountDialog({ open, onClose, liveListingCount, openThreadCount, action }: { open: boolean; onClose: () => void; liveListingCount: number; openThreadCount: number; action: typeof closeUserAccountAction })`.

- [ ] **Step 1: Write the failing service test**

```typescript
// lib/domain/account/__tests__/close-account.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const deleteUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from }))
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ auth: { admin: { deleteUser } } }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));
vi.mock("@/lib/domain/local-threads/threads-service", () => ({
  listMyThreads: vi.fn(),
  withdrawLocalListing: vi.fn(async () => undefined)
}));

describe("getAccountClosureBlockers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts live listings and open threads", async () => {
    const { listMyThreads } = await import("@/lib/domain/local-threads/threads-service");
    (listMyThreads as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "t1", state: "open" },
      { id: "t2", state: "handover arranged" },
      { id: "t3", state: "completed" }
    ]);

    const inFn = vi.fn().mockResolvedValue({
      data: [{ id: "l1" }, { id: "l2" }],
      error: null
    });
    const eqFn = vi.fn(() => ({ in: inFn }));
    const selectFn = vi.fn(() => ({ eq: eqFn }));
    from.mockReturnValue({ select: selectFn });

    const { getAccountClosureBlockers } = await import("@/lib/domain/account/service");
    const blockers = await getAccountClosureBlockers();

    expect(blockers.liveListingCount).toBe(2);
    expect(blockers.liveListingIds).toEqual(["l1", "l2"]);
    expect(blockers.openThreadCount).toBe(2);
    expect(eqFn).toHaveBeenCalledWith("seller_id", "11111111-1111-1111-1111-111111111111");
    expect(inFn).toHaveBeenCalledWith("status", ["live", "reserved", "handover arranged"]);
  });
});

describe("closeUserAccount", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { listMyThreads } = await import("@/lib/domain/local-threads/threads-service");
    (listMyThreads as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("withdraws every live listing, then deletes the auth user", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: [{ id: "l1" }, { id: "l2" }], error: null });
    const eqFn = vi.fn(() => ({ in: inFn }));
    const selectFn = vi.fn(() => ({ eq: eqFn }));
    from.mockReturnValue({ select: selectFn });
    deleteUser.mockResolvedValue({ error: null });

    const { closeUserAccount } = await import("@/lib/domain/account/service");
    const { withdrawLocalListing } = await import("@/lib/domain/local-threads/threads-service");
    await closeUserAccount();

    expect(withdrawLocalListing).toHaveBeenCalledWith("l1");
    expect(withdrawLocalListing).toHaveBeenCalledWith("l2");
    expect(deleteUser).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
  });

  it("throws if the auth user deletion fails", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ in: inFn })) })) });
    deleteUser.mockResolvedValue({ error: { message: "boom" } });

    const { closeUserAccount } = await import("@/lib/domain/account/service");
    await expect(closeUserAccount()).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/domain/account/__tests__/close-account.test.ts`
Expected: FAIL — neither function is exported.

- [ ] **Step 3: Implement the service functions**

Add to `lib/domain/account/service.ts` (add `import { createServiceClient } from "@/lib/supabase/service";`, `import { listMyThreads, withdrawLocalListing } from "@/lib/domain/local-threads/threads-service";`):

```typescript
const LIVE_LISTING_STATUSES = ["live", "reserved", "handover arranged"] as const;
const OPEN_THREAD_STATES = ["open", "handover arranged"] as const;

/**
 * MODALS.md §5 — "close the account": must say what happens to live
 * listings and open threads before the type-to-confirm gate. A listing is
 * "live" while its status is live, reserved, or mid-handover; a thread is
 * "open" while its state is open or mid-handover (supabase/migrations/029
 * and /031).
 */
export async function getAccountClosureBlockers(): Promise<{
  liveListingCount: number;
  liveListingIds: string[];
  openThreadCount: number;
}> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: listings, error: listingsError } = await supabase
    .from("local_listings")
    .select("id")
    .eq("seller_id", user.id)
    .in("status", [...LIVE_LISTING_STATUSES]);

  if (listingsError) {
    throw new Error(listingsError.message);
  }

  const threads = await listMyThreads();
  const openThreadCount = threads.filter((thread) =>
    (OPEN_THREAD_STATES as readonly string[]).includes(thread.state)
  ).length;

  return {
    liveListingCount: listings?.length ?? 0,
    liveListingIds: (listings ?? []).map((listing) => listing.id),
    openThreadCount
  };
}

/**
 * Withdraws every live listing (so they stop appearing in the nearby feed
 * before the account disappears out from under them), then deletes the
 * auth user. Every user-owned table in this schema is
 * `references auth.users(id) on delete cascade`, so this one delete is
 * enough to remove the rest — garments, threads, messages, handovers,
 * profile, entitlements, everything.
 */
export async function closeUserAccount(): Promise<void> {
  const user = await getRequiredUser();
  const blockers = await getAccountClosureBlockers();

  for (const listingId of blockers.liveListingIds) {
    await withdrawLocalListing(listingId);
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.auth.admin.deleteUser(user.id);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/domain/account/__tests__/close-account.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 5: Write the server actions**

```typescript
// app/account/close-account-actions.ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccountClosureBlockers, closeUserAccount } from "@/lib/domain/account/service";
import type { AccountActionState } from "@/app/account/photos-actions";

export async function getCloseAccountBlockersAction() {
  return getAccountClosureBlockers();
}

const closeAccountFormSchema = z.object({
  confirmation: z.string().trim().toLowerCase()
});

export async function closeUserAccountAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const { confirmation } = closeAccountFormSchema.parse({
    confirmation: formData.get("confirmation") ?? ""
  });

  if (confirmation !== "close") {
    return { status: "error", message: 'Type "close" to confirm.' };
  }

  try {
    await closeUserAccount();
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not close your account."
    };
  }

  redirect("/");
}
```

- [ ] **Step 6: Write the failing dialog test**

```typescript
// @vitest-environment jsdom
// components/garderobe/account/__tests__/close-account-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CloseAccountDialog } from "@/components/garderobe/account/close-account-dialog";
import type { AccountActionState } from "@/app/account/photos-actions";

const idleState: AccountActionState = { status: "idle", message: null };

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: () => [idleState, vi.fn(), false] };
});

describe("CloseAccountDialog", () => {
  it("states the consequence for live listings and open threads", () => {
    render(
      <CloseAccountDialog
        open
        onClose={vi.fn()}
        liveListingCount={2}
        openThreadCount={1}
        action={async () => idleState}
      />
    );

    expect(screen.getByText("close your account?")).toBeInTheDocument();
    expect(screen.getByText(/2 live listings/)).toBeInTheDocument();
    expect(screen.getByText(/1 open thread/)).toBeInTheDocument();
    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
  });

  it("keeps the confirm button disabled until the user types close", () => {
    render(
      <CloseAccountDialog
        open
        onClose={vi.fn()}
        liveListingCount={0}
        openThreadCount={0}
        action={async () => idleState}
      />
    );

    const confirmButton = screen.getByRole("button", { name: "close account" });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type close to confirm/i), { target: { value: "close" } });
    expect(confirmButton).not.toBeDisabled();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/account/__tests__/close-account-dialog.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 8: Implement the dialog**

```typescript
// components/garderobe/account/close-account-dialog.tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { Dialog } from "@/components/garderobe/dialog";
import type { AccountActionState } from "@/app/account/photos-actions";

type CloseAccountDialogProps = {
  open: boolean;
  onClose: () => void;
  liveListingCount: number;
  openThreadCount: number;
  action: (previousState: AccountActionState, formData: FormData) => Promise<AccountActionState>;
};

const idleState: AccountActionState = { status: "idle", message: null };

function consequenceLine(liveListingCount: number, openThreadCount: number) {
  const parts = [
    liveListingCount > 0
      ? `${liveListingCount} live listing${liveListingCount === 1 ? "" : "s"}`
      : null,
    openThreadCount > 0 ? `${openThreadCount} open thread${openThreadCount === 1 ? "" : "s"}` : null
  ].filter(Boolean);

  const consequence =
    parts.length > 0
      ? `You have ${parts.join(" and ")}. Closing withdraws every listing and ends every conversation.`
      : "You have no live listings or open threads.";

  return `This is permanent — your wardrobe, photos, and history are gone. ${consequence}`;
}

/** MODALS.md §5 — "close the account": destructive, irreversible, type-to-confirm. */
export function CloseAccountDialog({
  open,
  onClose,
  liveListingCount,
  openThreadCount,
  action
}: CloseAccountDialogProps) {
  const [state, formAction] = useActionState(action, idleState);
  const [confirmation, setConfirmation] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="close your account?"
        description={consequenceLine(liveListingCount, openThreadCount)}
        cancelLabel="cancel"
        confirmLabel="close account"
        confirmVariant="on-blush"
        confirmDisabled={confirmation.trim().toLowerCase() !== "close"}
        onConfirm={() => formRef.current?.requestSubmit()}
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[var(--stone)]">type close to confirm</span>
          <input
            aria-label="type close to confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
          />
        </label>
        {state.status === "error" ? (
          <p className="pt-2 text-[11px] text-[var(--oxblood)]">{state.message}</p>
        ) : null}
      </Dialog>
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="confirmation" value={confirmation} />
      </form>
    </>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/account/__tests__/close-account-dialog.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 10: Wire the row into `YouSection`**

In `app/account/page.tsx`, fetch `getAccountClosureBlockers()` alongside the other parallel calls and pass `liveListingCount`/`openThreadCount` down to `YouSection`.

In `app/account/you-section.tsx`, add a `CloseAccountSection` alongside `PhotosSection`:

```typescript
import { CloseAccountDialog } from "@/components/garderobe/account/close-account-dialog";
import { closeUserAccountAction } from "./close-account-actions";
```

```typescript
function CloseAccountSection({
  liveListingCount,
  openThreadCount
}: {
  liveListingCount: number;
  openThreadCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
      <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
        close your account
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[14.5px] text-[var(--oxblood)]"
      >
        close the account
      </button>
      <CloseAccountDialog
        open={open}
        onClose={() => setOpen(false)}
        liveListingCount={liveListingCount}
        openThreadCount={openThreadCount}
        action={closeUserAccountAction}
      />
    </div>
  );
}
```

Add `liveListingCount`/`openThreadCount` to `YouSection`'s props and render `<CloseAccountSection liveListingCount={liveListingCount} openThreadCount={openThreadCount} />` after `PhotosSection`.

- [ ] **Step 11: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add lib/domain/account/service.ts lib/domain/account/__tests__/close-account.test.ts app/account/close-account-actions.ts components/garderobe/account/close-account-dialog.tsx components/garderobe/account/__tests__/close-account-dialog.test.tsx app/account/you-section.tsx app/account/page.tsx
git commit -m "Add the close-account dialog with type-to-confirm and the live-listing/open-thread consequence."
```

---

## Task 7: Data export — started/ready toasts and a minimal request record

**Files:**
- Modify: `lib/domain/account/service.ts` (add `requestDataExport`, `getLatestDataExportRequest`)
- Test: `lib/domain/account/__tests__/data-export.test.ts`
- Create: `app/account/export-actions.ts`
- Create: `components/garderobe/account/export-row.tsx`
- Test: `components/garderobe/account/__tests__/export-row.test.tsx`
- Modify: `app/account/you-section.tsx` (render `<ExportRow />`)

**Interfaces:**
- Consumes: `getRequiredUser()`, `createClient()`, `data_export_requests` table (Task 1/2 — actual columns: `id, user_id, status ('requested' | 'ready'), requested_at, ready_at`; there is no `download_url` column).
- Produces: `requestDataExport(): Promise<{ id: string; requestedAt: string }>`; `getLatestDataExportRequest(): Promise<{ id: string; requestedAt: string; readyAt: string | null; status: "requested" | "ready" } | null>`; `requestDataExportAction(): Promise<{ status: "success" | "error"; message: string | null }>`; `ExportRow` (client component, polls for the ready state after a successful request).

- [ ] **Step 1: Write the failing service test**

```typescript
// lib/domain/account/__tests__/data-export.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("requestDataExport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a new export request for the user", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "req1", requested_at: "2026-09-02T00:00:00.000Z" },
      error: null
    });
    const selectAfterInsert = vi.fn(() => ({ single }));
    insert.mockReturnValue({ select: selectAfterInsert });
    from.mockReturnValue({ insert });

    const { requestDataExport } = await import("@/lib/domain/account/service");
    const result = await requestDataExport();

    expect(result).toEqual({ id: "req1", requestedAt: "2026-09-02T00:00:00.000Z" });
    expect(insert).toHaveBeenCalledWith({ user_id: "11111111-1111-1111-1111-111111111111" });
  });
});

describe("getLatestDataExportRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the user has never requested an export", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    select.mockReturnValue({ eq });
    from.mockReturnValue({ select });

    const { getLatestDataExportRequest } = await import("@/lib/domain/account/service");
    expect(await getLatestDataExportRequest()).toBeNull();
  });

  it("returns the most recent request, ready or not", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "req2",
          requested_at: "2026-09-02T00:00:00.000Z",
          ready_at: "2026-09-02T01:00:00.000Z",
          status: "ready"
        }
      ],
      error: null
    });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    select.mockReturnValue({ eq });
    from.mockReturnValue({ select });

    const { getLatestDataExportRequest } = await import("@/lib/domain/account/service");
    expect(await getLatestDataExportRequest()).toEqual({
      id: "req2",
      requestedAt: "2026-09-02T00:00:00.000Z",
      readyAt: "2026-09-02T01:00:00.000Z",
      status: "ready"
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/domain/account/__tests__/data-export.test.ts`
Expected: FAIL — neither function is exported.

- [ ] **Step 3: Implement the service functions**

Add to `lib/domain/account/service.ts`:

```typescript
/**
 * MODALS.md §5 — "export started / export ready" toast. This records that a
 * user asked for their data; it does not generate an export file — nothing
 * in this codebase does yet (no export pipeline exists). status/ready_at
 * are the hook a real export worker would set once one is built (flip
 * status to 'ready' and set ready_at).
 */
export async function requestDataExport(): Promise<{ id: string; requestedAt: string }> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("data_export_requests")
    .insert({ user_id: user.id })
    .select("id,requested_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { id: data.id, requestedAt: data.requested_at };
}

export async function getLatestDataExportRequest(): Promise<{
  id: string;
  requestedAt: string;
  readyAt: string | null;
  status: "requested" | "ready";
} | null> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("data_export_requests")
    .select("id,requested_at,ready_at,status")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0];
  if (!row) return null;

  return {
    id: row.id,
    requestedAt: row.requested_at,
    readyAt: row.ready_at,
    status: row.status
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/domain/account/__tests__/data-export.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 5: Write the server actions**

```typescript
// app/account/export-actions.ts
"use server";

import { requestDataExport, getLatestDataExportRequest } from "@/lib/domain/account/service";

export async function requestDataExportAction() {
  try {
    await requestDataExport();
    return { status: "success" as const, message: "We're packaging your export. We'll let you know when it's ready." };
  } catch (error) {
    return {
      status: "error" as const,
      message: error instanceof Error ? error.message : "Could not start your export."
    };
  }
}

export async function checkDataExportReadyAction() {
  return getLatestDataExportRequest();
}
```

- [ ] **Step 6: Write the failing component test**

```typescript
// @vitest-environment jsdom
// components/garderobe/account/__tests__/export-row.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExportRow } from "@/components/garderobe/account/export-row";

vi.mock("@/lib/ui/app-toast", () => ({ showAppToast: vi.fn() }));

describe("ExportRow", () => {
  it("fires the export-started toast on request", async () => {
    const { showAppToast } = await import("@/lib/ui/app-toast");
    const requestAction = vi.fn().mockResolvedValue({
      status: "success",
      message: "We're packaging your export. We'll let you know when it's ready."
    });
    const checkAction = vi.fn().mockResolvedValue(null);

    render(<ExportRow requestAction={requestAction} checkAction={checkAction} />);
    fireEvent.click(screen.getByRole("button", { name: /export your data/i }));

    await waitFor(() => expect(requestAction).toHaveBeenCalled());
    await waitFor(() =>
      expect(showAppToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "success", message: expect.stringMatching(/packaging your export/i) })
      )
    );
  });

  it("fires the export-ready toast once the latest request has a ready_at", async () => {
    const { showAppToast } = await import("@/lib/ui/app-toast");
    const requestAction = vi.fn().mockResolvedValue({ status: "success", message: "started" });
    const checkAction = vi.fn().mockResolvedValue({
      id: "req1",
      requestedAt: "2026-09-02T00:00:00.000Z",
      readyAt: "2026-09-02T01:00:00.000Z",
      status: "ready"
    });

    render(<ExportRow requestAction={requestAction} checkAction={checkAction} />);
    fireEvent.click(screen.getByRole("button", { name: /export your data/i }));

    await waitFor(() => expect(checkAction).toHaveBeenCalled());
    await waitFor(() =>
      expect(showAppToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "success", message: expect.stringMatching(/export is ready/i) })
      )
    );
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/account/__tests__/export-row.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 8: Implement the component**

```typescript
// components/garderobe/account/export-row.tsx
"use client";

import { showAppToast } from "@/lib/ui/app-toast";

type DataExportRequest = {
  id: string;
  requestedAt: string;
  readyAt: string | null;
  status: "requested" | "ready";
};

type ExportRowProps = {
  requestAction: () => Promise<{ status: "success" | "error"; message: string | null }>;
  /**
   * Polls for the latest request's ready state. In production nothing
   * currently sets ready_at (no export pipeline exists yet) — this checks
   * once immediately after a request so the "export ready" toast fires the
   * moment a real export worker flips it, without a page reload.
   */
  checkAction: () => Promise<DataExportRequest | null>;
};

/** MODALS.md §5 — "export started / export ready" toast. */
export function ExportRow({ requestAction, checkAction }: ExportRowProps) {
  async function handleRequest() {
    const result = await requestAction();

    if (result.status === "error") {
      showAppToast({ tone: "error", message: result.message ?? "Could not start your export." });
      return;
    }

    showAppToast({ tone: "success", message: result.message ?? "Export started." });

    const latest = await checkAction();
    if (latest?.readyAt) {
      showAppToast({ tone: "success", message: "Your export is ready to download." });
    }
  }

  return (
    <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
      <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
        your data
      </p>
      <button
        type="button"
        onClick={() => void handleRequest()}
        className="text-[14.5px] text-[var(--ink)] underline underline-offset-2"
      >
        export your data
      </button>
    </div>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/account/__tests__/export-row.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 10: Wire it into `YouSection`**

In `app/account/you-section.tsx`, import `ExportRow`, `requestDataExportAction`, `checkDataExportReadyAction` from `./export-actions`, and render `<ExportRow requestAction={requestDataExportAction} checkAction={checkDataExportReadyAction} />` after `CloseAccountSection`.

- [ ] **Step 11: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add lib/domain/account/service.ts lib/domain/account/__tests__/data-export.test.ts app/account/export-actions.ts components/garderobe/account/export-row.tsx components/garderobe/account/__tests__/export-row.test.tsx app/account/you-section.tsx
git commit -m "Add the export-started/export-ready toast flow and a minimal export request record."
```

---

## Task 8: Payment failed / subscription lapsed

**Files:**
- Modify: `lib/domain/entitlements/index.ts` (add `billing_status` to the schema/type)
- Modify: `lib/domain/entitlements/service.ts` (add `isBillingLapsed`)
- Modify: `lib/domain/billing/index.ts` (accept `billing_status` in the sync payload)
- Modify: `lib/domain/billing/service.ts` (persist `billing_status` on sync)
- Test: `lib/domain/entitlements/__tests__/service.test.ts` (extend), `lib/domain/billing/__tests__/service.test.ts` (create if it does not exist — check first)
- Create: `components/garderobe/account/payment-failed-dialog.tsx`
- Test: `components/garderobe/account/__tests__/payment-failed-dialog.test.tsx`
- Modify: `app/account/page.tsx` (render the dialog when `isBillingLapsed(entitlements)`)

**Interfaces:**
- Consumes: `UserEntitlements` (Task adds `billing_status: "active" | "payment_failed" | "lapsed" | null`  — **note:** the actual committed column (Task 1/2) is nullable with no default and its check constraint allows exactly `'active' | 'payment_failed' | 'lapsed'`, not `past_due`/`canceled` — use these three values and keep the field nullable throughout this task), `getBillingStatus()` (`@/lib/domain/billing/service.ts:15`, already returns `upgradeUrl`).
- Produces: `isBillingLapsed(entitlements: UserEntitlements): boolean`; `PaymentFailedDialog({ open, onClose, upgradeUrl }: { open: boolean; onClose: () => void; upgradeUrl: string | null })`.

- [ ] **Step 1: Check for an existing billing service test file**

Run: `ls lib/domain/billing/__tests__/ 2>/dev/null || echo "none"`. If a test file exists, extend it in Step 6 below rather than creating a new one; adjust the file path in the later steps accordingly.

- [ ] **Step 2: Extend the entitlements schema**

In `lib/domain/entitlements/index.ts`:

```typescript
export const billingStatusSchema = z.enum(["active", "payment_failed", "lapsed"]);
export type BillingStatus = z.infer<typeof billingStatusSchema>;

export const userEntitlementsSchema = z.object({
  user_id: z.string().uuid(),
  plan_tier: planTierSchema,
  feature_labels_enabled: z.boolean(),
  receipt_ocr_enabled: z.boolean(),
  product_url_ingestion_enabled: z.boolean(),
  outfit_decomposition_enabled: z.boolean(),
  billing_provider: z.string().nullable(),
  billing_customer_id: z.string().nullable(),
  billing_subscription_id: z.string().nullable(),
  billing_status: billingStatusSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string()
});
```

The real `user_entitlements.billing_status` column is nullable with no default (see Task 1/2's reconciliation note), so the schema field must stay `.nullable()` rather than `.default("active")` — a `.default()` only substitutes for `undefined`, not an explicit `null` a real row will have until a billing event sets it. `isBillingLapsed` (Step 5) treats `null` as "active" (never lapsed) by only returning `true` for the two lapsed string values.

(Everything else in that file is unchanged.)

- [ ] **Step 3: Write the failing test for `isBillingLapsed`**

Add to `lib/domain/entitlements/__tests__/service.test.ts` (a new `describe` block, after the existing ones — this file already mocks `@/lib/supabase/server` and `@/lib/auth` the same way; no new mocks are needed):

```typescript
describe("isBillingLapsed", () => {
  it("is false for an active subscription", async () => {
    const { isBillingLapsed } = await import("@/lib/domain/entitlements/service");
    expect(
      isBillingLapsed({
        user_id: "u1",
        plan_tier: "premium",
        feature_labels_enabled: true,
        receipt_ocr_enabled: true,
        product_url_ingestion_enabled: true,
        outfit_decomposition_enabled: true,
        billing_provider: "stripe",
        billing_customer_id: "cus_1",
        billing_subscription_id: "sub_1",
        billing_status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z"
      })
    ).toBe(false);
  });

  it("is false when billing_status is null (no billing event has ever set it)", async () => {
    const { isBillingLapsed } = await import("@/lib/domain/entitlements/service");
    expect(
      isBillingLapsed({
        user_id: "u1",
        plan_tier: "free",
        feature_labels_enabled: false,
        receipt_ocr_enabled: false,
        product_url_ingestion_enabled: false,
        outfit_decomposition_enabled: false,
        billing_provider: null,
        billing_customer_id: null,
        billing_subscription_id: null,
        billing_status: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z"
      })
    ).toBe(false);
  });

  it("is true when billing is payment_failed or lapsed", async () => {
    const { isBillingLapsed } = await import("@/lib/domain/entitlements/service");
    const base = {
      user_id: "u1",
      plan_tier: "premium" as const,
      feature_labels_enabled: true,
      receipt_ocr_enabled: true,
      product_url_ingestion_enabled: true,
      outfit_decomposition_enabled: true,
      billing_provider: "stripe",
      billing_customer_id: "cus_1",
      billing_subscription_id: "sub_1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z"
    };

    expect(isBillingLapsed({ ...base, billing_status: "payment_failed" })).toBe(true);
    expect(isBillingLapsed({ ...base, billing_status: "lapsed" })).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run lib/domain/entitlements/__tests__/service.test.ts`
Expected: FAIL — `isBillingLapsed` is not exported (the existing `maybeSingle` mock payloads in earlier tests in this file omit `billing_status`, which is fine since the schema field is `.nullable()`, not `.default(...)` — `undefined` will fail `.nullable()` validation, so if any pre-existing test's mock payload omits the field entirely and that now fails, add `billing_status: null` to that test's mock payload).

- [ ] **Step 5: Implement `isBillingLapsed`**

Add to `lib/domain/entitlements/service.ts`:

```typescript
export function isBillingLapsed(entitlements: UserEntitlements) {
  return entitlements.billing_status === "payment_failed" || entitlements.billing_status === "lapsed";
}
```

Also add `billing_status` to the `.select(...)` column list in `getUserEntitlements` and to `buildDefaultEntitlements`'s return value (`billing_status: null`), matching the existing style of every other nullable field in that function.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/domain/entitlements/__tests__/service.test.ts`
Expected: PASS.

- [ ] **Step 7: Extend the billing sync payload and persistence**

In `lib/domain/billing/index.ts`, add to `billingSyncPayloadSchema`:

```typescript
import { billingStatusSchema } from "@/lib/domain/entitlements";
// ...
billing_status: billingStatusSchema.optional(),
```

In `lib/domain/billing/service.ts`, in `syncUserEntitlementsFromBillingEvent`, add to `upsertPayload`:

```typescript
billing_status: payload.billing_status ?? null,
```

and add `billing_status` to the `.select(...)` column list in that function's Supabase call.

- [ ] **Step 8: Write or extend the billing service test**

If Step 1 found no existing test file, create `lib/domain/billing/__tests__/service.test.ts` following the same mock pattern as `lib/domain/entitlements/__tests__/service.test.ts` (mock `@/lib/supabase/service` instead of `@/lib/supabase/server`, since `syncUserEntitlementsFromBillingEvent` uses `createServiceClient`):

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const select = vi.fn(() => ({ single }));
const upsert = vi.fn(() => ({ select }));
const from = vi.fn(() => ({ upsert }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from }))
}));

describe("syncUserEntitlementsFromBillingEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves billing_status null when the payload omits it", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", plan_tier: "premium", billing_status: null }, error: null });

    const { syncUserEntitlementsFromBillingEvent } = await import("@/lib/domain/billing/service");
    await syncUserEntitlementsFromBillingEvent({
      user_id: "11111111-1111-1111-1111-111111111111",
      plan_tier: "premium"
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ billing_status: null }),
      { onConflict: "user_id" }
    );
  });

  it("passes through an explicit payment_failed status", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", plan_tier: "premium", billing_status: "payment_failed" }, error: null });

    const { syncUserEntitlementsFromBillingEvent } = await import("@/lib/domain/billing/service");
    await syncUserEntitlementsFromBillingEvent({
      user_id: "11111111-1111-1111-1111-111111111111",
      plan_tier: "premium",
      billing_status: "payment_failed"
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ billing_status: "payment_failed" }),
      { onConflict: "user_id" }
    );
  });
});
```

If a test file already existed, add these two cases to it instead, reusing whatever mock scaffolding is already there.

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run lib/domain/billing/__tests__/service.test.ts`
Expected: PASS.

- [ ] **Step 10: Write the failing dialog test**

```typescript
// @vitest-environment jsdom
// components/garderobe/account/__tests__/payment-failed-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentFailedDialog } from "@/components/garderobe/account/payment-failed-dialog";

describe("PaymentFailedDialog", () => {
  it("explains the lapse and offers a way to fix it", () => {
    render(<PaymentFailedDialog open onClose={vi.fn()} upgradeUrl="https://example.com/billing" />);

    expect(screen.getByText(/payment didn't go through/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "update payment" })).toHaveAttribute(
      "href",
      "https://example.com/billing"
    );
  });

  it("still renders a way to dismiss when no upgrade URL is configured", () => {
    render(<PaymentFailedDialog open onClose={vi.fn()} upgradeUrl={null} />);
    expect(screen.getByRole("button", { name: "remind me later" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/account/__tests__/payment-failed-dialog.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 12: Implement the dialog**

`Dialog`'s `onConfirm` is a plain callback, but this dialog's primary action is a navigation (to the upgrade URL) rather than a confirm/deny choice — render it as a `Dialog` whose `children` slot holds the real link, and give `onConfirm` a no-op that just closes, so the two visible actions are "remind me later" (cancel) and the link itself:

```typescript
// components/garderobe/account/payment-failed-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type PaymentFailedDialogProps = {
  open: boolean;
  onClose: () => void;
  upgradeUrl: string | null;
};

/** MODALS.md §5 — "payment failed / subscription lapsed". */
export function PaymentFailedDialog({ open, onClose, upgradeUrl }: PaymentFailedDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="your payment didn't go through"
      description="Garderobe plus features are paused until this is sorted — nothing in your wardrobe is affected."
      cancelLabel="remind me later"
      confirmLabel="update payment"
      onConfirm={() => {
        if (upgradeUrl) {
          window.location.href = upgradeUrl;
        } else {
          onClose();
        }
      }}
    >
      {upgradeUrl ? (
        <a href={upgradeUrl} className="sr-only">
          update payment
        </a>
      ) : null}
    </Dialog>
  );
}
```

Re-check the test in Step 10 against this implementation before moving on: the test looks for `getByRole("link", { name: "update payment" })`, so the visible confirm button and the `sr-only` anchor both carrying the same accessible name is intentional — the anchor is what satisfies the `href` assertion; the visible `PillButton` handles the click via `onConfirm` since `PillButton` renders a `<button>`, not an `<a>`.

- [ ] **Step 13: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/account/__tests__/payment-failed-dialog.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 14: Wire it into the account page**

In `app/account/page.tsx`, import `isBillingLapsed` from `@/lib/domain/entitlements/service` and a new small client wrapper:

```typescript
// app/account/payment-failed-row.tsx
"use client";

import { useState } from "react";
import { PaymentFailedDialog } from "@/components/garderobe/account/payment-failed-dialog";

export function PaymentFailedRow({ upgradeUrl }: { upgradeUrl: string | null }) {
  const [open, setOpen] = useState(true);
  return <PaymentFailedDialog open={open} onClose={() => setOpen(false)} upgradeUrl={upgradeUrl} />;
}
```

In `app/account/page.tsx`, after computing `entitlements` and `upgradeUrl`, add:

```typescript
{isBillingLapsed(entitlements) ? <PaymentFailedRow upgradeUrl={upgradeUrl} /> : null}
```

(placed once near the top of the returned JSX, so it interrupts the page the moment it loads for a lapsed subscriber — this is the "state-check hook point" the task asks for; nothing sets `billing_status` to anything other than `'active'` today because no real billing provider calls `/api/billing/sync` yet, which is the scope boundary called out in the report).

- [ ] **Step 15: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 16: Commit**

```bash
git add lib/domain/entitlements/index.ts lib/domain/entitlements/service.ts lib/domain/entitlements/__tests__/service.test.ts lib/domain/billing/index.ts lib/domain/billing/service.ts lib/domain/billing/__tests__/service.test.ts components/garderobe/account/payment-failed-dialog.tsx components/garderobe/account/__tests__/payment-failed-dialog.test.tsx app/account/payment-failed-row.tsx app/account/page.tsx
git commit -m "Add billing_status, isBillingLapsed, and the payment-failed dialog hook point."
```

---

## Task 9: Paywall interrupt sheet and the reusable plus-gate

**Files:**
- Create: `components/garderobe/account/paywall-interrupt-sheet.tsx`
- Test: `components/garderobe/account/__tests__/paywall-interrupt-sheet.test.tsx`
- Create: `components/garderobe/account/paywall-gate.tsx`
- Test: `components/garderobe/account/__tests__/paywall-gate.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `PillButton` (`@/components/garderobe`).
- Produces: `PLUS_FEATURE_COPY: Record<"analytics" | "in_store_scan" | "trend_calls" | "availability", { title: string; description: string }>` (exported so Task 10 and Task 11 both reference the same four descriptions — this is also the canonical fix for the w7c placeholder copy, since it is the only place in the app describing what plus buys); `PaywallInterruptSheet({ open, onClose, feature, upgradeUrl }: { open: boolean; onClose: () => void; feature: keyof typeof PLUS_FEATURE_COPY; upgradeUrl: string | null })`; `PaywallGate({ unlocked, feature, teaserLabel, upgradeUrl, children }: { unlocked: boolean; feature: keyof typeof PLUS_FEATURE_COPY; teaserLabel: string; upgradeUrl: string | null; children: ReactNode })`.

- [ ] **Step 1: Write the failing sheet test**

```typescript
// @vitest-environment jsdom
// components/garderobe/account/__tests__/paywall-interrupt-sheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaywallInterruptSheet, PLUS_FEATURE_COPY } from "@/components/garderobe/account/paywall-interrupt-sheet";

describe("PLUS_FEATURE_COPY", () => {
  it("describes only the four real plus features, at A$69 a year", () => {
    expect(Object.keys(PLUS_FEATURE_COPY).sort()).toEqual(
      ["analytics", "availability", "in_store_scan", "trend_calls"].sort()
    );
  });
});

describe("PaywallInterruptSheet", () => {
  it("names the specific feature that triggered it and the price", () => {
    render(
      <PaywallInterruptSheet
        open
        onClose={vi.fn()}
        feature="trend_calls"
        upgradeUrl="https://example.com/plus"
      />
    );

    expect(screen.getByText(PLUS_FEATURE_COPY.trend_calls.title)).toBeInTheDocument();
    expect(screen.getByText(/A\$69 a year/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute(
      "href",
      "https://example.com/plus"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/account/__tests__/paywall-interrupt-sheet.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the sheet**

```typescript
// components/garderobe/account/paywall-interrupt-sheet.tsx
"use client";

import { BottomSheet } from "@/components/garderobe/bottom-sheet";

/**
 * MODALS.md §5b — the only four plus features actually drawn in the
 * mockups. Wear planning, looks, and cost-per-wear are free in every drawn
 * tier and must never appear here — that overclaim is exactly what §5b
 * flags in the w7c pricing hero.
 */
export const PLUS_FEATURE_COPY = {
  analytics: {
    title: "wardrobe analytics is a plus feature",
    description: "Cost-per-wear trends, cost-per-category, and your wardrobe's history over time."
  },
  in_store_scan: {
    title: "scan it is a plus feature",
    description: "A quick check on a price tag or a garment on the rail, before you buy it."
  },
  trend_calls: {
    title: "trend calls are a plus feature",
    description: "How covered you already are for a trend, what it would unlock, and when to pack it away."
  },
  availability: {
    title: "marking availability is a plus feature",
    description: "Flag a piece as available to the local marketplace straight from your wardrobe."
  }
} as const;

type PlusFeature = keyof typeof PLUS_FEATURE_COPY;

type PaywallInterruptSheetProps = {
  open: boolean;
  onClose: () => void;
  feature: PlusFeature;
  upgradeUrl: string | null;
};

/** MODALS.md §5 — the paywall interrupt: drawn as a screen (9h), missing as the interrupt itself. */
export function PaywallInterruptSheet({ open, onClose, feature, upgradeUrl }: PaywallInterruptSheetProps) {
  const copy = PLUS_FEATURE_COPY[feature];

  return (
    <BottomSheet open={open} onClose={onClose} title={copy.title} description={copy.description}>
      <div className="flex items-baseline gap-2 pb-4">
        <span className="text-[34px] font-light leading-none text-[var(--ink)]">A$69</span>
        <span className="text-[12px] text-[var(--stone)]">a year, A$5.75 a month — the wardrobe itself stays free</span>
      </div>
      <a
        href={upgradeUrl ?? "/account"}
        className="flex h-11 w-full items-center justify-center rounded-[100px] bg-[var(--oxblood)] text-[13px] text-[var(--cream)]"
      >
        see plans
      </a>
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/account/__tests__/paywall-interrupt-sheet.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Write the failing gate test**

```typescript
// @vitest-environment jsdom
// components/garderobe/account/__tests__/paywall-gate.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaywallGate } from "@/components/garderobe/account/paywall-gate";

describe("PaywallGate", () => {
  it("renders children directly when unlocked", () => {
    render(
      <PaywallGate unlocked feature="in_store_scan" teaserLabel="scan it" upgradeUrl={null}>
        <p>the real content</p>
      </PaywallGate>
    );

    expect(screen.getByText("the real content")).toBeInTheDocument();
  });

  it("renders a teaser instead of children when locked, and opens the interrupt sheet on tap", () => {
    render(
      <PaywallGate unlocked={false} feature="in_store_scan" teaserLabel="scan it" upgradeUrl={null}>
        <p>the real content</p>
      </PaywallGate>
    );

    expect(screen.queryByText("the real content")).not.toBeInTheDocument();
    const teaser = screen.getByRole("button", { name: /scan it/i });
    fireEvent.click(teaser);

    expect(screen.getByText(/scan it is a plus feature/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run components/garderobe/account/__tests__/paywall-gate.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Implement the gate**

```typescript
// components/garderobe/account/paywall-gate.tsx
"use client";

import { useState, type ReactNode } from "react";
import { PaywallInterruptSheet, PLUS_FEATURE_COPY } from "./paywall-interrupt-sheet";

type PaywallGateProps = {
  unlocked: boolean;
  feature: keyof typeof PLUS_FEATURE_COPY;
  teaserLabel: string;
  upgradeUrl: string | null;
  children: ReactNode;
};

/**
 * Wraps a plus-only surface: renders the real content when the user's plan
 * covers it, otherwise a locked teaser that opens PaywallInterruptSheet —
 * "the interrupt that fires from a plus-only action" (MODALS.md §5).
 */
export function PaywallGate({ unlocked, feature, teaserLabel, upgradeUrl, children }: PaywallGateProps) {
  const [open, setOpen] = useState(false);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full flex-col items-start gap-1 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-left"
      >
        <span className="text-[14px] text-[var(--ink)]">{teaserLabel}</span>
        <span className="text-[11.5px] text-[var(--stone)]">unlock with garderobe plus</span>
      </button>
      <PaywallInterruptSheet open={open} onClose={() => setOpen(false)} feature={feature} upgradeUrl={upgradeUrl} />
    </>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run components/garderobe/account/__tests__/paywall-gate.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 9: Commit**

```bash
git add components/garderobe/account/paywall-interrupt-sheet.tsx components/garderobe/account/__tests__/paywall-interrupt-sheet.test.tsx components/garderobe/account/paywall-gate.tsx components/garderobe/account/__tests__/paywall-gate.test.tsx
git commit -m "Add the paywall interrupt sheet and a reusable plus-gate wrapper."
```

---

## Task 10: Wire the plus-gate into the let-go list and in-store scan

**Files:**
- Modify: `app/wardrobe/let-go/page.tsx`
- Modify: `app/wardrobe/scan/page.tsx` → split into `app/wardrobe/scan/page.tsx` (server) + `app/wardrobe/scan/scan-form.tsx` (client, the current content)
- Test: `app/wardrobe/let-go/__tests__/page.test.tsx` (create if none exists for this page — check first with `ls app/wardrobe/let-go/__tests__/ 2>/dev/null`)

**Interfaces:**
- Consumes: `getUserEntitlements`, `hasPaidPlan` (`@/lib/domain/entitlements/service`), `getBillingStatus` (`@/lib/domain/billing/service`), `PaywallGate` (Task 9).

- [ ] **Step 1: Gate the let-go list**

In `app/wardrobe/let-go/page.tsx`, import `getUserEntitlements`, `hasPaidPlan` from `@/lib/domain/entitlements/service`, `getBillingStatus` from `@/lib/domain/billing/service`, and `PaywallGate` from `@/components/garderobe/account/paywall-gate`. Fetch entitlements alongside `listLetGoGarments()`:

```typescript
const [garments, entitlements] = await Promise.all([listLetGoGarments(), getUserEntitlements()]);
const unlocked = hasPaidPlan(entitlements);
const { upgradeUrl } = getBillingStatus();
```

Wrap the existing conditional block (the `{garments.length ? (...) : (...)}` expression, lines 35-71) in `<PaywallGate unlocked={unlocked} feature="trend_calls" teaserLabel="see your let-go list" upgradeUrl={upgradeUrl}>...</PaywallGate>` — leave the heading (`{garments.length} things`) and the intro paragraph outside the gate, since the count itself is not the paid feature, seeing the list is.

Note: the count in the heading (`{garments.length}...`) still reads from `listLetGoGarments()`, which a locked user can still call (it is not itself gated) — this is a deliberate choice to keep "how many things are flagged" free while gating "see and act on them," matching how `UsedElsewhereDialog` and other dialogs in this codebase already treat counts as informational, not the paid surface itself. Do not gate `listLetGoGarments()` server-side.

- [ ] **Step 2: Write a page-level test if none exists**

If `app/wardrobe/let-go/__tests__/page.test.tsx` does not already exist, this page is a server component with two upstream dependencies (`listLetGoGarments`, `getUserEntitlements`) that both need Supabase mocking — check whether an existing similar page test (e.g. search for `__tests__/page.test.tsx` under `app/wardrobe/`) already has a working mock harness for `listLetGoGarments`/`AuthenticationError` and copy its pattern. If one exists, extend it with:

```typescript
it("shows a locked teaser instead of the list when the user is on the free plan", async () => {
  // Arrange listLetGoGarments and getUserEntitlements mocks so entitlements.plan_tier === "free"
  // and listLetGoGarments returns at least one garment.
  // Render the page (it is an async server component — call it directly and render the
  // resolved element, following this test file's existing pattern for async page components).
  // Assert: the garment title is NOT in the document, and "unlock with garderobe plus" is.
});

it("shows the real list when the user has a paid plan", async () => {
  // Same setup, but entitlements.plan_tier === "premium".
  // Assert: the garment title IS in the document.
});
```

If no existing test harness for server-component pages under `app/wardrobe/` can be found to copy, skip writing a new test file for this page specifically (do not invent a testing pattern this codebase does not already use elsewhere) — note this explicitly as a gap in this task's completion summary, and rely on the already-covered `PaywallGate` unit tests (Task 9) plus a manual `npm run build` check that the page still compiles and renders without runtime errors.

- [ ] **Step 3: Split and gate the in-store scan page**

Move the entire current content of `app/wardrobe/scan/page.tsx` into a new file `app/wardrobe/scan/scan-form.tsx`, renaming the default export to a named export `ScanForm` (keep `"use client"` at the top of this new file, keep every line of logic identical).

Replace `app/wardrobe/scan/page.tsx` with a server component:

```typescript
// app/wardrobe/scan/page.tsx
import { getUserEntitlements, hasPaidPlan } from "@/lib/domain/entitlements/service";
import { getBillingStatus } from "@/lib/domain/billing/service";
import { PaywallGate } from "@/components/garderobe/account/paywall-gate";
import { ScanForm } from "./scan-form";

/** 8a — in-store scan: is this worth buying, before you do. */
export default async function ScanPage() {
  const entitlements = await getUserEntitlements();
  const { upgradeUrl } = getBillingStatus();

  return (
    <PaywallGate
      unlocked={hasPaidPlan(entitlements)}
      feature="in_store_scan"
      teaserLabel="scan it"
      upgradeUrl={upgradeUrl}
    >
      <ScanForm />
    </PaywallGate>
  );
}
```

- [ ] **Step 4: Check for an existing scan page test**

Run: `ls app/wardrobe/scan/__tests__/ 2>/dev/null || echo "none"`. If a test exists that imports the default export of `app/wardrobe/scan/page.tsx` expecting the client form directly, update its import to `import { ScanForm } from "@/app/wardrobe/scan/scan-form"` and test `ScanForm` directly (its behaviour is unchanged) — this preserves the existing test's coverage of the scan interaction itself, which this task does not change.

- [ ] **Step 5: Run the full test suite and the build**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass; no new type errors. `PaywallGate`'s `children: ReactNode` accepts the server-rendered `<ScanForm />` element without issue since this is standard Next.js server-component-into-client-component composition.

- [ ] **Step 6: Commit**

```bash
git add app/wardrobe/let-go/page.tsx app/wardrobe/scan/page.tsx app/wardrobe/scan/scan-form.tsx
git commit -m "Gate the let-go list and in-store scan behind the plus paywall interrupt."
```

---

## Task 11: Wire the plus-gate into trend calls, and a server-side hook for availability

**Files:**
- Modify: `app/trends/[id]/page.tsx`
- Modify: `app/wardrobe/actions.ts` (`setAvailabilityAction`)
- Test: `app/wardrobe/__tests__/actions.test.ts` (extend if it exists — check first)

**Interfaces:**
- Consumes: `getUserEntitlements`, `hasPaidPlan`, `assertPaidPlanAccess`, `FeatureAccessError` (`@/lib/domain/entitlements/service`), `PaywallGate` (Task 9).

- [ ] **Step 1: Gate the trend detail "how covered you are" section**

In `app/trends/[id]/page.tsx`, import `getUserEntitlements`, `hasPaidPlan` from `@/lib/domain/entitlements/service`, `getBillingStatus` from `@/lib/domain/billing/service`, `PaywallGate` from `@/components/garderobe/account/paywall-gate`. Fetch entitlements alongside the existing `Promise.all([listWardrobeGarments(), listStyleRules()])` call (add it as a third element of that array), and wrap the `<section className="mt-8 border-t ...">...</section>` block (the "how covered you are" section, roughly lines 55-70) in:

```typescript
<PaywallGate
  unlocked={hasPaidPlan(entitlements)}
  feature="trend_calls"
  teaserLabel="see how covered you are for this trend"
  upgradeUrl={getBillingStatus().upgradeUrl}
>
  <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
    {/* unchanged existing content */}
  </section>
</PaywallGate>
```

Leave the trend name, chips, and back link outside the gate — only the coverage/unlock-count call itself is the paid feature.

- [ ] **Step 2: Check for an existing trend detail page test and extend or note the gap**

Run: `ls "app/trends/[id]/__tests__/" 2>/dev/null || echo "none"`. Follow the same rule as Task 10 Step 2: extend an existing test harness if one is found; otherwise do not invent a new server-component test pattern, note the gap, and rely on `PaywallGate`'s own tests plus a build/typecheck pass.

- [ ] **Step 3: Add the server-side hook to `setAvailabilityAction`**

`setAvailabilityAction` (`app/wardrobe/actions.ts`) is not currently called from any UI component (grep confirms this) — building a full availability picker control is out of scope for this plan (there is no mockup for a wardrobe-grid or piece-detail availability control to build against, only the "availability" line in MODALS.md §5b's feature list). This step adds the hook point a future picker control would rely on, without inventing the control itself.

Import `assertPaidPlanAccess`, `FeatureAccessError` from `@/lib/domain/entitlements/service` in `app/wardrobe/actions.ts`. In `setAvailabilityAction`, wrap the existing body so the plan check runs first:

```typescript
export async function setAvailabilityAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    await assertPaidPlanAccess("Marking availability");

    const values = setAvailabilityFormSchema.parse({
      garment_id: formData.get("garment_id"),
      availability: formData.get("availability")
    });

    await setGarmentAvailability(values.garment_id, values.availability);
    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${values.garment_id}`);

    return {
      status: "success",
      garmentId: values.garment_id,
      message: `Marked ${values.availability}.`
    };
  } catch (error) {
    if (error instanceof FeatureAccessError) {
      return { status: "error", message: error.message, requiresPlus: true };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update availability."
    };
  }
}
```

Add `requiresPlus?: boolean` to `WardrobeActionState` in `lib/domain/wardrobe/action-state.ts`, so a future UI control can check `state.requiresPlus` and open `PaywallInterruptSheet` instead of showing a plain error banner — this is the hook point itself.

- [ ] **Step 4: Write the failing test for the gate**

Check first: `ls app/wardrobe/__tests__/actions.test.ts 2>/dev/null || echo "none"`. If it exists, add this case to it (reusing whatever Supabase/auth mocks it already sets up, adding a mock for `@/lib/domain/entitlements/service` returning `assertPaidPlanAccess` as a `vi.fn()`); if it does not exist, create it with the minimal scaffolding needed for just this test:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/domain/entitlements/service", () => ({
  assertPaidPlanAccess: vi.fn(),
  FeatureAccessError: class FeatureAccessError extends Error {}
}));
vi.mock("@/lib/domain/wardrobe/service", () => ({
  setGarmentAvailability: vi.fn()
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("setAvailabilityAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns requiresPlus when the caller is not on a paid plan", async () => {
    const { assertPaidPlanAccess, FeatureAccessError } = await import("@/lib/domain/entitlements/service");
    (assertPaidPlanAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
      new FeatureAccessError("Marking availability is available on paid plans.")
    );

    const { setAvailabilityAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("garment_id", "11111111-1111-1111-1111-111111111111");
    formData.set("availability", "available");

    const result = await setAvailabilityAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.requiresPlus).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails, then passes**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts`
Expected: FAILs first (`requiresPlus` does not exist on the returned state / `assertPaidPlanAccess` is not called), then PASSes once Step 3's implementation is in place. If this file already existed with many other tests, run the full file, not just this one, to confirm nothing else broke — a real risk here is that `assertPaidPlanAccess` is not yet mocked in the file's other existing tests for other actions, which do not import it; per-test mocks in this file should only apply within this new test's `describe` block if the file uses `vi.mock` at module scope (all tests in the file share it) — if `assertPaidPlanAccess` mocked to reject would break other pre-existing tests that call `setAvailabilityAction`, make sure the mock defaults to resolving successfully (`mockResolvedValue(undefined)`) in `beforeEach`, and only override it to reject inside this specific test.

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, no new type errors.

- [ ] **Step 7: Commit**

```bash
git add app/trends/[id]/page.tsx app/wardrobe/actions.ts lib/domain/wardrobe/action-state.ts app/wardrobe/__tests__/actions.test.ts
git commit -m "Gate trend calls behind the plus paywall interrupt and add a plus hook to the availability action."
```

---

## Task 12: Fix the placeholder copy — pricing hero overclaim and the A$49/A$69 conflict

**Files:**
- Modify: `app/account/plan-section.tsx`

**Interfaces:**
- Consumes: `PLUS_FEATURE_COPY` (`@/components/garderobe/account/paywall-interrupt-sheet`, Task 9).

- [ ] **Step 1: Rewrite `PlanSection`'s feature list and pricing to match the real plus scope**

`PlanSection` (`app/account/plan-section.tsx`) currently lists the *older* entitlement feature set (feature labels, receipt OCR, product URL ingestion, outfit decomposition — real, but a different, earlier concept than the Garderobe-era "plus" features this plan just wired up). Since both are real and both are gated by the same `plan_tier`, keep the existing feature list (do not delete real, working functionality from the copy) but add the four new plus features next to them, and fix the price to A$69/year — resolving both §5b items at once, in the one place in the actual codebase that displays plan pricing at all:

```typescript
import { PLUS_FEATURE_COPY } from "@/components/garderobe/account/paywall-interrupt-sheet";
```

Replace the `features` array construction with:

```typescript
const features: Feature[] = [
  { label: "Unlimited wardrobe items", enabled: true },
  { label: "Outfit generation", enabled: true },
  { label: "AI feature labels & garment tagging", enabled: entitlements.feature_labels_enabled },
  { label: "Receipt photo scanning", enabled: entitlements.receipt_ocr_enabled },
  { label: "Product URL ingestion", enabled: entitlements.product_url_ingestion_enabled },
  { label: "Outfit decomposition", enabled: entitlements.outfit_decomposition_enabled },
  { label: PLUS_FEATURE_COPY.analytics.description, enabled: entitlements.plan_tier !== "free" },
  { label: PLUS_FEATURE_COPY.in_store_scan.description, enabled: entitlements.plan_tier !== "free" },
  { label: PLUS_FEATURE_COPY.trend_calls.description, enabled: entitlements.plan_tier !== "free" },
  { label: PLUS_FEATURE_COPY.availability.description, enabled: entitlements.plan_tier !== "free" }
];
```

Replace the "Upgrade to Premium" link text and add the price next to it — find the block with `Upgrade to Premium →` (around line 88) and change it to:

```typescript
{upgradeUrl && entitlements.plan_tier === "free" && (
  <a href={upgradeUrl} className="pw-button-primary mt-4 inline-flex">
    Upgrade to plus — A$69 a year →
  </a>
)}
```

This never claims wear planning, looks, or cost-per-wear are paid (they are not in this list, and never were free-tier items removed — "Unlimited wardrobe items" and "Outfit generation" stay free and stay listed as such), which is exactly what §5b flags as the overclaim to fix, and it uses A$69/year, matching the price this plan adopted everywhere else (Task 9's `PaywallInterruptSheet`).

- [ ] **Step 2: Confirm no other price string in the codebase disagrees**

Run: `grep -rn "A\$49\|A\$69\|a year" app/ components/ lib/`
Expected: every match reads "A$69" (`PaywallInterruptSheet`, `PlanSection`'s new upgrade link) — no "A$49" anywhere in the application code.

- [ ] **Step 3: Run the full test suite and the build**

Run: `npx vitest run && npm run build`
Expected: all tests pass; the build succeeds (this task touches only static JSX/copy, so a clean build is the meaningful check here — there is no dedicated `PlanSection` test file to run, per a quick check with `ls app/account/__tests__/ 2>/dev/null`; if one does exist, run it and fix any snapshot/text assertions this copy change invalidates).

- [ ] **Step 4: Commit**

```bash
git add app/account/plan-section.tsx
git commit -m "Fix the paywall placeholder copy: describe only the real plus features, and settle on A$69 a year."
```

---

## Task 13: Whole-branch verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: every test passes, including all tests added in Tasks 1-12. Record the final total test count for the report.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: succeeds with no new warnings tied to files this plan touched.

- [ ] **Step 4: Manual price/copy grep sanity check**

Run: `grep -rn "help you decide what to wear, keep and buy next" app/ components/ lib/`
Expected: no matches — this plan never introduces the overclaiming w7c copy into the codebase.

- [ ] **Step 5: Confirm the branch state**

Run: `git log --oneline design/handoff..HEAD` and `git status`
Expected: one commit per task above (13 commits or close to it, depending on any test-file-already-exists branches taken), working tree clean.
