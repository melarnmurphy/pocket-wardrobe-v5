import { signInWithMagicLinkAction } from "@/app/auth/actions";

export function AuthRequiredCard({
  next,
  title,
  description
}: {
  next: string;
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-10">
      <section className="w-full rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[0_18px_50px_rgba(40,25,12,0.08)]">
        <p className="text-sm uppercase tracking-[0.35em] text-[var(--muted)]">
          Authentication Required
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{description}</p>
        <form action={signInWithMagicLinkAction} className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
          <input type="hidden" name="next" value={next} />
          <input
            suppressHydrationWarning
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded-full border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)]"
          >
            Send Magic Link
          </button>
        </form>
      </section>
    </main>
  );
}
