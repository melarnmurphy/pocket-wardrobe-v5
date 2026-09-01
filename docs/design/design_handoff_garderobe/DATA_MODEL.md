# Garderobe — data model

Derived from the designed screens. Every field here is something a screen shows, writes or filters
on; nothing is included speculatively. Types are TypeScript for precision, not as a prescription —
translate to the codebase's own idiom.

Conventions: `Id` is an opaque string. Money is **integer cents in AUD** (`priceCents`) with a
separate `currency`, never a float. Dates are ISO 8601; `*Date` fields are date-only where the
screens show a date without a time. `null` means unknown and must render as unknown; `0` means
zero and must never stand in for unknown.

---

## Piece
The core object. One garment. 142 of them at the start of the mockups, 154 after the batch in 14b.

```ts
type Piece = {
  id: Id;
  name: string;                    // lowercase, as the user would say it: "wide trouser"
  category: Category;
  subcategory?: string;            // free text, e.g. "wide leg"
  colour: Colour;                  // one of ten, joined to the filter set
  colourHex: string;               // sampled from the cut-out, for swatches
  fabric: Fabric | null;           // null renders as the dashed "fabric?" chip
  fabricConfidence: number | null; // < 0.60 → treat as null in the UI
  seasons: Season[];
  size?: string;
  brand?: string;

  cutout: Cutout | null;           // null while processing, or if the user skipped it
  photos: Id[];                    // Photo ids this piece came from

  priceCents: number | null;       // null → "add later"; never render as A$0
  currency: 'AUD';
  priceSource: 'store' | 'receipt' | 'manual' | null;
  resaleEstimateCents: number | null;

  acquiredAt: string | null;       // date-only; from order, receipt or user
  addedAt: string;                 // when it entered Garderobe
  sourceId: Id | null;             // Source it arrived from; null = added by hand
  orderId: Id | null;

  availability: Availability;
  wearCount: number;               // denormalised from Wear
  lastWornAt: string | null;
  costPerWearCents: number | null; // null when priceCents or wearCount is 0 — hide, don't show 0

  letGo: LetGoState | null;        // set when the piece is on the let-go list
  listingId: Id | null;            // current or last Listing
  collectionIds: Id[];
  archivedAt: string | null;       // sold or given away; keeps history intact
};

type Category =
  | 'tops' | 'trousers' | 'skirts' | 'dresses' | 'outerwear'
  | 'knitwear' | 'shoes' | 'bags' | 'accessories' | 'activewear';

type Colour =
  | 'black' | 'white' | 'cream' | 'grey' | 'navy'
  | 'blue' | 'green' | 'brown' | 'red' | 'pink';

type Fabric = 'wool' | 'cotton' | 'linen' | 'silk' | 'denim' | 'cashmere'
            | 'leather' | 'crepe' | 'chiffon' | 'other';

type Season = 'summer' | 'autumn' | 'winter' | 'spring' | 'all year';

type Availability =
  | 'wearable'
  | 'in the wash'
  | 'at the tailor'
  | 'lent out'
  | 'packed'
  | 'listed for sale';

type LetGoState = {
  reason: 'never worn' | 'does not fit' | 'not me anymore' | 'worn out' | 'duplicate';
  addedAt: string;
  estimateCents: number | null;
};
```

**Invariants**

1. `priceCents === null` renders as `add later`. Cost per wear is hidden, not zero.
2. `fabricConfidence < 0.60` renders as a question, not a value.
3. A piece with `availability: 'listed for sale'` stays in the wardrobe and in counts until its
   Listing settles as sold; then `archivedAt` is set and it leaves the counts.
4. Deleting is never silent: removal always produces an undoable toast.

## Cutout
Produced by the split pipeline. Full spec in `Garment Split - Build Spec.dc.html`.

```ts
type Cutout = {
  id: Id;
  pngUri: string;        // premultiplied alpha, 1200px long edge
  pngThumbUri: string;   // 400px long edge, for grids
  maskUri: string;       // kept so a cut can be redone without re-segmenting
  width: number; height: number;
  alphaBbox: [number, number, number, number];
  hasPartialAlpha: boolean;  // sheer fabric — never threshold to binary
  sourcePhotoId: Id | null;
  origin: 'segmented' | 'pasted' | 'store';  // 15c pastes arrive already transparent
  redoCount: number;
};
```

