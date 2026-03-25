import { XMLParser } from "fast-xml-parser";
import robotsParser from "robots-parser";

const USER_AGENT = "PocketWardrobe/1.0 (+https://pocketwardrobe.app)";
const BOT_NAME = "PocketWardrobe";

async function assertRobotsAllowed(feedUrl: string): Promise<void> {
  const { origin } = new URL(feedUrl);
  const robotsUrl = `${origin}/robots.txt`;

  let robotsTxt = "";
  try {
    const res = await fetch(robotsUrl, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) robotsTxt = await res.text();
  } catch {
    // If robots.txt is unreachable, allow access (fail open)
    return;
  }

  const robots = robotsParser(robotsUrl, robotsTxt);
  if (robots.isDisallowed(feedUrl, BOT_NAME)) {
    throw new Error(`robots.txt disallows fetching ${feedUrl} for ${BOT_NAME}`);
  }
}

export interface RSSEntry {
  title: string;
  link: string;
  description: string | null;
  author: string | null;
  pubDate: string | null;
  categories: string[];
}

export interface TrendSourceInsertPayload {
  source_name: string;
  source_type: string;
  source_url: string;
  title: string;
  publish_date: string | null;
  author: string | null;
  region: string | null;
  season: string | null;
  raw_text_excerpt: string | null;
  authority_score: number;
}

export interface TrendSourceAdapter {
  sourceName: string;
  sourceType: string;
  feedUrl: string;
  baseAuthorityScore: number;
  parseEntry(entry: RSSEntry): TrendSourceInsertPayload;
  shouldProcess?(entry: RSSEntry): boolean;
}

export async function fetchRSSEntries(feedUrl: string): Promise<RSSEntry[]> {
  await assertRobotsAllowed(feedUrl);

  const response = await fetch(feedUrl, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel ?? parsed?.feed;
  if (!channel) throw new Error("RSS parse failed: no channel or feed element found");

  const items: unknown[] = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : Array.isArray(channel.entry)
        ? channel.entry
        : channel.entry
          ? [channel.entry]
          : [];

  return items.map((item: unknown) => {
    const i = item as Record<string, unknown>;
    const link = String(i.link ?? i.id ?? "");
    const author =
      typeof i.author === "string"
        ? i.author
        : typeof i["dc:creator"] === "string"
          ? i["dc:creator"]
          : null;
    const description =
      typeof i.description === "string"
        ? i.description.replace(/<[^>]+>/g, "").slice(0, 500)
        : typeof i.summary === "string"
          ? i.summary.replace(/<[^>]+>/g, "").slice(0, 500)
          : null;
    const categories: string[] = Array.isArray(i.category)
      ? (i.category as unknown[]).map(String)
      : typeof i.category === "string"
        ? [i.category]
        : [];
    return {
      title: String(i.title ?? ""),
      link,
      description,
      author,
      pubDate:
        typeof i.pubDate === "string"
          ? i.pubDate
          : typeof i.published === "string"
            ? i.published
            : null,
      categories
    };
  });
}
