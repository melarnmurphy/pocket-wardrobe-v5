# Local threads, trust and safety dialogs (design spec)

Design for the 8 items MODALS.md §4 marks **missing**. No mockup exists for any of these,
this document is the spec a build agent would otherwise have to invent, written against the
actual local-threads code (`lib/domain/local-threads/`, `app/local/`,
`supabase/migrations/029_local_listings.sql`, `031_local_threads_transactional.sql`,
`032_local_listing_category.sql`) rather than against DATA_MODEL.md's aspirational shape.

Applies MODALS.md's standing rules throughout: destructive dialogs name the consequence, not
the action; nothing destructive resolves in a toast alone; a dialog asks one question, a sheet
answers more than one; Australian English, no em dashes, lowercase sentence-style copy matching
`components/garderobe/wardrobe/*`.

Built on the existing primitives only: `Dialog` (`components/garderobe/dialog.tsx`),
`BottomSheet`/`SheetAction` (`components/garderobe/bottom-sheet.tsx`). `Dialog` currently always
renders both a cancel and a confirm button; two of the eight items below need a single
acknowledgement button, so `Dialog` gains one new optional prop, `hideCancel?: boolean`, when
true, only the confirm button renders, full width. This is the only primitive change in scope.

## What already exists (ground truth, not to be rebuilt)

- `blockUser(userId)`, `unblockUser(userId)`, `reportListing(listingId, reason)`,
  `lib/domain/local-threads/threads-service.ts:343,363,482`. All three already work; they are
  wired to `confirm()`/`prompt()`/`alert()` in `app/local/threads/[id]/thread-view.tsx:190-209`.
  This phase replaces those three call sites with real dialogs/sheets, it does not touch the
  service functions.
- `withdrawLocalListing(listingId)`, `lib/domain/local-threads/service.ts:84`, sets
  `local_listings.status = 'withdrawn'` and returns the piece to `wearable`. Exists, but no UI
  anywhere calls it, the seller's own listing view (`app/local/[id]/page.tsx:118-125`) only
  shows a link to threads, no manage/cancel affordance at all.
- `handovers.state` check constraint already includes `'missed'` and `'cancelled'`
  (migration 031 line 42), neither value is ever written by any existing code. "cancel or
  reschedule a handover" and "they didn't show" are built to use these existing enum values,
  not new ones.
- `local_listings.status` already includes `'withdrawn'`, no new listing-status value is
  needed for "cancel a listing".
- Offers have **no state at all**. `sendMessage(threadId, { offerCents })` just inserts a
  `messages` row with `kind = 'offer'` (`threads-service.ts:159-182`). There is no
  accepted/declined/withdrawn concept anywhere in the schema or the service layer, even though
  MODALS.md's "A$185 offered, counter / accept" is drawn. "Decline / withdraw an offer" cannot
  be built without adding this state, see Task 1 below.
- No `user_blocks` listing function exists (`listBlockedUsers` is new). No "blocked · N people"
  UI exists anywhere in the app today, MODALS.md's description of the account page is the
  target state this phase builds, not a screen that currently exists.
- No age or date-of-birth field exists anywhere in the schema (`profiles` table or otherwise).

## 1. Decline an offer / withdraw an offer, dialog

**Schema.** `messages` gains `offer_status text check (offer_status in ('pending', 'accepted',
'declined', 'withdrawn')) default 'pending'`, meaningful only on rows where `kind = 'offer'`.
Every existing offer row backfills to `'pending'` via the column default.

