create unique index if not exists trend_stories_headline_lower_uq
  on public.trend_stories (lower(headline));
