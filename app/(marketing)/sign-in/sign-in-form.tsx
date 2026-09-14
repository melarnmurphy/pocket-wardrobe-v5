"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  sendPasswordResetAction,
  signInWithMagicLinkAction,
  signInWithPasswordAction,
  signUpWithPasswordAction
} from "@/app/auth/actions";
import { EmailTakenDialog } from "@/components/garderobe/auth/email-taken-dialog";
import { ResetSentDialog } from "@/components/garderobe/auth/reset-sent-dialog";
import { ADELAIDE_SUBURBS } from "@/lib/domain/local-threads/adelaide-suburbs";
import styles from "@/app/marketing.module.css";

type Mode = "signin" | "create";

type Props = {
  next: string;
  initialMode: Mode;
  resetMode: boolean;
  email: string;
  error?: string;
  errorSource?: string;
  notice?: string;
  resetSent: boolean;
  duplicate: boolean;
};

export default function SignInForm({
  next,
  initialMode,
  resetMode,
  email,
  error,
  errorSource,
  notice,
  resetSent,
  duplicate
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isCreate = mode === "create";
  const signInHref = `/sign-in?next=${encodeURIComponent(next)}`;
  const resetHref = `/sign-in?mode=reset&next=${encodeURIComponent(next)}${email ? `&email=${encodeURIComponent(email)}` : ""}`;

  return (
    <>
      <main className={styles.authPage}>
      <section className={styles.authCover} aria-label="Garderobe">
        <div className={styles.authGrain} />
        <div className={styles.authVignette} />
        <div className={styles.authCoverInner}>
          <Link href="/" className={styles.authMasthead}>garderobe</Link>
          <Image
            src="/marketing/cover-green-blazer.webp"
            alt="Figure wearing a green blazer"
            width={1122}
            height={1402}
            priority
            sizes="(max-width: 900px) 100vw, 42vw"
            className={styles.authFigure}
          />
        </div>
      </section>

      <section className={styles.authColumn}>
        <nav className={styles.authNav} aria-label="Marketing">
          <span>
            <Link href="/how-it-works">how it works</Link>
            <Link href="/pricing">pricing</Link>
          </span>
          <Link href="/">back home</Link>
        </nav>

        <div className={styles.authTabs} role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={!isCreate} className={!isCreate ? styles.authTabActive : styles.authTab} onClick={() => setMode("signin")}>Sign in</button>
          <button type="button" role="tab" aria-selected={isCreate} className={isCreate ? styles.authTabActive : styles.authTab} onClick={() => setMode("create")}>Create account</button>
        </div>

        <div className={styles.authSectionLabel}>
          <span>01</span>
          <strong>{isCreate ? "create your account" : "email and password"}</strong>
        </div>

        {error || duplicate || notice || resetSent ? (
          <div className={styles.authMessage} role="status">
            {duplicate ? <>That email already has a wardrobe. <a href={signInHref}>Sign in instead</a>.</> : null}
            {error && !duplicate ? error : null}
            {notice ? notice : null}
            {resetSent ? <>We sent a password reset link to {email || "your email"}.</> : null}
          </div>
        ) : null}

        {isCreate ? (
          <form action={signUpWithPasswordAction} className={styles.authForm}>
            <input type="hidden" name="next" value={next} />
            <Field label="your name" name="name" placeholder="your name" required />
            <div className={styles.authTwoUp}>
              <Field label="date of birth" name="date_of_birth" type="date" required />
              <label className={styles.authField}>
                <span>location</span>
                <input name="location" list="adelaide-suburbs" placeholder="suburb or city, state" required />
                <datalist id="adelaide-suburbs">
                  {ADELAIDE_SUBURBS.map((suburb) => (
                    <option key={suburb.name} value={titleCase(suburb.name) + ", SA"} />
                  ))}
                </datalist>
              </label>
            </div>
            <Field label="email" name="email" type="email" placeholder="you@example.com" defaultValue={email} required />
            <Field label="password" name="password" type="password" placeholder="••••••••" minLength={8} required />
            <Field label="confirm password" name="confirm_password" type="password" placeholder="••••••••" minLength={8} required />
            <div className={styles.authActionRow}>
              <AuthSubmitButton className={styles.authPrimary} pendingLabel="Creating account…">
                Create account
              </AuthSubmitButton>
              <span className={styles.authTerms}>By creating an account you agree to our <a href="#terms">terms</a>.</span>
            </div>
          </form>
        ) : (
          <>
            <form action={signInWithPasswordAction} className={styles.authForm}>
              <input type="hidden" name="next" value={next} />
              <Field label="email" name="email" type="email" placeholder="you@example.com" defaultValue={email} required />
              <Field label="password" name="password" type="password" placeholder="••••••••" required />
              {errorSource === "password" && error ? <p className={styles.authInlineError}>{error}</p> : null}
              <div className={styles.authActionRow}>
                <AuthSubmitButton className={styles.authPrimary} pendingLabel="Signing in…">
                  Sign in
                </AuthSubmitButton>
                <a href={resetHref} className={styles.authForgot}>Forgot your password?</a>
              </div>
            </form>

            {resetMode ? (
              <form action={sendPasswordResetAction} className={styles.authResetForm}>
                <input type="hidden" name="next" value={next} />
                <Field label="email" name="email" type="email" placeholder="you@example.com" defaultValue={email} required />
                <AuthSubmitButton className={styles.authOutline} pendingLabel="Sending…">
                  Email password reset link
                </AuthSubmitButton>
              </form>
            ) : null}

            <div className={styles.authMagic}>
              <div className={styles.authSectionLabel}><span>02</span><strong>magic link</strong></div>
              <p>Use a magic link if you would rather not login with a password.</p>
              <form action={signInWithMagicLinkAction} className={styles.authMagicForm}>
                <input type="hidden" name="next" value={next} />
                <Field label="email" name="email" type="email" placeholder="you@example.com" defaultValue={email} required />
                {errorSource === "magic-link" && error ? <p className={styles.authInlineError}>{error}</p> : null}
                <AuthSubmitButton className={styles.authOutline} pendingLabel="Sending…">
                  Send magic link
                </AuthSubmitButton>
              </form>
            </div>
          </>
        )}
      </section>
      </main>
      {duplicate && email ? <EmailTakenDialog email={email} signInHref={signInHref} /> : null}
      {resetSent && email ? (
        <ResetSentDialog email={email} next={next} resendAction={sendPasswordResetAction} />
      ) : null}
    </>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={styles.authField}><span>{label}</span><input {...props} /></label>;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function AuthSubmitButton({
  children,
  pendingLabel,
  className
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pendingLabel}
        </span>
      ) : children}
    </button>
  );
}
