# Trend Discovery

Pocket Wardrobe uses open-source search discovery for trend sources.

## Local Development

Run a private SearXNG instance and point the app at it:

```sh
SEARXNG_BASE_URL=http://localhost:8080
```

The app calls SearXNG's JSON `/search` endpoint to discover candidate source
URLs. SearXNG snippets are stored as short `trend_sources.raw_text_excerpt`
values, then the existing extraction jobs normalize them into structured
`trend_signals`.

## Production

Provision SearXNG as a small long-running service. Fly.io, Render, a small VPS,
or an internal container platform are all acceptable. The app only requires a
stable HTTPS base URL in `SEARXNG_BASE_URL`.

Keep the instance private or rate-limited. The trends engine should discover
URLs, not behave like a public search product.

## Extraction

Article extraction is tiered:

1. `TRAFILATURA_SERVICE_URL`, if configured.
2. `CRAWL4AI_SERVICE_URL`, if configured.
3. Built-in Readability extraction.

The optional services should accept:

```json
{ "url": "https://example.com/article", "max_chars": 5000 }
```

And return JSON with one of `text`, `content`, or `markdown`. Optional `title`,
`author`, `publishedDate`, or `metadata` fields are accepted for future
enrichment.

This repo includes a minimal Trafilatura service:

```sh
uvicorn scripts.trends.trafilatura_service:app --host 0.0.0.0 --port 8010
```

Then set:

```sh
TRAFILATURA_SERVICE_URL=http://localhost:8010/extract
```

## Source Policy

The trend pipeline stores provenance and short evidence snippets only. It should
not store full publisher article bodies or unlicensed images.
