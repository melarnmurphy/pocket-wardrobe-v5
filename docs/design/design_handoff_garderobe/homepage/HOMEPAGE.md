# Garderobe marketing homepage — build spec

Unauthenticated route. `app/page.tsx` in `melarnmurphy/pocket-wardrobe-v5` is the signed-in today view, so this is a **new** route: `app/(marketing)/page.tsx` with its own layout, no Supabase session read, no personal data.

Reference design: `Garderobe Homepage - Editorial.dc.html` (open in a browser; `support.js` sits beside it). Three artboards at 1440px: `1a` cover on blue, `1e` same layout on sage, `1b` contents page. **Ship 1a as the hero, 1b as the section below it.** 1e is the alternate colourway — keep it as a theme swap, not a second page.

## Assets

`public/marketing/*.png` — copy the folder in as-is. Eleven cut-outs. Serve through `next/image` with `priority` on the hero figure only.

| file | used in |
| --- | --- |
| `figure-blue-red-spheres.png` | 1a hero figure, strip |
| `cover-green-blazer.png` | 1e hero figure, strip |
| `look-red-dress-spheres.png`, `stack-knits-blue.png`, `figure-pink-brown.png`, `still-loafers-green.png`, `look-zebra-blue.png`, `figure-yellow-poster.png`, `figure-lilac-chair.png`, `figure-blue-flower.png`, `figure-apricot-coat.png` | strip only |

## Tokens

Add these to `app/globals.css` alongside the existing oxblood/cream set. See the conflict note in `github.md` — `docs/style-guide.md` still specifies violet + Space Grotesk and must be updated, not mixed.

```
--cover-blue      #7fbee2
--cover-sage      #8d9f84
--paper           #faf7f2
--paper-warm      #f2ece3
--ink             #1e1a17
--ink-soft        #3a332c
--ink-mute        #6b6459
--green-head      #1f6b3f   /* 1a headline */
--green-body      #14472b   /* 1a body + outline CTA */
--green-head-alt  #2f4030   /* 1e headline + filled CTA */
--green-body-alt  #1e2b1f   /* 1e body */
--orange          #d9532b   /* contents numerals, cover folio */
--oxblood         #6d2a24   /* 1b filled CTA, links */
```

Type: **Karla** 400/500/600/700 for all body, nav, CTAs and headline. **Bodoni Moda** 700 for the 1a masthead and the 1b contents numerals/lines. **Abril Fatface** 400 for the 1e masthead only. Both serifs load from Google Fonts; move them to `next/font/google` on build.

| role | spec |
| --- | --- |
| masthead 1a | Bodoni Moda 700, 260px, `line-height:.78`, `letter-spacing:-.045em`, paper |
| masthead 1e | Abril Fatface 400, 250px, `line-height:.8`, `letter-spacing:-.035em`, paper |
| masthead 1b | Bodoni Moda 700, 96px, `line-height:.85`, `letter-spacing:-.04em`, ink |
| headline | Karla 700, 46px, `line-height:1.02`, `letter-spacing:-.02em`, uppercase |
| dek | Karla 400, 20px/1.5, `max-width:300px` (must stop short of the figure) |
| contents row | Bodoni Moda 400, 30px/1.1 |
| nav / CTA / step labels | Karla 600, 10.5px, `letter-spacing:.18em`, uppercase (CTA 11.5px / `.14em`) |
| pricing line | Karla 400, 17.5px/1.55 |

CTAs are pills, `border-radius:100px`. Filled: `18px 26px`. Outlined: `16.5px 24px` + `1.5px` border.

## 1a — cover (hero)

Grid, 1440 wide, `overflow:hidden`:

1. **Nav bar**, `20px 40px`: how it works / nearby / pricing left; sign in + `start for free` pill right (ink pill, paper label).
2. **Cover well**, `height:940px`, `position:relative`:
   - masthead absolutely at `top:4px`, centred, `z-index:1`;
   - figure `left:50%; top:74px; height:900px`, `z-index:0` — sits *behind* the type;
   - folio `0` `1` — two 34px circles, `top:14px right:40px`, 1.5px orange border, Bodoni 17px;
   - cover block bottom-left at `left:40px bottom:44px`, `z-index:3`: headline, dek, two CTAs.
3. **Step line**, right-aligned, `padding:0 40px 40px`: `01 · upload your wardrobe`, `02 · record every wear`, `03 · get recommendations`.

Two full-bleed texture layers over the whole cover at `z-index:4`, `pointer-events:none` — copy the `repeating-linear-gradient` triple and the `radial-gradient` vignette verbatim from the reference. They are what make it read as print rather than web.

The figure carries an intersected two-axis mask so it dissolves into the ground with no cut edge:

```css
mask-image:
  linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent 100%),
  linear-gradient(180deg, transparent 0, #000 10%, #000 88%, transparent 100%);
mask-composite: intersect; /* + -webkit- pair for Safari */
```

## 1b — contents

Paper ground. Nav bar, then the masthead flanked left and right by a `1.5px` ink rule (`flex:1` either side). Then four numbered rows, `20px` vertical padding, `1px rgba(30,26,23,.18)` hairline between rows and under the last — orange numeral in a fixed `52px` column, label in `flex:1`:

```
01  upload images of your wardrobe
02  record every wear
03  get recommendations on what to wear
04  sell it nearby
```

One pricing line, `white-space:nowrap`, single line by design:

> Free to keep every piece, every wear and every cost per wear. A$69 a year when you want Garderobe deciding with you.

Then the full-bleed **garment strip**: a `360px`-tall row of `288px` cells, `object-fit:cover`, sliding left continuously. Eleven images duplicated once (22 cells, `6336px`) and translated by exactly half (`-3168px`) over `77s linear infinite` — the duplicate is what makes the loop seamless; do not change one number without the other. Pause on `prefers-reduced-motion`.

## Motion

| keyframe | applied to |
| --- | --- |
| `gMast` — fade + `translateY(-14px)`, 1.1s | masthead, on load |
| `gRise` — fade + `translateY(26px)`, .9s, .2s delay | cover block |
| `gFade` — 1.4s, .4s delay | step line |
| `gFloat` — ±16px, 11s, infinite | hero figure |
| `gSlide` — `translateX(0 → -3168px)`, 77s linear infinite | garment strip |

All easing `cubic-bezier(.2,.7,.2,1)`. Wrap the four load animations and both loops in `@media (prefers-reduced-motion: reduce) { animation: none }`.

## Responsive

The reference is a fixed 1440 artboard. Below 1100px: drop the masthead to `clamp(64px, 13vw, 250px)`, let the figure shrink to `height:60vh` and stay centred, move the cover block to static flow under it, stack the step line to two lines, and let the pricing line wrap (drop `nowrap`). Contents rows keep the numeral column at `40px`.

## Not in scope here

how it works, nearby, pricing and the auth screens are specified in `../BUILD_ORDER.md` and `../API_CONTRACT.md`. This route needs no server actions and no data — it is static and cacheable.
