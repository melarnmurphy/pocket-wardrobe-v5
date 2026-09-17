# Garderobe Style Guide

## Direction

Garderobe should feel like a well-kept atelier ledger, not a beige utility app and not a
neon SaaS dashboard. The visual language is:

- warm and editorial, oxblood on cream
- premium through restraint, not through gradient or glow
- numerals carry the page — wear counts, unlock scores, prices are set large and quiet
- lowercase everywhere except micro labels, which are uppercase and spaced

This direction supersedes the earlier violet / electric-purple palette. That palette is
retired; nothing in the app should reference it.

## Core palette

| token | hex | use |
| --- | --- | --- |
| oxblood | `#6d2a24` | primary action, accents, links, active state |
| oxblood dark | `#43170f` | link hover |
| blush | `#f2d6cb` | second colour (default) — highlight blocks, toast marks |
| blush ink | `#4a1f16` | text on blush |
| blush mid | `#6d3a2c` | body text on blush |
| ink | `#1e1a17` | primary text, dark chips, toasts |
| cream | `#faf7f2` | app background (light screens) |
| paper | `#f2ece3` | cut-out tile background, page ground |
| paper warm | `#f3eee6` | sticky footer bar |
| stone | `#8b8177` | secondary text, meta |
| slate | `#6b6459` | body copy |
| slate dark | `#4a453f` | dense body copy |
| sage | `#4f6350` | positive status (connected, sold) |
| night | `#141210` | dark screen background |
| night raised | `#2a2522` | dark card / modal column ground |

Hairlines: `1px solid rgba(30,26,23,.11)` inside cards and lists, `rgba(30,26,23,.14)` for
section rules, `rgba(30,26,23,.18)` for page rules. On dark: `rgba(255,255,255,.28)`.
Fills: `rgba(30,26,23,.07)` chips and inactive fields, `rgba(30,26,23,.16)` off-state toggles.

## Usage rules

- Oxblood is the product foundation: primary buttons, active states, links.
- Blush is the second colour for highlight blocks and toast marks. It is not mixed with
  another highlight colour on the one screen.
- Sage is reserved for positive status only — connected, sold, live — never a decorative accent.
- No gradients as a brand device. No violet, electric purple, hot pink, acid yellow or cyber
  mint anywhere in the product.

### Garment image ground

The page ground should feel like warm gallery paper, not a coloured panel behind the clothes.
Keep the cream/paper base quiet and use only a very soft, low-saturation warmth behind a
featured cut-out when separation is needed. The garment remains the visual anchor.

- Preserve the cream base; reduce peach/yellow saturation rather than increasing contrast.
- Keep any warmth local and diffuse, with no obvious gradient boundary.
- Use a faint soft shadow beneath cut-outs to ground them without boxing them in.
- Prefer cut-outs on the continuous page surface; do not add decorative image cards.
- On mobile, let the image ground collapse naturally with the content rather than becoming a
  tall coloured slab.

This is the visual reading: **warm gallery wall**, not **coloured panel**.

### Product surface schema

The signed-in product follows one continuous editorial surface across today, wardrobe,
lookbook, calendar, trends, and resale. Feature pages may change their content, but not their
visual grammar:

- spacing scale: `4 · 8 · 14 · 20 · 32 · 46 · 64`;
- hairline rules and square surfaces do the structural work;
- almost no radius except pill buttons and toggles;
- serif display titles, Karla body copy, and uppercase tracked micro labels;
- cut-outs carry emphasis; cards should not compete with them;
- one continuous cream ground rather than a collection of boxed sections.

### Editorial product rulings

The current product direction is the reference for all signed-in surfaces:

- One continuous page surface replaces segmented cards.
- Hairline rules create structure without adding visual noise.
- The editorial hierarchy is clear: one daily recommendation, then supporting evidence.
- The sidebar feels like part of the product system, not a separate dashboard.
- Serif display type gives the product a distinctive identity.
- “Worn this week” and “worth knowing” make the data feel useful, not merely administrative.

