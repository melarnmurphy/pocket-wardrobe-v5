begin;

drop trigger if exists avatar_profiles_set_updated_at on public.avatar_profiles;
drop trigger if exists trg_avatar_profiles_set_updated_at on public.avatar_profiles;
create trigger trg_avatar_profiles_set_updated_at
before update on public.avatar_profiles
for each row
execute function public.set_updated_at();

drop index if exists public.avatar_profiles_user_id_idx;
create index if not exists idx_avatar_profiles_user_id
on public.avatar_profiles(user_id);

commit;
