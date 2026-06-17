# Pocket Wardrobe Runbook

This is the practical guide for running the app, syncing database changes, and
running the trend engine.

## Important Rule

For this repository, Supabase work must target `pocketwardrobev5`.

Do not use the `real-estate` Supabase project/server for this app.

## Local App

Install dependencies:

```sh
npm install
```

Create `.env.local` from `.env.example` and fill the required values:

```sh
cp .env.example .env.local
```

Minimum app envs:

```sh
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
CRON_SECRET=
```

Run the Next.js app:

```sh
npm run dev
```

Default local URL:

```txt
http://localhost:3000
```

## Checks

Run TypeScript:

```sh
npm run typecheck
```

Run tests:

```sh
npm run test
```

Run focused trend tests:

```sh
npm run test -- lib/domain/trends/__tests__/article-content-extractor.test.ts lib/domain/trends/__tests__/searxng-search.test.ts lib/domain/trends/__tests__/ingestion.test.ts lib/domain/trends/__tests__/content.test.ts lib/domain/trends/__tests__/extractors.test.ts
```

Build the app:

```sh
npm run build
```

## Database Sync

Schema changes live in:

```txt
supabase/migrations/
```

The canonical full schema is:

```txt
schema.sql
```

To sync new migrations into the linked Supabase app database:

```sh
supabase db push
```

For the open-source trends work, the migration to apply is:

```txt
supabase/migrations/020_open_source_trend_discovery_sources.sql
supabase/migrations/021_allow_rising_trend_signal_status.sql
```

`020` updates `trend_sources.source_type` so the app can insert provenance from:

```txt
searxng_search
firecrawl_search
firecrawl_scrape
crawl4ai
trafilatura
browser_use
```

`021` updates `trend_signals.trend_status` so extraction can insert/update
signals with the `rising` status.

After pushing migrations, deploy or restart the app with the matching env vars.

## Local Supabase

Start local Supabase:

```sh
supabase start
```

Reset local DB and replay migrations:

```sh
supabase db reset
```

Local Supabase ports from `supabase/config.toml`:

```txt
API:    http://127.0.0.1:54321
DB:     localhost:54322
Studio: http://127.0.0.1:54323
```

Use the local Supabase URL and anon key printed by `supabase start` in
`.env.local` when running fully local.

## Trend Discovery

The app now uses SearXNG instead of Tavily for scheduled trend discovery.

Required env:

```sh
SEARXNG_BASE_URL=http://localhost:8080
```

Production should point this at a private SearXNG service:

```sh
SEARXNG_BASE_URL=https://your-private-search.example.com
```

Fly.io deployment:

```sh
flyctl auth login
cd ops/searxng
cp fly.toml.example fly.toml
flyctl apps create pocketwardrobe-searxng
flyctl deploy
```

If `pocketwardrobe-searxng` is unavailable, choose another globally unique app
name and update `app = "..."` in `ops/searxng/fly.toml`.

The resulting base URL is:

```txt
https://<fly-app-name>.fly.dev
```

For example:

```sh
SEARXNG_BASE_URL=https://pocketwardrobe-searxng.fly.dev
```

SearXNG discovers candidate source URLs. It does not define trends by itself.
The app still normalizes sources through:

```txt
trend_sources -> trend_ingestion_jobs -> trend_signals -> user_trend_matches
```

Local Docker smoke test:

```sh
docker run -d --name fashionapp5-searxng \
  -p 8080:8080 \
  -v "$PWD/ops/searxng/settings.yml:/etc/searxng/settings.yml:ro" \
  searxng/searxng:latest
```

The repo config at `ops/searxng/settings.yml` enables JSON output, which the
app requires.

## Optional Article Extraction

Article extraction is tiered:

1. `TRAFILATURA_SERVICE_URL`
2. `CRAWL4AI_SERVICE_URL`
3. built-in Readability extraction

Run the included Trafilatura service locally:

```sh
pip install -r requirements.txt
uvicorn scripts.trends.trafilatura_service:app --host 0.0.0.0 --port 8010
```

Then set:

```sh
TRAFILATURA_SERVICE_URL=http://localhost:8010/extract
```

Health check:

```sh
curl http://localhost:8010/health
```

Manual extraction test:

```sh
curl -X POST http://localhost:8010/extract \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","max_chars":5000}'
```

`CRAWL4AI_SERVICE_URL` is optional and should use the same request/response
contract:

```json
{ "url": "https://example.com/article", "max_chars": 5000 }
```

The response should include one of:

```json
{ "text": "..." }
```

```json
{ "content": "..." }
```

```json
{ "markdown": "..." }
```

## Running Trend Jobs Manually

Trend scanner cron endpoint:

```txt
/api/cron/trend-scanners
```

Run one scanner locally:

```sh
curl -X POST 'http://localhost:3000/api/cron/trend-scanners?archetype=editorial&force=true' \
  -H "x-cron-secret: $CRON_SECRET"
```

Useful scanner archetypes:

```txt
runway
fashion_week
street_social
editorial
design_house
it_girl_discovery
colour_authority
```

Process queued extraction jobs:

```sh
curl -X POST 'http://localhost:3000/api/trends/extract' \
  -H "x-cron-secret: $CRON_SECRET"
```

Generate trend stories:

```sh
curl -X POST 'http://localhost:3000/api/cron/story-generation' \
  -H "x-cron-secret: $CRON_SECRET"
```

## Production Cron

Vercel cron schedules are defined in:

```txt
vercel.json
```

Required production envs for cron:

```sh
CRON_SECRET=
SEARXNG_BASE_URL=
OPENAI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Optional production envs:

```sh
TRAFILATURA_SERVICE_URL=
CRAWL4AI_SERVICE_URL=
```

## How To Sync This Into The App

Use this checklist after pulling these changes:

1. Apply database migration:

```sh
supabase db push
```

2. Add app env vars locally and in production:

```sh
SEARXNG_BASE_URL=
TRAFILATURA_SERVICE_URL=
CRAWL4AI_SERVICE_URL=
```

Only `SEARXNG_BASE_URL` is required for the new trend discovery path.

3. Provision SearXNG somewhere reachable by the app.

For local development, `http://localhost:8080` is fine. For production, use a
private HTTPS URL.

4. Optionally provision the Trafilatura service and set:

```sh
TRAFILATURA_SERVICE_URL=https://your-extractor.example.com/extract
```

5. Deploy or restart the Next.js app.

6. Run a forced scanner once:

```sh
curl -X POST 'https://your-app.example.com/api/cron/trend-scanners?archetype=editorial&force=true' \
  -H "x-cron-secret: $CRON_SECRET"
```

7. Process extraction jobs:

```sh
curl -X POST 'https://your-app.example.com/api/trends/extract' \
  -H "x-cron-secret: $CRON_SECRET"
```

8. Check the app's Trends page.

Expected flow:

```txt
SearXNG finds URLs
-> app inserts trend_sources
-> app queues signal_extraction jobs
-> extraction creates trend_signals
-> trends UI reads normalized signals
```

## IP And Content Safety

The trend engine should store:

- source URL
- publisher/source name
- title
- observed date
- short evidence excerpt
- normalized trend facts

It should not store full publisher article bodies or unlicensed publisher
images.
