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

export function listTrendDiscoveryAdapters(env: TrendDiscoveryEnv): TrendDiscoveryAdapter[] {
  const adapters: TrendDiscoveryAdapter[] = [];

  if (env.OPENROUTER_API_KEY) {
    adapters.push(
      createOpenRouterSearchAdapter({
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_TREND_MODEL
      })
    );
  }

  if (env.SEARXNG_BASE_URL) {
    adapters.push(
      createSearXNGSearchAdapter({
        baseUrl: env.SEARXNG_BASE_URL,
        maxResults: 10
      })
    );
  }

  if (env.XAI_API_KEY) {
    adapters.push(
      createXaiSearchAdapter({
        apiKey: env.XAI_API_KEY,
        model: env.XAI_TREND_MODEL
      })
    );
  }

  if (env.TAVILY_API_KEY) {
    adapters.push(createTavilySearchAdapter({ apiKey: env.TAVILY_API_KEY }));
  }

  return adapters;
}

export function createDiscoveryFailoverAdapter(
  adapters: TrendDiscoveryAdapter[]
): TrendDiscoveryAdapter {
  if (adapters.length === 0) {
    throw new Error(
      "No trend discovery provider configured. Set OPENROUTER_API_KEY, SEARXNG_BASE_URL, XAI_API_KEY, or TAVILY_API_KEY."
    );
  }

  let active = adapters[0];

  return {
    get sourceName() {
      return active.sourceName;
    },
    get sourceType() {
      return active.sourceType;
    },
    async search(query: string) {
      const errors: string[] = [];
      for (const adapter of adapters) {
        try {
          const result = await adapter.search(query);
          if (result.citations.length > 0) {
            active = adapter;
            return result;
          }
          errors.push(`${adapter.sourceName}: no citations`);
        } catch (error) {
          errors.push(`${adapter.sourceName}: ${String(error)}`);
        }
      }
      throw new Error(`All trend discovery adapters failed. ${errors.join("; ")}`);
    }
  };
}

export function resolveTrendDiscoveryAdapter(
  env: TrendDiscoveryEnv
): TrendDiscoveryAdapter {
  return createDiscoveryFailoverAdapter(listTrendDiscoveryAdapters(env));
}
