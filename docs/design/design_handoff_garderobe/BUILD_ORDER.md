# Garderobe — build order

Sequenced so that every phase compiles, runs, and can be checked by a person. Do not skip ahead:
each phase depends on the one before it. Phase 0 is not optional — three things in the repo
contradict these designs and an agent that starts building without settling them will produce
work that has to be thrown away.

---

## Phase 0 — settle the contradictions

Nothing else starts until these are resolved in the repo, not just in someone's head.

1. **The style guide disagrees with the designs.** `docs/style-guide.md` and `app/globals.css`
   specify violet / electric purple / hot pink with Space Grotesk and Plus Jakarta Sans. These
   mockups are oxblood `#6d2a24` on cream `#faf7f2` in Karla. The mockups are the newer direction.
   Update the style guide and the CSS variables to the token table in `README.md`, then delete the
   old palette so nothing half-migrates.
2. **`agents.md` lists "resale marketplace integration" and "social feed" as MVP non-goals.**
   Local threads is a local resale marketplace with messaging. Lift or rescope that line, or an
   agent reading the repo will correctly refuse to build turns 16 and w2.
3. **Retailer account connections are out.** The product decision is receipts, dockets, pasted
   links and resale accounts only. Revise the `garment_sources.source_type` check constraint
   before writing any ingestion code.

**Done when** the style guide, `agents.md` and the source-type constraint all agree with this
bundle, and `npm run build` is green.

## Phase 1 — tokens and primitives

Rebuild the visual layer before any screen.

- Colour, type, spacing and radius tokens from the `README.md` table into `app/globals.css`.
- Karla and IBM Plex Mono loaded. Nothing else.
- Primitives: pill button (52px, 100px radius, uppercase micro-label), secondary button, toggle
  (42 × 25, knob 19), chip, hairline list row, bottom sheet (20px top corners, grab handle),
  centred dialog, pill toast with one action, cut-out tile (`aspect-ratio: .78`, garment flush to
  the bottom).
- The four keyframes: `gwPop`, `gwGrow`, `gwDot`, `gwSpin`. Nothing else animates.
- Replace the CSS-drawn glyphs with the codebase's icon set at 1.5px strokes, 12–16px.

**Done when** `Garderobe Style Sheet.dc.html` and the running app show the same components side
by side.

## Phase 2 — wardrobe spine

The half the repo mostly has. Bring it up to the designs.

- `1d`/`1e` grid and filter sheet, with a live result count.
- `11a` piece detail — the most-tapped screen; it does not exist as a route yet.
- `w1a`, `w3f` desktop equivalents.
- Availability (`9a`), let-go list (`9b`).

**Done when** a piece can be opened, edited, made unavailable, and found again through every
filter combination; a null price renders as *add later* and cost per wear hides rather than
showing zero.

## Phase 3 — getting pieces in

- `14a`/`14b` batch add on the existing pipeline, including leave-and-resume.
- `w1d` desktop drag-a-folder.
- Duplicate compare above 0.92 similarity, never a silent merge.
- Low confidence renders as a question (`fabric?`), never a value.

**Done when** twenty photos become twenty reviewable drafts, the user can close the app mid-batch
and find the work finished, and nothing enters the wardrobe unconfirmed.

## Phase 4 — prices

- Inbound mail webhook and the forwarding address.
- Docket photo and pdf upload, OCR, parse.
- `13a`/`13b`, `10a`, `15b`, `w3b`, `w3d`.
- Resale account connect (depop, vestiaire) with add-what-I-buy and remove-what-I-sell.

**Done when** forwarding a real order email attaches a real price to a real garment without a
human typing anything, and an unreadable price shows as unreadable.

## Phase 5 — wear, looks, today

- `logWear`, the calendar (`9d`, `w3h`), look detail (`11b`, `w3g`).
- Look canvas placements (`6d`, `w1b`) — needs the new `outfit_items` columns.
- Today (`12a`, `w1c`) on the existing weather route.

**Done when** wear counts, cost per wear, least-worn sort and the calendar all agree, because they
all read `wear_events`.

## Phase 6 — you

- `17a`, `w3e`: name, local name, email, suburb, sizes, height.
- `LocalPrivacy` toggles and the public-profile preview.

Do this **before** local threads. Sizes filter the feed, the suburb centres the radius, and the
public profile is the only thing another person sees — building the marketplace first means
building it against a profile that doesn't exist.

**Done when** the public-profile card renders from real data and contains nothing on the
never-exposed list in `DATA_MODEL.md`.

## Phase 7 — local threads, read-only

- New tables, RLS, and the radius index.
- `16a` and `w2a`: the nearby feed, 30 km default, expandable, four sorts.
- `16b` and `w2b`: a listing, with the seller's lookbook photos at full size.
- Seed enough listings across Adelaide suburbs to test distance and radius honestly.

**Done when** two accounts in different suburbs see each other's listings at the right distances,
the exact point is not in any response payload, and widening the radius changes the result set.

## Phase 8 — local threads, transactional

- `16c`, `w2c`: list it locally, photos pre-picked from the lookbook.
- `16d`, `w2d`: thread, offers, handover proposal, both-party confirmation, payment method.
- Block and report.
- Realtime on messages.

**Done when** two accounts can go from listing to completed handover, the piece leaves the
seller's wardrobe only on the second confirmation, the looks it was in keep their photos, and no
payment code exists anywhere in the diff.

## Phase 9 — wishlist and trends

- `15a`, `w3a` wishlist on `lookbook_entries`, with the shared unlock computation.
- `2a`–`2c`, `w3i` trends on the existing trend tables.
- `8a` in-store scan, `8c` trend expiry.

**Done when** the unlock number on a wishlist item and the *finishes a look* sort in the nearby
feed come from the same function.

## Phase 10 — the edges

- Onboarding (`6a`, `w4a`–`w4c`) on both platforms, resuming each other.
- `9f` notifications, `9g` settings, `9h` paywall.
- `w3c` ⌘K search across pieces, looks, trends and nearby.
- Every empty, error and offline state from the last section of `API_CONTRACT.md`.
- Sign-in and sign-up styled to the new tokens.

**Done when** a new account can get from nothing to a usable wardrobe without reading any
instructions.

---

## Standing rules

These are not phase-specific. Breaking one is a bug regardless of what phase you are in.

1. Garderobe never buys, never lists on the user's behalf, and never processes a payment.
2. A null price is *add later*, never `A$0`. Cost per wear hides rather than lying.
3. Low confidence renders as a question, never a fact.
4. Nothing enters the wardrobe unconfirmed — not a receipt line, not a draft, not a batch of one.
5. Deletion is undoable and says so in a toast.
6. No exact location, ever, to either party, at any listing state.
7. Local threads is never behind the paywall.
