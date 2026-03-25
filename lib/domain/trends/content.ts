// lib/domain/trends/content.ts
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { WardrobeColourFamily } from "@/lib/domain/wardrobe/colours";

export const USER_AGENT = "PocketWardrobe/1.0 (+https://pocketwardrobe.app)";
export const MAX_ARTICLE_CHARS = 5000;

// ─── Article fetching ────────────────────────────────────────────────────────

export async function fetchArticleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) return "";
    const html = await res.text();
    const { document } = parseHTML(html);
    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();
    const text = article?.textContent ?? "";
    return text.replace(/\s+/g, " ").trim().slice(0, MAX_ARTICLE_CHARS);
  } catch {
    return "";
  }
}

// ─── Category filter ─────────────────────────────────────────────────────────

const FASHION_TERMS = ["fashion", "runway", "style", "trend", "wear", "clothing", "apparel"];
const SKIP_TERMS = ["beauty/wellness", "culture/music", "living/royals", "culture/tv", "business/", "photovogue", "culture/books"];

export function isFashionRelevant(categories: string[]): boolean {
  const lower = categories.map((c) => c.toLowerCase());
  if (lower.some((c) => SKIP_TERMS.some((s) => c.includes(s)))) return false;
  return lower.some((c) => FASHION_TERMS.some((f) => c.includes(f)));
}

// ─── Colour extraction ────────────────────────────────────────────────────────

export const COLOUR_SYNONYMS: Record<string, WardrobeColourFamily> = {
  // black
  black: "black", jet: "black", ebony: "black", noir: "black", onyx: "black",
  // white
  white: "white", ivory: "white", "off-white": "white", pearl: "white", chalk: "white",
  ecru: "white", snow: "white",
  // grey
  grey: "grey", gray: "grey", silver: "grey", slate: "grey", ash: "grey",
  pewter: "grey", charcoal: "grey", stone: "grey",
  // blue
  blue: "blue", navy: "blue", cobalt: "blue", azure: "blue", cerulean: "blue",
  indigo: "blue", sapphire: "blue", denim: "blue", "powder blue": "blue",
  "midnight blue": "blue", teal: "blue",
  // red
  red: "red", crimson: "red", scarlet: "red", ruby: "red", wine: "red",
  burgundy: "red", cherry: "red", "deep red": "red", tomato: "red",
  // green
  green: "green", olive: "green", sage: "green", forest: "green", emerald: "green",
  mint: "green", khaki: "green", army: "green", hunter: "green", "forest green": "green",
  "olive green": "green",
  // yellow
  yellow: "yellow", mustard: "yellow", lemon: "yellow", golden: "yellow",
  butter: "yellow", canary: "yellow", ochre: "yellow",
  // orange
  orange: "orange", terracotta: "orange", rust: "orange", copper: "orange",
  pumpkin: "orange", amber: "orange", "burnt orange": "orange",
  // purple
  purple: "purple", violet: "purple", lavender: "purple", lilac: "purple",
  plum: "purple", mauve: "purple", grape: "purple", amethyst: "purple",
  // pink
  pink: "pink", blush: "pink", rose: "pink", fuchsia: "pink", "hot pink": "pink",
  "dusty rose": "pink", salmon: "pink", magenta: "pink", "powder pink": "pink",
  // brown
  brown: "brown", caramel: "brown", chocolate: "brown", tan: "brown",
  cognac: "brown", mocha: "brown", chestnut: "brown", mahogany: "brown",
  sienna: "brown", umber: "brown",
  // beige
  beige: "beige", sand: "beige", nude: "beige", taupe: "beige", camel: "beige",
  oatmeal: "beige", latte: "beige", champagne: "beige", wheat: "beige",
  natural: "beige", cream: "beige"
};

export interface ExtractedColour {
  family: WardrobeColourFamily;
  term: string;
  count: number;
}

export function extractColoursFromText(text: string): ExtractedColour[] {
  const lower = text.toLowerCase();
  const counts = new Map<WardrobeColourFamily, { term: string; count: number }>();

  // Multi-word synonyms first (longest match wins)
  const sortedSynonyms = Object.entries(COLOUR_SYNONYMS).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [synonym, family] of sortedSynonyms) {
    const re = new RegExp(`\\b${synonym.replace(/[-/]/g, "[- /]")}\\b`, "gi");
    const matches = lower.match(re);
    if (matches) {
      const existing = counts.get(family);
      if (!existing || matches.length > existing.count) {
        counts.set(family, { term: synonym, count: matches.length });
      }
    }
  }

  return Array.from(counts.entries())
    .map(([family, { term, count }]) => ({ family, term, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Chunk relevance scoring ─────────────────────────────────────────────────

const TREND_VERBS = ["emerging", "returning", "key", "directional", "everywhere", "season's", "back", "dominant", "defining", "staple", "essential", "statement"];
const FASHION_NOUNS = ["silhouette", "proportion", "tailoring", "drape", "fabric", "texture", "cut", "palette", "aesthetic", "look", "collection", "runway", "trend", "style", "wear"];

export function scoreChunkRelevance(chunk: string): number {
  const lower = chunk.toLowerCase();
  const wordCount = chunk.split(/\s+/).length;
  if (wordCount < 15) return 0;

  let hits = 0;
  for (const word of [...TREND_VERBS, ...FASHION_NOUNS]) {
    if (lower.includes(word)) hits++;
  }

  return hits / (TREND_VERBS.length + FASHION_NOUNS.length);
}

// ─── Chunking ────────────────────────────────────────────────────────────────

export function chunkText(
  text: string,
  size = 800,
  overlap = 150,
  minSize = 200
): string[] {
  if (text.length <= size) return text.length >= minSize ? [text] : [];
  const chunks: string[] = [];
  let i = 0;
  let lastEnd = 0;
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    const chunk = text.slice(i, end);
    if (chunk.length >= minSize) chunks.push(chunk);
    lastEnd = end;
    if (end === text.length) break;
    // Only continue with overlap if there's more text beyond the current window
    const nextStart = i + size - overlap;
    // The tail after the next full window would be text[nextStart+size..]; if the next
    // window would overshoot, emit only the non-overlapping tail
    if (nextStart + size > text.length) {
      const tail = text.slice(lastEnd);
      if (tail.length >= minSize) chunks.push(tail);
      break;
    }
    i = nextStart;
  }
  return chunks;
}
