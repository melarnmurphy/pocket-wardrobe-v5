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
    <main className="pw-shell mx-auto flex min-h-[calc(100vh-68px)] max-w-3xl items-center">
      <section className="w-full rounded-[6px] border border-[var(--line)] bg-[var(--cream)] p-6 md:p-8">
        <p className="pw-kicker">authentication required</p>
        <h1 className="mt-4 max-w-[18ch] text-[34px] font-light leading-[1.05] tracking-[-0.04em]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-[13px] leading-6 text-[var(--muted)]">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/sign-in?next=${encodeURIComponent(next)}`}
            className="pw-button-primary"
          >
            sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
