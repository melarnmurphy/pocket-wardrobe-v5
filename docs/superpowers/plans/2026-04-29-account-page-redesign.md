# Account Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/account` page with an editorial layout, add a display name field, replace the desktop nav email chip/sign-out with an avatar dropdown, and replace the mobile hamburger with an MM avatar circle that opens a profile menu.

**Architecture:** Pure utility first (`deriveInitials`), then service/action layer (`display_name`), then leaf UI components (`PlanSection`, `AvatarMenu`, `AtelierMenu`), then the pages that compose them (`account/page.tsx`, `auth-shell.tsx`, `atelier-shell.tsx`). Each task is independently committable.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Supabase auth metadata, Vitest

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `lib/ui/initials.ts` | **Create** | Pure `deriveInitials(displayName, email)` utility |
| `lib/ui/__tests__/initials.test.ts` | **Create** | Unit tests for initials |
| `lib/domain/account/service.ts` | **Modify** | Add `display_name` to schema, get/update |
| `app/account/actions.ts` | **Modify** | Add `display_name` to action Zod schema |
| `app/account/plan-section.tsx` | **Create** | Client component — plan chip + ? expandable panel |
| `app/account/account-profile-form.tsx` | **Modify** | Add Name field, update layout/styling |
| `app/account/page.tsx` | **Modify** | Editorial header, compose form + plan section |
| `components/avatar-menu.tsx` | **Create** | Client component — desktop avatar circle + dropdown |
| `components/auth-shell.tsx` | **Modify** | Use AvatarMenu, clean nav spacing |
| `components/atelier-menu.tsx` | **Create** | Client component — mobile MM circle + slide menu |
| `components/atelier-shell.tsx` | **Modify** | Use AtelierMenu, remove hamburger |

---

## Task 1: `deriveInitials` utility

**Files:**
- Create: `lib/ui/initials.ts`
- Create: `lib/ui/__tests__/initials.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/ui/__tests__/initials.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveInitials } from "@/lib/ui/initials";

describe("deriveInitials", () => {
  it("uses first letter of each space-separated word from display name", () => {
    expect(deriveInitials("Melarn Murphy", "mel@example.com")).toBe("MM");
  });

  it("caps initials at two characters for long names", () => {
    expect(deriveInitials("Anna Belle Carter", "a@example.com")).toBe("AB");
  });

  it("handles single-word display name", () => {
    expect(deriveInitials("Melarn", "mel@example.com")).toBe("M");
  });

  it("falls back to first two chars of email local part when display name is null", () => {
    expect(deriveInitials(null, "melarn@11point2.io")).toBe("ME");
  });

  it("falls back to email when display name is empty string", () => {
    expect(deriveInitials("   ", "mel@example.com")).toBe("ME");
  });

  it("uppercases initials", () => {
    expect(deriveInitials("anna bell", "a@example.com")).toBe("AB");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/ui/__tests__/initials.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/ui/initials'`

- [ ] **Step 3: Implement the utility**

Create `lib/ui/initials.ts`:

```ts
export function deriveInitials(displayName: string | null, email: string): string {
  if (displayName?.trim()) {
    return displayName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (email.split("@")[0] ?? "?").slice(0, 2).toUpperCase();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/ui/__tests__/initials.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ui/initials.ts lib/ui/__tests__/initials.test.ts
git commit -m "feat: add deriveInitials utility"
```

---

## Task 2: Add `display_name` to account service

**Files:**
- Modify: `lib/domain/account/service.ts`

- [ ] **Step 1: Update the schema and service functions**

Replace the full contents of `lib/domain/account/service.ts`:

