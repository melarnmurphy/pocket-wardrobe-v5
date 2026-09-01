# Garderobe — API contract

One entry per screen. Written in the repo's own idiom: **server actions** in
`app/<route>/actions.ts` for anything a user does, **route handlers** in `app/api/*` only where an
external service posts in or a client polls. Domain logic lives in `lib/domain/<area>/`, never in
the action — the action validates, calls the domain module, and revalidates.

Conventions in force in the repo, keep them:

- Actions return `FormActionState` (`lib/ui/form-action-state.ts`), not thrown errors.
- Auth via `lib/auth.ts`; the Supabase client from `lib/supabase/server.ts`. RLS is the
  enforcement boundary — never the service-role client in a user-facing path.
- Money is `numeric(12,2)` in Postgres and integer cents in TypeScript. Convert at the boundary.
- `revalidatePath` the screens listed under **invalidates**.
- Rate limiting via `lib/rate-limit.ts` on anything that writes for an unauthenticated or
  cross-user path — every local-threads write qualifies.

---

## Wardrobe — 1d, 1e, 11a, w1a, w3f

Existing: `app/wardrobe/actions.ts`. Additions only.

| action | signature | notes |
| --- | --- | --- |
| `listGarments` | `(filter: GarmentFilter) => Piece[]` | filter is category, colour, season, fabric, worn-range, availability, sort. Server-side; the mockups show a live result count, so return `{ items, total }` |
| `updateGarment` | `(id, patch) => FormActionState` | partial; a null `purchase_price` must survive a round trip as null |
| `setAvailability` | `(id, availability) => FormActionState` | 9a |
| `addToLetGo` / `removeFromLetGo` | `(id, reason?) => FormActionState` | 9b |
| `archiveGarment` | `(id, reason) => FormActionState` | soft; keeps wear history |

**invalidates** `/wardrobe`, `/wardrobe/[id]`, `/` (today counts)

## Add a batch — 14a, 14b, w1d

Existing: `app/components/upload-card.tsx`, `app/wardrobe/review/*`,
`app/api/pipeline/analyse/route.ts`, `pipeline/fashion_pipeline.py`.

| endpoint | shape |
| --- | --- |
| `POST /api/pipeline/analyse` | `{ photoIds }` → `{ jobId }`. Already exists |
| `GET /api/pipeline/jobs/[id]` | `{ state, done, total, candidates[] }` — polled by 14b's progress ring |
| `updateDraft` action | `(draftId, patch)` — edits during review write to `garment_drafts`, never to `garments` |
| `commitDrafts` action | `(draftIds[], { collectionId? })` → creates garments with `purchase_price: null` |
| `discardDraft` action | `(draftId)` |

The batch must survive the user leaving the screen. `processing_jobs` already models this — the
client polls, it does not hold the work.

## Receipts and prices — 13a, 13b, 10a, 15b, w3b, w3d

Replaces the retailer-connection surface entirely.

| action / endpoint | shape | notes |
| --- | --- | --- |
| `POST /api/receipts/inbound` | provider webhook for `receipts@garderobe.app` | verify the sending provider's signature; drop anything not an order confirmation |
| `uploadReceipt` | `(file: File, kind)` → `{ receiptId }` | docket photo, pdf, screenshot |
| `readReceipt` | `(receiptId)` → `{ lines[], confidence }` | OCR + parse in `lib/domain/ingestion/`; **never invent a price** — an unread price is null |
| `attachReceiptLine` | `(lineId, { garmentId? })` → `FormActionState` | with no `garmentId`, creates the garment; sets `purchase_price` and a `garment_sources` row |
| `ignoreReceiptLine` | `(lineId)` | |
| `setPriceManually` | `(garmentId, priceCents, currency)` | 13b and the "type it" affordance in 15b |
| `resolveProductUrl` | `(url)` → `{ name, priceCents, size, imageUri }` | shared with the wishlist paste |
| `connectResaleAccount` | `(provider, oauthCode)` | depop, vestiaire only |
| `setResaleSettings` | `(sourceId, { addWhatIBuy, removeWhatISell, allowListing, resalePrices })` | |

**invalidates** `/settings/receipts`, `/settings/sources`, `/wardrobe`

`garment_sources.source_type`'s check constraint must be revised before any of this compiles —
see the mapping table in `DATA_MODEL.md`.

## Wishlist — 15a, w3a

Stored as `lookbook_entries` with `source_type = 'wishlist'`.

| action | shape |
| --- | --- |
| `addWishlistItem` | `(url \| manual fields)` → resolves, cuts out the image, computes unlock |
| `setWatchPrice` | `(itemId, boolean)` — on by default |
| `recomputeUnlocks` | `(userId)` — server-side; runs on any wardrobe change |
| `convertToGarment` | `(itemId, { priceCents })` — when the thing is actually bought |

