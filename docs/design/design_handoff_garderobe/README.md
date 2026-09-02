# Handoff: Garderobe — pocket wardrobe app (iOS + web)

## Overview
Garderobe is a wardrobe app. It knows every garment a person owns, where it came from, what it
cost, how often it has been worn, and what it is worth now. From that it answers four questions:
what to wear today, whether a trend is already covered by what you own, which pieces are
expensive per wear, and what to let go of.

This bundle covers the full designed surface: 60 phone screens across 18 turns, 31 desktop
screens, 3 clickable prototypes, a style sheet, an illustration spec, and the garment-split
pipeline spec. The data model is in `DATA_MODEL.md`, the endpoint-per-screen contract in
`API_CONTRACT.md`, the dialog inventory in `MODALS.md`, and the sequence to build them in
`BUILD_ORDER.md`.

`MODALS.md` matters more than its length suggests: roughly forty dialogs the product needs are
not drawn, including most of the destructive ones in the wardrobe.

**Read `BUILD_ORDER.md` first.** Its phase 0 lists three things in the repo that contradict these
designs — the style guide's palette and fonts, an MVP non-goal that rules out the marketplace, and
a database constraint that assumes retailer logins. Settling those first avoids building work that
has to be thrown away.

## The repo this builds into
`melarnmurphy/pocket-wardrobe-v5`, branch `main`. Next.js 15 App Router, React 19, Supabase,
Tailwind 4. Server actions per route in `app/<route>/actions.ts`, domain logic in
`lib/domain/<area>/`, migrations in `supabase/migrations/`. Roughly half of this design surface
already has tables and actions behind it; `DATA_MODEL.md` maps every entity onto the real schema,
and `github.md` at the project root maps every screen onto the files it builds from.

## About the design files
The files in this bundle are **design references written in HTML**. They are prototypes that show
intended look, copy and behaviour. They are not production code and should not be copied into an
app as-is.

The task is to **recreate these designs in the target codebase** — Next.js on the web, and a
native iOS app for the phone screens — following the repo's established components, navigation and
state patterns.

Each HTML file is a canvas of many screens side by side. Screens carry stable ids (`14a`, `w1d`)
that this README and `DATA_MODEL.md` refer to. Open a file in a browser and use the id anchors
(e.g. `Garderobe Phone.dc.html#15a`) to jump to a screen.

## Fidelity
**High fidelity.** Colours, type, spacing, copy and component states are final and should be
matched closely. Two qualifications:

- Garment images are transparent PNG cut-outs of real garments, used as stand-ins for user
  content. They are not app assets — see *Assets* below.
- Illustration slots (marked with striped placeholders) are unresolved; sizes are in
  `Illustration Spec.dc.html`.

## Design tokens

### Colour
| token | hex | use |
| --- | --- | --- |
| oxblood | `#6d2a24` | primary action, accents, links, active state |
| oxblood dark | `#43170f` | link hover |
| blush | `#f2d6cb` | second colour (default) — highlight blocks, toast marks |
| blush ink | `#4a1f16` | text on blush |
| blush mid | `#6d3a2c` | body text on blush |
| butter | `#e8cfa0` | second colour (alternate colourway) |
| butter ink | `#3d1f10` | text on butter |
| butter mid | `#5c3a16` | body text on butter |
| ink | `#1e1a17` | primary text, dark chips, toasts |
| cream | `#faf7f2` | app background (light screens) |
| paper | `#f2ece3` | cut-out tile background, page ground |
| paper warm | `#f3eee6` | sticky footer bar |
| stone | `#8b8177` | secondary text, meta |
| slate | `#6b6459` | body copy |
| slate dark | `#4a453f` | dense body copy |
| canvas | `#e6e0d6` | design-canvas ground (not app UI) |
| sage | `#4f6350` | positive status (connected, sold) |
| night | `#141210` | dark screen background |
| night raised | `#2a2522` | dark card / modal column ground |

Hairlines: `1px solid rgba(30,26,23,.11)` inside cards and lists, `rgba(30,26,23,.14)` for
section rules, `rgba(30,26,23,.18)` for page rules. On dark: `rgba(255,255,255,.28)`.
Fills: `rgba(30,26,23,.07)` chips and inactive fields, `rgba(30,26,23,.16)` off-state toggles.

