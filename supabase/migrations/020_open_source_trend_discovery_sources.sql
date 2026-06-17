-- Allow open-source trend discovery/extraction adapters to write provenance.
alter table public.trend_sources
  drop constraint if exists trend_sources_source_type_check;

alter table public.trend_sources
  add constraint trend_sources_source_type_check check (
    source_type in (
      'rss',
      'sitemap',
      'press_release',
      'brand_newsroom',
      'manual_curated',
      'trend_report',
      'runway_coverage',
      'fashion_publication',
      'gemini_grounded',
      'tavily_search',
      'searxng_search',
      'firecrawl_search',
      'firecrawl_scrape',
      'crawl4ai',
      'trafilatura',
      'browser_use'
    )
  );