## Photo and the add batch
```ts
type Photo = {
  id: Id;
  originalUri: string;
  workingUri: string;    // downscaled to 1600px long edge
  exifDate: string | null;
  source: 'library' | 'camera' | 'paste' | 'drop' | 'store';
  addedAt: string;
};

type AddBatch = {                 // 14a → 14b, w1d
  id: Id;
  photoIds: Id[];
  state: 'selecting' | 'processing' | 'reviewing' | 'committed' | 'abandoned';
  doneCount: number; totalCount: number;
  candidates: GarmentCandidate[];
  putInCollection: boolean;
  committedPieceIds: Id[];
  startedAt: string; committedAt: string | null;
};

type GarmentCandidate = {         // a proposed Piece, editable before commit
  id: Id;
  photoId: Id;
  slot: 'top' | 'bottom' | 'dress' | 'outer' | 'shoe' | 'bag';
  cutout: Cutout;
  attributes: {
    name: string; category: Category; subcategory?: string;
    colour: Colour; colourHex: string;
    fabric: Fabric | null; fabricConfidence: number | null;
    seasons: Season[];
  };
  splitFrom: Id | null;           // set when one photo produced several candidates
  splitOffered: boolean;          // "that's three garments" — offered, never imposed
  duplicateHint: { pieceId: Id; similarity: number } | null;  // shown above 0.92
  edited: boolean;
};
```

Edits during review write to the candidate, not to the wardrobe. Commit creates Pieces with
`priceCents: null` and `availability: 'wearable'`.

## Look and Wear
```ts
type Look = {
  id: Id;
  name: string | null;
  photoId: Id | null;             // the outfit photo, if there is one
  pins: Pin[];                    // tagged points on that photo (5a, 5b)
  placements: Placement[];        // arranged cut-outs on the canvas (6d, w1b)
  pieceIds: Id[];
  occasion?: string;
  createdAt: string;
  wearIds: Id[];
  savedFromBatchId: Id | null;    // "keep as a look" instead of splitting
};

type Pin = { id: Id; x: number; y: number; pieceId: Id | null; label: string | null };

type Placement = {
  pieceId: Id;
  x: number; y: number; z: number;      // canvas units, 0–1 of the canvas box
  scale: number; rotation: number;
};

type Wear = {
  id: Id;
  date: string;                   // date-only; one wear per piece per day
  pieceIds: Id[];
  lookId: Id | null;
  weather: WeatherSnapshot | null;
  note?: string;
  source: 'user' | 'planned' | 'inferred';
};

type WeatherSnapshot = {
  minC: number; maxC: number;
  condition: 'clear' | 'cloud' | 'rain' | 'wind' | 'heat' | 'cold';
  location: string;
};
```

Wear is the spine of every number in the app: wear count, cost per wear, the calendar (9d), least
worn (1e sort), the let-go list (9b) and trend correlation (2c).

## Collection
```ts
type Collection = {
  id: Id; name: string;
  pieceIds: Id[];
  kind: 'user' | 'batch' | 'packing';
  createdAt: string;
};
```

Packing lists (9c) are Collections with `kind: 'packing'` plus a trip window.

## Wishlist — 15a
```ts
type WishlistItem = {
  id: Id;
  name: string;
  imageUri: string | null;        // cut out on arrival, same pipeline
  category: Category; colour: Colour;
  priceCents: number | null;
  originalPriceCents: number | null;   // set when the price has dropped
  currency: 'AUD';
  size?: string;
  storeName: string | null;
  storeId: Id | null;
  productUrl: string | null;      // pasted; the resolver fills the rest
  addedAt: string;

  unlockCount: number;            // looks this piece would open up — the default sort
  unlockNormalised: number;       // 0–1, drives the bar width
  ownedSimilarPieceIds: Id[];     // non-empty → "you own 3 like this"

  watchPrice: boolean;            // on by default
  priceHistory: { at: string; priceCents: number }[];
  stockNote: string | null;       // "one left in your size"
  resolvedState: 'resolving' | 'resolved' | 'manual' | 'failed';
  boughtPieceId: Id | null;       // set when the piece is later acquired
};
```

