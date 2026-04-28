# Account Page Design

**Date:** 2026-04-29
**Status:** Approved — ready for implementation

---

## Overview

Redesign the `/account` page and its entry points (desktop nav, mobile header) to give the account settings page a proper editorial design consistent with the rest of the app, and to surface it accessibly on mobile.

---

## Scope

- `app/account/page.tsx` — page layout and sections
- `app/account/account-profile-form.tsx` — form component
- `components/auth-shell.tsx` — desktop nav header (MM avatar circle)
- `components/atelier-shell.tsx` — mobile header (MM avatar circle replacing hamburger)
- No new data fields, no new server actions, no schema changes

---

## Page Layout — Layout A: Single Column Editorial

The page uses the existing `pw-shell` wrapper with a single column structure. Sections are `pw-panel-soft` white cards separated by vertical rhythm.

### 1. Editorial Header

- `pw-kicker`: "Account"
- Large serif headline: *"Personal settings for your wardrobe OS."* (desktop) / *"Personal settings."* (mobile, shorter)
- `pw-chip` row below the headline showing: current plan tier + preferred location (or "No location set")
- Separated from sections below by a bottom border (`var(--line)`)

### 2. Account Info Section (white card)

- Section kicker: "Account Info"
- Italic serif section title: *"Keep your planner grounded in a real place."*
- **Email field** — read-only, styled with `--paper` background and `--muted` text to signal it is non-editable
- **Preferred Location field** — editable, white background, placeholder: "Adelaide, Sydney, Melbourne..."
- **Save button** — `pw-button-primary`, full-width on mobile
- Existing `updateAccountProfileAction` server action, no changes needed

### 3. Plan Section (white card)

**Default (collapsed) state:**
- Section kicker: "Your Plan"
- Plan chip (`pw-chip`) showing current tier (e.g. "Free")
- Right-aligned: quiet underline "Upgrade plan →" link + a small italic `?` circle button (15×15px, border `var(--line-strong)`)

**Expanded state (? clicked):**
- Inline panel revealed below the plan row, separated by a `var(--line)` top border
- Small uppercase kicker: "What's included"
- Feature list with dot indicators:
  - Filled dark dot = included on current plan
  - Faded dot = locked / Premium only
  - Features shown: Unlimited wardrobe items, Outfit generation (included); AI feature labels & garment tagging, Trend intelligence & match scoring, Style rules engine (locked on Free)
- "Upgrade to Premium →" filled dark button at the bottom of the expanded panel
- Toggle is client-side only (no server round-trip); implemented with a `useState` boolean

### 4. Footer

- Quiet `signout-link` text ("Sign out") at the very bottom of the page, left-aligned
- Styled with `--muted` colour and underline, not a button
- Calls the existing `signOutAction`

---

## Desktop Nav — `auth-shell.tsx`

**Current:** wordmark + nav links in a row + email chip + "Sign Out" button

**New:**
- Remove email chip and Sign Out button from nav bar
- Add an **MM avatar circle** (28×28px, filled `--foreground`, `--accent-foreground` text, 700 weight) on the far right
- Initials derived from the authenticated user's email local part: if it contains a dot (e.g. `mel.murphy@example.com`), take the first character of each dot-separated segment and uppercase them → "MM". Otherwise take the first two characters uppercased (e.g. `melarn@11point2.io` → "ME").
- `auth-shell.tsx` is a server component. The avatar + dropdown must be extracted into a `AvatarMenu` client component that receives `email` as a prop and manages open/close state internally.
- Clicking the avatar circle opens a small **dropdown panel** (white card, `border-radius: 10px`, `shadow-strong`):
  - Header: email address (small, muted) + derived initials or email prefix (slightly larger, bold)
  - "Account settings" item → navigates to `/account`
  - "Sign out" item → calls `signOutAction` (muted colour)
- Dropdown closes on outside click via a `useEffect` click-away listener
- Nav links get more breathing room: `gap` between items increased, each link has `px-2.5 py-1.5` padding with `rounded-full` hover state

---

## Mobile Header — `atelier-shell.tsx`

**Current:** wordmark on left, hamburger (3-line `<details>`) on right

**New:**
- Replace the hamburger `<details>` element with an **MM avatar circle** (26×26px, same style as desktop)
- `atelier-shell.tsx` is a server component. Extract the avatar + menu panel into an `AtelierMenu` client component that receives `email`, `isAdmin`, and `pathname` as props and manages open/close state internally.
- Tapping the circle opens a **slide-down menu panel** that overlays the page content (not a `<details>` — use a `useState` + conditional render)
- The menu panel contains:
  1. **Header bar:** wordmark on left, ✕ close button on right
  2. **Profile card** (subtle `--paper` background, bottom border): MM avatar + name/email + plan chip stacked
  3. **Nav list:** Lookbook, Style rules, Account settings (active state bolded), each separated by a fine line
  4. **Sign out:** below a divider, muted colour
- The page body behind the panel dims (semi-transparent overlay)
- The dock remains visible below the panel but is dimmed

---

## Initials Derivation Logic

```ts
function deriveInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  if (local.length === 0) return "?";
  const parts = local.split(".");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
```

This is a pure utility function, placed in `lib/ui/initials.ts`.

---

## Mobile Dock

No changes to the dock. The MM circle in the header is the sole entry point to account/menu on mobile. The dock retains its four items (Closet, Planner, Calendar, Trends) and the central FAB.

---

## Display Name

The app does not currently store a display name. The menu panel shows the email address. Initials are derived from the email as described above. No name field is added to this spec — that is a future extension.

---

## Files Changed

| File | Change |
|---|---|
| `app/account/page.tsx` | Full redesign — editorial header, plan section with ? toggle |
| `app/account/account-profile-form.tsx` | Update form styling; plan section extracted to new component |
| `components/auth-shell.tsx` | Replace email chip + sign out with MM avatar circle + dropdown; extract `AvatarMenu` client component |
| `components/atelier-shell.tsx` | Replace hamburger with MM avatar circle + slide-down menu; extract `AtelierMenu` client component |
| `lib/ui/initials.ts` | New — `deriveInitials(email)` utility |

---

## Out of Scope

- Display name / profile name field
- Notification preferences
- Style profile / body type / aesthetic preferences
- Avatar image upload
- Native iOS app (deleted from this branch)