### Type — Karla, everything lowercase except micro labels
| role | spec |
| --- | --- |
| screen title | `300 34px/1.05`, ink; 30px on dense screens |
| section heading | `300 26px/1.1`, ink |
| card statement | `300 21px/1.25` in modals, `400 17px/1.35` in cards |
| item name | `400 14.5px/1.2`, ink (14px in lists) |
| body copy | `400 12.5px/1.5`, slate; `400 11.5px/1.5` on dark |
| meta | `400 11px/1.4`, stone |
| micro label | `600 8–8.5px/1`, `letter-spacing .16–.24em`, uppercase |
| button label | `600 9–10px/1`, `letter-spacing .18–.22em`, uppercase |
| chip | `400 10–11px/1` |
| big numeral | `300 26–64px/1` — numerals carry the page |
| monospace | IBM Plex Mono, for URLs and spec values only |

### Spacing, radius, sizes
- Phone canvas 402 × 874 (iPhone 15/16 logical). Screen gutter **22px**; dark photo screens 20px.
- Status-bar clearance: content starts at **62px** from the top of the screen area.
- Section rhythm: 26px between blocks, 22px inside, 13–16px list rows.
- Radius: 100px pills and toggles · 20px sheet top corners · 14px modal cards · 5–6px inputs and
  tiles · 3px cut-out thumbnails · 4px swatches.
- Primary button: full width, height **52px**, radius 100px, oxblood, uppercase label.
  Secondary: same height, 1px `rgba(30,26,23,.22)` border, transparent. In modals both drop to 44px.
- Toggle: 42 × 25px, knob 19px. Sticky footer: 14px top / 22px side / 32px bottom padding.
- Cut-out thumbnails: 52 × 64 in lists, 56–62 × 70–78 in modals, tile `aspect-ratio:.78` in grids.
  Garment sits flush to the bottom of its tile; shoes and bags centre.
- Desktop 1440 × 900, sidebar 232px, 12-column content, same colours and type at +1px body.

### Motion
Four keyframes, all in the canvas `<helmet>`:
`gwPop` (0.45s ease, scale .88→1, entering cards) · `gwGrow` (1.3–1.4s ease, scaleX from left,
progress and score bars) · `gwDot` (staggered dot reveals) · `gwSpin` (1.1s linear infinite,
processing rings). Nothing else animates. No parallax, no springs.

## Screen inventory

### Phone — `Garderobe Phone.dc.html`
Newest turn first in the file. Each screen is a phone frame; most sit beside a dark column
holding that screen's modals, sheets and toasts.

| id | screen |
| --- | --- |
| 18a | Price and provenance · merge duplicates · disposal · wear correction |
| 18b | Deletes that refuse · unsaved changes · recently deleted · archive toast |
| 18c | Select mode · delete 12 · new collection · sort |
| 18d | Recut the photo · fabric picker |
| 17a | You — details, sizes, and what other people see |
| 16a | Nearby — what's for sale within 30 km |
| 16b | A listing — the seller's own lookbook photos |
| 16c | List it locally — photos already picked |
| 16d | The thread — messages, offer, handover |
| 15a | Wishlist — ranked by what each piece would unlock |
| 15b | Where prices come from — receipts you already have |
| 15c | Paste a sticker — a cut-out copied from anywhere |
| 15d | Listings — what's for sale, and what happened to it |
| 14a | Choose photos — many at a time |
| 14b | Check what we guessed — then add them |
| 13a | Receipts — what's waiting, what's been read |
| 13b | Add a receipt by hand |
| 12a | Today — the forecast decides the layers |
| 12b | Region and units |
| 11a | Piece detail — the most-tapped screen in the app |
| 11b | Look detail — what you wore, and when |
| 10a | Sources — stores, resale and the inbox |
| 9a–9h | Availability · let-go list · packing · calendar · search results · notifications · settings · paywall |
| 8a–8c | In-store scan · price import · trend expiry |
| 7a–7d | Add-a-look, four steps |
| 6a–6d | Onboarding · me · share a look · outfit builder |
| 5a–5d | Look photo · tagging a pin · edit piece · the modal set |
| 4a–4c | Own this trend · unlock score · today |
| 3a–3e | The five decision screens |
| 2a–2c | Trends feed · trend detail · search by trend |
| 1a–1e | Logo studies · wardrobe grid · filters |