```ts
import { z } from "zod";
import { getRequiredUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const accountProfileSchema = z.object({
  email: z.string().email().nullable(),
  display_name: z.string().trim().max(80).nullable(),
  preferred_location: z.string().trim().max(160).nullable()
});

export type AccountProfile = z.infer<typeof accountProfileSchema>;

export function getPreferredLocationFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { preferred_location?: unknown }).preferred_location;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function getDisplayNameFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { display_name?: unknown }).display_name;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function getAccountProfile(): Promise<AccountProfile> {
  const user = await getRequiredUser();
  return accountProfileSchema.parse({
    email: user.email ?? null,
    display_name: getDisplayNameFromMetadata(user.user_metadata),
    preferred_location: getPreferredLocationFromMetadata(user.user_metadata)
  });
}

export async function updateAccountProfile(input: {
  display_name: string | null;
  preferred_location: string | null;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const existingMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? { ...(user.user_metadata as Record<string, unknown>) }
      : {};

  if (input.display_name) {
    existingMetadata.display_name = input.display_name;
  } else {
    delete existingMetadata.display_name;
  }

  if (input.preferred_location) {
    existingMetadata.preferred_location = input.preferred_location;
  } else {
    delete existingMetadata.preferred_location;
  }

  const { error } = await supabase.auth.updateUser({ data: existingMetadata });
  if (error) throw new Error(error.message);

  return getAccountProfile();
}
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add lib/domain/account/service.ts
git commit -m "feat: add display_name to account profile service"
```

---

## Task 3: Add `display_name` to account action

**Files:**
- Modify: `app/account/actions.ts`

- [ ] **Step 1: Update the action**

Replace the full contents of `app/account/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateAccountProfile } from "@/lib/domain/account/service";

const updateAccountProfileSchema = z.object({
  display_name: z.string().trim().max(80).optional(),
  preferred_location: z.string().trim().max(160).optional()
});

export type AccountProfileActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const accountProfileActionState: AccountProfileActionState = {
  status: "idle",
  message: null
};

export async function updateAccountProfileAction(
  _previousState: AccountProfileActionState,
  formData: FormData
): Promise<AccountProfileActionState> {
  try {
    const values = updateAccountProfileSchema.parse({
      display_name: formData.get("display_name") ?? undefined,
      preferred_location: formData.get("preferred_location") ?? undefined
    });

    await updateAccountProfile({
      display_name: values.display_name?.trim() || null,
      preferred_location: values.preferred_location?.trim() || null
    });

    revalidatePath("/account");
    revalidatePath("/outfits");
    revalidatePath("/");

    return { status: "success", message: "Account details updated." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update account details."
    };
  }
}
```

- [ ] **Step 2: Run test suite**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add app/account/actions.ts
git commit -m "feat: add display_name to account profile action"
```

---

## Task 4: Create `PlanSection` client component

**Files:**
- Create: `app/account/plan-section.tsx`

- [ ] **Step 1: Create the component**

Create `app/account/plan-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { UserEntitlements } from "@/lib/domain/entitlements";

type PlanSectionProps = {
  entitlements: UserEntitlements;
  upgradeUrl: string | null;
};

type Feature = {
  label: string;
  enabled: boolean;
};

