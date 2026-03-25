import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { signInWithMagicLinkAction, signOutAction } from "@/app/auth/actions";

export async function AuthShell() {
  const user = await getOptionalUser();

  return (
    <header className="border-b border-[var(--line)] bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/" className="font-semibold tracking-[-0.02em]">
            Pocket Wardrobe
          </Link>
          <Link href="/wardrobe" className="text-[var(--muted)]">
            Wardrobe
          </Link>
          <Link href="/lookbook" className="text-[var(--muted)]">
            Lookbook
          </Link>
          <Link href="/style-rules" className="text-[var(--muted)]">
            Style Rules
          </Link>
          <Link href="/outfits" className="text-[var(--muted)]">
            Outfits
          </Link>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-[var(--muted)]">{user.email}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full border border-[var(--line)] px-4 py-2 font-medium"
              >
                Sign Out
              </button>
            </form>
          </div>
        ) : (
          <form action={signInWithMagicLinkAction} className="flex flex-col gap-3 md:flex-row md:items-center">
            <input type="hidden" name="next" value="/wardrobe" />
            <input
              suppressHydrationWarning
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)]"
            >
              Email Magic Link
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
