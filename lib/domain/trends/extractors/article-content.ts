import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export const TREND_USER_AGENT = "PocketWardrobe/1.0 (+https://pocketwardrobe.app)";
export const MAX_EXTRACTED_ARTICLE_CHARS = 5000;

export interface ExtractedArticleContent {
  text: string;
  extractor: "trafilatura" | "crawl4ai" | "readability";
  title?: string | null;
  author?: string | null;
  publishedDate?: string | null;
}

interface HttpExtractorResponse {
  text?: unknown;
  content?: unknown;
  markdown?: unknown;
  title?: unknown;
  author?: unknown;
  publishedDate?: unknown;
  publish_date?: unknown;
  date?: unknown;
  metadata?: unknown;
}

function normalizeExtractedText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACTED_ARTICLE_CHARS)
    : "";
}

function metadataString(
  metadata: unknown,
  keys: readonly string[]
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

async function callHttpExtractor(
  serviceUrl: string,
  url: string,
  extractor: ExtractedArticleContent["extractor"]
): Promise<ExtractedArticleContent | null> {
  const response = await fetch(serviceUrl.replace(/\/+$/, ""), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": TREND_USER_AGENT
    },
    body: JSON.stringify({ url, max_chars: MAX_EXTRACTED_ARTICLE_CHARS }),
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) return null;
  const data = (await response.json()) as HttpExtractorResponse;
  const text =
    normalizeExtractedText(data.text) ||
    normalizeExtractedText(data.content) ||
    normalizeExtractedText(data.markdown);

  if (!text) return null;

  return {
    text,
    extractor,
    title:
      typeof data.title === "string"
        ? data.title
        : metadataString(data.metadata, ["title", "og:title"]),
    author:
      typeof data.author === "string"
        ? data.author
        : metadataString(data.metadata, ["author", "byline"]),
    publishedDate:
      typeof data.publishedDate === "string"
        ? data.publishedDate
        : typeof data.publish_date === "string"
          ? data.publish_date
          : typeof data.date === "string"
            ? data.date
            : metadataString(data.metadata, ["date", "publishedDate", "publish_date"])
  };
}

async function extractWithReadability(url: string): Promise<ExtractedArticleContent | null> {
  const response = await fetch(url, {
    headers: { "User-Agent": TREND_USER_AGENT },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) return null;

  const html = await response.text();
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const text = normalizeExtractedText(article?.textContent);

  if (!text) return null;

  return {
    text,
    extractor: "readability",
    title: article?.title ?? null,
    author: article?.byline ?? null,
    publishedDate: null
  };
}

export async function extractArticleContent(
  url: string,
  opts?: {
    trafilaturaServiceUrl?: string;
    crawl4AIServiceUrl?: string;
  }
): Promise<ExtractedArticleContent | null> {
  const trafilaturaServiceUrl =
    opts?.trafilaturaServiceUrl ?? process.env.TRAFILATURA_SERVICE_URL;
  const crawl4AIServiceUrl =
    opts?.crawl4AIServiceUrl ?? process.env.CRAWL4AI_SERVICE_URL;

  try {
    if (trafilaturaServiceUrl) {
      const result = await callHttpExtractor(trafilaturaServiceUrl, url, "trafilatura");
      if (result) return result;
    }

    if (crawl4AIServiceUrl) {
      const result = await callHttpExtractor(crawl4AIServiceUrl, url, "crawl4ai");
      if (result) return result;
    }

    return await extractWithReadability(url);
  } catch {
    return null;
  }
}
