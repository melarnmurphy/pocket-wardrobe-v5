import Link from "next/link";

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
      <section className="pw-panel w-full p-8">
        <p className="pw-kicker">
          Authentication Required
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/auth/sign-in?next=${encodeURIComponent(next)}`}
            className="pw-button-primary"
          >
            Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