`unlockCount` is server-computed: for each wishlist item, the number of valid looks it would
complete against the current wardrobe. It is the ranking the screen is built around, so it needs a
stable definition and a recompute on every wardrobe change.

## Sources, receipts — 10a, 15b, 13a

**Product decision, September 2026: there are no retailer account connections.** Garderobe never
holds a shop login. Prices arrive one of four ways — a forwarded order email, a photographed paper
docket, a pasted product link, or the user typing it. The only accounts that connect are *resale*
accounts (depop, vestiaire), and only so that buying there adds a piece and selling there removes
one. Any screen implying order-history sync is out of date.

```ts
type Source =
  | MailboxSource     // the forwarding address, plus optional read access to order emails
  | ResaleSource      // depop, vestiaire
  | UploadSource;     // dockets, pdfs, screenshots dropped in

type MailboxSource = {
  id: Id; kind: 'mailbox';
  address: string;                        // "esther@hey.com", or the forwarding alias
  mode: 'forwarding only' | 'read order emails';
  status: 'available' | 'authorising' | 'reading' | 'connected' | 'error' | 'disconnected';
  lookBackYears: number | null;           // "past 3 years"
  receiptsRead: number; pricesAttached: number;
  lastSyncedAt: string | null;
};

type ResaleSource = {
  id: Id; kind: 'resale';
  name: 'depop' | 'vestiaire' | string; monogram: string;
  status: 'available' | 'authorising' | 'connected' | 'error' | 'disconnected';
  account: string | null;
  settings: {
    addWhatIBuy: boolean;
    removeWhatISell: boolean;
    allowListing: boolean;
    resalePrices: boolean;                // feeds Piece.resaleEstimateCents
  };
  lastSyncedAt: string | null;
};

type UploadSource = { id: Id; kind: 'upload'; waitingCount: number };

type Receipt = {
  id: Id;
  kind: 'forwarded email' | 'read email' | 'docket photo' | 'pdf' | 'screenshot';
  fileUri: string | null;                 // null for a read email
  state: 'waiting' | 'reading' | 'read' | 'unreadable' | 'ignored';
  retailer: string | null;                // parsed; may be a name we've never seen
  date: string | null;
  totalCents: number | null;
  currency: 'AUD';
  lines: ReceiptLine[];
  confidence: number | null;              // < 0.6 → every field is a question, not a value
  addedAt: string;
};

type ReceiptLine = {
  name: string;
  priceCents: number | null;              // null → "couldn't read the price", user types it
  size?: string;
  imageUri?: string;                      // lifted from the email where present
  pieceId: Id | null;                     // set on accept
  state: 'waiting for your nod' | 'attached' | 'ignored';
};
```

**Invariants**

1. Nothing enters the wardrobe from a receipt without an explicit accept. 10a's button reads
   *review N receipts*, and N is the count of `ReceiptLine.state === 'waiting for your nod'`.
2. An unreadable price is `null` and the row says so. Never guess a price.
3. A retailer parsed from a receipt is a **string on the receipt**, not a connection. 15b groups
   receipts by retailer name; there is nothing to "connect" on those rows.
4. Disconnecting a resale source leaves every piece it contributed in place.

## Local threads — 16a–16d, w2a–w2d

The local marketplace. Adelaide-shaped: a radius the user sets, defaulting to 30 km, expandable.
No money moves through Garderobe — see `Handover.paymentMethod`.

