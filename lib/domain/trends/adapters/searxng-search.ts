export interface TrendDiscoveryCitation {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string | null;
  engine?: string | null;
  score?: number | null;
}

export interface TrendDiscoveryResult {
  query: string;
  summary: string;
  citations: TrendDiscoveryCitation[];
  groundingAvailable: boolean;
}

export interface TrendDiscoveryAdapter {
  sourceName: string;
  sourceType: string;
  search(query: string): Promise<TrendDiscoveryResult>;
}

interface SearXNGResult {
  title?: string;
  url?: string;
  content?: string;
  publishedDate?: string;
  engine?: string;
  score?: number;
}

interface SearXNGResponse {
  query?: string;
  results?: SearXNGResult[];
}

function cleanBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function createSearXNGSearchAdapter(opts: {
  baseUrl: string;
  maxResults?: number;
  categories?: string;
  language?: string;
  safeSearch?: 0 | 1 | 2;
}): TrendDiscoveryAdapter {
  const baseUrl = cleanBaseUrl(opts.baseUrl);
  const maxResults = opts.maxResults ?? 10;

  return {
    sourceName: "searxng_search",
    sourceType: "searxng_search",
    async search(query: string): Promise<TrendDiscoveryResult> {
      const url = new URL(`${baseUrl}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("categories", opts.categories ?? "general");
      url.searchParams.set("language", opts.language ?? "en");
      url.searchParams.set("safesearch", String(opts.safeSearch ?? 1));

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PocketWardrobe/1.0 (+https://pocketwardrobe.app)"
        },
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) {
        throw new Error(
          `SearXNG search failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as SearXNGResponse;
      const citations = (data.results ?? [])
        .filter((result) => result.url && (result.content || result.title))
        .slice(0, maxResults)
        .map((result) => ({
          title: result.title || result.url!,
          url: result.url!,
          snippet: (result.content || result.title || "").slice(0, 1200),
          publishedDate: result.publishedDate ?? null,
          engine: result.engine ?? null,
          score: result.score ?? null
        }));

      return {
        query: data.query ?? query,
        summary: citations.map((citation) => citation.snippet).join(" "),
        citations,
        groundingAvailable: citations.length > 0
      };
    }
  };
}
