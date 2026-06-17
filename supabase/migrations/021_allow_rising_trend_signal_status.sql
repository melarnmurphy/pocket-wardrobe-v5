-- Align trend_signals.trend_status with later trend metric/story statuses.
alter table public.trend_signals
  drop constraint if exists trend_signals_trend_status_check;

alter table public.trend_signals
  add constraint trend_signals_trend_status_check check (
    trend_status in (
      'candidate',
      'emerging',
      'confirmed',
      'dominant',
      'cooling',
      'flat',
      'rising'
    )
    or trend_status is null
  );