export function PlanSection({ entitlements, upgradeUrl }: PlanSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const features: Feature[] = [
    { label: "Unlimited wardrobe items", enabled: true },
    { label: "Outfit generation", enabled: true },
    { label: "AI feature labels & garment tagging", enabled: entitlements.feature_labels_enabled },
    { label: "Receipt photo scanning", enabled: entitlements.receipt_ocr_enabled },
    { label: "Product URL ingestion", enabled: entitlements.product_url_ingestion_enabled },
    { label: "Outfit decomposition", enabled: entitlements.outfit_decomposition_enabled }
  ];

  const tierLabel = entitlements.plan_tier === "free"
    ? "Free"
    : entitlements.plan_tier === "pro"
    ? "Pro"
    : "Premium";

  return (
    <div className="pw-panel-soft space-y-0 p-6">
      <p className="pw-kicker">Your Plan</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="pw-chip normal-case tracking-normal">{tierLabel}</span>
        <div className="flex items-center gap-3">
          {upgradeUrl && entitlements.plan_tier === "free" && (
            <a
              href={upgradeUrl}
              className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
            >
              Upgrade plan →
            </a>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] text-xs italic text-[var(--muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            ?
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
          <p className="pw-kicker">What&apos;s included</p>
          <ul className="mt-2 space-y-2">
            {features.map((f) => (
              <li key={f.label} className="flex items-start gap-2.5">
                <span
                  className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full"
                  style={{
                    background: f.enabled
                      ? "var(--foreground)"
                      : "rgba(26,25,22,0.18)"
                  }}
                />
                <span
                  className="text-sm leading-snug"
                  style={{ color: f.enabled ? "var(--foreground)" : "var(--muted)" }}
                >
                  {f.label}
                </span>
              </li>
            ))}
          </ul>
          {upgradeUrl && entitlements.plan_tier === "free" && (
            <a
              href={upgradeUrl}
              className="pw-button-primary mt-4 inline-flex"
            >
              Upgrade to Premium →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/account/plan-section.tsx
git commit -m "feat: add PlanSection client component with ? expandable panel"
```

---

## Task 5: Redesign `AccountProfileForm` — add Name field and update styling

**Files:**
- Modify: `app/account/account-profile-form.tsx`

- [ ] **Step 1: Update the form component**

Replace the full contents of `app/account/account-profile-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import {
  accountProfileActionState,
  updateAccountProfileAction,
  type AccountProfileActionState
} from "@/app/account/actions";

export function AccountProfileForm({
  email,
  displayName,
  preferredLocation
}: {
  email: string | null;
  displayName: string | null;
  preferredLocation: string | null;
}) {
  const [state, formAction] = useActionState<AccountProfileActionState, FormData>(
    updateAccountProfileAction,
    accountProfileActionState
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      showAppToast({ tone: "success", message: state.message });
    }
  }, [state.message, state.status]);

  return (
    <form action={formAction} className="pw-panel-soft space-y-5 p-6">
      <div>
        <p className="pw-kicker">Account Info</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
          Keep your planner grounded in a real place.
        </h2>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Name</span>
        <input
          name="display_name"
          defaultValue={displayName ?? ""}
          placeholder="Melarn Murphy"
          maxLength={80}
          className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--foreground)]"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Email</span>
        <input
          value={email ?? ""}
          readOnly
          className="rounded-[10px] border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-[var(--muted)] outline-none"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Preferred Location</span>
        <input
          name="preferred_location"
          defaultValue={preferredLocation ?? ""}
          placeholder="Adelaide, Sydney, Melbourne..."
          className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--foreground)]"
        />
      </label>

      <button type="submit" className="pw-button-primary w-full md:w-auto">
        Save account info
      </button>

      <FormFeedback state={state} />
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/account/account-profile-form.tsx
git commit -m "feat: add Name field to account profile form"
```

---

## Task 6: Redesign `account/page.tsx` — editorial layout

**Files:**
- Modify: `app/account/page.tsx`

- [ ] **Step 1: Update the page**

Replace the full contents of `app/account/page.tsx`:

```tsx
import { AuthenticationError } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { getAccountProfile } from "@/lib/domain/account/service";
import { getBillingStatus } from "@/lib/domain/billing/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { AccountProfileForm } from "@/app/account/account-profile-form";
import { PlanSection } from "@/app/account/plan-section";
import { signOutAction } from "@/app/auth/actions";

export default async function AccountPage() {
  try {
    const [profile, entitlements] = await Promise.all([
      getAccountProfile(),
      getUserEntitlements()
    ]);
    const { upgradeUrl } = getBillingStatus();

    const tierLabel =
      entitlements.plan_tier === "free"
        ? "Free plan"
        : entitlements.plan_tier === "pro"
        ? "Pro plan"
        : "Premium plan";

    return (
      <main className="pw-shell flex min-h-screen max-w-5xl flex-col gap-6 md:px-10">
        {/* Editorial header */}
        <section className="border-b border-[var(--line)] pb-8 pt-2">
          <p className="pw-kicker">Account</p>
          <h1 className="mt-3 text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-[0.95] tracking-[-0.06em] md:hidden">
            Personal settings.
          </h1>
          <h1 className="mt-3 hidden text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-[0.95] tracking-[-0.06em] md:block">
            Personal settings for your wardrobe OS.
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pw-chip normal-case tracking-normal">{tierLabel}</span>
            <span className="pw-chip normal-case tracking-normal">
              {profile.preferred_location ?? "No location set"}
            </span>
          </div>
        </section>

        <AccountProfileForm
          email={profile.email}
          displayName={profile.display_name}
          preferredLocation={profile.preferred_location}
        />

        <PlanSection entitlements={entitlements} upgradeUrl={upgradeUrl} />

        {/* Sign out */}
        <form action={signOutAction} className="pb-4">
          <button
            type="submit"
            className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
          >
            Sign out
          </button>
        </form>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/account"
          title="Sign in to manage your account settings."
          description="Account preferences are tied to your authenticated Supabase user."
        />
      );
    }
    throw error;
  }
}
```

- [ ] **Step 2: Verify the page builds**

```bash
npx tsc --noEmit
```

Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add app/account/page.tsx
git commit -m "feat: redesign account page with editorial layout and plan section"
```

---

## Task 7: Create `AvatarMenu` client component for desktop

**Files:**
- Create: `components/avatar-menu.tsx`

- [ ] **Step 1: Create the component**

Create `components/avatar-menu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { deriveInitials } from "@/lib/ui/initials";
import { signOutAction } from "@/app/auth/actions";

type AvatarMenuProps = {
  email: string;
  displayName: string | null;
};

export function AvatarMenu({ email, displayName }: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = deriveInitials(displayName, email);
  const label = displayName?.trim() || email;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--foreground)] text-[0.56rem] font-bold tracking-wide text-[var(--accent-foreground)] transition-opacity hover:opacity-80"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-white shadow-[0_8px_32px_rgba(26,25,22,0.14)]">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">{email}</p>
            <p className="mt-0.5 text-sm font-semibold">{label}</p>
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-[var(--paper)]"
          >
            Account settings
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 border-t border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--paper)]"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/avatar-menu.tsx
git commit -m "feat: add AvatarMenu client component for desktop nav"
```

---

## Task 8: Update `auth-shell.tsx` — use AvatarMenu, clean nav

**Files:**
- Modify: `components/auth-shell.tsx`

- [ ] **Step 1: Update the shell**

Replace the full contents of `components/auth-shell.tsx`:

```tsx
import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getAccountProfile } from "@/lib/domain/account/service";
import { AvatarMenu } from "@/components/avatar-menu";

export async function AuthShell() {
  const user = await getOptionalUser();
  const isAdmin = user ? await isCurrentUserAdmin() : false;
  const profile = user ? await getAccountProfile().catch(() => null) : null;

  return (
    <header className="pw-shell-header sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 px-6 py-4 md:px-8">
        <div className="flex items-center gap-2 xl:gap-4">
          <Link href="/" className="pw-wordmark pw-nav-link mr-2 rounded-full px-3 py-2 flex-shrink-0">
            Pocket Wardrobe
          </Link>

          <nav className="flex flex-1 flex-wrap items-center gap-1">
            <Link href="/wardrobe" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Wardrobe
            </Link>
            <Link href="/lookbook" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Lookbook
            </Link>
            <Link href="/outfits" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Outfits
            </Link>
            <Link href="/trends" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Trends
            </Link>
            <Link href="/style-rules" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Style Rules
            </Link>
            {isAdmin && (
              <Link href="/admin/entitlements" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
                Admin
              </Link>
            )}
          </nav>

          <div className="flex-shrink-0">
            {user ? (
              <AvatarMenu
                email={user.email ?? ""}
                displayName={profile?.display_name ?? null}
              />
            ) : (
              <Link href="/auth/sign-in?next=%2Fwardrobe" className="pw-button-primary px-4 py-2 text-sm">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/auth-shell.tsx
git commit -m "feat: replace desktop nav sign-out with AvatarMenu circle"
```

---

## Task 9: Create `AtelierMenu` client component for mobile

**Files:**
- Create: `components/atelier-menu.tsx`

- [ ] **Step 1: Create the component**

Create `components/atelier-menu.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { deriveInitials } from "@/lib/ui/initials";
import { signOutAction } from "@/app/auth/actions";

type AtelierMenuProps = {
  email: string;
  displayName: string | null;
  planTier: string;
  isAdmin: boolean;
  pathname: string;
};

const NAV_ITEMS = [
  { label: "Lookbook", href: "/lookbook" },
  { label: "Style rules", href: "/style-rules" },
  { label: "Account settings", href: "/account" }
] as const;

export function AtelierMenu({ email, displayName, planTier, isAdmin, pathname }: AtelierMenuProps) {
  const [open, setOpen] = useState(false);
  const initials = deriveInitials(displayName, email);
  const tierLabel =
    planTier === "free" ? "Free plan" : planTier === "pro" ? "Pro plan" : "Premium plan";
  const label = displayName?.trim() || email;

  return (
    <>
      {/* MM circle — replaces hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--foreground)] text-[0.5rem] font-bold tracking-wide text-[var(--accent-foreground)]"
      >
        {initials}
      </button>

      {/* Overlay + slide-down panel */}
      {open && (
        <>
          {/* dim overlay */}
          <div
            className="fixed inset-0 z-40 bg-[var(--foreground)]/20"
            onClick={() => setOpen(false)}
          />

          {/* menu panel */}
          <div className="fixed inset-x-0 top-0 z-50 overflow-hidden rounded-b-[18px] bg-white shadow-[0_12px_40px_rgba(26,25,22,0.18)]">
            {/* header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <span className="font-display text-lg font-bold tracking-tight">n.</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-lg leading-none text-[var(--muted)]"
              >
                ✕
              </button>
            </div>

            {/* profile card */}
            <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--paper)] px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[0.6rem] font-bold tracking-wide text-[var(--accent-foreground)]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{label}</p>
                <p className="truncate text-xs text-[var(--muted)]">{email}</p>
                <span className="mt-1 inline-block rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {tierLabel}
                </span>
              </div>
            </div>

            {/* nav items */}
            <nav className="py-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-[var(--line)]/50 px-5 py-3.5 text-sm last:border-b-0"
                  style={{
                    fontWeight: pathname.startsWith(item.href) ? 700 : 400
                  }}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin/entitlements"
                  onClick={() => setOpen(false)}
                  className="block border-t border-[var(--line)]/50 px-5 py-3.5 text-sm"
                >
                  Admin
                </Link>
              )}
            </nav>

            {/* sign out */}
            <div className="border-t border-[var(--line)] px-5 py-4">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-sm text-[var(--muted)] underline underline-offset-2"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/atelier-menu.tsx
git commit -m "feat: add AtelierMenu client component for mobile header"
```

---

## Task 10: Update `atelier-shell.tsx` — use AtelierMenu

**Files:**
- Modify: `components/atelier-shell.tsx`

- [ ] **Step 1: Update the shell**

Replace the full contents of `components/atelier-shell.tsx`:

```tsx
import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getAccountProfile } from "@/lib/domain/account/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { AtelierMenu } from "@/components/atelier-menu";

export async function AtelierShell({ pathname }: { pathname: string }) {
  const user = await getOptionalUser();
  const isAdmin = user ? await isCurrentUserAdmin() : false;
  const [profile, entitlements] = user
    ? await Promise.all([
        getAccountProfile().catch(() => null),
        getUserEntitlements().catch(() => null)
      ])
    : [null, null];

  return (
    <>
      <header className="atelier-top">
        <Link href="/wardrobe" className="atelier-wordmark" aria-label="Pocket Wardrobe — Closet">
          <span className="atelier-wordmark__mark">n</span>
          <span className="atelier-wordmark__dot">.</span>
        </Link>

        {user ? (
          <AtelierMenu
            email={user.email ?? ""}
            displayName={profile?.display_name ?? null}
            planTier={entitlements?.plan_tier ?? "free"}
            isAdmin={isAdmin}
            pathname={pathname}
          />
        ) : (
          <Link href="/auth/sign-in?next=%2Fwardrobe" className="text-sm font-medium">
            Sign in
          </Link>
        )}
      </header>

      <AtelierDock pathname={pathname} />
    </>
  );
}

const DOCK_ITEMS = [
  { id: "closet", label: "Closet", href: "/wardrobe", glyph: "hanger" },
  { id: "planner", label: "Planner", href: "/outfits", glyph: "tee" },
  { id: "calendar", label: "Calendar", href: "/calendar", glyph: "calendar" },
  { id: "trends", label: "Trends", href: "/trends", glyph: "trend" }
] as const;

function activeId(pathname: string): string | null {
  if (pathname.startsWith("/wardrobe")) return "closet";
  if (pathname.startsWith("/outfits")) return "planner";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/trends")) return "trends";
  return null;
}

function AtelierDock({ pathname }: { pathname: string }) {
  const active = activeId(pathname);
  const left = DOCK_ITEMS.slice(0, 2);
  const right = DOCK_ITEMS.slice(2);

  return (
    <nav className="atelier-dock" aria-label="Primary">
      <div className="atelier-dock__rail">
        <div className="atelier-dock__col">
          {left.map((item) => (
            <DockLink key={item.id} item={item} active={active === item.id} />
          ))}
        </div>
        <Link href="/wardrobe" className="atelier-fab" aria-label="Add to wardrobe">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <line x1="11" y1="3" x2="11" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Link>
        <div className="atelier-dock__col">
          {right.map((item) => (
            <DockLink key={item.id} item={item} active={active === item.id} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function DockLink({
  item,
  active
}: {
  item: (typeof DOCK_ITEMS)[number];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className="atelier-dock__link"
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
    >
      <DockIcon glyph={item.glyph} />
      <span>{item.label}</span>
    </Link>
  );
}

function DockIcon({ glyph }: { glyph: "hanger" | "tee" | "calendar" | "trend" }) {
  switch (glyph) {
    case "hanger":
      return (
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
          <path
            d="M11 6c0-1.5 1.2-2.7 2.7-2.7S16.4 4.5 16.4 6c0 .8-.4 1.5-1 1.9L11 11l-9.5 5.4a1 1 0 00.5 1.9h18a1 1 0 00.5-1.9L11 11"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
          />
        </svg>
      );
    case "tee":
      return (
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
          <path
            d="M3 4l4-2 1.5 2h5L15 2l4 2 2 4-3 1v7H4v-7L1 8l2-4z"
            stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2" y="4" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.3" />
          <rect x="2" y="4" width="16" height="4" rx="2" fill="currentColor" />
          <line x1="6" y1="2" x2="6" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="14" y1="2" x2="14" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "trend":
      return (
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
          <polyline
            points="1,14 6,10 10,12 14,5 18,7 21,3"
            stroke="currentColor" strokeWidth="1.3" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <path d="M21 3l-3 0M21 3l0 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
  }
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add components/atelier-shell.tsx
git commit -m "feat: replace mobile hamburger with AtelierMenu avatar circle"
```

---

## Self-Review Checklist

- [x] `deriveInitials` receives `(displayName, email)` — used consistently in `AvatarMenu` and `AtelierMenu`
- [x] `AccountProfileForm` receives `displayName` prop — passed from `page.tsx`
- [x] `updateAccountProfile` accepts `{ display_name, preferred_location }` — action passes both
- [x] `PlanSection` receives `UserEntitlements` (not a subset) — typed correctly
- [x] `AtelierShell` passes `planTier` from entitlements to `AtelierMenu` — confirmed
- [x] `auth-shell.tsx` removed "Account" from nav links — no longer needed (it's in the avatar dropdown)
- [x] Sign-out on `account/page.tsx` footer uses `signOutAction` form — correct
- [x] `getAccountProfile()` in `auth-shell.tsx` wrapped in `.catch(() => null)` — safe for unauthenticated renders
