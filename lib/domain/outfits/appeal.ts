import type { LookbookListItem } from "@/lib/domain/lookbook/service";
import type { UnlockCandidate } from "@/lib/domain/outfits/unlock";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";

function stringField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function pickOwnedTrend(
  matches: UserTrendMatchWithSignal[]
): UserTrendMatchWithSignal | null {
  const byScore = (a: UserTrendMatchWithSignal, b: UserTrendMatchWithSignal) =>
    b.score - a.score;
  const exact = matches.filter((match) => match.match_type === "exact_match").sort(byScore);
  if (exact[0]) return exact[0];
  const adjacent = matches
    .filter((match) => match.match_type === "adjacent_match")
    .sort(byScore);
  return adjacent[0] ?? null;
}

export function lookbookUnlockCandidates(entries: LookbookListItem[]): UnlockCandidate[] {
  const candidates: UnlockCandidate[] = [];

  for (const entry of entries) {
    for (const item of entry.items) {
      const desired = item.desired_item_json;
      if (!desired) continue;

      const title =
        stringField(desired.title) ?? stringField(entry.title) ?? "Desired piece";
      const category =
        stringField(desired.category) ?? stringField(item.role) ?? title;
      const colour =
        stringField(desired.primary_colour_family) ?? stringField(desired.colour);

      candidates.push({
        id: item.id,
        label: title,
        source: "lookbook",
        synthetic: {
          id: `lookbook-${item.id}`,
          title,
          category,
          subcategory: stringField(desired.subcategory),
          primary_colour_family: colour
        }
      });
    }
  }

  return candidates;
}

export function trendUnlockCandidates(
  matches: UserTrendMatchWithSignal[]
): UnlockCandidate[] {
  return matches
    .filter((match) => match.match_type === "missing_piece")
    .map((match) => {
      const attrs = match.trend_signal.normalized_attributes_json ?? {};
      const label = match.trend_signal.label;
      const category = stringField(attrs.category) ?? label;
      const colour = stringField(attrs.family) ?? stringField(attrs.colour);

      return {
        id: match.id ?? match.trend_signal_id,
        label,
        source: "trend" as const,
        synthetic: {
          id: `trend-${match.trend_signal_id}`,
          title: label,
          category,
          subcategory: stringField(attrs.subcategory),
          primary_colour_family: colour
        }
      };
    });
}

export function plannedForDateFromLocal(localDate: string, localHour: number): string {
  if (localHour < 20) return localDate;
  const [year, month, day] = localDate.split("-").map(Number);
  const next = new Date(year, month - 1, day + 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function matchedGarmentIds(match: UserTrendMatchWithSignal): string[] {
  const reasoning = match.reasoning_json as { matched_garment_ids?: unknown };
  if (!Array.isArray(reasoning.matched_garment_ids)) return [];
  return reasoning.matched_garment_ids.filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
}
