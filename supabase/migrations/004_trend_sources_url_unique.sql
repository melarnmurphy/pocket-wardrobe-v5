alter table public.trend_sources
  add constraint trend_sources_source_url_unique unique (source_url);
