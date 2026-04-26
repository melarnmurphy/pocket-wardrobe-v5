-- Migration 011: extend trend_sources.source_type to include "gemini_grounded".
--
-- The Gemini grounding adapter (lib/domain/trends/adapters/gemini-grounding.ts)
-- inserts trend_sources rows whose snippet content came from Google's index
-- via Gemini's googleSearch tool rather than a direct HTTP fetch. Tagging
-- these with a dedicated source_type lets downstream filters and scoring
-- logic treat grounded snippets differently from full RSS-fetched articles
-- (e.g. shorter excerpts, no reliable publish_date).

alter table public.trend_sources
  drop constraint if exists trend_sources_source_type_check;

alter table public.trend_sources
  add constraint trend_sources_source_type_check
  check (
    source_type in (
      'rss',
      'sitemap',
      'press_release',
      'brand_newsroom',
      'manual_curated',
      'trend_report',
      'runway_coverage',
      'fashion_publication',
      'gemini_grounded'
    )
  );
