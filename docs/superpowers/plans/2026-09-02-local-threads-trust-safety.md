# Local Threads Trust and Safety Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 8 local-threads trust-and-safety dialogs/sheets `docs/design/design_handoff_garderobe/MODALS.md` §4 marks **missing**: decline/withdraw an offer, cancel a listing with a live offer, cancel or reschedule a handover, "they didn't show", report a listing/person, block confirm, first listing safety brief, and age check, so the marketplace stops relying on raw `confirm()`/`prompt()`/`alert()` and has no dialog-shaped gaps left before launch.

**Architecture:** One migration adds every new column/table this phase needs (offer state on `messages`, no-show tracking on `handovers`, three new `profiles` columns, no new tables). Service functions land in the existing `lib/domain/local-threads/threads-service.ts` and `lib/domain/profile/service.ts`. New dialogs/sheets are standalone components under a new `components/garderobe/local-threads/` directory, built only on the existing `Dialog` (`components/garderobe/dialog.tsx`) and `BottomSheet`/`SheetAction` (`components/garderobe/bottom-sheet.tsx`) primitives, `Dialog` gains one new optional prop (`hideCancel`) for single-button acknowledgement dialogs, used by the safety brief and the age-check block notice. They are wired into `app/local/threads/[id]/thread-view.tsx` (replacing the existing `confirm()`/`prompt()`/`alert()` calls), a new "manage this listing" section on `app/local/[id]/page.tsx`, `app/local/list/[garmentId]/page.tsx` (age check + safety brief gate before the listing form), and a new "blocked" section on `app/account/you-section.tsx`.

**Tech Stack:** Next.js App Router server actions, Zod validation, Supabase/Postgres with RLS, Vitest for unit tests, React Testing Library for component tests.

