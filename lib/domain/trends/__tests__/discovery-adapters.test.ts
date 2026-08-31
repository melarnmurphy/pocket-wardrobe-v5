import { describe, expect, it, vi, afterEach } from "vitest";
import { createDiscoveryFailoverAdapter, resolveTrendDiscoveryAdapter } from "../adapters/resolve-discovery";
import { parseOpenRouterCitations } from "../adapters/openrouter-search";
import { parseXaiCitations } from "../adapters/xai-search";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("resolveTrendDiscoveryAdapter", () => {
  it("prefers OpenRouter, then SearXNG, then Grok, then Tavily", () => {
    expect(
      resolveTrendDiscoveryAdapter({
        SEARXNG_BASE_URL: "http://localhost:8080",
        OPENROUTER_API_KEY: "or-key",
        XAI_API_KEY: "xai-key",
        TAVILY_API_KEY: "tvly-key"
      }).sourceName
    ).toBe("openrouter_search");

    expect(
      resolveTrendDiscoveryAdapter({
        OPENROUTER_API_KEY: "or-key",
        XAI_API_KEY: "xai-key",
        TAVILY_API_KEY: "tvly-key"
      }).sourceName
    ).toBe("openrouter_search");

    expect(
      resolveTrendDiscoveryAdapter({
        XAI_API_KEY: "xai-key",
        TAVILY_API_KEY: "tvly-key"
      }).sourceName
    ).toBe("xai_search");

    expect(
      resolveTrendDiscoveryAdapter({
        TAVILY_API_KEY: "tvly-key"
      }).sourceName
    ).toBe("tavily_search");
  });

  it("fails over to the next adapter when the first search returns no citations", async () => {
    const result = await createDiscoveryFailoverAdapter([
      {
        sourceName: "openrouter_search",
        sourceType: "openrouter_search",
        search: async () => ({
          query: "q",
          summary: "",
          citations: [],
          groundingAvailable: false
        })
      },
      {
        sourceName: "searxng_search",
        sourceType: "searxng_search",
        search: async () => ({
          query: "q",
          summary: "from searxng",
          citations: [
            {
              title: "Press",
              url: "https://example.com/press",
              snippet: "Tailoring is repeating.",
              publishedDate: null,
              engine: "searxng",
              score: null
            }
          ],
          groundingAvailable: true
        })
      }
    ]).search("q");

    expect(result.citations[0]?.url).toBe("https://example.com/press");
  });

  it("throws when no discovery provider is configured", () => {
    expect(() => resolveTrendDiscoveryAdapter({})).toThrow(
      /No trend discovery provider/
    );
  });
});

describe("parseOpenRouterCitations", () => {
  it("normalizes annotations and citation arrays into discovery citations", () => {
    const citations = parseOpenRouterCitations({
      choices: [
        {
          message: {
            content: "Relaxed tailoring is repeating across collections.",
            annotations: [
              {
                type: "url_citation",
                url_citation: {
                  title: "Runway notes",
                  url: "https://example.com/runway",
                  content: "Relaxed tailoring and soft neutrals."
                }
              }
            ]
          }
        }
      ]
    });

    expect(citations).toEqual([
      {
        title: "Runway notes",
        url: "https://example.com/runway",
        snippet: "Relaxed tailoring and soft neutrals.",
        publishedDate: null,
        engine: "openrouter",
        score: null
      }
    ]);
  });
});

describe("parseXaiCitations", () => {
  it("normalizes xAI citation URLs with the model summary as snippet fallback", () => {
    const citations = parseXaiCitations(
      {
        choices: [
          {
            message: {
              content: "Olive suiting is gaining editorial mentions."
            }
          }
        ],
        citations: ["https://example.com/olive-suiting"]
      },
      "Olive suiting is gaining editorial mentions."
    );

    expect(citations[0]).toMatchObject({
      title: "example.com",
      url: "https://example.com/olive-suiting",
      snippet: "Olive suiting is gaining editorial mentions.",
      engine: "xai"
    });
  });
});
