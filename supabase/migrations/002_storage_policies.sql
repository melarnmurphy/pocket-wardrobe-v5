begin;

insert into storage.buckets (id, name, public)
values
  ('garment-originals', 'garment-originals', false),
  ('garment-cutouts', 'garment-cutouts', false),
  ('lookbook-images', 'lookbook-images', false),
  ('receipt-uploads', 'receipt-uploads', false),
  ('source-thumbnails', 'source-thumbnails', false)
on conflict (id) do nothing;

drop policy if exists "garment originals insert own" on storage.objects;
create policy "garment originals insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'garment-originals'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment originals read own" on storage.objects;
create policy "garment originals read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'garment-originals'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment originals update own" on storage.objects;
create policy "garment originals update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'garment-originals'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment originals delete own" on storage.objects;
create policy "garment originals delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'garment-originals'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "lookbook images insert own" on storage.objects;
create policy "lookbook images insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lookbook-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "lookbook images read own" on storage.objects;
create policy "lookbook images read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lookbook-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "lookbook images update own" on storage.objects;
create policy "lookbook images update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lookbook-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "lookbook images delete own" on storage.objects;
create policy "lookbook images delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lookbook-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment cutouts insert own" on storage.objects;
create policy "garment cutouts insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'garment-cutouts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment cutouts read own" on storage.objects;
create policy "garment cutouts read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'garment-cutouts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment cutouts update own" on storage.objects;
create policy "garment cutouts update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'garment-cutouts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment cutouts delete own" on storage.objects;
create policy "garment cutouts delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'garment-cutouts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "receipt uploads insert own" on storage.objects;
create policy "receipt uploads insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'receipt-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "receipt uploads read own" on storage.objects;
create policy "receipt uploads read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipt-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "receipt uploads update own" on storage.objects;
create policy "receipt uploads update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'receipt-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "receipt uploads delete own" on storage.objects;
create policy "receipt uploads delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'receipt-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "source thumbnails insert own" on storage.objects;
create policy "source thumbnails insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'source-thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "source thumbnails read own" on storage.objects;
create policy "source thumbnails read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'source-thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "source thumbnails update own" on storage.objects;
create policy "source thumbnails update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'source-thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "source thumbnails delete own" on storage.objects;
create policy "source thumbnails delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'source-thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
