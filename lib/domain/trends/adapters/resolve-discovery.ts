import type { TrendDiscoveryAdapter } from "./searxng-search";
import { createSearXNGSearchAdapter } from "./searxng-search";
import { createOpenRouterSearchAdapter } from "./openrouter-search";
import { createXaiSearchAdapter } from "./xai-search";
import { callTavilySearch } from "./tavily-search";

export type TrendDiscoveryEnv = {
  SEARXNG_BASE_URL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_TREND_MODEL?: string;
  XAI_API_KEY?: string;
  XAI_TREND_MODEL?: string;
  TAVILY_API_KEY?: string;
};

export function createTavilySearchAdapter(opts: {
  apiKey: string;
}): TrendDiscoveryAdapter {
  return {
    sourceName: "tavily_search",
    sourceType: "tavily_search",
    async search(query: string) {
      const result = await callTavilySearch(query, { apiKey: opts.apiKey });
      return {
        query: result.query,
        summary: result.summary,
        citations: result.citations.map((citation) => ({
          ...citation,
          publishedDate: null,
          engine: "tavily",
          score: null
        })),
        groundingAvailable: result.groundingAvailable
      };
    }
  };
}

export function resolveTrendDiscoveryAdapter(
  env: TrendDiscoveryEnv
): TrendDiscoveryAdapter {
  if (env.SEARXNG_BASE_URL) {
    return createSearXNGSearchAdapter({
      baseUrl: env.SEARXNG_BASE_URL,
      maxResults: 10
    });
  }

  if (env.OPENROUTER_API_KEY) {
    return createOpenRouterSearchAdapter({
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_TREND_MODEL
    });
  }

  if (env.XAI_API_KEY) {
    return createXaiSearchAdapter({
      apiKey: env.XAI_API_KEY,
      model: env.XAI_TREND_MODEL
    });
  }

  if (env.TAVILY_API_KEY) {
    return createTavilySearchAdapter({ apiKey: env.TAVILY_API_KEY });
  }

  throw new Error(
    "No trend discovery provider configured. Set SEARXNG_BASE_URL, OPENROUTER_API_KEY, XAI_API_KEY, or TAVILY_API_KEY."
  );
}
