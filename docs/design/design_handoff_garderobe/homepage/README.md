# Handoff: Garderobe marketing pack (homepage + auth)

## Overview
Two unauthenticated screens for Garderobe: the editorial marketing homepage and the sign in / create account page. Both are new routes — `app/page.tsx` in `melarnmurphy/pocket-wardrobe-v5` is the signed-in "today" view and must not be replaced.

## About the design files
The `.dc.html` files here are **design references created in HTML** — prototypes of the intended look and behaviour, not production code to copy. The task is to recreate them in the existing Next.js + Supabase app using its established patterns (App Router, server components where appropriate, Tailwind or the existing styling approach, `next/image`, `next/font`). Open each file directly in a browser; `support.js` must sit beside them.

## Fidelity
**High fidelity.** Colours, typography, spacing, radii and motion values are final and specified exactly in the two build specs. Recreate the UI to match.

## What to read, in order
1. `HOMEPAGE.md` — the homepage build spec: layout, tokens, type scale, the sliding garment strip, motion, responsive rules. Three artboards (`1a` cover on blue, `1b` contents page, `1e` sage colourway); ship 1a as the hero and 1b below it, 1e as a theme swap.
2. `SIGN_IN.md` — the auth build spec: two-column layout, the sticky figure panel, mode tabs, field list (including the new name / date of birth / location fields on create), magic link section, state.
3. `Garderobe Homepage - Editorial.dc.html` and `Garderobe Sign In.dc.html` — the running references.
4. `../BUILD_ORDER.md`, `../API_CONTRACT.md`, `../DATA_MODEL.md` — existing project docs for wiring, endpoints and schema. Name, date of birth and location are new profile fields; check the data model before adding columns.

## Routes
| Screen | Route | Data |
| --- | --- | --- |
| Marketing homepage | `app/(marketing)/page.tsx` | none — static and cacheable |
| Sign in / create account | `app/(marketing)/sign-in/page.tsx` | Supabase auth only (`signInWithPassword`, `signUp`, `signInWithOtp`) |

Both sit under a `(marketing)` layout that does not read the session.

## Assets
`public/marketing/` — eleven editorial cut-out PNGs. Copy the folder in as-is and serve through `next/image`; `priority` on the hero figure only. Per-file usage is tabled in `HOMEPAGE.md`.

## Fonts
Karla (400/500/600/700) for all body, nav, labels and CTAs. Bodoni Moda (400/700) display only — mastheads, contents numerals, auth mode tabs. Abril Fatface (400) only for the 1e masthead. Loaded from Google Fonts in the references; move to `next/font/google` on build.

## Known conflict
`docs/style-guide.md` in the repo still specifies violet + Space Grotesk. That predates this direction — update it to the tokens in `HOMEPAGE.md` rather than mixing the two.

## Files in this bundle
```
HOMEPAGE.md                          homepage build spec
SIGN_IN.md                           auth build spec
Garderobe Homepage - Editorial.dc.html
Garderobe Sign In.dc.html
support.js                           runtime the two references need
public/marketing/*.png               11 image assets
```
