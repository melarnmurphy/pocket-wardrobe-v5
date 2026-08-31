import type { TrendDiscoveryAdapter, TrendDiscoveryCitation } from "./searxng-search";

interface XaiMessage {
  content?: string;
}

interface XaiResponse {
  choices?: Array<{ message?: XaiMessage }>;
  citations?: string[];
}

function hostnameTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function parseXaiCitations(
  payload: XaiResponse,
  summary: string
): TrendDiscoveryCitation[] {
  const seen = new Set<string>();
  const citations: TrendDiscoveryCitation[] = [];

  for (const url of payload.citations ?? []) {
    if (!url || seen.has(url)) continue;
    try {
      const parsed = new URL(url);
      seen.add(url);
      citations.push({
        title: hostnameTitle(parsed.toString()),
        url: parsed.toString(),
        snippet: summary.slice(0, 1200),
        publishedDate: null,
        engine: "xai",
        score: null
      });
    } catch {
      continue;
    }
  }

  return citations;
}

export function createXaiSearchAdapter(opts: {
  apiKey: string;
  model?: string;
}): TrendDiscoveryAdapter {
  const model = opts.model ?? "grok-4";

  return {
    sourceName: "xai_search",
    sourceType: "xai_search",
    async search(query: string) {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Return fashion trend facts with citations. Do not reproduce publisher article bodies."
            },
            { role: "user", content: query }
          ],
          search_parameters: { mode: "auto" }
        }),
        signal: AbortSignal.timeout(30_000)
      });

      if (!response.ok) {
        throw new Error(`xAI search failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as XaiResponse;
      const summary = data.choices?.[0]?.message?.content ?? "";
      const citations = parseXaiCitations(data, summary);

      return {
        query,
        summary,
        citations,
        groundingAvailable: citations.length > 0
      };
    }
  };
}