### Desktop — `Garderobe Web.dc.html`
| id | screen |
| --- | --- |
| w7a | How it works — three steps under "wear more. waste less." |
| w7b | Nearby — browsable signed out, wear counts attached |
| w7c | Pricing — free wardrobe, plus at A$69 a year |
| w7d | Local threads dialogs — safety brief, age check, decline, reschedule, no-show, report, block |
| w7e | Account and data dialogs — sign out, delete photos, close account, card declined, export ready |
| w7f | Plus on desktop — an interrupt over the blurred let-go list |
| w6a | Wardrobe in select mode — bulk bar, delete N with its cost named |
| w6b | Piece detail — price and fabric as a persistent side panel |
| w6c | Wardrobe dialogs — refuse-and-archive, merge, recut, recently deleted, disposal, unsaved changes |
| w5a | Homepage — signed out, garments on a rail |
| w5b | Sign in — cold device, nothing personal on screen |
| w5c | Welcome back — recognised device, name and avatar only |
| w5d | Start your wardrobe — account, then straight into intake |
| w5e | Homepage v2 — rail as live local listings, planner shown below the fold |
| w4a–w4c | Onboarding — three steps, resumable, shared with the phone |
| w3a | Wishlist |
| w3b | Sources — receipts, dockets, resale accounts |
| w3c | Search everything — ⌘K over any page |
| w3d | Receipts |
| w3e | Account — you, sizes, region, notifications, privacy |
| w3f | Piece detail |
| w3g | Look detail |
| w3h | Calendar |
| w3i | Trends |
| w2a | Nearby |
| w2b | A listing |
| w2c | List it locally |
| w2d | Handovers |
| w1a | Wardrobe — 142 pieces, seen at once |
| w1b | Look canvas — cut-outs arranged with a mouse |
| w1c | Today — the morning view at a desk |
| w1d | Upload — drag a folder in, fix a table |

Phone-only by design: the in-store scan (8a), the share-a-look story canvas (6c), and the paywall
(9h), which lives in the platform's own billing sheet on iOS.

### Prototypes (interactive)
- `Garderobe Prototype - Add a Look v2.dc.html` — the add-a-look flow on real modals.
- `Garderobe Cut-outs.dc.html` — press and hold a garment to lift it out of a photo.
- `Garderobe Phone.dc.html#1e` — the filter sheet: section headers, checkboxes, swatches, sort.

### Specs
- `Garderobe Style Sheet.dc.html` — colour, type, spacing, component states in one sheet.
- `Garment Split - Build Spec.dc.html` — the photo → garments pipeline, thresholds included.
- `Garment Split - Wiring Sequence.dc.html` — the same pipeline as a call sequence.
- `Illustration Spec.dc.html` — illustration slots and sizes.
- `Name Lockups.dc.html`, `Pocket Wardrobe Logos.dc.html` — wordmark and mark studies.

## The four screens built last, in detail

### 15a Wishlist
**Purpose.** Hold the things you want, ranked by how many looks each would open up in the
wardrobe you already own — not by price or recency.

Layout, top to bottom: nav row (`‹ me` · WISHLIST · `+`) · title `9 things / you want` at
`300 34px/1.05` · 12.5px explanation · three sort pills (`unlocks most` active in ink,
`price drop`, `saved`) · a hairline-separated list · a blush note block · sticky footer with
`paste a link` primary and a 56px square secondary.

Each row: 60 × 74 cut-out tile on `#f2ece3`, then name left / price right on one baseline, store
and age in stone, then the unlock bar — 70 × 3px track `rgba(30,26,23,.12)` with an oxblood fill
animated by `gwGrow`, and `unlocks 14 looks` in oxblood at `500 10.5px`. Rows below the top two
use stone instead of oxblood for the bar and label. A discounted row shows the new price with the
old struck through beneath it at 10px stone. A piece close to something owned drops the bar and
shows a grey chip `you own 3 like this`.

Modals in the column: **add to the wishlist** sheet (pasted-URL field in IBM Plex Mono with a
`paste` affordance, resolved preview row, price-drop toggle on by default, `save it`) ·
**you own three like this** dialog (three cut-outs, `see mine` / `save anyway`) · price-drop
toast with a `↓` mark on blush.

### 15b Where prices come from
**Purpose.** Show which retailers already appear in the user's own receipts, and let a price be
attached without connecting anything.

There are **no retailer account connections** anywhere in the product. Prices arrive by forwarded
order email, photographed docket, pasted product link, or typing. The only accounts that connect
are resale accounts (depop, vestiaire), so that buying there adds a piece and selling there removes
one.

Phone frame carries the keyboard. Search row: 40px pill, `rgba(30,26,23,.07)`, 12px circle glyph,
query `coun`, a 1.5 × 16px oxblood caret, `cancel` in oxblood outside the field. Two labelled
groups — `3 RETAILERS IN YOUR RECEIPTS` and `RESALE ACCOUNTS` — of hairline rows: monogram or
document tile, name with the matched substring highlighted on blush, a meta line saying how the
price got in, and `READ` / `TYPE IT` / `CONNECT` in oxblood micro-label caps.

