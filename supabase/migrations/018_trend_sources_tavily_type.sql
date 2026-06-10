-- Replace the trend_sources source_type check constraint to include
-- 'tavily_search' alongside the existing values.
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
      'tavily_search'
    )
  );