```ts
type LocalListing = {
  id: Id;
  pieceId: Id;                            // always backed by a real piece in the seller's wardrobe
  sellerId: Id;
  status: LocalListingStatus;
  askCents: number; currency: 'AUD';
  negotiable: boolean;
  description: string;                    // generated from the Piece, editable
  photoUris: string[];                    // cut-out first, then lookbook photos the piece appears in
  lookPhotoIds: Id[];                     // Look ids whose photos are attached — the differentiator
  showWearCount: boolean;                 // profile default, overridable per listing
  wearCountAtListing: number | null;
  size: string | null;                    // defaults from the seller's profile sizes

  suburb: string;                         // "norwood" — never a street or a number
  point: { lat: number; lng: number };    // jittered to ~200 m for display; exact only server-side
  distanceKm: number | null;              // computed per viewer, never stored on the listing

  views: number; saves: number;
  listedAt: string | null;
  reservedForThreadId: Id | null;
  soldAt: string | null; soldForCents: number | null;
  blockedReason: string | null;           // draft blocker, e.g. "needs 2 photos"
  photosRequired: number;
};

type LocalListingStatus =
  | 'draft' | 'live' | 'reserved' | 'handover arranged' | 'sold' | 'expired' | 'withdrawn';

type Thread = {
  id: Id;
  listingId: Id;
  buyerId: Id; sellerId: Id;
  state: 'open' | 'handover arranged' | 'completed' | 'declined' | 'expired' | 'blocked';
  messages: Message[];
  handover: Handover | null;
  lastMessageAt: string;
  unreadFor: Id[];                        // user ids with unread messages
};

type Message = {
  id: Id; threadId: Id; senderId: Id;
  kind: 'text' | 'offer' | 'handover proposal' | 'system';
  body: string;
  offerCents: number | null;
  sentAt: string;
  readAt: string | null;
};

type Handover = {
  id: Id; threadId: Id;
  place: { name: string; suburb: string; note: string | null };  // public places only
  at: string;                             // ISO datetime
  proposedBy: Id;
  state: 'proposed' | 'agreed' | 'completed' | 'missed' | 'cancelled';
  paymentMethod: 'cash' | 'payid' | 'bank transfer' | null;   // recorded, never processed
  completedAt: string | null;
  sellerConfirmed: boolean; buyerConfirmed: boolean;
};
```

**Invariants**

1. **Garderobe processes no payments.** `paymentMethod` is a record of what the two people did.
   A seller may type a payid or bank details as ordinary message text; the app neither stores them
   as structured data nor validates them. No escrow, no fees, no wallet.
2. Location granularity is suburb + jittered point. An exact address is never returned by any
   endpoint, to either party, at any listing state.
3. Marking a handover complete requires both `sellerConfirmed` and `buyerConfirmed`, then archives
   the piece, closes the thread, and writes `soldForCents`. The looks the piece appeared in keep
   their photos.
4. A reserved listing stays visible with a `reserved` chip. It does not vanish from the feed.
5. Blocking is mutual and permanent until undone: blocked users' listings disappear from each
   other's feeds and threads close.

```ts
type NearbyQuery = {
  radiusKm: number;                       // default 30; user-expandable, 5–100
  centre: { lat: number; lng: number };   // the user's suburb centroid, not their device
  sizes: string[] | null;                 // from the profile; null = all sizes
  oneSizeEitherWay: boolean;
  categories: Category[] | null;
  maxPriceCents: number | null;
  sort: 'closest' | 'newest' | 'finishes a look' | 'price';
};
```

`finishes a look` is the ranking the nearby feed is built around: for each listing, how many of
the viewer's own incomplete looks it would complete. Same computation as `WishlistItem.unlockCount`,
run against another person's listing.

## Public profile and sizes — 17a, w3e

```ts
type PublicProfile = {                    // the only thing another person ever sees
  userId: Id;
  localName: string;                      // "esther" — not the account name
  suburb: string;
  avatarUri: string | null;
  joinedAt: string;
  handoverCount: number;
  listedCount: number;
};

type Sizes = {
  tops: string | null; bottoms: string | null; shoes: string | null;
  topsSystem: 'AU' | 'UK' | 'US' | 'EU'; bottomsSystem: 'AU' | 'UK' | 'US' | 'EU';
  shoesSystem: 'AU' | 'UK' | 'US' | 'EU';
  heightCm: number | null;
  oneSizeEitherWay: boolean;              // widens the nearby filter
};

type LocalPrivacy = {
  showSuburb: boolean;                    // default true; false hides the suburb line
  showWearCount: boolean;                 // default true; the count, never the dates
  blockedUserIds: Id[];
};
```

Never exposed to another user: surname, email, phone, street address, purchase prices, wear dates,
the rest of the wardrobe, or any piece not on a live listing.

