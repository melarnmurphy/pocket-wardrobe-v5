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
