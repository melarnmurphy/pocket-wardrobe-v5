export function canonicalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ").replace(/-/g, " ");
}
