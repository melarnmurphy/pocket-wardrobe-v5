import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSearXNGSearchAdapter } from "../adapters/searxng-search";

const originalFetch = global.fetch;

describe("createSearXNGSearchAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T00:00:00Z"));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("queries SearXNG JSON search and normalizes citations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        query: "fashion trends",
        results: [
          {
            title: "Wide-leg trousers are everywhere",
            url: "https://example.com/trends",
            content: "A useful fashion trend snippet.",
            engine: "brave",
            score: 2.5
          }
        ]
      })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createSearXNGSearchAdapter({
      baseUrl: "https://search.example.com/",
      maxResults: 5
    });

    const result = await adapter.search("fashion trends");
    const requestedUrl = fetchMock.mock.calls[0][0] as URL;

    expect(requestedUrl.toString()).toContain("https://search.example.com/search?");
    expect(requestedUrl.searchParams.get("format")).toBe("json");
    expect(requestedUrl.searchParams.get("q")).toBe("fashion trends");
    expect(result.citations).toEqual([
      {
        title: "Wide-leg trousers are everywhere",
        url: "https://example.com/trends",
        snippet: "A useful fashion trend snippet.",
        publishedDate: null,
        engine: "brave",
        score: 2.5
      }
    ]);
    expect(result.groundingAvailable).toBe(true);
  });

  it("throws when the SearXNG request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable"
    }) as unknown as typeof fetch;

    const adapter = createSearXNGSearchAdapter({
      baseUrl: "https://search.example.com"
    });

    await expect(adapter.search("fashion trends")).rejects.toThrow(
      "SearXNG search failed: 503 Service Unavailable"
    );
  });
});
