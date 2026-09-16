"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  sendPasswordResetAction,
  signInWithMagicLinkAction,
  signInWithPasswordAction,
  signUpWithPasswordAction
} from "@/app/auth/actions";
import { EmailTakenDialog } from "@/components/garderobe/auth/email-taken-dialog";
import { ResetSentDialog } from "@/components/garderobe/auth/reset-sent-dialog";
import styles from "@/app/marketing.module.css";
import { ADELAIDE_SUBURBS } from "@/lib/domain/local-threads/adelaide-suburbs";

type Mode = "signin" | "create";

type Props = {
  next: string;
  initialMode: Mode;
  resetMode: boolean;
  email: string;
  name?: string;
  dateOfBirth?: string;
  location?: string;
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
  name = "",
  dateOfBirth = "",
  location = "",
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
      <div className={styles.authLayout}>
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
          <form action={signUpWithPasswordAction} className={styles.authForm} data-1p-ignore="true">
            <input type="hidden" name="next" value={next} />
            <Field label="your name" name="name" autoComplete="name" data-1p-ignore data-op-ignore placeholder="your name" defaultValue={name} required />
            <div className={styles.authTwoUp}>
              <Field label="date of birth" name="date_of_birth" type="date" autoComplete="bday" data-1p-ignore data-op-ignore defaultValue={dateOfBirth} required />
              <LocationField initialValue={location} />
            </div>
            <Field label="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={email} required />
            <Field label="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••" minLength={8} required />
            <Field label="confirm password" name="confirm_password" type="password" autoComplete="new-password" placeholder="••••••••" minLength={8} required />
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
      <footer className={styles.authFullLegal} aria-label="Garderobe legal information">
        <span className={styles.authLegalWord}>garderobe pty ltd</span>
        <span>adelaide</span>
        <span className={styles.authLegalLinks}>privacy&nbsp;&nbsp;&nbsp; terms&nbsp;&nbsp;&nbsp; contact</span>
      </footer>
      </div>
      {duplicate && email ? <EmailTakenDialog email={email} signInHref={signInHref} /> : null}
      {resetSent && email ? (
        <ResetSentDialog email={email} next={next} resendAction={sendPasswordResetAction} />
      ) : null}
    </>
  );
}

function LocationField({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const suggestions = useMemo<Array<{ name: string; custom: boolean }>>(() => {
    const query = value.trim().toLowerCase();
    const matches = (query
      ? ADELAIDE_SUBURBS.filter((entry) => entry.name.includes(query)).slice(0, 5)
      : ADELAIDE_SUBURBS.slice(0, 6)
    ).map((entry) => ({ name: entry.name, custom: false }));
    const exactMatch = ADELAIDE_SUBURBS.some((entry) => entry.name === query);

    return query && !exactMatch
      ? [{ name: value.trim(), custom: true }, ...matches]
      : matches;
  }, [value]);
  const showSuggestions = focused && suggestions.length > 0;

  return (
    <label className={`${styles.authField} ${styles.authLocationField}`}>
      <span>location</span>
      <input
        name="location"
        value={value}
        autoComplete="off"
        data-1p-ignore
        data-op-ignore
        placeholder="suburb or city, state"
        required
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls="location-suggestions"
        onChange={(event) => {
          setValue(event.target.value);
          setHighlightedIndex(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onKeyDown={(event) => {
          if (!showSuggestions) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((index) => Math.min(index + 1, suggestions.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            setValue(suggestions[highlightedIndex]?.name ?? value);
            setFocused(false);
          } else if (event.key === "Escape") {
            setFocused(false);
          }
        }}
      />
      {showSuggestions ? (
        <div id="location-suggestions" className={styles.authLocationSuggestions} role="listbox" aria-label="Suggested locations">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.name}
              type="button"
              role="option"
              aria-selected={index === highlightedIndex}
              className={index === highlightedIndex ? styles.authLocationSuggestionActive : styles.authLocationSuggestion}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setValue(suggestion.name);
                setFocused(false);
              }}
            >
              <span>{suggestion.custom ? `use “${suggestion.name}”` : suggestion.name}</span>
              <span>{suggestion.custom ? "your location" : "South Australia"}</span>
            </button>
          ))}
          <p className={styles.authLocationHint}>Suggestions follow what you type. Any suburb or city, state is welcome.</p>
        </div>
      ) : null}
    </label>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={styles.authField}><span>{label}</span><input {...props} /></label>;
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
