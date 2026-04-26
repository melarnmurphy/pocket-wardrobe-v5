import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { signOutAction } from "@/app/auth/actions";

export async function AuthShell() {
  const user = await getOptionalUser();
  const isAdmin = user ? await isCurrentUserAdmin() : false;

  return (
    <header className="pw-shell-header sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 px-6 py-4 md:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="pw-shell-nav text-sm">
            <Link href="/" className="pw-wordmark pw-nav-link rounded-full px-3 py-2">
              Pocket Wardrobe
            </Link>
            <div className="pw-nav-rail">
              <Link href="/wardrobe" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
                Wardrobe
              </Link>
              <Link href="/lookbook" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
                Lookbook
              </Link>
              <Link href="/outfits" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
                Outfits
              </Link>
              <Link href="/account" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
                Account
              </Link>
              <Link href="/trends" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
                Trends
              </Link>
              <Link href="/style-rules" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
                Style Rules
              </Link>
              {isAdmin ? (
                <Link href="/admin/entitlements" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
                  Admin
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {user ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="pw-chip normal-case tracking-normal">{user.email}</span>
                <form action={signOutAction}>
                  <button type="submit" className="pw-button-quiet px-4 py-2 text-sm">
                    Sign Out
                  </button>
                </form>
              </div>
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
