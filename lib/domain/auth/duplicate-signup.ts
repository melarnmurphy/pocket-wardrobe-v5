/**
 * If email confirmations are configured to reject on the server side (rather
 * than obfuscate), Supabase raises this message directly.
 */
export function isDuplicateAccountMessage(message: string): boolean {
  return /already registered|already exists/i.test(message);
}

/**
 * When email confirmations are enabled, Supabase deliberately returns a
 * "successful" signUp with no error for an email that already has a
 * confirmed account, to avoid leaking which emails are registered. The
 * tell is an empty `identities` array on the returned user. We choose to
 * disclose this to the user anyway (per the "that email already has a
 * wardrobe" design), rather than silently pretending to send a
 * confirmation email that will never arrive.
 */
export function looksLikeExistingAccount(
  user: { identities?: unknown[] | null } | null | undefined
): boolean {
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}
