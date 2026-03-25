import type { TrendSourceAdapter, RSSEntry, TrendSourceInsertPayload } from "./rss";
import { isFashionRelevant } from "@/lib/domain/trends/content";

// Configure via VOGUE_RSS_FEED_URL env var.
// Verify the feed URL is accessible before first ingestion run.
const VOGUE_FEED_URL = process.env.VOGUE_RSS_FEED_URL ?? "https://www.vogue.com/feed/rss";

const SENIOR_EDITOR_BYLINES = [
  "hamish bowles", "anna wintour", "chioma nnadi", "mark holgate",
  "alessandra codinha", "sarah mower", "anders christian madsen"
];

function editorAuthorityScore(author: string | null): number {
  if (!author) return 0.7;
  const normalized = author.toLowerCase();
  return SENIOR_EDITOR_BYLINES.some((name) => normalized.includes(name)) ? 0.95 : 0.75;
}

export const vogueAdapter: TrendSourceAdapter = {
  sourceName: "Vogue",
  sourceType: "fashion_publication",
  feedUrl: VOGUE_FEED_URL,
  baseAuthorityScore: 0.85,

  parseEntry(entry: RSSEntry): TrendSourceInsertPayload {
    return {
      source_name: "Vogue",
      source_type: "fashion_publication",
      source_url: entry.link,
      title: entry.title,
      publish_date: entry.pubDate ? new Date(entry.pubDate).toISOString() : null,
      author: entry.author,
      region: null,
      season: null,
      raw_text_excerpt: entry.description,
      authority_score: editorAuthorityScore(entry.author)
    };
  },

  shouldProcess(entry: RSSEntry): boolean {
    return isFashionRelevant(entry.categories);
  }
};

export const registeredAdapters: TrendSourceAdapter[] = [vogueAdapter];
