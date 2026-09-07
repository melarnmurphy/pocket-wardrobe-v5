/**
 * The sign-in page has three error-rendering slots: an inline block inside the
 * password form, an inline block inside the magic-link form, and a top-of-panel
 * banner for sign-up and reset. Which one shows is driven by `errorSource`,
 * set explicitly by each server action in `app/auth/actions.ts`.
 */
export function shouldShowInlinePasswordError(params: { error?: string; errorSource?: string }): boolean {
  return Boolean(params.error) && params.errorSource === "password";
}

export function shouldShowMagicLinkError(params: { error?: string; errorSource?: string }): boolean {
  return Boolean(params.error) && params.errorSource === "magic-link";
}

export function shouldShowTopBannerError(params: { error?: string; errorSource?: string }): boolean {
  return Boolean(params.error) && params.errorSource !== "password" && params.errorSource !== "magic-link";
}
