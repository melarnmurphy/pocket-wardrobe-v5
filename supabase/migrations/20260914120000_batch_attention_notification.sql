-- Give terminally failed photo batches their own notification kind.
alter table public.app_notifications
  drop constraint if exists app_notifications_kind_check;

alter table public.app_notifications
  add constraint app_notifications_kind_check check (
    kind in (
      'price drop', 'trend expiry', 'offer', 'sold', 'orders waiting',
      'receipt read', 'wear reminder', 'batch finished', 'batch attention', 'message'
    )
  );
