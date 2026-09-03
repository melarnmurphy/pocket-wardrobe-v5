/**
 * The sign-in page has two error-rendering slots: an inline block inside the
 * password form, and a top-of-panel banner shared by every other source
 * (magic link, sign-up, reset). Which one shows is driven by `errorSource`,
 * set explicitly by each server action in `app/auth/actions.ts`, rather than
 * by `mode`, which also changes for reasons unrelated to which form raised
 * the error (e.g. it defaults to "password" whenever it isn't "reset" or
 * "signup", which used to misdirect a magic-link error into the password
 * form's inline slot).
 */
export function shouldShowInlinePasswordError(params: { error?: string; errorSource?: string }): boolean {
  return Boolean(params.error) && params.errorSource === "password";
}

export function shouldShowTopBannerError(params: { error?: string; errorSource?: string }): boolean {
  return Boolean(params.error) && params.errorSource !== "password";
}