**Spec:** `docs/design/design_handoff_garderobe/LOCAL_THREADS_TRUST_SAFETY_SPEC.md` (this phase's own design spec, written against the actual local-threads code since no mockup exists for these 8 items), `docs/design/design_handoff_garderobe/MODALS.md` §4 and "Standing rules", `docs/design/design_handoff_garderobe/API_CONTRACT.md` "Local threads".

## Out of scope for this phase

- Wiring `no_show_by`/no-show counts into `getPublicProfile`'s `handoverCount`, that field is
  hard-coded to `0` everywhere today (`lib/domain/profile/service.ts:177-178,222-223`), a
  pre-existing gap. This phase records the no-show, it does not yet surface it as a trust score.
- Gating the buyer side (browsing, starting a thread, offering, agreeing to a handover) behind
  the age check, the spec flags this as a policy question for the human partner, not something
  this plan decides unilaterally. See spec §8's final paragraph.
- Any self-service "actually I'm 18 now" override once `age_declined_at` is set.
- Everything in MODALS.md still marked missing outside §4 (intake permissions, account/billing,
  auth), a separate phase per README.md's own scoping.

## Global Constraints

- Australian English, no em dashes, lowercase sentence-style copy, in all new UI copy (`~/.claude/CLAUDE.md`).
- Destructive dialogs name the consequence, not the action (MODALS.md standing rule 1), never "are you sure?".
- Nothing destructive resolves in a toast alone (standing rule 2), a toast is fine only for genuinely non-destructive submissions (e.g. sending a report).
- A dialog asks one question; if it needs two answers it is a sheet (standing rule 3).
- Sheets carry a 38×3px grab handle and 20px top corners; dialogs are 14px radius, centred, 44px buttons; both dim with `rgba(30,26,23,.45)` (standing rule 7), already baked into `Dialog`/`BottomSheet`, do not re-implement.
- Every new dialog/sheet is built on `Dialog` or `BottomSheet`/`SheetAction`, extend a primitive's props if needed (this plan extends `Dialog` once, with `hideCancel`), never fork a new overlay pattern.
- RLS is the enforcement boundary for every local-threads write; never the service-role client in a user-facing path (`API_CONTRACT.md`).
- Rate limiting via `lib/rate-limit.ts`'s `checkRateLimit(action, requests, windowSeconds)` on any local-threads write that can be triggered repeatedly by one user against another (offers, reports, no-show reports), every existing local-threads write already does this; new writes follow the same pattern.
- A user can only report/block/decline/withdraw from their own session, every new service function is scoped by `getRequiredUser()` plus a `.eq(...)` or RLS check tying the row to that user, matching every existing function in `threads-service.ts`.

---

## Task 1: Migration, offer state, no-show tracking, profile flags

**Files:**
- Create: `supabase/migrations/036_local_threads_trust_and_safety.sql`

**Interfaces:**
- Produces: `messages.offer_status text` (default `'pending'`), `handovers.no_show_by uuid`, `handovers.no_show_reported_at timestamptz`, `profiles.local_safety_brief_seen_at timestamptz`, `profiles.age_confirmed_at timestamptz`, `profiles.age_declined_at timestamptz`.

- [ ] **Step 1: Write the migration**

```sql
-- Phase 12 (local threads trust and safety): decline/withdraw an offer,
-- cancel a listing with a live offer, cancel/reschedule a handover, "they
-- didn't show", report, block, first-listing safety brief, and age check.
-- See docs/design/design_handoff_garderobe/LOCAL_THREADS_TRUST_SAFETY_SPEC.md.

-- Offers today are plain messages (kind = 'offer') with no accept/decline/
-- withdraw state at all. This adds that state directly on the message row
-- rather than a separate offers table, since a message row already *is*
-- the one-offer-per-send record MODALS.md's "counter / accept" dialog acts
-- on.
alter table public.messages
  add column if not exists offer_status text
    check (offer_status in ('pending', 'accepted', 'declined', 'withdrawn'))
    default 'pending';

-- "They didn't show" needs to record who, the handovers.state check
-- constraint already allows 'missed' (migration 031) but no code has ever
-- written it.
alter table public.handovers
  add column if not exists no_show_by uuid references auth.users(id),
  add column if not exists no_show_reported_at timestamptz;

-- First listing safety brief and the age gate, same pattern as the
-- existing onboarding_completed_at column.
alter table public.profiles
  add column if not exists local_safety_brief_seen_at timestamptz,
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists age_declined_at timestamptz;
```

- [ ] **Step 2: Apply it and confirm it runs clean**

Run: `supabase db push` (or this project's existing local/dev apply path, check current
migration state first, per the caveat in `HANDOFF.md` about unapplied migrations).
Expected: migration `036_local_threads_trust_and_safety.sql` applies with no errors; `messages`,
`handovers`, and `profiles` show the new columns via `list_tables`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/036_local_threads_trust_and_safety.sql
git commit -m "Add offer state, no-show tracking, and safety/age profile flags for local threads."
```

---

## Task 2: Offer decline/withdraw service functions

**Files:**
- Modify: `lib/domain/local-threads/threads-service.ts` (add `respondToOffer`, `withdrawOffer`)
- Test: `lib/domain/local-threads/__tests__/offer-decisions.test.ts`

**Interfaces:**
- Consumes: `getRequiredUser`, `createClient`, the existing private `insertMessage` helper (same file), `checkRateLimit` from `@/lib/rate-limit`.
- Produces: `respondToOffer(messageId: string): Promise<void>` (seller declines), `withdrawOffer(messageId: string): Promise<void>` (buyer withdraws), both consumed by Task 6's UI.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/domain/local-threads/__tests__/offer-decisions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn(() => ({ eq: eqMock, error: null }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const maybeSingleMock = vi.fn();
const selectMock = vi.fn(() => ({ eq: eqMock, maybeSingle: maybeSingleMock }));
const insertMock = vi.fn(() => ({ error: null }));
const fromMock = vi.fn((table: string) => {
  if (table === "messages") {
    return { update: updateMock, select: selectMock, insert: insertMock };
  }
  return { select: selectMock, update: updateMock, insert: insertMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => {}) }));

describe("respondToOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
    maybeSingleMock.mockResolvedValue({
      data: { thread_id: "22222222-2222-2222-2222-222222222222", sender_id: "33333333-3333-3333-3333-333333333333" },
      error: null
    });
  });

  it("sets offer_status to declined", async () => {
    const { respondToOffer } = await import("@/lib/domain/local-threads/threads-service");
    await respondToOffer("44444444-4444-4444-4444-444444444444");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ offer_status: "declined" }));
  });
});

describe("withdrawOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
    maybeSingleMock.mockResolvedValue({
      data: { thread_id: "22222222-2222-2222-2222-222222222222", sender_id: "11111111-1111-1111-1111-111111111111" },
      error: null
    });
  });

  it("sets offer_status to withdrawn", async () => {
    const { withdrawOffer } = await import("@/lib/domain/local-threads/threads-service");
    await withdrawOffer("44444444-4444-4444-4444-444444444444");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ offer_status: "withdrawn" }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/domain/local-threads/__tests__/offer-decisions.test.ts`
Expected: FAIL, `respondToOffer`/`withdrawOffer` are not exported yet.

- [ ] **Step 3: Implement**

```typescript
// lib/domain/local-threads/threads-service.ts, add near sendMessage/insertMessage:

/**
 * 16b column, missing, seller declines a buyer's offer. Scoped to the
 * *other* party's message: a seller can decline any pending offer in a
 * thread they're party to, but never their own.
 */
export async function respondToOffer(messageId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(messageId);

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("thread_id,sender_id,offer_cents")
    .eq("id", parsedId)
    .maybeSingle();

  if (messageError || !message) {
    throw new Error("Offer not found.");
  }

  const parsedMessage = message as { thread_id: string; sender_id: string; offer_cents: number | null };
  if (parsedMessage.sender_id === user.id) {
    throw new Error("You can't decline your own offer.");
  }

  const { error } = await supabase
    .from("messages")
    .update({ offer_status: "declined" } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }

  await insertMessage(supabase, {
    threadId: parsedMessage.thread_id,
    senderId: user.id,
    kind: "system",
    body: "offer declined"
  });
}

/**
 * 16b column, missing, buyer withdraws their own offer. Scoped to the
 * sender: only the person who made the offer can withdraw it.
 */
export async function withdrawOffer(messageId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(messageId);

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("thread_id,sender_id")
    .eq("id", parsedId)
    .maybeSingle();

  if (messageError || !message) {
    throw new Error("Offer not found.");
  }

  const parsedMessage = message as { thread_id: string; sender_id: string };
  if (parsedMessage.sender_id !== user.id) {
    throw new Error("You can only withdraw your own offer.");
  }

  const { error } = await supabase
    .from("messages")
    .update({ offer_status: "withdrawn" } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }

  await insertMessage(supabase, {
    threadId: parsedMessage.thread_id,
    senderId: user.id,
    kind: "system",
    body: "offer withdrawn"
  });
}
```

Add `offer_status: z.enum(["pending", "accepted", "declined", "withdrawn"]).nullable()` to the
existing `messageSchema` in the same file (it currently has no `offer_status` field at all,
add it so `ThreadMessage` carries the new column through `getThreadDetail`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/local-threads/__tests__/offer-decisions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/local-threads/threads-service.ts lib/domain/local-threads/__tests__/offer-decisions.test.ts
git commit -m "Add offer decline and withdraw service functions with an offer_status field."
```

---

## Task 3: Handover cancel and no-show service functions

**Files:**
- Modify: `lib/domain/local-threads/threads-service.ts` (add `cancelHandover`, `reportNoShow`)
- Test: `lib/domain/local-threads/__tests__/handover-lifecycle.test.ts`

**Interfaces:**
- Consumes: same mocking pattern as Task 2; the existing `handoverSchema`.
- Produces: `cancelHandover(handoverId: string): Promise<void>`, `reportNoShow(handoverId: string): Promise<void>`, both consumed by Task 7's UI.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/domain/local-threads/__tests__/handover-lifecycle.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn(() => ({ eq: eqMock, error: null }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const maybeSingleMock = vi.fn();
const selectMock = vi.fn(() => ({ eq: eqMock, maybeSingle: maybeSingleMock }));
const fromMock = vi.fn(() => ({ update: updateMock, select: selectMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("cancelHandover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
    maybeSingleMock.mockResolvedValue({ data: { thread_id: "22222222-2222-2222-2222-222222222222" }, error: null });
  });

  it("sets the handover state to cancelled and reopens the thread", async () => {
    const { cancelHandover } = await import("@/lib/domain/local-threads/threads-service");
    await cancelHandover("33333333-3333-3333-3333-333333333333");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ state: "cancelled" }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ state: "open" }));
  });
});

describe("reportNoShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
    maybeSingleMock.mockResolvedValue({
      data: { thread_id: "22222222-2222-2222-2222-222222222222", buyer_id: "44444444-4444-4444-4444-444444444444", seller_id: "11111111-1111-1111-1111-111111111111" },
      error: null
    });
  });

  it("marks the handover missed and records who did not show", async () => {
    const { reportNoShow } = await import("@/lib/domain/local-threads/threads-service");
    await reportNoShow("33333333-3333-3333-3333-333333333333");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ state: "missed", no_show_by: "44444444-4444-4444-4444-444444444444" })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/domain/local-threads/__tests__/handover-lifecycle.test.ts`
Expected: FAIL, `cancelHandover`/`reportNoShow` are not exported yet.

- [ ] **Step 3: Implement**

```typescript
// lib/domain/local-threads/threads-service.ts, add near respondToHandover:

/** Sheet action for "cancel or reschedule a handover", either party can cancel. */
export async function cancelHandover(handoverId: string): Promise<void> {
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(handoverId);

  const { data: handover, error: handoverError } = await supabase
    .from("handovers")
    .select("thread_id")
    .eq("id", parsedId)
    .maybeSingle();

  if (handoverError || !handover) {
    throw new Error("Handover not found.");
  }

  const { error } = await supabase
    .from("handovers")
    .update({ state: "cancelled" } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("threads")
    .update({ state: "open" } as never)
    .eq("id", (handover as { thread_id: string }).thread_id);
}

/**
 * "they didn't show", the only trust signal the marketplace has. Records
 * who was reported as a no-show (the *other* participant, never the
 * reporter) and reopens the thread so the pair can still try again.
 */
export async function reportNoShow(handoverId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(handoverId);

  const { data: handover, error: handoverError } = await supabase
    .from("handovers")
    .select("thread_id")
    .eq("id", parsedId)
    .maybeSingle();

  if (handoverError || !handover) {
    throw new Error("Handover not found.");
  }

  const threadId = (handover as { thread_id: string }).thread_id;

  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .select("buyer_id,seller_id")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError || !thread) {
    throw new Error("Thread not found.");
  }

  const parsedThread = thread as { buyer_id: string; seller_id: string };
  const noShowBy = user.id === parsedThread.buyer_id ? parsedThread.seller_id : parsedThread.buyer_id;

  const { error } = await supabase
    .from("handovers")
    .update({
      state: "missed",
      no_show_by: noShowBy,
      no_show_reported_at: new Date().toISOString()
    } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("threads").update({ state: "open" } as never).eq("id", threadId);
}
```

Add `no_show_by: z.string().uuid().nullable()` and `no_show_reported_at: z.string().nullable()`
to the existing `handoverSchema` in the same file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/local-threads/__tests__/handover-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/local-threads/threads-service.ts lib/domain/local-threads/__tests__/handover-lifecycle.test.ts
git commit -m "Add handover cancel and no-show reporting service functions."
```

---

## Task 4: Cancel-listing check, block listing, and profile flag service functions

**Files:**
- Modify: `lib/domain/local-threads/threads-service.ts` (add `hasLiveOfferOrHandover`, `closeThreadForCancelledListing`, `listBlockedUsers`)
- Modify: `lib/domain/profile/service.ts` (add `markSafetyBriefSeen`, `confirmAge`, `declineAge`)
- Modify: `lib/domain/profile/index.ts` (extend `profileSchema` with the three new columns)
- Test: `lib/domain/local-threads/__tests__/listing-cancel-and-blocks.test.ts`, `lib/domain/profile/__tests__/safety-flags.test.ts` (new file, check for an existing `__tests__` dir under `lib/domain/profile/` first, create it if absent)

**Interfaces:**
- Consumes: `getRequiredUser`, `createClient`.
- Produces: `hasLiveOfferOrHandover(listingId: string): Promise<{ hasOffer: boolean; hasHandover: boolean; counterpartUserId: string | null }>`, `closeThreadForCancelledListing(threadId: string): Promise<void>`, `listBlockedUsers(): Promise<Array<{ userId: string; localName: string | null; blockedAt: string }>>`, `markSafetyBriefSeen(): Promise<void>`, `confirmAge(): Promise<void>`, `declineAge(): Promise<void>`, all consumed by Tasks 6-9's UI. `Profile` type gains `local_safety_brief_seen_at: string | null`, `age_confirmed_at: string | null`, `age_declined_at: string | null`.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/domain/local-threads/__tests__/listing-cancel-and-blocks.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn(() => ({ eq: eqMock, order: orderMock, maybeSingle: maybeSingleMock, error: null }));
const orderMock = vi.fn();
const maybeSingleMock = vi.fn();
const inMock = vi.fn(() => ({ eq: eqMock }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const selectMock = vi.fn(() => ({ eq: eqMock, in: inMock, order: orderMock, maybeSingle: maybeSingleMock }));
const fromMock = vi.fn(() => ({ select: selectMock, update: updateMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("hasLiveOfferOrHandover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, order: orderMock, maybeSingle: maybeSingleMock, error: null });
    orderMock.mockResolvedValue({ data: [], error: null });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  it("reports no live offer or handover when there are none", async () => {
    const { hasLiveOfferOrHandover } = await import("@/lib/domain/local-threads/threads-service");
    const result = await hasLiveOfferOrHandover("22222222-2222-2222-2222-222222222222");

    expect(result).toEqual({ hasOffer: false, hasHandover: false, counterpartUserId: null });
  });
});

describe("listBlockedUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderMock.mockResolvedValue({
      data: [{ blocked_id: "33333333-3333-3333-3333-333333333333", created_at: "2026-01-01T00:00:00Z", profiles: { local_name: "sam" } }],
      error: null
    });
  });

  it("returns the current user's blocked list", async () => {
    const { listBlockedUsers } = await import("@/lib/domain/local-threads/threads-service");
    const result = await listBlockedUsers();

    expect(result).toEqual([
      { userId: "33333333-3333-3333-3333-333333333333", localName: "sam", blockedAt: "2026-01-01T00:00:00Z" }
    ]);
  });
});
```

```typescript
// lib/domain/profile/__tests__/safety-flags.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn(() => ({ eq: eqMock, error: null }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("confirmAge / declineAge / markSafetyBriefSeen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("confirmAge sets age_confirmed_at", async () => {
    const { confirmAge } = await import("@/lib/domain/profile/service");
    await confirmAge();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ age_confirmed_at: expect.any(String) }));
  });

  it("declineAge sets age_declined_at", async () => {
    const { declineAge } = await import("@/lib/domain/profile/service");
    await declineAge();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ age_declined_at: expect.any(String) }));
  });

  it("markSafetyBriefSeen sets local_safety_brief_seen_at", async () => {
    const { markSafetyBriefSeen } = await import("@/lib/domain/profile/service");
    await markSafetyBriefSeen();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ local_safety_brief_seen_at: expect.any(String) }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/domain/local-threads/__tests__/listing-cancel-and-blocks.test.ts lib/domain/profile/__tests__/safety-flags.test.ts`
Expected: FAIL, none of the six functions are exported yet.

- [ ] **Step 3: Implement `threads-service.ts` additions**

```typescript
// lib/domain/local-threads/threads-service.ts, add near withdrawLocalListing's callers:

/**
 * "cancel a listing with a live offer" reads this before showing the
 * dialog. A pending offer is any kind='offer' message with offer_status
 * 'pending' in a thread on this listing; a live handover is any handover
 * not yet completed/cancelled/missed.
 */
export async function hasLiveOfferOrHandover(
  listingId: string
): Promise<{ hasOffer: boolean; hasHandover: boolean; counterpartUserId: string | null }> {
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(listingId);

  const { data: threads, error: threadsError } = await supabase
    .from("threads")
    .select("id,buyer_id")
    .eq("listing_id", parsedId);

  if (threadsError) {
    throw new Error(threadsError.message);
  }

  const threadRows = (threads ?? []) as Array<{ id: string; buyer_id: string }>;
  if (threadRows.length === 0) {
    return { hasOffer: false, hasHandover: false, counterpartUserId: null };
  }

  const threadIds = threadRows.map((thread) => thread.id);

  const { data: offers } = await supabase
    .from("messages")
    .select("thread_id")
    .in("thread_id", threadIds)
    .eq("kind", "offer")
    .eq("offer_status", "pending");

  const { data: handovers } = await supabase
    .from("handovers")
    .select("thread_id")
    .in("thread_id", threadIds)
    .in("state", ["proposed", "agreed"]);

  const offerThreadId = (offers as Array<{ thread_id: string }> | null)?.[0]?.thread_id ?? null;
  const handoverThreadId = (handovers as Array<{ thread_id: string }> | null)?.[0]?.thread_id ?? null;
  const matchedThreadId = handoverThreadId ?? offerThreadId;
  const counterpart = threadRows.find((thread) => thread.id === matchedThreadId);

  return {
    hasOffer: Boolean(offerThreadId),
    hasHandover: Boolean(handoverThreadId),
    counterpartUserId: counterpart?.buyer_id ?? null
  };
}

/** Closes a thread once its listing has been cancelled out from under it. */
export async function closeThreadForCancelledListing(threadId: string): Promise<void> {
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(threadId);

  const { error } = await supabase
    .from("threads")
    .update({ state: "declined" } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }
}

/** Account page's "blocked · N people" list, RLS already scopes this to the caller's own rows. */
export async function listBlockedUsers(): Promise<
  Array<{ userId: string; localName: string | null; blockedAt: string }>
> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id,created_at,profiles:blocked_id(local_name)")
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const typed = row as { blocked_id: string; created_at: string; profiles: { local_name: string | null } | null };
    return {
      userId: typed.blocked_id,
      localName: typed.profiles?.local_name ?? null,
      blockedAt: typed.created_at
    };
  });
}
```

- [ ] **Step 4: Implement `profile/service.ts` and `profile/index.ts` additions**

```typescript
// lib/domain/profile/index.ts, extend profileSchema's .extend({...}) block with:
    local_safety_brief_seen_at: z.string().nullable(),
    age_confirmed_at: z.string().nullable(),
    age_declined_at: z.string().nullable()
```

Add the same three columns to `PROFILE_SELECT` in `lib/domain/profile/service.ts`:

```typescript
// lib/domain/profile/service.ts, PROFILE_SELECT gains:
"...,onboarding_completed_at,local_safety_brief_seen_at,age_confirmed_at,age_declined_at,created_at,updated_at"
```

```typescript
// lib/domain/profile/service.ts, add near completeOnboarding:

/** First-listing safety brief, dismissing it is an acknowledgement, not a gate. */
export async function markSafetyBriefSeen(): Promise<void> {
  await getOrCreateProfile();
  const user = await getRequiredUser();
  const supabase = await createClient();

  const update: ProfileUpdate = { local_safety_brief_seen_at: new Date().toISOString() };
  const { error } = await supabase.from("profiles").update(update as never).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/** Age check, "I'm 18 or over". */
export async function confirmAge(): Promise<void> {
  await getOrCreateProfile();
  const user = await getRequiredUser();
  const supabase = await createClient();

  const update: ProfileUpdate = { age_confirmed_at: new Date().toISOString() };
  const { error } = await supabase.from("profiles").update(update as never).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Age check, "I'm under 18". Conservative default: this permanently
 * blocks the local-listing/selling flow for this account. There is no
 * self-service reversal, see LOCAL_THREADS_TRUST_SAFETY_SPEC.md §8.
 */
export async function declineAge(): Promise<void> {
  await getOrCreateProfile();
  const user = await getRequiredUser();
  const supabase = await createClient();

  const update: ProfileUpdate = { age_declined_at: new Date().toISOString() };
  const { error } = await supabase.from("profiles").update(update as never).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/domain/local-threads/__tests__/listing-cancel-and-blocks.test.ts lib/domain/profile/__tests__/safety-flags.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/domain/local-threads/threads-service.ts lib/domain/profile/service.ts lib/domain/profile/index.ts lib/domain/local-threads/__tests__/listing-cancel-and-blocks.test.ts lib/domain/profile/__tests__/safety-flags.test.ts
git commit -m "Add cancel-listing checks, blocked-user listing, and safety/age profile service functions."
```

---

## Task 5: Server actions for every new service function

**Files:**
- Modify: `app/local/actions.ts` (add actions wrapping every Task 2-4 function)
- Modify: `app/account/profile-actions.ts` (add `markSafetyBriefSeenAction`, `confirmAgeAction`, `declineAgeAction`, check this file's existing pattern first; it already exports `updateProfileAction`, `updateSizesAction`, `updateLocalPrivacyAction` per `you-section.tsx`)
- Test: `app/local/__tests__/actions.test.ts` (new, check for an existing `__tests__` dir under `app/local/` first, create it if absent)

**Interfaces:**
- Consumes: every function from Tasks 2-4.
- Produces: `respondToOfferAction(messageId): Promise<ActionResult>`, `withdrawOfferAction(messageId): Promise<ActionResult>`, `cancelHandoverAction(handoverId, threadId): Promise<ActionResult>`, `reportNoShowAction(handoverId, threadId): Promise<ActionResult>`, `cancelListingAction(listingId, threadIdToClose?: string): Promise<ActionResult>`, `listBlockedUsersAction(): Promise<Array<{ userId: string; localName: string | null; blockedAt: string }>>`, `markSafetyBriefSeenAction(): Promise<void>`, `confirmAgeAction(): Promise<void>`, `declineAgeAction(): Promise<void>`, all consumed by Tasks 6-9.

- [ ] **Step 1: Write the failing tests**

```typescript
// app/local/__tests__/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("respondToOfferAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success and revalidates the thread on decline", async () => {
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return { ...actual, respondToOffer: vi.fn(async () => {}) };
    });
    const { respondToOfferAction } = await import("@/app/local/actions");

    const result = await respondToOfferAction("11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222");

    expect(result.status).toBe("success");
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });
});

describe("cancelListingAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("withdraws the listing and closes the given thread when one is passed", async () => {
    vi.doMock("@/lib/domain/local-threads/service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/service");
      return { ...actual, withdrawLocalListing: vi.fn(async () => {}) };
    });
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return { ...actual, closeThreadForCancelledListing: vi.fn(async () => {}) };
    });
    const { cancelListingAction } = await import("@/app/local/actions");
    const { closeThreadForCancelledListing } = await import("@/lib/domain/local-threads/threads-service");

    const result = await cancelListingAction("33333333-3333-3333-3333-333333333333", "44444444-4444-4444-4444-444444444444");

    expect(result.status).toBe("success");
    expect(closeThreadForCancelledListing).toHaveBeenCalledWith("44444444-4444-4444-4444-444444444444");
    vi.doUnmock("@/lib/domain/local-threads/service");
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/local/__tests__/actions.test.ts`
Expected: FAIL, `respondToOfferAction`/`cancelListingAction` do not exist yet.

- [ ] **Step 3: Implement**

```typescript
// app/local/actions.ts, extend the existing import from
// "@/lib/domain/local-threads/threads-service" with: respondToOffer,
// withdrawOffer, cancelHandover, reportNoShow, hasLiveOfferOrHandover,
// closeThreadForCancelledListing, listBlockedUsers
// and add a new import:
import { withdrawLocalListing } from "@/lib/domain/local-threads/service";
import { confirmAge, declineAge, markSafetyBriefSeen } from "@/lib/domain/profile/service";

// then add:

export async function respondToOfferAction(messageId: string, threadId: string): Promise<ActionResult> {
  try {
    await respondToOffer(messageId);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to decline that offer." };
  }
}

export async function withdrawOfferAction(messageId: string, threadId: string): Promise<ActionResult> {
  try {
    await withdrawOffer(messageId);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to withdraw that offer." };
  }
}

export async function cancelHandoverAction(handoverId: string, threadId: string): Promise<ActionResult> {
  try {
    await cancelHandover(handoverId);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to cancel the handover." };
  }
}

export async function reportNoShowAction(handoverId: string, threadId: string): Promise<ActionResult> {
  try {
    await reportNoShow(handoverId);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to record that." };
  }
}

export async function cancelListingAction(listingId: string, threadIdToClose?: string): Promise<ActionResult> {
  try {
    await withdrawLocalListing(listingId);
    if (threadIdToClose) {
      await closeThreadForCancelledListing(threadIdToClose);
    }
    revalidatePath(`/local/${listingId}`);
    revalidatePath("/local/nearby");
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to cancel the listing." };
  }
}

export async function listBlockedUsersAction() {
  return listBlockedUsers();
}

export async function markSafetyBriefSeenAction(): Promise<void> {
  await markSafetyBriefSeen();
}

export async function confirmAgeAction(): Promise<void> {
  await confirmAge();
}

export async function declineAgeAction(): Promise<void> {
  await declineAge();
}
```

Check `app/account/profile-actions.ts`'s existing style (the `ProfileActionState` reducer
pattern `you-section.tsx` uses via `useActionState`) before deciding where
`markSafetyBriefSeenAction`/`confirmAgeAction`/`declineAgeAction` should live, they are placed
in `app/local/actions.ts` above because they are called imperatively (not via `useActionState`)
from `app/local/list/[garmentId]/page.tsx`'s dialogs in Task 9, matching how
`blockUserAction`/`reportListingAction` are already called imperatively from `thread-view.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/local/__tests__/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/local/actions.ts app/local/__tests__/actions.test.ts
git commit -m "Add server actions for offer decisions, handover lifecycle, listing cancel, and age/safety flags."
```

---

## Task 6: Offer decision dialog and cancel-listing dialog components

**Files:**
- Create: `components/garderobe/local-threads/offer-decision-dialog.tsx`
- Create: `components/garderobe/local-threads/cancel-listing-dialog.tsx`
- Modify: `components/garderobe/dialog.tsx` (add `hideCancel?: boolean` prop)
- Test: `components/garderobe/local-threads/__tests__/offer-decision-dialog.test.tsx`, `components/garderobe/local-threads/__tests__/cancel-listing-dialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog` from `components/garderobe/dialog.tsx`.
- Produces: `<Dialog hideCancel />` (new prop, backward compatible, omitted, both buttons render as today), `<OfferDecisionDialog open variant="decline"|"withdraw" counterpartName offerCents onConfirm onClose />`, `<CancelListingDialog open counterpartName hasOffer hasHandover onConfirm onClose />`, both consumed by Task 8/Task 6's own wiring.

- [ ] **Step 1: Extend `Dialog` with `hideCancel`**

```tsx
// components/garderobe/dialog.tsx, add to DialogProps:
  hideCancel?: boolean;

//, and in the render, replace the two-button block:
        <div className="flex gap-[9px] pt-1">
          {!hideCancel ? (
            <PillButton variant="secondary" onClick={onClose} className="h-11">
              {cancelLabel}
            </PillButton>
          ) : null}
          <PillButton variant={confirmVariant} onClick={onConfirm} className="h-11">
            {confirmLabel}
          </PillButton>
        </div>
```

Add `hideCancel = false` to the destructured props in the function signature, alongside the
other defaults.

- [ ] **Step 2: Write the failing tests**

```tsx
// components/garderobe/local-threads/__tests__/offer-decision-dialog.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferDecisionDialog } from "@/components/garderobe/local-threads/offer-decision-dialog";

describe("OfferDecisionDialog", () => {
  it("names the consequence for a seller declining an offer", () => {
    const onConfirm = vi.fn();
    render(
      <OfferDecisionDialog
        open
        variant="decline"
        counterpartName="sam"
        offerCents={18500}
        onConfirm={onConfirm}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/decline this offer\?/i)).toBeInTheDocument();
    expect(screen.getByText(/closes out sam's a\$185 offer/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^decline$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("names the consequence for a buyer withdrawing their own offer", () => {
    render(
      <OfferDecisionDialog
        open
        variant="withdraw"
        counterpartName="sam"
        offerCents={18500}
        onConfirm={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/withdraw your offer\?/i)).toBeInTheDocument();
    expect(screen.getByText(/removes your a\$185 offer to sam/i)).toBeInTheDocument();
  });
});
```

```tsx
// components/garderobe/local-threads/__tests__/cancel-listing-dialog.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CancelListingDialog } from "@/components/garderobe/local-threads/cancel-listing-dialog";

describe("CancelListingDialog", () => {
  it("names the live offer that will close, not just 'are you sure'", () => {
    render(
      <CancelListingDialog
        open
        counterpartName="sam"
        hasOffer
        hasHandover={false}
        onConfirm={vi.fn()}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/cancel this listing\?/i)).toBeInTheDocument();
    expect(screen.getByText(/sam's offer closes and the thread ends/i)).toBeInTheDocument();
  });

  it("falls back to the plain consequence with no live offer or handover", () => {
    render(
      <CancelListingDialog
        open
        counterpartName={null}
        hasOffer={false}
        hasHandover={false}
        onConfirm={vi.fn()}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/takes it off the nearby feed/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run components/garderobe/local-threads/__tests__/offer-decision-dialog.test.tsx components/garderobe/local-threads/__tests__/cancel-listing-dialog.test.tsx`
Expected: FAIL, neither component exists yet.

- [ ] **Step 4: Implement**

```tsx
// components/garderobe/local-threads/offer-decision-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type OfferDecisionDialogProps = {
  open: boolean;
  variant: "decline" | "withdraw";
  counterpartName: string;
  offerCents: number;
  onConfirm: () => void;
  onClose: () => void;
};

/** Missing item, "decline an offer / withdraw an offer". One dialog, two directions. */
export function OfferDecisionDialog({
  open,
  variant,
  counterpartName,
  offerCents,
  onConfirm,
  onClose
}: OfferDecisionDialogProps) {
  const amount = `A$${Math.round(offerCents / 100)}`;

  if (variant === "decline") {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="decline this offer?"
        description={`closes out ${counterpartName}'s ${amount} offer. they can still send another one.`}
        confirmLabel="decline"
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="withdraw your offer?"
      description={`removes your ${amount} offer to ${counterpartName}. you can offer again anytime.`}
      confirmLabel="withdraw"
      onConfirm={onConfirm}
    />
  );
}
```

```tsx
// components/garderobe/local-threads/cancel-listing-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type CancelListingDialogProps = {
  open: boolean;
  counterpartName: string | null;
  hasOffer: boolean;
  hasHandover: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Missing item, "cancel a listing with a live offer". */