Modals: **reading 7 country road emails** (spinning dashed ring) · **no receipt for this one**
(dashed placeholder, `shoot a docket` / `type the price`) · read toast.

### 15c Paste a sticker
**Purpose.** Accept a garment that arrives already cut out — long-pressed out of a photo on iOS,
or copied off a product page — and treat it exactly like a camera shot.

Dark screen (`#141210`) with a diagonally striped ground at 90% opacity. The pasted PNG sits in a
210 × 250 dashed frame, `rgba(255,255,255,.06)` fill, entering with `gwPop`; the garment carries
`drop-shadow(0 12px 26px rgba(0,0,0,.5))`. Caption underneath in `rgba(255,255,255,.55)`.

A cream sheet occupies the bottom: 20px top corners, 38 × 3px grab handle, `keep this sticker?`
at `300 22px` with `retake` opposite, one line of explanation, then four label/value rows —
name, category, fabric (a dashed oxblood `chiffon?` chip when confidence is below 0.6), where it
goes. Footer: 56px `×` secondary and a full-width `keep it`.

Modals: **there's an image on your clipboard** (`wishlist` / `wardrobe`) · **that one has a
background** (offers to cut it out) · added toast noting the missing price.

### 15d Listings
**Purpose.** Show what is listed for resale, what it is doing, and what leaving the wardrobe did
to the numbers.

Title is two figures: `A$740 listed / A$310 sold`. Status filter pills: `all 9` (active),
`live 6`, `draft 2`, `sold 1`. Rows share the 56 × 70 tile and name/price baseline, then differ
by status:

- **offer** — blush chip `1 offer · A$185`, views and saves in stone, age and wear count below.
- **live** — sage dot + `live`, views, and a suggested price cut after 34 days.
- **draft** — tile at 55% opacity, dashed chip `draft · needs 2 photos`, and the reason
  (`cut-outs don't sell — shoot them on the floor`).
- **sold** — name struck through, sage-tinted chip `sold · 22 aug`, and the settled numbers
  (`A$45 back, cost per wear A$1.40`).

Modals: **A$185 offered** dialog with what was paid and how often it was worn (`counter` /
`accept`) · **list the bias skirt** sheet with a generated description, a resale range beside the
ask, a photo requirement, and a hide-while-listed toggle · sold toast with `undo`.

## Interactions and behaviour
The prototypes are the source of truth for feel; this is the summary.

- **Navigation.** Five tabs: today, wardrobe, looks, trends, me. Detail screens push. Anything
  that edits one object is a bottom sheet; anything that asks a yes/no question is a centred
  dialog; anything that reports a result is a pill toast at the bottom with one action.
- **Press and hold** a garment in a photo lifts it as a cut-out (`Garderobe Cut-outs.dc.html`).
  Around 400ms, with a scale-up and shadow on lift.
- **Batch add** (14a → 14b) never blocks: the user can leave mid-batch and work resumes in the
  background. Nothing enters the wardrobe until the batch is confirmed, including a batch of one.
- **Low confidence is shown as a question**, never as a fact — the dashed `fabric?` chip. Tapping
  it opens the fabric picker.
- **Duplicate detection** shows a side-by-side compare above 0.92 similarity and never merges
  silently.
- **Price is optional everywhere.** A null price renders as `add later`, never `A$0`, and cost
  per wear hides rather than lying.
- **Selling** keeps the piece in the wardrobe until the sale settles, then removes it and posts an
  undoable toast.
- **Loading** is a dashed ring (`gwSpin`) plus a sentence saying what is happening and what is
  finished. Progress bars animate with `gwGrow`, left-anchored.
- **Empty states** name the next action (`another photo, or place it by hand`), never just the
  absence.

## State the client holds
Per screen, beyond the persisted model:

- batch add: `selectedPhotoIds`, `processing{done,total}`, `candidates[]`, `duplicateHint`,
  `collectionToggle`
- filter sheet (1e): open section, selected categories / colours / seasons / fabrics, worn range,
  sort key, derived result count
- wishlist: sort key (`unlocks | priceDrop | saved`), pending paste URL, resolve status
- store search: query, debounced results, per-store connect status
  (`idle | authorising | reading | connected | failed`)
- sticker paste: clipboard availability, whether the pasted image already has alpha, destination
  (`wardrobe | wishlist`)