## Listings — 15d
```ts
type Listing = {
  id: Id;
  pieceId: Id;
  marketplaceSourceId: Id;                 // the resale Source it lives on
  status: ListingStatus;
  askCents: number; currency: 'AUD';
  resaleRangeCents: [number, number] | null;
  description: string;                     // generated from the Piece, editable
  photoUris: string[];
  photosRequired: number;                  // draft blocker: "needs 2 photos"
  blockedReason: string | null;
  views: number; saves: number;
  offers: Offer[];
  listedAt: string | null;
  soldAt: string | null;
  soldForCents: number | null;
  suggestedAskCents: number | null;        // "live 34 days · try A$78?"
  hideFromWardrobeWhileListed: boolean;
  externalUrl: string | null;
};

type ListingStatus = 'draft' | 'live' | 'offer received' | 'sold' | 'expired' | 'withdrawn';

type Offer = {
  id: Id; listingId: Id;
  amountCents: number;
  buyerHandle: string | null;
  receivedAt: string;
  state: 'open' | 'accepted' | 'countered' | 'declined' | 'expired';
  counterCents: number | null;
};
```

Accepting an offer sets the Piece to `listed for sale` until settlement, then archives it and
writes `soldForCents`. The sold row keeps showing the final cost per wear — that is the point of
the screen.

## Trends — 2a, 2b, 2c, 8c
```ts
type Trend = {
  id: Id; name: string;
  summary: string;                          // 14 words, not 90
  imageUri: string | null;
  altitude: number;                         // 0–1, current prominence
  phase: 'rising' | 'peaking' | 'fading' | 'over';
  peakedAt: string | null;
  ownedScore: number;                       // 0–1, how covered the user already is
  matchingPieceIds: Id[];
  missingSlots: { slot: string; unlockCount: number }[];
  region: string;
};

type UnlockScore = {                        // 3d, 4b, 8a
  subject: { kind: 'wishlist' | 'trend' | 'scanned'; id: Id };
  score: number;                            // 0–1, the orbit
  looksUnlocked: number;
  withPieceIds: Id[];
  verdict: 'buy it' | 'maybe' | 'you already own this';
};
```

## Account and settings — 9g, 9h, 12b, 6a
```ts
type User = {
  id: Id;
  displayName: string;
  region: 'AU' | 'NZ' | string;
  units: { temperature: 'C' | 'F'; currency: 'AUD' | 'NZD' };
  onboarding: { slotsFilled: number; slotsTotal: 20; completedAt: string | null };
  subscription: { plan: 'free' | 'full'; renewsAt: string | null; pieceLimit: number | null };
  notifications: {
    weatherPick: boolean; priceDrops: boolean; trendExpiry: boolean;
    listingActivity: boolean; wearReminders: boolean;
  };
  privacy: { processOnDevice: boolean; serverRetentionDays: 30 };
};

type AppNotification = {                    // 9f
  id: Id;
  kind: 'price drop' | 'trend expiry' | 'offer' | 'sold' | 'orders waiting'
      | 'receipt read' | 'wear reminder' | 'batch finished';
  title: string; body: string;
  subject: { kind: 'piece' | 'wishlist' | 'listing' | 'trend' | 'batch'; id: Id } | null;
  createdAt: string; readAt: string | null;
};
```

Photos and masks are processed on device where the platform allows it; anything sent to a server is
deleted within 30 days, and the copy on screen says which is which. That is a product commitment,
not a setting to quietly change.

---

## Screen → entity map

