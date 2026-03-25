import Link from "next/link";
import {
  sendPasswordResetAction,
  signInWithMagicLinkAction,
  signInWithPasswordAction,
  signUpWithPasswordAction
} from "@/app/auth/actions";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{
    next?: string;
    mode?: string;
    email?: string;
    error?: string;
    notice?: string;
  }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/wardrobe";
  const email = params.email ?? "";
  const mode =
    params.mode === "reset"
      ? "reset"
      : params.mode === "signup"
        ? "signup"
        : "password";
  const isCreateAccount = mode === "signup";
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(next)}`;
  const createAccountHref = `/auth/sign-in?mode=signup&next=${encodeURIComponent(next)}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 md:px-10">
      <section className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="pw-panel p-8">
          <p className="pw-kicker">
            {isCreateAccount ? "Create Account" : "Sign In"}
          </p>
          <div className="pw-pill-toggle mt-6">
            <a
              href={signInHref}
              data-active={!isCreateAccount}
            >
              Sign In
            </a>
            <a
              href={createAccountHref}
              data-active={isCreateAccount}
            >
              Create Account
            </a>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
            {isCreateAccount ? "Create your Pocket Wardrobe account" : "Use password or magic link"}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            {isCreateAccount
              ? "Create an account with email and password. If email confirmation is enabled, Supabase will send a confirmation link before the account becomes active."
              : "Existing magic-link accounts can send themselves a password setup email below, then use password sign-in from the same screen."}
          </p>

          {params.error ? (
            <p className="mt-6 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {params.error}
            </p>
          ) : null}
          {params.notice ? (
            <p className="mt-6 rounded-[8px] border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--muted)]">
              {params.notice}
            </p>
          ) : null}

          <div className="mt-8 grid gap-5">
            {isCreateAccount ? (
              <form action={signUpWithPasswordAction} className="pw-panel-soft space-y-4 p-5">
                <input type="hidden" name="next" value={next} />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                    Create Account
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Start with email and password. You can still use magic links later if you want.
                  </p>
                </div>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={email}
                  placeholder="you@example.com"
                  className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Create password"
                  className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                />
                <input
                  name="confirm_password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Confirm password"
                  className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                />
                <button
                  type="submit"
                  className="pw-button-primary"
                >
                  Create Account
                </button>
              </form>
            ) : (
              <>
                <form action={signInWithPasswordAction} className="pw-panel-soft space-y-4 p-5">
                  <input type="hidden" name="next" value={next} />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      Password
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Sign in with your email and password.
                    </p>
                  </div>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={email}
                    placeholder="you@example.com"
                    className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                  />
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="Password"
                    className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="pw-button-primary"
                  >
                    Sign In With Password
                  </button>
                </form>

                <form action={sendPasswordResetAction} className="pw-panel-soft space-y-4 p-5">
                  <input type="hidden" name="next" value={next} />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      Set Or Reset Password
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {mode === "reset"
                        ? "If your account exists, a reset email has been sent."
                        : "Use this if your account was created with magic link only, or if you forgot your password."}
                    </p>
                  </div>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={email}
                    placeholder="you@example.com"
                    className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="pw-button-quiet"
                  >
                    Email Password Reset Link
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <aside className="pw-panel-dark p-8">
          <p className="pw-kicker text-white/60">
            Magic Link
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
            Continue without a password
          </h2>
          <p className="mt-4 text-sm leading-6 text-white/74">
            Magic links still work. Use this if you do not want to manage a password.
          </p>

          <form action={signInWithMagicLinkAction} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <input
              name="email"
              type="email"
              required
              defaultValue={email}
              placeholder="you@example.com"
              className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
            />
            <button
              type="submit"
              className="pw-button-secondary"
            >
              Send Magic Link
            </button>
          </form>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href={next} className="pw-button-quiet px-4 py-2 text-sm">
              Back
            </a>
            <Link href="/" className="pw-button-quiet px-4 py-2 text-sm">
              Home
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
