import Link from "next/link";

export default async function CheckEmailPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "your inbox";
  const next = params.next && params.next.startsWith("/") ? params.next : "/";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-10">
      <section className="w-full rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[0_18px_50px_rgba(40,25,12,0.08)]">
        <p className="text-sm uppercase tracking-[0.35em] text-[var(--muted)]">
          Check Email
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
          Magic link sent to {email}.
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Open the Supabase email and follow the sign-in link to continue into Pocket Wardrobe.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={next}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
          >
            Back
          </a>
          <Link
            href="/"
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
