/**
 * Supabase returns the same generic message for a wrong password and for a
 * non-existent account, by design, so we cannot distinguish them here. Map
 * it to copy that reads naturally either way and points at the fix.
 */
export function mapSignInPasswordError(message: string): string {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Wrong email or password. Try again, or reset it below.";
  }
  return message;
}

/** Supabase OTP rejects some addresses (role accounts, example.com, etc.) with a 500-looking message. */
export function mapMagicLinkError(message: string): string {
  if (/email address .+ is invalid/i.test(message)) {
    return "That email address isn't accepted. Check the spelling and try again.";
  }
  return message;
}
