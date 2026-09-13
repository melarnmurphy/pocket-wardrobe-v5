-- Keep app chrome counts in one request. The function is invoker-security scoped
-- through auth.uid(), so it never exposes another user's counts.
create or replace function public.get_sidebar_counts()
returns table (
  wardrobe bigint,
  looks bigint,
  wishlist bigint,
  let_go bigint,
  handovers bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*) from public.garments
      where user_id = auth.uid() and archived_at is null and deleted_at is null),
    (select count(*) from public.outfits
      where user_id = auth.uid()),
    (select count(*) from public.lookbook_entries
      where user_id = auth.uid()
        and source_type = 'wishlist'
        and bought_garment_id is null),
    (select count(*) from public.garments
      where user_id = auth.uid()
        and archived_at is null
        and deleted_at is null
        and let_go_reason is not null),
    (select count(*) from public.threads
      where buyer_id = auth.uid() or seller_id = auth.uid());
$$;
grant execute on function public.get_sidebar_counts() to authenticated;
