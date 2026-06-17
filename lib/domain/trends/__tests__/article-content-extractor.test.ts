import { afterEach, describe, expect, it, vi } from "vitest";
import { extractArticleContent } from "../extractors/article-content";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("extractArticleContent", () => {
  it("uses the Trafilatura service before falling back to local extraction", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        text: "  Butter yellow tailoring is becoming a repeated runway signal.  ",
        title: "Colour Signals",
        author: "Editor",
        publishedDate: "2026-06-01"
      })
    }) as unknown as typeof fetch;

    const result = await extractArticleContent("https://example.com/article", {
      trafilaturaServiceUrl: "http://localhost:8010/extract"
    });

    expect(result).toEqual({
      text: "Butter yellow tailoring is becoming a repeated runway signal.",
      extractor: "trafilatura",
      title: "Colour Signals",
      author: "Editor",
      publishedDate: "2026-06-01"
    });
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe(
      "http://localhost:8010/extract"
    );
  });

  it("falls back from Trafilatura to Crawl4AI when the first service has no content", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: "" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          markdown: "# Wide-leg trousers\nA directional trouser shape is recurring."
        })
      }) as unknown as typeof fetch;

    const result = await extractArticleContent("https://example.com/article", {
      trafilaturaServiceUrl: "http://localhost:8010/extract",
      crawl4AIServiceUrl: "http://localhost:8020/extract"
    });

    expect(result?.extractor).toBe("crawl4ai");
    expect(result?.text).toContain("Wide-leg trousers");
  });

  it("uses local Readability extraction when no services are configured", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(`
        <html>
          <head><title>Runway Notes</title></head>
          <body>
            <article>
              <h1>Runway Notes</h1>
              <p>Relaxed tailoring and soft white neutrals are appearing across collections.</p>
            </article>
          </body>
        </html>
      `)
    }) as unknown as typeof fetch;

    const result = await extractArticleContent("https://example.com/article", {
      trafilaturaServiceUrl: undefined,
      crawl4AIServiceUrl: undefined
    });

    expect(result?.extractor).toBe("readability");
    expect(result?.text).toContain("Relaxed tailoring");
  });
});