export function CancelListingDialog({
  open,
  counterpartName,
  hasOffer,
  hasHandover,
  onConfirm,
  onClose
}: CancelListingDialogProps) {
  const name = counterpartName ?? "the other person";
  const description = hasHandover
    ? `you have a handover arranged with ${name}. cancelling the listing cancels that too, and the thread ends.`
    : hasOffer
      ? `${name}'s offer closes and the thread ends. the piece stays in your wardrobe, but this can't be undone.`
      : "takes it off the nearby feed. the piece stays in your wardrobe.";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="cancel this listing?"
      description={description}
      confirmLabel="cancel listing"
      onConfirm={onConfirm}
    />
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/garderobe/local-threads/__tests__/offer-decision-dialog.test.tsx components/garderobe/local-threads/__tests__/cancel-listing-dialog.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/garderobe/dialog.tsx components/garderobe/local-threads/offer-decision-dialog.tsx components/garderobe/local-threads/cancel-listing-dialog.tsx components/garderobe/local-threads/__tests__/offer-decision-dialog.test.tsx components/garderobe/local-threads/__tests__/cancel-listing-dialog.test.tsx
git commit -m "Add the offer-decision and cancel-listing dialogs, and a hideCancel option on Dialog."
```

---

## Task 7: Handover manage sheet and no-show sheet components

**Files:**
- Create: `components/garderobe/local-threads/handover-manage-sheet.tsx`
- Create: `components/garderobe/local-threads/no-show-sheet.tsx`
- Test: `components/garderobe/local-threads/__tests__/handover-manage-sheet.test.tsx`, `components/garderobe/local-threads/__tests__/no-show-sheet.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `SheetAction` from `components/garderobe/bottom-sheet.tsx`.
- Produces: `<HandoverManageSheet open placeName placeSuburb at onReschedule onCancel onClose />`, `<NoShowSheet open counterpartName placeName at onReport onClose />`, both consumed by Task 8's thread-view wiring.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/garderobe/local-threads/__tests__/handover-manage-sheet.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverManageSheet } from "@/components/garderobe/local-threads/handover-manage-sheet";

describe("HandoverManageSheet", () => {
  it("offers reschedule and cancel, and calls the right handler for each", () => {
    const onReschedule = vi.fn();
    const onCancel = vi.fn();
    render(
      <HandoverManageSheet
        open
        placeName="the food court"
        placeSuburb="Rundle Mall"
        at="2026-09-10T10:00:00.000Z"
        onReschedule={onReschedule}
        onCancel={onCancel}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByText("reschedule"));
    expect(onReschedule).toHaveBeenCalled();
    fireEvent.click(screen.getByText("cancel handover"));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

```tsx
// components/garderobe/local-threads/__tests__/no-show-sheet.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoShowSheet } from "@/components/garderobe/local-threads/no-show-sheet";

describe("NoShowSheet", () => {
  it("names who was due and where before recording a no-show", () => {
    const onReport = vi.fn();
    render(
      <NoShowSheet
        open
        counterpartName="sam"
        placeName="the food court"
        at="2026-09-10T10:00:00.000Z"
        onReport={onReport}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/sam was due at the food court/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("they didn't show"));
    expect(onReport).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/garderobe/local-threads/__tests__/handover-manage-sheet.test.tsx components/garderobe/local-threads/__tests__/no-show-sheet.test.tsx`
Expected: FAIL, neither component exists yet.

- [ ] **Step 3: Implement**

```tsx
// components/garderobe/local-threads/handover-manage-sheet.tsx
"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

type HandoverManageSheetProps = {
  open: boolean;
  placeName: string;
  placeSuburb: string;
  at: string;
  onReschedule: () => void;
  onCancel: () => void;
  onClose: () => void;
};

/** Missing item, "cancel or reschedule a handover". */
export function HandoverManageSheet({
  open,
  placeName,
  placeSuburb,
  at,
  onReschedule,
  onCancel,
  onClose
}: HandoverManageSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="this handover"
      description={`${placeName}, ${placeSuburb} · ${new Date(at).toLocaleString("en-AU")}`}
    >
      <div>
        <SheetAction onClick={onReschedule}>reschedule</SheetAction>
        <SheetAction destructive last onClick={onCancel}>
          cancel handover
        </SheetAction>
      </div>
    </BottomSheet>
  );
}
```

```tsx
// components/garderobe/local-threads/no-show-sheet.tsx
"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

type NoShowSheetProps = {
  open: boolean;
  counterpartName: string;
  placeName: string;
  at: string;
  onReport: () => void;
  onClose: () => void;
};

/** Missing item, "they didn't show", the only trust signal the marketplace has. */
export function NoShowSheet({ open, counterpartName, placeName, at, onReport, onClose }: NoShowSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="they didn't show?"
      description={`${counterpartName} was due at ${placeName} on ${new Date(at).toLocaleString("en-AU")}.`}
    >
      <div>
        <SheetAction onClick={onClose}>give it a bit longer</SheetAction>
        <SheetAction destructive last onClick={onReport}>
          they didn&apos;t show
        </SheetAction>
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/garderobe/local-threads/__tests__/handover-manage-sheet.test.tsx components/garderobe/local-threads/__tests__/no-show-sheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/garderobe/local-threads/handover-manage-sheet.tsx components/garderobe/local-threads/no-show-sheet.tsx components/garderobe/local-threads/__tests__/handover-manage-sheet.test.tsx components/garderobe/local-threads/__tests__/no-show-sheet.test.tsx
git commit -m "Add the handover manage and no-show sheets."
```

---

## Task 8: Report sheet and block dialog components

**Files:**
- Create: `components/garderobe/local-threads/report-listing-sheet.tsx`
- Create: `components/garderobe/local-threads/block-user-dialog.tsx`
- Test: `components/garderobe/local-threads/__tests__/report-listing-sheet.test.tsx`, `components/garderobe/local-threads/__tests__/block-user-dialog.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `SheetAction`, `Dialog`.
- Produces: `<ReportListingSheet open onSubmit={(reason: string) => Promise<void>} onClose />`, `<BlockUserDialog open counterpartName onConfirm onClose />`, both consumed by Task 9's thread-view wiring.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/garderobe/local-threads/__tests__/report-listing-sheet.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportListingSheet } from "@/components/garderobe/local-threads/report-listing-sheet";

describe("ReportListingSheet", () => {
  it("says the other person is never told, and submits the chosen reason", async () => {
    const onSubmit = vi.fn(async () => {});
    render(<ReportListingSheet open onSubmit={onSubmit} onClose={() => {}} />);

    expect(screen.getByText(/never told you reported them/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("spam"));
    fireEvent.click(screen.getByRole("button", { name: /send report/i }));

    expect(onSubmit).toHaveBeenCalledWith("spam");
  });

  it("requires text when 'something else' is chosen", () => {
    render(<ReportListingSheet open onSubmit={vi.fn()} onClose={() => {}} />);

    fireEvent.click(screen.getByText("something else"));
    expect(screen.getByRole("button", { name: /send report/i })).toBeDisabled();
  });
});
```

```tsx
// components/garderobe/local-threads/__tests__/block-user-dialog.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlockUserDialog } from "@/components/garderobe/local-threads/block-user-dialog";

describe("BlockUserDialog", () => {
  it("names the consequence: thread ends, listings hide, no notice", () => {
    const onConfirm = vi.fn();
    render(<BlockUserDialog open counterpartName="sam" onConfirm={onConfirm} onClose={() => {}} />);

    expect(screen.getByText(/block sam\?/i)).toBeInTheDocument();
    expect(screen.getByText(/ends this thread for both of you/i)).toBeInTheDocument();
    expect(screen.getByText(/they won't be told/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^block$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/garderobe/local-threads/__tests__/report-listing-sheet.test.tsx components/garderobe/local-threads/__tests__/block-user-dialog.test.tsx`
Expected: FAIL, neither component exists yet.

- [ ] **Step 3: Implement**

```tsx
// components/garderobe/local-threads/report-listing-sheet.tsx
"use client";

import { useState } from "react";
import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";
import { PillButton } from "@/components/garderobe";

const REPORT_REASONS = [
  "fake or misleading",
  "inappropriate content",
  "unsafe or harassing behaviour",
  "spam",
  "something else"
] as const;

type ReportListingSheetProps = {
  open: boolean;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
};

/** Missing item, "report a listing / report a person". `blockUser` and `reportListing`
 * already exist server-side; this is their first UI. */
export function ReportListingSheet({ open, onSubmit, onClose }: ReportListingSheetProps) {
  const [selected, setSelected] = useState<(typeof REPORT_REASONS)[number] | null>(null);
  const [otherText, setOtherText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOther = selected === "something else";
  const canSubmit = selected !== null && (!isOther || otherText.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || !selected) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(isOther ? otherText.trim() : selected);
      onClose();
    } catch {
      setError("couldn't send that. try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="report this listing"
      description="tell us what's wrong. the other person is never told you reported them."
    >
      <div>
        {REPORT_REASONS.map((reason, index) => (
          <SheetAction key={reason} last={index === REPORT_REASONS.length - 1} onClick={() => setSelected(reason)}>
            {reason}
            {selected === reason ? " ✓" : ""}
          </SheetAction>
        ))}
      </div>
      {isOther ? (
        <textarea
          value={otherText}
          onChange={(event) => setOtherText(event.target.value.slice(0, 500))}
          rows={3}
          placeholder="what happened?"
          className="mt-3 w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
        />
      ) : null}
      {error ? <p className="pt-2 text-[11px] text-[var(--oxblood)]">{error}</p> : null}
      <div className="pt-4">
        <PillButton disabled={!canSubmit || isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? "sending…" : "send report"}
        </PillButton>
      </div>
    </BottomSheet>
  );
}
```

```tsx
// components/garderobe/local-threads/block-user-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type BlockUserDialogProps = {
  open: boolean;
  counterpartName: string;
  onConfirm: () => void;
  onClose: () => void;
};

/** Missing item, "block, confirm". Replaces the raw confirm() in thread-view.tsx. */
export function BlockUserDialog({ open, counterpartName, onConfirm, onClose }: BlockUserDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`block ${counterpartName}?`}
      description="ends this thread for both of you and hides their listings from your feed. they won't be told."
      confirmLabel="block"
      onConfirm={onConfirm}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/garderobe/local-threads/__tests__/report-listing-sheet.test.tsx components/garderobe/local-threads/__tests__/block-user-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/garderobe/local-threads/report-listing-sheet.tsx components/garderobe/local-threads/block-user-dialog.tsx components/garderobe/local-threads/__tests__/report-listing-sheet.test.tsx components/garderobe/local-threads/__tests__/block-user-dialog.test.tsx
git commit -m "Add the report-listing sheet and block-confirm dialog."
```

---

## Task 9: Safety brief and age check dialog components

**Files:**
- Create: `components/garderobe/local-threads/safety-brief-dialog.tsx`
- Create: `components/garderobe/local-threads/age-check-dialog.tsx`
- Test: `components/garderobe/local-threads/__tests__/safety-brief-dialog.test.tsx`, `components/garderobe/local-threads/__tests__/age-check-dialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog` (with `hideCancel` from Task 6).
- Produces: `<SafetyBriefDialog open onAcknowledge onClose />`, `<AgeCheckDialog open onConfirmAdult onDeclineUnderage onClose />`, `<AgeBlockedDialog open onDismiss />`, all consumed by Task 10's listing-page wiring.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/garderobe/local-threads/__tests__/safety-brief-dialog.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SafetyBriefDialog } from "@/components/garderobe/local-threads/safety-brief-dialog";

describe("SafetyBriefDialog", () => {
  it("has a single acknowledgement button, no cancel", () => {
    const onAcknowledge = vi.fn();
    render(<SafetyBriefDialog open onAcknowledge={onAcknowledge} onClose={() => {}} />);

    expect(screen.getByText(/before you list/i)).toBeInTheDocument();
    expect(screen.getByText(/meet in a public place/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onAcknowledge).toHaveBeenCalled();
  });
});
```

```tsx
// components/garderobe/local-threads/__tests__/age-check-dialog.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgeCheckDialog, AgeBlockedDialog } from "@/components/garderobe/local-threads/age-check-dialog";

describe("AgeCheckDialog", () => {
  it("routes 18-or-over and under-18 to the two different handlers", () => {
    const onConfirmAdult = vi.fn();
    const onDeclineUnderage = vi.fn();
    render(
      <AgeCheckDialog open onConfirmAdult={onConfirmAdult} onDeclineUnderage={onDeclineUnderage} onClose={() => {}} />
    );

    expect(screen.getByText(/confirm you're 18 or over/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /i'm under 18/i }));
    expect(onDeclineUnderage).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /i'm 18 or over/i }));
    expect(onConfirmAdult).toHaveBeenCalled();
  });
});

describe("AgeBlockedDialog", () => {
  it("has a single dismiss button and names what still works", () => {
    const onDismiss = vi.fn();
    render(<AgeBlockedDialog open onDismiss={onDismiss} />);

    expect(screen.getByText(/needs an adult/i)).toBeInTheDocument();
    expect(screen.getByText(/every other part of garderobe/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ok/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/garderobe/local-threads/__tests__/safety-brief-dialog.test.tsx components/garderobe/local-threads/__tests__/age-check-dialog.test.tsx`
Expected: FAIL, none of the components exist yet.

- [ ] **Step 3: Implement**

```tsx
// components/garderobe/local-threads/safety-brief-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type SafetyBriefDialogProps = {
  open: boolean;
  onAcknowledge: () => void;
  onClose: () => void;
};

/** Missing item, "first listing safety brief". One-time, informational, no "no" answer. */
export function SafetyBriefDialog({ open, onAcknowledge, onClose }: SafetyBriefDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        onAcknowledge();
        onClose();
      }}
      title="before you list"
      description="meet in a public place, and never share your address. garderobe doesn't move money for you, arrange cash, payid or a bank transfer directly with the other person."
      confirmLabel="got it"
      hideCancel
      onConfirm={onAcknowledge}
    />
  );
}
```

```tsx
// components/garderobe/local-threads/age-check-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type AgeCheckDialogProps = {
  open: boolean;
  onConfirmAdult: () => void;
  onDeclineUnderage: () => void;
  onClose: () => void;
};

/** Missing item, "age check". Policy default on decline: LOCAL_THREADS_TRUST_SAFETY_SPEC.md §8. */
export function AgeCheckDialog({ open, onConfirmAdult, onDeclineUnderage, onClose }: AgeCheckDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="confirm you're 18 or over"
      description="local threads means arranging your own handover with a stranger, so it's for adults only."
      cancelLabel="I'm under 18"
      confirmLabel="I'm 18 or over"
      onConfirm={onConfirmAdult}
    />
  );
}

type AgeBlockedDialogProps = {
  open: boolean;
  onDismiss: () => void;
};

export function AgeBlockedDialog({ open, onDismiss }: AgeBlockedDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      title="local threads needs an adult"
      description="you can keep using every other part of Garderobe. this stays off until you're 18."
      confirmLabel="ok"
      hideCancel
      onConfirm={onDismiss}
    />
  );
}
```

Note: `Dialog`'s `onClose` fires from the backdrop-dismiss button (`components/garderobe/dialog.tsx`'s `aria-label="dismiss"` button) as well as any `cancelLabel` button, `AgeCheckDialog` deliberately leaves `onClose` as a no-op-from-the-caller's-perspective dismiss (closes the dialog without recording either answer) rather than wiring it to `onDeclineUnderage`, since backdrop-dismiss is not the same affirmative action as tapping "I'm under 18".

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/garderobe/local-threads/__tests__/safety-brief-dialog.test.tsx components/garderobe/local-threads/__tests__/age-check-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/garderobe/local-threads/safety-brief-dialog.tsx components/garderobe/local-threads/age-check-dialog.tsx components/garderobe/local-threads/__tests__/safety-brief-dialog.test.tsx components/garderobe/local-threads/__tests__/age-check-dialog.test.tsx
git commit -m "Add the safety brief and age check dialogs."
```

---

## Task 10: Wire the age check and safety brief into the listing flow

**Files:**
- Create: `components/garderobe/local-threads/listing-gate.tsx` (client component orchestrating the two one-time dialogs)
- Modify: `app/local/list/[garmentId]/page.tsx` (read the profile's three new flags, render `ListingGate` wrapping `ListingForm`, or a permanent blocked state)
- Test: `components/garderobe/local-threads/__tests__/listing-gate.test.tsx`

**Interfaces:**
- Consumes: `AgeCheckDialog`, `AgeBlockedDialog`, `SafetyBriefDialog` from Tasks 6/9, `confirmAgeAction`, `declineAgeAction`, `markSafetyBriefSeenAction` from Task 5.
- Produces: `<ListingGate ageConfirmed ageDeclined safetyBriefSeen onBlockedDismiss children />`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/garderobe/local-threads/__tests__/listing-gate.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListingGate } from "@/components/garderobe/local-threads/listing-gate";

vi.mock("@/app/local/actions", () => ({
  confirmAgeAction: vi.fn(async () => {}),
  declineAgeAction: vi.fn(async () => {}),
  markSafetyBriefSeenAction: vi.fn(async () => {})
}));

describe("ListingGate", () => {
  it("shows the age check first when nothing has been answered yet", () => {
    render(
      <ListingGate ageConfirmed={false} ageDeclined={false} safetyBriefSeen={false} onBlockedDismiss={() => {}}>
        <p>the form</p>
      </ListingGate>
    );

    expect(screen.getByText(/confirm you're 18 or over/i)).toBeInTheDocument();
    expect(screen.queryByText("the form")).not.toBeInTheDocument();
  });

  it("shows the permanent block once age has been declined, never the form", () => {
    render(
      <ListingGate ageConfirmed={false} ageDeclined onBlockedDismiss={() => {}} safetyBriefSeen={false}>
        <p>the form</p>
      </ListingGate>
    );

    expect(screen.getByText(/needs an adult/i)).toBeInTheDocument();
    expect(screen.queryByText("the form")).not.toBeInTheDocument();
  });

  it("shows the safety brief, then the form, once age is confirmed", () => {
    render(
      <ListingGate ageConfirmed safetyBriefSeen={false} ageDeclined={false} onBlockedDismiss={() => {}}>
        <p>the form</p>
      </ListingGate>
    );

    expect(screen.getByText(/before you list/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(screen.getByText("the form")).toBeInTheDocument();
  });

  it("renders straight through once both flags are set", () => {
    render(
      <ListingGate ageConfirmed safetyBriefSeen ageDeclined={false} onBlockedDismiss={() => {}}>
        <p>the form</p>
      </ListingGate>
    );

    expect(screen.getByText("the form")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/garderobe/local-threads/__tests__/listing-gate.test.tsx`
Expected: FAIL, `ListingGate` does not exist yet.

- [ ] **Step 3: Implement**

```tsx
// components/garderobe/local-threads/listing-gate.tsx
"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AgeBlockedDialog, AgeCheckDialog } from "@/components/garderobe/local-threads/age-check-dialog";
import { SafetyBriefDialog } from "@/components/garderobe/local-threads/safety-brief-dialog";
import { confirmAgeAction, declineAgeAction, markSafetyBriefSeenAction } from "@/app/local/actions";

type ListingGateProps = {
  ageConfirmed: boolean;
  ageDeclined: boolean;
  safetyBriefSeen: boolean;
  onBlockedDismiss: () => void;
  children: ReactNode;
};

/**
 * Orchestrates the two one-time gates in front of "list it locally":
 * age check, then the safety brief. Age-declined is permanent for this
 * build, see LOCAL_THREADS_TRUST_SAFETY_SPEC.md §8.
 */
export function ListingGate({ ageConfirmed, ageDeclined, safetyBriefSeen, onBlockedDismiss, children }: ListingGateProps) {
  const router = useRouter();
  const [localAgeConfirmed, setLocalAgeConfirmed] = useState(ageConfirmed);
  const [localSafetyBriefSeen, setLocalSafetyBriefSeen] = useState(safetyBriefSeen);

  if (ageDeclined) {
    return (
      <AgeBlockedDialog
        open
        onDismiss={() => {
          onBlockedDismiss();
          router.back();
        }}
      />
    );
  }

  if (!localAgeConfirmed) {
    return (
      <AgeCheckDialog
        open
        onClose={() => {}}
        onConfirmAdult={async () => {
          await confirmAgeAction();
          setLocalAgeConfirmed(true);
        }}
        onDeclineUnderage={async () => {
          await declineAgeAction();
          router.back();
        }}
      />
    );
  }

  if (!localSafetyBriefSeen) {
    return (
      <SafetyBriefDialog
        open
        onClose={() => {}}
        onAcknowledge={async () => {
          await markSafetyBriefSeenAction();
          setLocalSafetyBriefSeen(true);
        }}
      />
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/garderobe/local-threads/__tests__/listing-gate.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire it into the listing page**

```tsx
// app/local/list/[garmentId]/page.tsx, replace the getGarmentById-only fetch and the
// direct <ListingForm ... /> render:

import { getOrCreateProfile } from "@/lib/domain/profile/service";
import { ListingGate } from "@/components/garderobe/local-threads/listing-gate";

// inside the component, after fetching garment:
    const profile = await getOrCreateProfile();

// replace the closing <ListingForm .../> with:
        <ListingGate
          ageConfirmed={Boolean(profile.age_confirmed_at)}
          ageDeclined={Boolean(profile.age_declined_at)}
          safetyBriefSeen={Boolean(profile.local_safety_brief_seen_at)}
          onBlockedDismiss={() => {}}
        >
          <ListingForm
            garmentId={garmentId}
            suggestedTitle={garment.title || garment.category}
            suggestedSize={garment.size ?? null}
            wearCount={garment.wear_count}
          />
        </ListingGate>
```

- [ ] **Step 6: Run the full local-threads and profile test suites to check nothing regressed**

Run: `npx vitest run components/garderobe/local-threads lib/domain/local-threads lib/domain/profile app/local`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/garderobe/local-threads/listing-gate.tsx components/garderobe/local-threads/__tests__/listing-gate.test.tsx app/local/list/[garmentId]/page.tsx
git commit -m "Gate the listing flow behind the age check and first-listing safety brief."
```

---

## Task 11: Wire offer decisions, handover management, and no-show into the thread view

**Files:**
- Modify: `app/local/threads/[id]/thread-view.tsx` (render offer decision text-actions per pending offer message, add handover manage/no-show sheets, replace `confirm()`/`prompt()`/`alert()` with the new dialogs)
- Test: `app/local/threads/[id]/__tests__/thread-view.test.tsx` (new, check for an existing `__tests__` dir under `app/local/threads/[id]/` first)

**Interfaces:**
- Consumes: `OfferDecisionDialog`, `CancelListingDialog` (unused here, wired in Task 12), `HandoverManageSheet`, `NoShowSheet`, `ReportListingSheet`, `BlockUserDialog` from Tasks 6-8; `respondToOfferAction`, `withdrawOfferAction`, `cancelHandoverAction`, `reportNoShowAction`, `reportListingAction`, `blockUserAction` from `@/app/local/actions`.
- Produces: an updated `ThreadView` with no `window.confirm`/`window.prompt`/`window.alert` calls anywhere in the file.

- [ ] **Step 1: Write the failing test**

```tsx
// app/local/threads/[id]/__tests__/thread-view.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThreadView } from "@/app/local/threads/[id]/thread-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn() })
}));
vi.mock("@/app/local/actions", () => ({
  sendMessageAction: vi.fn(async () => ({ status: "success" })),
  proposeHandoverAction: vi.fn(async () => ({ status: "success" })),
  respondToHandoverAction: vi.fn(async () => ({ status: "success" })),
  confirmHandoverAction: vi.fn(async () => ({ status: "success" })),
  blockUserAction: vi.fn(async () => ({ status: "success" })),
  reportListingAction: vi.fn(async () => ({ status: "success" })),
  respondToOfferAction: vi.fn(async () => ({ status: "success" })),
  withdrawOfferAction: vi.fn(async () => ({ status: "success" })),
  cancelHandoverAction: vi.fn(async () => ({ status: "success" })),
  reportNoShowAction: vi.fn(async () => ({ status: "success" }))
}));

const baseThread = {
  id: "11111111-1111-1111-1111-111111111111",
  listing_id: "22222222-2222-2222-2222-222222222222",
  buyer_id: "33333333-3333-3333-3333-333333333333",
  seller_id: "44444444-4444-4444-4444-444444444444",
  state: "open",
  last_message_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z"
};

describe("ThreadView block and report", () => {
  it("opens a real dialog for block, not window.confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <ThreadView
        viewerId={baseThread.buyer_id}
        thread={baseThread}
        initialMessages={[]}
        initialHandover={null}
        counterpartName="sam"
      />
    );

    fireEvent.click(screen.getByText("block"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/block sam\?/i)).toBeInTheDocument();
  });

  it("opens a real sheet for report, not window.prompt", () => {
    const promptSpy = vi.spyOn(window, "prompt");
    render(
      <ThreadView
        viewerId={baseThread.buyer_id}
        thread={baseThread}
        initialMessages={[]}
        initialHandover={null}
        counterpartName="sam"
      />
    );

    fireEvent.click(screen.getByText("report"));
    expect(promptSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/report this listing/i)).toBeInTheDocument();
  });

  it("offers decline on a pending offer message from the counterpart", () => {
    render(
      <ThreadView
        viewerId={baseThread.seller_id}
        thread={baseThread}
        initialMessages={[
          {
            id: "55555555-5555-5555-5555-555555555555",
            thread_id: baseThread.id,
            sender_id: baseThread.buyer_id,
            kind: "offer",
            body: "",
            offer_cents: 18500,
            offer_status: "pending",
            sent_at: "2026-01-01T00:00:00Z",
            read_at: null
          }
        ]}
        initialHandover={null}
        counterpartName="sam"
      />
    );

    fireEvent.click(screen.getByText("decline"));
    expect(screen.getByText(/decline this offer\?/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/local/threads/[id]/__tests__/thread-view.test.tsx"`
Expected: FAIL, `window.confirm`/`window.prompt` are still called, offer decline text action doesn't exist, `offer_status` isn't read.

- [ ] **Step 3: Implement**

Update `app/local/threads/[id]/thread-view.tsx`:

```tsx
// Add to imports:
import { OfferDecisionDialog } from "@/components/garderobe/local-threads/offer-decision-dialog";
import { HandoverManageSheet } from "@/components/garderobe/local-threads/handover-manage-sheet";
import { NoShowSheet } from "@/components/garderobe/local-threads/no-show-sheet";
import { ReportListingSheet } from "@/components/garderobe/local-threads/report-listing-sheet";
import { BlockUserDialog } from "@/components/garderobe/local-threads/block-user-dialog";
import {
  cancelHandoverAction,
  reportNoShowAction,
  respondToOfferAction,
  withdrawOfferAction
} from "@/app/local/actions";

// Replace the message-bubble render loop's offer branch so a pending offer from the *other*
// party shows the decision dialog trigger, and the offer's own status renders inline:
        {messages.map((message) => {
          const isMine = message.sender_id === viewerId;
          const isPendingOffer = message.kind === "offer" && message.offer_status === "pending";
          return (
            <div
              key={message.id}
              className={[
                "max-w-[80%] rounded-[14px] px-3 py-2 text-[12.5px]",
                isMine ? "self-end bg-[var(--oxblood)] text-[var(--cream)]" : "self-start bg-[var(--cream)] text-[var(--ink)]"
              ].join(" ")}
            >
              {message.kind === "offer" ? (
                <span className="font-semibold">
                  offered A${((message.offer_cents ?? 0) / 100).toFixed(0)}
                  {message.offer_status && message.offer_status !== "pending" ? ` · ${message.offer_status}` : ""}
                </span>
              ) : null}
              {message.body ? <p>{message.body}</p> : null}
              {isPendingOffer ? (
                <button
                  type="button"
                  className={["mt-1 block text-[10.5px] underline", isMine ? "text-[var(--cream)]" : "text-[var(--stone)]"].join(" ")}
                  onClick={() => setOfferDecision(message)}
                >
                  {isMine ? "withdraw" : "decline"}
                </button>
              ) : null}
            </div>
          );
        })}

// Add state near the top of ThreadView, alongside the existing useState calls:
  const [offerDecision, setOfferDecision] = useState<ThreadMessage | null>(null);
  const [showHandoverManage, setShowHandoverManage] = useState(false);
  const [showNoShow, setShowNoShow] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);

// Replace the handover block's "handover · {state}" header so a manage entry point appears
// while the handover is still editable, and a no-show entry point appears once its time has
// passed:
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
                  handover · {handover.state}
                </p>
                {handover.state === "proposed" || handover.state === "agreed" ? (
                  <button type="button" className="text-[11px] underline text-[var(--stone)]" onClick={() => setShowHandoverManage(true)}>
                    manage
                  </button>
                ) : null}
              </div>
              {(handover.state === "proposed" || handover.state === "agreed") && new Date(handover.at) < new Date() ? (
                <button type="button" className="mt-2 text-[11px] underline text-[var(--oxblood)]" onClick={() => setShowNoShow(true)}>
                  they didn't show?
                </button>
              ) : null}

// Replace the block/report buttons' onClick handlers:
          <button type="button" className="underline" onClick={() => setShowBlock(true)}>
            block
          </button>
          <button type="button" className="underline" onClick={() => setShowReport(true)}>
            report
          </button>

// Add before the component's closing </div>, alongside the other JSX:
      {offerDecision ? (
        <OfferDecisionDialog
          open
          variant={offerDecision.sender_id === viewerId ? "withdraw" : "decline"}
          counterpartName={counterpartName}
          offerCents={offerDecision.offer_cents ?? 0}
          onClose={() => setOfferDecision(null)}
          onConfirm={async () => {
            if (offerDecision.sender_id === viewerId) {
              await withdrawOfferAction(offerDecision.id, thread.id);
            } else {
              await respondToOfferAction(offerDecision.id, thread.id);
            }
            setOfferDecision(null);
            router.refresh();
          }}
        />
      ) : null}
      {handover ? (
        <HandoverManageSheet
          open={showHandoverManage}
          placeName={handover.place_name}
          placeSuburb={handover.place_suburb}
          at={handover.at}
          onClose={() => setShowHandoverManage(false)}
          onReschedule={async () => {
            await cancelHandoverAction(handover.id, thread.id);
            setShowHandoverManage(false);
            setShowHandoverForm(true);
            router.refresh();
          }}
          onCancel={async () => {
            await cancelHandoverAction(handover.id, thread.id);
            setShowHandoverManage(false);
            router.refresh();
          }}
        />
      ) : null}
      {handover ? (
        <NoShowSheet
          open={showNoShow}
          counterpartName={counterpartName}
          placeName={handover.place_name}
          at={handover.at}
          onClose={() => setShowNoShow(false)}
          onReport={async () => {
            await reportNoShowAction(handover.id, thread.id);
            setShowNoShow(false);
            router.refresh();
          }}
        />
      ) : null}
      <ReportListingSheet
        open={showReport}
        onClose={() => setShowReport(false)}
        onSubmit={async (reason) => {
          await reportListingAction(thread.listing_id, reason);
        }}
      />
      <BlockUserDialog
        open={showBlock}
        counterpartName={counterpartName}
        onClose={() => setShowBlock(false)}
        onConfirm={async () => {
          const counterpartId = iAmBuyer ? thread.seller_id : thread.buyer_id;
          await blockUserAction(counterpartId, thread.id);
          setShowBlock(false);
          router.refresh();
        }}
      />
```

Remove the old inline block/report `<section>` body that called `confirm()`/`prompt()`/`alert()`
entirely, replacing it with the button pair shown above plus the dialogs rendered at the bottom.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/local/threads/[id]/__tests__/thread-view.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/local/threads/[id]/thread-view.tsx" "app/local/threads/[id]/__tests__/thread-view.test.tsx"
git commit -m "Replace confirm/prompt/alert in the thread view with real offer, handover, report, and block dialogs."
```

---

## Task 12: Wire cancel-listing into the seller's own listing page, and the blocked-users list into account

**Files:**
- Create: `app/local/[id]/manage-listing.tsx` (client component: cancel-listing button + dialog)
- Modify: `app/local/[id]/page.tsx` (render `ManageListing` in place of the current "this is your listing" paragraph, pass in the live-offer/handover check)
- Modify: `app/account/you-section.tsx` (add the "blocked · N" section)
- Test: `app/local/[id]/__tests__/manage-listing.test.tsx`, `app/account/__tests__/you-section.test.tsx` (new, check for an existing `__tests__` dir under `app/account/` first)

**Interfaces:**
- Consumes: `CancelListingDialog` (Task 6), `hasLiveOfferOrHandover`, `listBlockedUsers` (Task 4), `cancelListingAction`, `listBlockedUsersAction`, `unblockUserAction` (Task 5/existing).
- Produces: seller-facing "cancel listing" control on `/local/[id]`; "blocked" section on `/account`.

- [ ] **Step 1: Write the failing tests**

```tsx
// app/local/[id]/__tests__/manage-listing.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManageListing } from "@/app/local/[id]/manage-listing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/local/actions", () => ({
  cancelListingAction: vi.fn(async () => ({ status: "success" }))
}));

describe("ManageListing", () => {
  it("opens the cancel-listing dialog naming the live offer, not a bare confirm", () => {
    render(
      <ManageListing
        listingId="11111111-1111-1111-1111-111111111111"
        hasOffer
        hasHandover={false}
        counterpartName="sam"
        counterpartThreadId="22222222-2222-2222-2222-222222222222"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel listing/i }));
    expect(screen.getByText(/sam's offer closes and the thread ends/i)).toBeInTheDocument();
  });
});
```

```tsx
// app/account/__tests__/you-section.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YouSection } from "@/app/account/you-section";

vi.mock("@/app/account/profile-actions", () => ({
  updateProfileAction: vi.fn(async (state: unknown) => state),
  updateSizesAction: vi.fn(async (state: unknown) => state),
  updateLocalPrivacyAction: vi.fn(async (state: unknown) => state)
}));
vi.mock("@/app/local/actions", () => ({
  unblockUserAction: vi.fn(async () => ({ status: "success" }))
}));

const profile = {
  local_name: "esther",
  suburb: "norwood",
  tops_size: null,
  bottoms_size: null,
  shoes_size: null,
  tops_size_system: "AU",
  bottoms_size_system: "AU",
  shoes_size_system: "AU",
  height_cm: null,
  one_size_either_way: false,
  show_suburb: true,
  show_wear_count: true,
  user_id: "11111111-1111-1111-1111-111111111111",
  suburb_lat: null,
  suburb_lng: null,
  radius_km: 30,
  onboarding_completed_at: null,
  local_safety_brief_seen_at: null,
  age_confirmed_at: null,
  age_declined_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};

const preview = {
  userId: "11111111-1111-1111-1111-111111111111",
  localName: "esther",
  suburb: "norwood",
  avatarUri: null,
  joinedAt: "2026-01-01T00:00:00Z",
  handoverCount: 0,
  listedCount: 0
};

describe("YouSection blocked list", () => {
  it("shows the empty state when nobody is blocked", () => {
    render(<YouSection profile={profile as never} preview={preview} blockedUsers={[]} />);
    expect(screen.getByText(/blocked · 0/i)).toBeInTheDocument();
    expect(screen.getByText(/haven't blocked anyone/i)).toBeInTheDocument();
  });

  it("lists a blocked user with an unblock action", () => {
    render(
      <YouSection
        profile={profile as never}
        preview={preview}
        blockedUsers={[{ userId: "33333333-3333-3333-3333-333333333333", localName: "sam", blockedAt: "2026-01-01T00:00:00Z" }]}
      />
    );
    expect(screen.getByText(/blocked · 1/i)).toBeInTheDocument();
    expect(screen.getByText("sam")).toBeInTheDocument();
    fireEvent.click(screen.getByText("unblock"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/local/[id]/__tests__/manage-listing.test.tsx" app/account/__tests__/you-section.test.tsx`
Expected: FAIL, `ManageListing` doesn't exist yet; `YouSection` doesn't accept a `blockedUsers` prop yet.

- [ ] **Step 3: Implement `ManageListing`**

```tsx
// app/local/[id]/manage-listing.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/garderobe";
import { CancelListingDialog } from "@/components/garderobe/local-threads/cancel-listing-dialog";
import { cancelListingAction } from "@/app/local/actions";

type ManageListingProps = {
  listingId: string;
  hasOffer: boolean;
  hasHandover: boolean;
  counterpartName: string | null;
  counterpartThreadId: string | null;
};

/** Missing item, "cancel a listing with a live offer" (also covers the plain cancel case,
 * which had no UI at all before this). */
export function ManageListing({ listingId, hasOffer, hasHandover, counterpartName, counterpartThreadId }: ManageListingProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-6">
      <p className="text-[11px] text-[var(--stone)]">this is your listing</p>
      <div className="mt-3 flex gap-2">
        <PillButton fullWidth={false} variant="secondary" onClick={() => setOpen(true)}>
          cancel listing
        </PillButton>
      </div>
      <CancelListingDialog
        open={open}
        counterpartName={counterpartName}
        hasOffer={hasOffer}
        hasHandover={hasHandover}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await cancelListingAction(listingId, counterpartThreadId ?? undefined);
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `app/local/[id]/page.tsx`**

```tsx
// app/local/[id]/page.tsx, add import:
import { hasLiveOfferOrHandover } from "@/lib/domain/local-threads/threads-service";
import { getPublicProfile } from "@/lib/domain/profile/service";
import { ManageListing } from "./manage-listing";

// after fetching `listing` and before the return, when listing.seller_id === viewer.id:
    const ownershipCheck =
      listing.seller_id === viewer.id ? await hasLiveOfferOrHandover(listing.id) : null;
    const counterpart =
      ownershipCheck?.counterpartUserId ? await getPublicProfile(ownershipCheck.counterpartUserId) : null;

// replace the existing
//   ) : listing.seller_id === viewer.id ? (
//     <p className="pt-6 text-[11px] text-[var(--stone)]">
//       this is your listing, <Link href="/local/threads" className="underline">see your threads</Link>
//     </p>
//   ) : null}
// with:
        ) : listing.seller_id === viewer.id && ownershipCheck ? (
          <ManageListing
            listingId={listing.id}
            hasOffer={ownershipCheck.hasOffer}
            hasHandover={ownershipCheck.hasHandover}
            counterpartName={counterpart?.localName ?? null}
            counterpartThreadId={null}
          />
        ) : null}
```

Note: `counterpartThreadId` is left `null` here deliberately, `hasLiveOfferOrHandover` reports
*whether* a live offer/handover exists and who the counterpart is, but the seller may have
multiple threads on one listing; resolving the specific thread id to close requires a small
follow-up lookup (`listMyThreads()` filtered by `listing_id`) that the implementer should add
inline in this step if `cancelListingAction`'s thread-closing behaviour needs to reach the exact
thread, for a single-offer listing (the common case) this is the one thread on it.

- [ ] **Step 5: Implement the `YouSection` blocked list**

```tsx
// app/account/you-section.tsx, extend YouSectionProps and add the section:

import { unblockUserAction } from "@/app/local/actions";

type BlockedUser = { userId: string; localName: string | null; blockedAt: string };

export function YouSection({
  profile,
  preview,
  blockedUsers
}: {
  profile: Profile;
  preview: PublicProfilePreview;
  blockedUsers: BlockedUser[];
}) {
  // ...existing hooks unchanged...

  // add this section after the "what other people see" section, before the closing </section>:
      <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
        <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          blocked · {blockedUsers.length}
        </p>
        {blockedUsers.length === 0 ? (
          <p className="text-[12.5px] text-[var(--stone)]">you haven&apos;t blocked anyone.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {blockedUsers.map((blocked) => (
              <div key={blocked.userId} className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--ink)]">{blocked.localName || "a Garderobe user"}</span>
                <UnblockButton userId={blocked.userId} />
              </div>
            ))}
          </div>
        )}
      </div>
```

```tsx
// app/account/you-section.tsx, add this component at the bottom of the file, alongside
// SizeRow/ToggleVisual:

function UnblockButton({ userId }: { userId: string }) {
  const [isBusy, setIsBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={isBusy}
      className="text-[11px] underline text-[var(--stone)]"
      onClick={async () => {
        setIsBusy(true);
        await unblockUserAction(userId);
        setIsBusy(false);
      }}
    >
      unblock
    </button>
  );
}
```

`useState` is already imported at the top of `you-section.tsx` for the existing
`useActionState` calls' surrounding logic, confirm the import line includes plain `useState`
alongside `useActionState`; add it if not already present.

- [ ] **Step 6: Wire `blockedUsers` into `app/account/page.tsx`**

```tsx
// app/account/page.tsx, add import:
import { listBlockedUsers } from "@/lib/domain/local-threads/threads-service";

// add to the Promise.all:
    const [profile, entitlements, garderobeProfile, publicPreview, blockedUsers] = await Promise.all([
      getAccountProfile(),
      getUserEntitlements(),
      getOrCreateProfile(),
      getMyPublicProfilePreview(),
      listBlockedUsers()
    ]);

// pass it through:
        <YouSection profile={garderobeProfile} preview={publicPreview} blockedUsers={blockedUsers} />
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run "app/local/[id]/__tests__/manage-listing.test.tsx" app/account/__tests__/you-section.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add "app/local/[id]/manage-listing.tsx" "app/local/[id]/page.tsx" "app/local/[id]/__tests__/manage-listing.test.tsx" app/account/you-section.tsx app/account/page.tsx app/account/__tests__/you-section.test.tsx
git commit -m "Wire cancel-listing into the seller's own listing page and add the blocked-users account section."
```

---

## Task 13: Full-suite verification and typecheck

**Files:** none created; verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, no regressions in any existing suite.

- [ ] **Step 2: Run the project's typecheck**

Run: `npx tsc --noEmit` (or the project's existing typecheck script, check `package.json` for a `typecheck` script first and prefer it if present).
Expected: no type errors.

- [ ] **Step 3: Grep for any remaining raw browser dialogs in the local-threads surface**

Run: `grep -rn "window.confirm\|window.prompt\|window.alert\|confirm(\|prompt(\|alert(" app/local components/garderobe/local-threads`
Expected: no matches (the three call sites in `thread-view.tsx` from before this phase are gone).

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "Fix typecheck/test issues found in full-suite verification."
```
