# iOS Auth — Design Spec

**Date:** 2026-04-29  
**Status:** Approved  
**Scope:** Sub-project 1 of 2 (Auth only — Supabase data integration is Sub-project 2)

---

## Overview

Add a complete authentication layer to the Pocket Wardrobe iOS app (`PocketWardrobev5`). Currently the app is a pixel-perfect SwiftUI prototype with zero networking, zero dependencies, and all data hardcoded in `SampleData.swift`. This spec covers adding Apple Sign In and email+password auth via the Supabase Swift SDK, protecting the main `TabView` behind a sign-in gate, and persisting sessions across launches.

---

## Auth Methods

- **Apple Sign In** — native iOS flow via `AuthenticationServices`, identity token exchanged with Supabase
- **Email + password** — sign in, sign up (with email confirmation), and password reset

---

## Architecture

### Package Dependency

Add `supabase-swift` via Swift Package Manager:
- URL: `https://github.com/supabase/supabase-swift`
- Targets: `Supabase`, `Auth`

### `Config.swift`

Static struct backed by a `Secrets.plist` file (gitignored). Exposes:
- `supabaseURL: String`
- `supabaseAnonKey: String`

A `Secrets.example.plist` with empty values is committed in place of the real file. Matches the pattern of `.env.example` on the web app.

### `AuthManager`

`@Observable` class. Instantiated once in `PocketWardrobeApp`, passed into the SwiftUI environment via `.environment(authManager)`.

**Properties:**
- `var session: Session?` — nil means unauthenticated
- `var isLoading: Bool` — true during initial Keychain session restore on launch

**Owns:**
- The `SupabaseClient` singleton (initialized from `Config` constants)
- Subscription to `supabase.auth.onAuthStateChange` — updates `session` and `isLoading` on every auth event

**Methods:**
- `signInWithApple()` — triggers `ASAuthorizationController`, exchanges identity token with Supabase
- `signInWithPassword(email:password:)` — calls `supabase.auth.signInWithPassword`
- `signUp(email:password:)` — calls `supabase.auth.signUp`
- `sendPasswordReset(email:)` — calls `supabase.auth.resetPasswordForEmail`
- `signOut()` — calls `supabase.auth.signOut`, clears Keychain tokens

**Session persistence:** Handled entirely by the Supabase SDK (Keychain storage, automatic token refresh before expiry). No manual Keychain code required.

### `RootView`

Switches on `authManager` state:

| State | Renders |
|-------|---------|
| `isLoading == true` | Splash/launch screen — prevents flicker during Keychain restore |
| `session == nil` | `AuthView` |
| `session != nil` | Existing `TabView` |

---

## Auth Screens

### `AuthView`

Single screen. `@State var mode: AuthMode` (`.signIn` / `.signUp`) toggles the form in place — no navigation stack.

**Sign In form:**
- Email field
- Password field
- "Sign In" primary button → `authManager.signInWithPassword(email:password:)`
- "Forgot password?" text button → `authManager.sendPasswordReset(email:)`, shows inline confirmation notice
- Divider ("or")
- `SignInWithAppleButton` styled `.black` → `authManager.signInWithApple()`

**Sign Up form:**
- Email field
- Password field
- Confirm password field
- "Create Account" primary button → `authManager.signUp(email:password:)`
- `SignInWithAppleButton` (same as above — creates account if new, signs in if existing)
- After sign-up: inline notice ("Check your email to confirm your account"), stays on `AuthView` until session established

**Error handling:**
- `var errorMessage: String?` in `AuthView`
- Shown as a styled inline banner above the form
- No system alerts

**Styling:** Uses existing `PWColor`, `PWFont`, `PWSpacing`, and `PWButton` throughout.

---

## Session Management & Data Flow

### Launch Sequence

1. `PocketWardrobeApp` creates `AuthManager`
2. `AuthManager.init()` subscribes to `onAuthStateChange`
3. SDK restores session from Keychain and fires the first event
4. `isLoading` → `false`, `session` → restored value or nil
5. `RootView` renders the correct screen with no flicker

### Apple Sign In Flow

1. App requests Apple credential via `ASAuthorizationController`
2. Apple returns `identityToken` (JWT)
3. `AuthManager` calls `supabase.auth.signInWithIdToken(credentials:)`
4. Supabase validates token, creates or finds user, returns session
5. `onAuthStateChange` fires → `session` set → `RootView` switches to `TabView`

### Token Refresh

Fully automatic via Supabase SDK. No implementation required.

### Sign Out

1. `authManager.signOut()` calls `supabase.auth.signOut()`
2. Keychain tokens cleared
3. `onAuthStateChange` fires with nil session
4. `RootView` switches to `AuthView`
5. `TabView` state discarded

### User Identity

`authManager.session?.user.id` exposes the UUID needed for all Supabase data calls in Sub-project 2. Views do not access `AuthManager` directly for data fetching — the user ID will be passed down or accessed via environment when data integration is implemented.

---

## File Plan

```
PocketWardrobev5/
├── App/
│   ├── PocketWardrobeApp.swift     — modified: create + inject AuthManager
│   └── RootView.swift              — modified: auth-gated switching
├── Auth/
│   ├── AuthManager.swift           — new
│   └── AuthView.swift              — new
├── Config/
│   ├── Config.swift                — new
│   ├── Secrets.plist               — new (gitignored)
│   └── Secrets.example.plist       — new (committed)
```

---

## Out of Scope

- Supabase data integration (Sub-project 2)
- Deep linking / Universal Links for magic link auth
- Biometric unlock (Face ID / Touch ID) — can be added later on top of this layer
- Account deletion flow
