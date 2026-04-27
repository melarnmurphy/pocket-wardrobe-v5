alter table public.trend_stories
  add constraint trend_stories_headline_lower_uq
  unique (lower(headline));
