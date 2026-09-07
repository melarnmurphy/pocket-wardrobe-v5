# Auth — sign in / create account build spec

Unauthenticated route, sibling of the marketing homepage. `app/(marketing)/sign-in/page.tsx`. One page, two modes (sign in / create account) switched client-side — not two routes. No session read; redirect to `/` (the signed-in today view) on success.

Reference design: `Garderobe Sign In.dc.html` (open in a browser, `support.js` beside it). High fidelity — colours, type and spacing below are final. Recreate it in the app's existing React/Next patterns; do not ship the HTML.

## Layout

Two-column CSS grid, `grid-template-columns: minmax(0,0.82fr) minmax(0,1fr)`, `min-height:100vh`, page background `#faf7f2`.

**Left panel** (`overflow:hidden`, `position:relative`):
- Background is a hard-stop gradient, not a flat colour: `linear-gradient(180deg,#8d9f84 0 74vh,#eee8df 78vh 100%)`. The sage meets the photograph's own studio-floor line at 74vh and continues in the floor cream below, so the floor reads as running to the bottom of the page.
- Two full-panel texture layers, `position:absolute; inset:0; pointer-events:none; z-index:4` — the `repeating-linear-gradient` triple at `opacity:.5` and the `radial-gradient` vignette. Copy verbatim from the reference; they must sit on the **panel**, not on the sticky child, or the grain stops at the fold.
- Inside, a `position:sticky; top:0; height:100vh; overflow:hidden` wrapper holds the masthead and figure, so the composition stays in view while the form scrolls.
- Masthead `garderobe`: Bodoni Moda 700, `clamp(40px,6.2vw,88px)`, `line-height:.82`, `letter-spacing:-.045em`, `#faf7f2`, centred, `top:22px`, `z-index:1`.
- Figure `cover-green-blazer.png`: `left:0; top:7%; width:100%; height:93%; object-fit:cover; object-position:50% 12%; z-index:0`. **No mask** — the earlier mask blurred the shoes and the background match makes it unnecessary. (Note for later edits: `mask-composite:intersect` with a `-webkit-mask-composite:source-in` fallback is not equivalent and blanks the image in WebKit.)

**Right column**: flex column, `padding:26px clamp(24px,4vw,64px) 56px`. Form fields cap at `max-width:520px`.

## Right column contents

1. **Nav row** — Karla 600, 10.5px, `letter-spacing:.18em`, uppercase: `how it works`, `pricing` left; `back home` pushed right in `#6b6459`.
2. **Mode tabs** — a flex row, `align-items:flex-end`, `gap:28px`, `padding-top:52px`, `border-bottom:1px solid rgba(30,26,23,.18)`. Each tab is Bodoni Moda 400, 27px, sentence case, `padding-bottom:14px`, `margin-bottom:-1px` so its own rule overlaps the container hairline. Active: `#1e1a17` + `border-bottom:2.5px solid #d9532b`. Inactive: `#9a9287` + transparent rule. The display serif at 27px is deliberate — it must not read as more nav, and must not compete with the green pill button.
3. **Section 01** — numeral `01` in Bodoni Moda 400 30px `#d9532b` in a fixed 44px column, label in Karla 600 10.5px `.18em` uppercase, row `align-items:center`, `padding:38px 0 18px`, hairline under. Label is `email and password` (sign in) or `create your account` (create).
4. **Fields** — all inputs are bottom-rule only: transparent background, `border:0`, `border-bottom:1.5px solid rgba(30,26,23,.35)`, `padding:12px 2px`, Karla 400 19px, focus turns the rule `#1f6b3f`. Labels Karla 600 10px `.16em` uppercase `#6b6459`.
   - Sign in: email, password.
   - Create account: **your name**, then a two-up grid (`minmax(0,1fr)` × 2, `gap:24px`) of **date of birth** (`type="date"`) and **location** (placeholder `Adelaide, SA`), then email, password.
5. **Primary action row** — filled pill: Karla 600 11.5px `.14em` uppercase, `#faf7f2` on `#1f6b3f`, `padding:18px 26px`, `border-radius:100px`. Label `Sign in` / `Create account`. Beside it: `Forgot your password?` link (`#6d2a24`, 15px) on sign in; on create, the line `By creating an account you agree to our terms.` (Karla 400 14px `#6b6459`, `terms` linked).
6. **Section 02 — magic link** (sign in only; hidden entirely on create account): same numbered-row treatment, label `magic link`. Copy: `Use a magic link if you would rather not login with a password.` (Karla 400 18px/1.5 `#3a332c`, `max-width:42ch`). Then an email field and an outlined pill: Karla 600 11.5px `.14em` uppercase `#14472b`, `1.5px solid #14472b`, `padding:16.5px 24px`, `border-radius:100px`.

Set-or-reset password from the current build is intentionally not a separate section — it lives behind `Forgot your password?`.

## State

One piece of UI state: `mode: 'signin' | 'create'`. It drives the active tab, the 01 label, the primary CTA label, the extra create fields, the trailing link/terms line, and whether section 02 renders. Nothing else on the page is stateful. Wire real state for the field values and Supabase calls (`signInWithPassword`, `signUp`, `signInWithOtp`) per `../API_CONTRACT.md`.

Name, date of birth and location are new profile fields on create — check `../DATA_MODEL.md` before adding columns.

## Tokens used here

Same set as the homepage (`HOMEPAGE.md`), plus: `--cover-sage #8d9f84`, `--floor-cream #eee8df`, `--ink-faint #9a9287`. Fonts: Karla 400/600/700 for everything functional; Bodoni Moda 400/700 display only (masthead, tabs, numerals).

## Motion

`gMast` (masthead fade + `translateY(-14px)`, 1.1s) and `gLift` (figure ±14px, 11s infinite), easing `cubic-bezier(.2,.7,.2,1)`. Both wrapped in `@media (prefers-reduced-motion: reduce) { animation: none }`.

## Responsive

Fluid already via `clamp()` and `minmax(0,…)` tracks. Below ~900px, collapse to one column: left panel becomes a `~46vh` banner (masthead + figure, `object-position:50% 12%`), form flows beneath at full width, field grid goes single column.

## Assets

`public/marketing/cover-green-blazer.png` — already in this bundle from the homepage handoff.