**Service.** `lib/domain/local-threads/threads-service.ts` gains:
- `respondToOffer(messageId, response: 'decline')`, seller-only, sets `offer_status =
  'declined'` on that message, scoped by `sender_id <> auth.uid()` (a seller can only decline
  the *other* party's offer) and thread participancy.
- `withdrawOffer(messageId)`, buyer-only, sets `offer_status = 'withdrawn'`, scoped by
  `sender_id = auth.uid()` (only the person who made the offer can withdraw it).

Both post a `kind: 'system'` message afterwards (`"offer declined"` / `"offer withdrawn"`) so
the change is visible in the transcript, reusing the existing `insertMessage` helper.

**UI.** One `OfferDecisionDialog` component reused for both directions via a `variant: "decline"
| "withdraw"` prop, rendered in `thread-view.tsx` next to the most recent pending offer message
in the transcript (a small "decline" / "withdraw" text action under that one bubble, mirroring
the existing block/report row's `underline` text-button style).

- Seller declining: title `decline this offer?`, description `closes out {name}'s A$$$
  offer. They can still send another one.`, `confirmLabel="decline"`, default `cancelLabel`
  ("cancel").
- Buyer withdrawing: title `withdraw your offer?`, description `removes your A$$$ offer to
  {name}. you can offer again anytime.`, `confirmLabel="withdraw"`.

A declined/withdrawn offer message renders in the transcript with its bubble text struck through
in tone (`text-[var(--stone)]` instead of the live colour) and a trailing ` · declined` /
` · withdrawn` label, rather than disappearing, the transcript is a record, nothing is deleted.

## 2. Cancel a listing with a live offer, dialog

**No new status value**, this calls the existing `withdrawLocalListing`. What's new is the UI
never had a cancel affordance and never checked for a live offer first.

**Service.** `getLocalListingDetail`'s caller in the new seller-manage view separately calls
`listMyThreads()`-equivalent (or a small helper) to check: does any thread on this listing have
a `messages` row with `kind = 'offer' and offer_status = 'pending'`, or does its thread have a
non-completed `handovers` row? Add `hasLiveOfferOrHandover(listingId): Promise<{ hasOffer:
boolean; hasHandover: boolean; counterpartName: string | null }>` to `threads-service.ts`.

**UI.** `CancelListingDialog`:
- No live offer/handover: title `cancel this listing?`, description `takes it off the nearby
  feed. the piece stays in your wardrobe.`, `confirmLabel="cancel listing"`.
- Live offer: title `cancel this listing?`, description `{name}'s A$$$ offer closes and the
  thread ends. the piece stays in your wardrobe, but this can't be undone.`,
  `confirmLabel="cancel listing"`.
- Live handover (arranged/agreed): description instead reads `you have a handover arranged with
  {name}. cancelling the listing cancels that too, and the thread ends.`

Add a "manage this listing" section to the seller's own view in `app/local/[id]/page.tsx`
(currently just a link to threads) with a `cancel listing` `PillButton` (`variant="secondary"`)
that opens this dialog. On confirm, calls `withdrawLocalListingAction`, then, if there was a
live offer/handover, also transitions the affected thread's `state` to `'declined'` via a new
`closeThreadForCancelledListing(threadId)` service call.

## 3. Cancel or reschedule a handover, sheet

Available to either participant once a handover exists in state `proposed` or `agreed` (not
`completed`, `cancelled`, or `missed`). Replaces nothing existing, today there is no way to
change a handover once agreed, only to `agree`/`decline` while `proposed`.

**Service.** `threads-service.ts` gains `cancelHandover(handoverId)`, sets `state =
'cancelled'`, and sets the thread back to `state = 'open'` (mirrors the existing decline path in
`respondToHandover`). Rescheduling reuses `proposeHandover` as-is: the UI cancels the old one
first, then shows the existing `HandoverForm` to propose a new time, no new propose logic
needed.

**UI.** `HandoverManageSheet`, opened from a "..." affordance next to the handover block in
`thread-view.tsx` (replacing the bare text once a handover exists in an editable state):

```
title: "this handover"
description: "{place_name}, {place_suburb} · {formatted date/time}"
SheetAction "reschedule" (chevron) → calls cancelHandover, then opens HandoverForm inline
SheetAction "cancel handover" (destructive, last) → calls cancelHandover directly, closes sheet
```

Matches the existing `DisposalSheet` convention: reason/action rows resolve immediately on tap,
no secondary confirm dialog behind a sheet action, the sheet itself is the deliberate step.

## 4. "They didn't show", sheet, "the only trust signal the marketplace has"

Available once a handover's `at` timestamp has passed and it is not yet `completed` (both
confirmed) or already `cancelled`/`missed`.

**Schema.** `handovers` gains `no_show_by uuid references auth.users(id)` and
`no_show_reported_at timestamptz`, both nullable.

**Service.** `threads-service.ts` gains `reportNoShow(handoverId)`: sets `state = 'missed'`,
`no_show_by = ` the *other* participant (not the reporter, the person who didn't show), `
no_show_reported_at = now()`, and sets the thread back to `state = 'open'` so the pair can
still renegotiate a new handover if they choose to.

This phase writes the record; it deliberately does **not** wire `no_show_by` into
`getPublicProfile`'s `handoverCount`/any new "no-show count" surfaced to other users,
`handoverCount`/`listedCount` are already hard-coded to `0` everywhere today
(`lib/domain/profile/service.ts:177-178,222-223`), a pre-existing gap outside this plan's scope.
Flagged in the final report as a follow-on: the signal is captured but not yet surfaced, so it
does not yet function as a "trust signal" end-to-end.

**UI.** `NoShowSheet`, offered once `at` has passed on a `proposed`/`agreed` handover:

```
title: "they didn't show?"
description: "{name} was due at {place_name} on {formatted date/time}."
SheetAction "give it a bit longer" (chevron) → closes the sheet, no write
SheetAction "they didn't show" (destructive, last) → calls reportNoShow
```

## 5. Report a listing / report a person, sheet

Replaces `thread-view.tsx`'s `prompt()`/`alert()` pair (lines 198-209) with a real sheet. Calls
the existing `reportListing(listingId, reason)` unchanged, no service or schema change. A
report from a thread already reports the associated listing, which is the existing contract's
only report surface; there is no separate "report a person" endpoint to build; a thread always
carries a `listing_id`, so reporting from a thread already covers "report a person" in
practice.

**UI.** `ReportListingSheet`:

```
title: "report this listing"
description: "tell us what's wrong. the other person is never told you reported them."
radio-style SheetAction list, single-select, non-destructive style:
  - fake or misleading
  - inappropriate content
  - unsafe or harassing behaviour
  - spam
  - something else
"something else" reveals a text input (max 500 chars, matching reportListing's reason schema)
submit PillButton "send report", disabled until a reason is chosen (and non-empty if "something
else")
```

On success: closes the sheet and shows a toast, `reported, thanks for flagging this.` (toast is
correct here per standing rule 2, reporting is not itself a destructive action against the
reporter's own data, it is a one-way submission with no undo state to lose). On error: inline
message inside the sheet, matching `DisposalSheet`/`PricePanel`'s existing error-message
pattern, sheet stays open.

Available from both the thread (`thread-view.tsx`) and the listing detail page
(`app/local/[id]/page.tsx`, for a buyer who hasn't started a thread yet), same component, listing
id passed as a prop either way.

## 6. Block, confirm, dialog

Replaces `thread-view.tsx`'s `confirm()` (line 190) with a real `Dialog`, and adds the "blocked
· N people" management surface MODALS.md refers to, which does not exist yet anywhere in the app.

**Service.** `threads-service.ts` gains `listBlockedUsers(): Promise<Array<{ userId: string;
localName: string | null; blockedAt: string }>>`, reads `user_blocks` joined to `profiles` for
rows where `blocker_id = auth.uid()`, RLS-scoped by the existing `user_blocks_select_own` policy
(migration 031 line 150) so no new policy is needed.

**UI, block confirm.** `BlockUserDialog`:

```
title: "block {name}?"
description: "ends this thread for both of you and hides their listings from your feed. they
won't be told."
confirmLabel: "block"
```

**UI, account management.** New section in `app/account/you-section.tsx`, under "local
privacy", titled `blocked · {count}`. Empty state: `you haven't blocked anyone.` Each row: local
name (or "a Garderobe user" if none set) and an `unblock` text button
(`text-[11px] underline text-[var(--stone)]`, matching the existing block/report row style in
`thread-view.tsx`) calling the existing `unblockUserAction` directly, unblocking is reversible
(blocking them again is one tap away) so it does not need its own confirm dialog, consistent
with `respondToHandoverAction`'s un-confirmed "agree" having no dialog either.

## 7. First listing safety brief, one-time dialog

**Schema.** `profiles` gains `local_safety_brief_seen_at timestamptz`, nullable, same pattern
as the existing `onboarding_completed_at` column.

**Service.** `lib/domain/profile/service.ts` gains `markSafetyBriefSeen(): Promise<void>`
(mirrors `completeOnboarding`).

**UI.** `SafetyBriefDialog`, shown in `app/local/list/[garmentId]/page.tsx` before `ListingForm`
renders, only when `profile.local_safety_brief_seen_at` is null:

```
title: "before you list"
description: "meet in a public place, and never share your address. garderobe doesn't move
money for you, arrange cash, payid or a bank transfer directly with the other person."
confirmLabel: "got it"
hideCancel: true
```

Dismissing (backdrop or "got it") both call `markSafetyBriefSeenAction`, since this is
informational, not a gate, there is no "no" answer to give.

## 8. Age check, dialog, **policy decision, not fully mine to make**

**Schema.** `profiles` gains two nullable `timestamptz` columns: `age_confirmed_at` and
`age_declined_at`.

**Service.** `lib/domain/profile/service.ts` gains `confirmAge(): Promise<void>` (sets
`age_confirmed_at`) and `declineAge(): Promise<void>` (sets `age_declined_at`).

**UI, the gate itself (not in question).** `AgeCheckDialog`, shown in
`app/local/list/[garmentId]/page.tsx` before the safety brief, only when both
`age_confirmed_at` and `age_declined_at` are null:

```
title: "confirm you're 18 or over"
description: "local threads means arranging your own handover with a stranger, so it's for
adults only."
cancelLabel: "I'm under 18"
confirmLabel: "I'm 18 or over"
```

**What happens on "I'm under 18", the part that needs a human policy call.** This spec
implements the most conservative default: `declineAge()` is called, and the listing page renders
a permanent blocking state instead of the form,

```
title: "local threads needs an adult"
description: "you can keep using every other part of Garderobe. this stays off until you're 18."
confirmLabel: "ok"
hideCancel: true
```

That dialog routes back to `/wardrobe/{garmentId}` on dismiss. Once `age_declined_at` is set, the
gate is permanent for this build: there is no in-app "actually I'm 18 now" override. Re-enabling
it would need a support-assisted or time-based path this plan does not build.

**Scope of the gate, updated after human confirmation.** This spec originally gated only the
**sell** side: creating a listing (`app/local/list/[garmentId]/page.tsx`). Per the human partner's
explicit follow-up decision, the gate now also covers a buyer's first message on a listing
(`MessageSellerGate`, wired into `app/local/[id]/page.tsx`) — the buyer-side equivalent first
step toward an in-person handover. `AgeCheckDialog`, `AgeBlockedDialog`, and `SafetyBriefDialog`
all carry neutral copy covering both sides ("local threads needs an adult" / "before you meet
up"), and share the same profile-level flags, so confirming age or acknowledging the safety
brief on either side of the marketplace covers the other. Sending an offer or agreeing to a
handover as a buyer both happen inside an already-started thread, so gating thread-start is the
one entry point that needs it; nothing downstream needs its own separate gate. Browsing the
nearby feed remains ungated, since it involves no interaction with another person. The
"permanent, no self-service override" behaviour on decline is unchanged, still a product/policy
default the build chose rather than a human decision-maker, and remains open — it was not
part of this follow-up and still needs its own explicit confirmation before this ships.
