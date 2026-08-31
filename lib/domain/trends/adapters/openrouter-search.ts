import type { TrendDiscoveryAdapter, TrendDiscoveryCitation } from "./searxng-search";

interface OpenRouterUrlCitation {
  title?: string;
  url?: string;
  content?: string;
  text?: string;
}

interface OpenRouterAnnotation {
  type?: string;
  url_citation?: OpenRouterUrlCitation;
  url?: string;
  title?: string;
  content?: string;
}

interface OpenRouterMessage {
  content?: string | Array<{ type?: string; text?: string }>;
  annotations?: OpenRouterAnnotation[];
  citations?: Array<string | OpenRouterUrlCitation>;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: OpenRouterMessage }>;
}

function messageText(message: OpenRouterMessage | undefined): string {
  if (!message?.content) return "";
  if (typeof message.content === "string") return message.content;
  return message.content
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join(" ")
    .trim();
}

function citationFromUrl(
  url: string,
  title?: string,
  snippet?: string
): TrendDiscoveryCitation | null {
  try {
    const parsed = new URL(url);
    return {
      title: title?.trim() || parsed.hostname.replace(/^www\./, ""),
      url: parsed.toString(),
      snippet: (snippet ?? "").slice(0, 1200),
      publishedDate: null,
      engine: "openrouter",
      score: null
    };
  } catch {
    return null;
  }
}

export function parseOpenRouterCitations(payload: OpenRouterResponse): TrendDiscoveryCitation[] {
  const message = payload.choices?.[0]?.message;
  const summary = messageText(message);
  const citations: TrendDiscoveryCitation[] = [];
  const seen = new Set<string>();

  const push = (citation: TrendDiscoveryCitation | null) => {
    if (!citation || seen.has(citation.url)) return;
    seen.add(citation.url);
    citations.push({
      ...citation,
      snippet: citation.snippet || summary.slice(0, 1200)
    });
  };

  for (const annotation of message?.annotations ?? []) {
    const urlCitation = annotation.url_citation;
    push(
      citationFromUrl(
        urlCitation?.url ?? annotation.url ?? "",
        urlCitation?.title ?? annotation.title,
        urlCitation?.content ?? urlCitation?.text ?? annotation.content
      )
    );
  }

  for (const citation of message?.citations ?? []) {
    if (typeof citation === "string") {
      push(citationFromUrl(citation, undefined, summary));
    } else {
      push(citationFromUrl(citation.url ?? "", citation.title, citation.content ?? citation.text));
    }
  }

  return citations;
}

export function createOpenRouterSearchAdapter(opts: {
  apiKey: string;
  model?: string;
  maxResults?: number;
}): TrendDiscoveryAdapter {
  const model = opts.model ?? "perplexity/sonar";
  const maxResults = opts.maxResults ?? 10;

  return {
    sourceName: "openrouter_search",
    sourceType: "openrouter_search",
    async search(query: string) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://pocketwardrobe.app",
          "X-Title": "Pocket Wardrobe"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Return fashion trend facts with source URLs. Do not quote long article passages. Prefer titles, dates, and short snippets."
            },
            { role: "user", content: query }
          ],
          plugins: [{ id: "web", max_results: maxResults }]
        }),
        signal: AbortSignal.timeout(30_000)
      });

      if (!response.ok) {
        throw new Error(
          `OpenRouter search failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as OpenRouterResponse;
      const citations = parseOpenRouterCitations(data).slice(0, maxResults);
      const summary = messageText(data.choices?.[0]?.message);

      return {
        query,
        summary: summary || citations.map((citation) => citation.snippet).join(" "),
        citations,
        groundingAvailable: citations.length > 0
      };
    }
  };
}