Refinements to preserve as the product expands:

- Reduce the number of tiny uppercase labels; they should not compete with one another.
- Make the primary daily action the most visually dominant control on the page.
- Keep the palette restrained: cream, ink, oxblood, and one soft warmth are enough.
- Let large hero image areas collapse elegantly on mobile instead of becoming tall slabs.
- Apply the continuous editorial surface to wardrobe, lookbook, calendar, trends, and resale.
- Keep dense controls—filters, editing, and tagging—in drawers or sheets so the main pages
  retain their calm rhythm.
- Treat the colour wheel as a quiet explanatory layer inside outfit reasoning, never as
  another prominent dashboard.

## Shape system

- Pills and toggles: `100px` radius.
- Bottom sheets: `20px` top corners, with a `38 × 3px` grab handle.
- Modal cards: `14px` radius.
- Inputs and tiles: `5–6px` radius.
- Cut-out thumbnails: `3px` radius. Swatches: `4px` radius.
- Primary button: full width, `52px` height, `100px` radius, oxblood fill, uppercase label.
  Secondary: same height, `1px rgba(30,26,23,.22)` border, transparent fill. Both drop to
  `44px` inside modals.
- Toggle: `42 × 25px`, knob `19px`.

## Typography

Karla carries everything except monospace values. Everything is lowercase except micro
labels, which are uppercase.

| role | spec |
| --- | --- |
| screen title | `300 34px/1.05`, ink; `30px` on dense screens |
| section heading | `300 26px/1.1`, ink |
| card statement | `300 21px/1.25` in modals, `400 17px/1.35` in cards |
| item name | `400 14.5px/1.2`, ink (`14px` in lists) |
| body copy | `400 12.5px/1.5`, slate; `400 11.5px/1.5` on dark |
| meta | `400 11px/1.4`, stone |
| micro label | `600 8–8.5px/1`, `letter-spacing .16–.24em`, uppercase |
| button label | `600 9–10px/1`, `letter-spacing .18–.22em`, uppercase |
| chip | `400 10–11px/1` |
| big numeral | `300 26–64px/1` — numerals carry the page |
| monospace | IBM Plex Mono, for URLs and spec values only |

- Display: **Karla** (weights 300–700; 300 and 400 carry almost everything).
- Monospace: **IBM Plex Mono** 400/500, for URLs and spec values only.

### Marketing homepage

The unauthenticated `/` route is a print cover, not the atelier ledger. It keeps Karla
for body, nav, CTAs and the cover headline, then uses:

| role | spec |
| --- | --- |
| masthead (blue cover) | **Bodoni Moda** 700, paper, tight tracking |
| masthead (sage colourway) | **Abril Fatface** 400, paper |
| contents numerals and row labels | **Bodoni Moda** 400, orange numerals / ink labels |

Cover tokens live beside the product palette in `app/globals.css` (`--cover-blue`,
`--cover-sage`, `--green-head`, `--green-body`, `--orange`). They are for that route
only — oxblood on cream remains the in-app system. Do not mix violet or Space Grotesk
back in.

## Motion

Four keyframes only, nothing else animates: no parallax, no springs, no playful bounce.

- `gwPop` — `0.45s` ease, scale `.88→1`, entering cards.
- `gwGrow` — `1.3–1.4s` ease, `scaleX` from the left, progress and score bars.
- `gwDot` — staggered dot reveals.
- `gwSpin` — `1.1s` linear infinite, processing rings.

## Trends section

Trends reads as a data surface within the same system, not a separate visual product. It
uses the same oxblood/cream tokens as the rest of the app; the big-numeral treatment does
the work of making it feel like its own place.

## Source of truth

The canonical version of this table, with full component states, lives in
`docs/design/design_handoff_garderobe/Garderobe Style Sheet.dc.html`. Where the two
disagree, the `.dc.html` file wins and this file should be updated to match.
