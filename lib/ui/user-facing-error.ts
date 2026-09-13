/**
 * Keep database, storage, parser, and network details out of user-facing copy.
 * Logs may retain the original error; the UI should explain the next action.
 */
export function userFacingError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : "";
  const normalized = raw.toLowerCase();

  if (!raw) return fallback;
  if (normalized.includes("jwt") || normalized.includes("auth session") || normalized.includes("not authenticated")) {
    return "your session has expired. sign in again and try once more.";
  }
  if (normalized.includes("row-level security") || normalized.includes("permission denied") || normalized.includes("forbidden")) {
    return "we couldn't save that change. refresh the page and try again.";
  }
  if (normalized.includes("premium feature") || normalized.includes("plus feature")) {
    return raw;
  }
  if (normalized.includes("duplicate key") || normalized.includes("unique constraint")) {
    return "that piece is already here. check your wardrobe before adding it again.";
  }
  if (normalized.includes("storage") || normalized.includes("upload") || normalized.includes("bucket")) {
    return "we couldn't save that photo. try a smaller image or try again.";
  }
  if (normalized.includes("fetch failed") || normalized.includes("network") || normalized.includes("timed out") || normalized.includes("status 5")) {
    return "we couldn't reach Garderobe just now. check your connection and try again.";
  }
  if (normalized.includes("not found") || normalized.includes("pgrst116")) {
    return "we couldn't find that piece anymore. refresh the page and try again.";
  }

  // Preserve short, intentionally-written domain messages, but never expose
  // long SQL/API diagnostics or opaque error codes.
  if (raw.length <= 140 && !/[{}\[\]<>]/.test(raw) && !/\b(sql|postgres|supabase|pgrst|constraint)\b/i.test(raw)) {
    return raw;
  }
  return fallback;
}