- listings: status filter, per-listing optimistic state for accept / counter / relist, undo window
  on a sold toast
- look canvas (w1b): piece placements (x, y, z, scale, rotation), selection, undo stack

Everything else is server state. See `DATA_MODEL.md` for entities, invariants and the
screen-to-entity map.

## What is not designed, and needs a decision
Not gaps in the mockups — things a build agent will otherwise invent:

**Settle before writing code**
- **Plus scope.** w7c's pricing copy claims plus helps you decide "what to wear, keep and buy
  next", but wear planning, looks and cost per wear are all free in the drawn tiers. A dashed
  placeholder note sits on the screen. Fix the scope, then the copy.
- **Price conflict.** w3e's plan card says A$49; w7c and the phone paywall say A$69 a year with
  A$9.90 monthly. One is stale.
- The three phase 0 conflicts in `BUILD_ORDER.md` (style guide, MVP scope, `garment_sources`).

**Still undesigned**
- **Empty, loading, offline and error states.** Every screen in this bundle is drawn full and
  happy. No empty wardrobe, no zero nearby results, no skeletons, no offline bar, no 404, no
  focus rings. This is the largest remaining gap on both platforms.
- **Auth failure states** — wrong password, reset sent, email already has a wardrobe, handle
  taken, signed in elsewhere. See `MODALS.md` § 6.
- **Intake modals** — photo library permission, notification permission, upload failed,
  ambiguous receipt, disconnect a resale account. `MODALS.md` § 3.
- **Collections** — rename and delete. `MODALS.md` § 2.
- **Legal pages** — privacy, terms, contact. Linked from every marketing footer, none drawn.
- **Responsive behaviour.** Every desktop frame is 1440 wide. Nothing defines 1280, tablet, or
  what the marketing pages do when they scroll rather than fit a fixed window.
- **Moderation queue** for what `reportListing` and `blockUser` produce. The user-facing report
  dialog is drawn (w7d); the staff side is not.
- **Icon set and a vector logo.** The mark is CSS boxes in the mockups — rebuild as a vector.

## Assets
- `cutouts/` — 13 transparent PNG garment cut-outs used throughout the mockups. They stand in for
  **user content** and are not product assets; do not ship them. Two are used as a matched pair
  (`gown-black-front.png` / `gown-black-back.png`).
- `uploads/` is not included: it held source photography used to make the cut-outs.
- No icon set. Every glyph in the designs is drawn from divs and borders — chevrons are a `›`
  character, ticks are a rotated two-sided border, the camera is a bordered rectangle. Replace
  these with the codebase's icon set at the same optical weight (1.5px strokes at 12–16px).
- Type: **Karla** (Google Fonts, weights 300–700; 300 and 400 carry almost everything).
  **IBM Plex Mono** 400/500 for URLs and spec values only.
- Logo: the bombé mark is drawn in CSS in `Pocket Wardrobe Logos.dc.html` and `Name Lockups.dc.html`
  — rebuild it as a vector before shipping.

## Files in this bundle
| file | what it is |
| --- | --- |
| `BUILD_ORDER.md` | **start here** — phases, dependencies, acceptance criteria, standing rules |
| `API_CONTRACT.md` | endpoint and server action per screen, in the repo's idiom |
| `MODALS.md` | every dialog, sheet and toast — what is drawn, and the 40-odd that are not |
| `DATA_MODEL.md` | entities, fields, invariants, screen-to-entity map, mapping onto the real Supabase schema |
| `Garderobe Phone.dc.html` | all phone screens, turns 1–17 |
| `Garderobe Web.dc.html` | desktop screens w1–w7: app, marketing, auth, and every dialog |
| `Garderobe Style Sheet.dc.html` | style sheet |
| `Garderobe Prototype - Add a Look v2.dc.html` | clickable add-a-look flow |
| `Garderobe Cut-outs.dc.html` | press-and-hold cut-out prototype |
| `Garment Split - Build Spec.dc.html` | photo → garments pipeline spec |
| `Garment Split - Wiring Sequence.dc.html` | the pipeline as a call sequence |
| `Illustration Spec.dc.html` | illustration slots and sizes |
| `Name Lockups.dc.html`, `Pocket Wardrobe Logos.dc.html` | wordmark and mark studies |
| `ios-frame.jsx`, `browser-window.jsx`, `doc-page.js`, `support.js` | frames and runtime the HTML needs to render |
| `cutouts/` | stand-in garment PNGs |

Open any `.dc.html` file directly in a browser. `support.js` must sit beside them.
