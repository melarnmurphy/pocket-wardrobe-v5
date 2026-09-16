import Link from "next/link";

export default async function CheckEmailPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; next?: string; type?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "your inbox";
  const next = params.next && params.next.startsWith("/") ? params.next : "/";
  const isSignup = params.type === "signup";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-10">
      <section className="w-full border-t border-b border-[var(--line)] py-8">
        <p className="pw-kicker">
          Check Email
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
          {isSignup ? "Account created. Confirm your email." : `Magic link sent to ${email}.`}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          {isSignup
            ? `Open the confirmation email sent to ${email}. Once confirmed, you’ll go straight to your onboarding flow.`
            : "Open the Supabase email and follow the sign-in link to continue into Pocket Wardrobe."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={next} className="pw-button-quiet px-4 py-2 text-sm">
            Back
          </a>
          <Link href="/" className="pw-button-quiet px-4 py-2 text-sm">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
