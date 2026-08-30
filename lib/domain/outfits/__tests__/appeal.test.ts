import { describe, expect, it } from "vitest";
import {
  lookbookUnlockCandidates,
  pickOwnedTrend,
  plannedForDateFromLocal,
  trendUnlockCandidates
} from "../appeal";
import type { LookbookListItem } from "@/lib/domain/lookbook/service";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";

const NOW = new Date().toISOString();
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SIGNAL_EXACT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1";
const SIGNAL_ADJACENT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2";
const SIGNAL_MISSING = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3";
const MATCH_EXACT = "cccccccc-cccc-cccc-cccc-ccccccccccc1";
const MATCH_ADJACENT = "cccccccc-cccc-cccc-cccc-ccccccccccc2";
const MATCH_MISSING = "cccccccc-cccc-cccc-cccc-ccccccccccc3";
const ENTRY_ID = "dddddddd-dddd-dddd-dddd-ddddddddddd1";
const ITEM_DESIRED = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1";
const ITEM_OWNED = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2";

function makeSignal(
  overrides: Partial<UserTrendMatchWithSignal["trend_signal"]> = {}
): UserTrendMatchWithSignal["trend_signal"] {
  return {
    id: SIGNAL_EXACT,
    trend_type: "garment",
    label: "wide-leg trousers",
    normalized_attributes_json: { category: "trouser", family: "navy" },
    source_count: 3,
    authority_score: 0.9,
    confidence_score: 0.85,
    last_seen_at: NOW,
    ...overrides
  };
}

function makeMatch(
  overrides: Partial<UserTrendMatchWithSignal> = {}
): UserTrendMatchWithSignal {
  return {
    id: MATCH_EXACT,
    user_id: USER_ID,
    trend_signal_id: SIGNAL_EXACT,
    match_type: "exact_match",
    score: 0.5,
    reasoning_json: { matched_garment_ids: ["g-1"] },
    trend_signal: makeSignal(),
    ...overrides
  };
}

function makeLookbookEntry(
  overrides: Partial<LookbookListItem> = {}
): LookbookListItem {
  return {
    id: ENTRY_ID,
    user_id: USER_ID,
    title: "Navy work look",
    description: null,
    source_type: "wishlist",
    source_url: null,
    image_path: null,
    aesthetic_tags: [],
    occasion_tags: [],
    created_at: NOW,
    preview_url: null,
    items: [],
    ...overrides
  };
}

describe("pickOwnedTrend", () => {
  it("prefers exact_match over adjacent_match", () => {
    const exact = makeMatch({
      id: MATCH_EXACT,
      match_type: "exact_match",
      score: 0.5,
      trend_signal_id: SIGNAL_EXACT,
      trend_signal: makeSignal({ id: SIGNAL_EXACT, label: "beige linen" })
    });
    const adjacent = makeMatch({
      id: MATCH_ADJACENT,
      match_type: "adjacent_match",
      score: 0.9,
      trend_signal_id: SIGNAL_ADJACENT,
      trend_signal: makeSignal({ id: SIGNAL_ADJACENT, label: "butter yellow" })
    });
    expect(pickOwnedTrend([adjacent, exact])?.match_type).toBe("exact_match");
  });

  it("picks the highest-scoring exact_match", () => {
    const low = makeMatch({ id: MATCH_EXACT, score: 0.4 });
    const high = makeMatch({
      id: MATCH_ADJACENT,
      score: 0.8,
      trend_signal_id: SIGNAL_ADJACENT,
      trend_signal: makeSignal({ id: SIGNAL_ADJACENT })
    });
    expect(pickOwnedTrend([low, high])?.id).toBe(MATCH_ADJACENT);
  });

  it("falls back to adjacent_match when no exact exists", () => {
    const adjacent = makeMatch({
      match_type: "adjacent_match",
      score: 0.6
    });
    const missing = makeMatch({
      id: MATCH_MISSING,
      match_type: "missing_piece",
      score: 0.99,
      trend_signal_id: SIGNAL_MISSING,
      trend_signal: makeSignal({ id: SIGNAL_MISSING })
    });
    expect(pickOwnedTrend([missing, adjacent])?.match_type).toBe("adjacent_match");
  });

  it("returns null when only styling or missing matches exist", () => {
    expect(
      pickOwnedTrend([
        makeMatch({ match_type: "styling_match" }),
        makeMatch({ match_type: "missing_piece" })
      ])
    ).toBeNull();
  });
});

describe("lookbookUnlockCandidates", () => {
  it("maps desired_item_json rows to lookbook unlock candidates", () => {
    const entries = [
      makeLookbookEntry({
        items: [
          {
            id: ITEM_DESIRED,
            lookbook_entry_id: ENTRY_ID,
            garment_id: null,
            desired_item_json: {
              title: "Navy trousers",
              category: "trouser",
              primary_colour_family: "navy"
            },
            role: "bottom",
            created_at: NOW
          },
          {
            id: ITEM_OWNED,
            lookbook_entry_id: ENTRY_ID,
            garment_id: "ffffffff-ffff-ffff-ffff-fffffffffff1",
            desired_item_json: null,
            role: "top",
            created_at: NOW
          }
        ]
      })
    ];

    const candidates = lookbookUnlockCandidates(entries);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: ITEM_DESIRED,
      label: "Navy trousers",
      source: "lookbook",
      synthetic: {
        title: "Navy trousers",
        category: "trouser",
        primary_colour_family: "navy"
      }
    });
  });

  it("uses category or entry title when desired title is missing", () => {
    const entries = [
      makeLookbookEntry({
        title: "Weekend set",
        items: [
          {
            id: ITEM_DESIRED,
            lookbook_entry_id: ENTRY_ID,
            garment_id: null,
            desired_item_json: { category: "loafer" },
            role: "shoes",
            created_at: NOW
          }
        ]
      })
    ];
    const [candidate] = lookbookUnlockCandidates(entries);
    expect(candidate?.label).toBe("Weekend set");
    expect(candidate?.synthetic.category).toBe("loafer");
  });
});

describe("trendUnlockCandidates", () => {
  it("maps missing_piece matches using category or label", () => {
    const withCategory = makeMatch({
      id: MATCH_MISSING,
      match_type: "missing_piece",
      trend_signal_id: SIGNAL_MISSING,
      trend_signal: makeSignal({
        id: SIGNAL_MISSING,
        label: "Wide-leg navy",
        normalized_attributes_json: { category: "trouser", family: "navy" }
      })
    });
    const labelOnly = makeMatch({
      id: MATCH_EXACT,
      match_type: "missing_piece",
      trend_signal_id: SIGNAL_EXACT,
      trend_signal: makeSignal({
        id: SIGNAL_EXACT,
        label: "midi dress",
        normalized_attributes_json: {}
      })
    });
    const owned = makeMatch({ match_type: "exact_match" });

    const candidates = trendUnlockCandidates([owned, withCategory, labelOnly]);
    expect(candidates.map((c) => c.synthetic.category)).toEqual(["trouser", "midi dress"]);
    expect(candidates.every((c) => c.source === "trend")).toBe(true);
  });
});

describe("plannedForDateFromLocal", () => {
  it("uses today before 20:00 local", () => {
    expect(plannedForDateFromLocal("2026-08-31", 19)).toBe("2026-08-31");
  });

  it("uses tomorrow at 20:00 local and later", () => {
    expect(plannedForDateFromLocal("2026-08-31", 20)).toBe("2026-09-01");
  });
});
