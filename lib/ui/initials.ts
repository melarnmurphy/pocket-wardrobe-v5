export function deriveInitials(displayName: string | null, email: string): string {
  if (displayName?.trim()) {
    return displayName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (email.split("@")[0] ?? "?").slice(0, 2).toUpperCase();
}
