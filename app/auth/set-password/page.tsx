import { updatePasswordAction } from "@/app/auth/actions";

export default async function SetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/wardrobe";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-10">
      <section className="pw-panel w-full p-8">
        <p className="pw-kicker">
          Set Password
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
          Choose a password for your account
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          This page is intended for password setup and reset links sent by Supabase.
        </p>

        {params.error ? (
          <p className="mt-6 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        <form action={updatePasswordAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="New password"
            className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
          <input
            name="confirm_password"
            type="password"
            required
            minLength={8}
            placeholder="Confirm new password"
            className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
          <button
            type="submit"
            className="pw-button-primary"
          >
            Save Password
          </button>
        </form>
      </section>
    </main>
  );
}
