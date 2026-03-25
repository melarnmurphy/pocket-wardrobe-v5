import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { signOutAction } from "@/app/auth/actions";

export async function AuthShell() {
  const user = await getOptionalUser();
  const isAdmin = user ? await isCurrentUserAdmin() : false;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(250,248,255,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-3 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/" className="pw-nav-link rounded-full px-3 py-2 text-base font-semibold tracking-[-0.05em]">
            Pocket Wardrobe
          </Link>
          <Link href="/wardrobe" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
            Wardrobe
          </Link>
          <Link href="/lookbook" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
            Lookbook
          </Link>
          <Link href="/outfits" className="pw-nav-link rounded-full px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]">
            Outfits
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
    </header>
  );
}