| screen | reads | writes |
| --- | --- | --- |
| 15a wishlist | WishlistItem, UnlockScore, Piece | WishlistItem |
| 15b where prices come from | Receipt (grouped by retailer), ResaleSource | Receipt.state, ResaleSource |
| 16a nearby | LocalListing, NearbyQuery, PublicProfile | saves, NearbyQuery (client) |
| 16b a listing | LocalListing, PublicProfile, Look | Thread (on first message) |
| 16c list it locally | Piece, Look, Sizes, LocalListing | LocalListing |
| 16d thread and handover | Thread, Message, Handover | Message, Handover, Piece.archivedAt |
| 17a you | PublicProfile, Sizes, LocalPrivacy, User | all four |
| w2a–w2d | as 16a–16d | same |
| w3a–w3i, w4a–w4c | as their phone equivalents | same |
| 15c paste a sticker | Cutout, Photo | Piece or WishlistItem, Cutout |
| 15d listings | Listing, Offer, Piece | Listing, Offer, Piece.availability |
| 14a / 14b add batch | Photo, AddBatch, GarmentCandidate | AddBatch, Piece, Cutout, Collection |
| 13a / 13b receipts | Receipt | Receipt, Piece.priceCents |
| 12a today | Wear, WeatherSnapshot, Look, Piece | Wear |
| 11a piece detail | Piece, Wear, Listing | Piece, Wear, LetGoState |
| 11b look detail | Look, Wear, Piece | Look, Wear |
| 10a sources | Source, Order | Source.settings, Order.state |
| 9a availability | Piece.availability | Piece.availability |
| 9b let-go list | Piece.letGo, resaleEstimateCents | LetGoState, Listing (draft) |
| 9c packing | Collection(packing), Piece | Collection |
| 9d calendar | Wear | Wear |
| 9e search | Piece, Look, Trend | — |
| 1d / 1e wardrobe + filters | Piece | filter state only (client) |
| 2a–2c trends | Trend, Piece | — |
| 8a in-store scan | UnlockScore, Piece | WishlistItem |
| 8b price import | Order, Receipt | Piece.priceCents |
| w1a–w1d desktop | as their phone equivalents | same |

---

## Mapping onto the existing Supabase schema

The repo (`melarnmurphy/pocket-wardrobe-v5`) already has most of the wardrobe half of this model.
Use the existing tables; do not create parallel ones.

| model entity | existing table | notes |
| --- | --- | --- |
| Piece | `public.garments` | has `brand`, `category`, `subcategory`, `purchase_price numeric(12,2)`, `wear_count`, `last_worn_at`; cost per wear is computed by a trigger on update of `purchase_price, wear_count` — do not compute it in the client |
| Piece images / Cutout | `public.garment_images`, `public.garment_3d_assets` | cut-out variants belong on `garment_images` |
| AddBatch / GarmentCandidate | `public.garment_drafts` (`status` default `pending`), `public.processing_jobs` | the review step in 14b is the draft table |
| Source, Receipt | `public.garment_sources` (`source_type` check constraint) | **the check constraint needs revising** — drop retailer-account types, keep/add `forwarded_email`, `read_email`, `docket_photo`, `pdf`, `manual`, `resale_account` |
| Wear | `public.wear_events` | `worn_at`, `outfit_id`; the trigger recomputes `wear_count` and `last_worn_at` |
| Look | `public.lookbook_entries` + `public.lookbook_items` | `source_type` distinguishes lookbook from wishlist |
| WishlistItem | `public.lookbook_entries` with `source_type = 'wishlist'` | `unlockCount` is new — add a column or a computed view |
| Outfit / Placement | `public.outfits`, `public.outfit_items`, `outfits.planned_for` | the look canvas needs x/y/z/scale/rotation columns on `outfit_items` |
| Trend | `trend_signals`, `trend_entities`, `trend_signal_metrics`, `trend_stories`, `user_trend_matches` | already richer than the screens use |
| WeatherSnapshot | `public.weather_snapshots` | |
| User.subscription | `public.user_entitlements` | |
| Sizes, PublicProfile | `public.avatar_profiles`, `public.avatar_measurement_sets` | measurement sets already carry `source_type` and `status`; sizes can live here or in a new `profiles` table — pick one and say so |
| LocalListing, Thread, Message, Handover, LocalPrivacy | **all new** | proposed `local_listings`, `threads`, `messages`, `handovers`, `user_blocks`; needs PostGIS or a lat/lng + haversine index for the radius query |

RLS: every new table follows the existing per-user policy pattern, with one exception — a live
`local_listing` and its seller's `PublicProfile` are readable by any authenticated user inside the
radius. Threads and messages are readable only by their two participants.

## What is deliberately not modelled
No social graph, no following, no comments — sharing a look (6c) exports an image. No purchasing:
Garderobe never places an order. No body measurements or fit prediction. No brand catalogue beyond
what a connected Source or a pasted URL returns.