`unlockCount` — the number of complete looks the item would create against the current wardrobe —
is the screen's default sort. Define it once in `lib/domain/lookbook/unlock.ts` and reuse it for
the nearby feed's *finishes a look* sort; they are the same computation.

## Today, calendar, looks — 12a, 9d, 11b, 6d, w1b, w1c, w3g, w3h

Existing: `app/wardrobe/today-actions.ts`, `app/api/weather/local/route.ts`, `app/calendar/*`,
`app/lookbook/actions.ts`, `app/outfits/*`. No contract changes beyond:

| action | shape |
| --- | --- |
| `saveOutfitPlacements` | `(outfitId, placements[])` — needs new columns on `outfit_items` |
| `logWear` | `(garmentIds[], date, outfitId?)` — one wear per garment per day; the trigger updates counts |

## Local threads — 16a–16d, w2a–w2d

All new. Proposed `lib/domain/local-threads/`.

### Feed

```
searchNearby(query: NearbyQuery) => { listings: LocalListingCard[], total: number }
```

`LocalListingCard` carries `distanceKm` computed per viewer and a **jittered** point. The exact
point never leaves the server. Radius defaults to 30 km, is user-settable 5–100, and is stored on
the profile so it persists across sessions.

Sort keys: `closest`, `newest`, `finishes a look`, `price`. The third calls the shared unlock
computation.

Index: either PostGIS `geography(Point)` with a GiST index, or lat/lng columns with a bounding-box
prefilter and a haversine sort. Adelaide-scale volumes make either fine; pick one and note it.

### Listing

| action | shape | notes |
| --- | --- | --- |
| `createLocalListing` | `(garmentId, { askCents, negotiable, description, photoUris, lookIds, showWearCount, size })` | photos default to the cut-out plus every lookbook photo the piece appears in — that is 16c's whole trick |
| `updateLocalListing` / `withdrawLocalListing` | `(listingId, patch)` | |
| `saveListing` | `(listingId)` | buyer-side save |

Creating a listing does **not** remove the piece from the wardrobe. `garments.availability`
becomes `listed for sale`; it still counts.

### Threads

| action | shape | notes |
| --- | --- | --- |
| `startThread` | `(listingId, firstMessage)` → `{ threadId }` | one thread per buyer per listing |
| `sendMessage` | `(threadId, body \| offerCents)` | rate-limited; the seller may type payid or bank details as ordinary text and the app stores it as text, nothing more |
| `proposeHandover` | `(threadId, { place, at })` | public places only; the place list is curated per suburb |
| `respondToHandover` | `(handoverId, 'agree' \| 'decline' \| 'propose new')` | |
| `confirmHandover` | `(handoverId, { paymentMethod: 'cash' \| 'payid' \| 'bank transfer' })` | both parties must confirm; on the second, archive the garment, close the thread, write `sold_for` |
| `blockUser` / `reportListing` | `(userId \| listingId, reason)` | mutual and immediate |

**No payment endpoints exist.** No charge, no escrow, no payout, no webhook from a PSP.
`paymentMethod` is a label on a completed handover.

Realtime: threads use Supabase Realtime on `messages` filtered by `thread_id`. Unread state is
per-participant.

## You — 17a, 9g, 12b, w3e

| action | shape |
| --- | --- |
| `updateAccount` | `(patch: { name, localName, email, suburb })` — changing the suburb re-centres the nearby radius |
| `updateSizes` | `(sizes: Sizes)` — filters the nearby feed and prefills listings |
| `updateLocalPrivacy` | `(patch: { showSuburb, showWearCount })` |
| `unblockUser` | `(userId)` |
| `getPublicProfile` | `(userId)` → `PublicProfile` — the only cross-user read of a person |

## Onboarding — 6a, w4a–w4c

`app/auth/*` exists; the welcome flow is new. Three steps, each resumable:

1. `POST` a first batch of photos, or the mailbox connection, or skip.
2. Twenty slots fill as the pipeline reports; the user can leave and come back.
3. Suburb + radius, which writes the profile and unlocks the nearby feed.

Store progress on the profile (`onboarding: { slotsFilled, slotsTotal, completedAt }`) so web and
phone resume each other.

## Entitlements — 9h

`lib/domain/entitlements/` and `user_entitlements` already exist. The paywall gates piece count on
the free plan. Local threads is **not** gated — a marketplace with a paywall on messaging is dead
on arrival.

---

## Errors, empties, offline

Not designed as screens, so specify them once here and apply everywhere:

- A failed action returns `FormActionState` with a sentence in the app's voice, lowercase, saying
  what to try. Never a raw error code.
- Every list has an empty state naming the next action. The nearby feed's empty state offers to
  widen the radius, and says by how much: *nothing in 30 km — try 50?*
- Offline: the wardrobe, looks and calendar read from cache; local threads and receipts show a
  one-line offline bar rather than an error dialog.
- Optimistic writes are allowed for saves, wear logging and offers; everything on the handover
  path is confirmed server-side before the UI moves.
