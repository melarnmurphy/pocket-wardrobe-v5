-- The Diary's "what you wore" log (LogOutfitSheet) has a photo drop zone
-- that has always been cosmetic — wear_events has no photo column at all,
-- so nothing has ever been uploaded or persisted for it. This wires it up.
--
-- A column on wear_events, not a new table: one submission logs one photo
-- of the person wearing the outfit, shared across every piece selected in
-- that submission (one wear_events row per garment, same as occasion/notes
-- already are). That is exactly the shape a nullable text column already
-- captures for occasion/notes on this table, so a photo_storage_path
-- column matches the existing row shape rather than introducing a new
-- one-to-one or one-to-many table for a value that never varies within a
-- submission. garment_images is a separate table because a garment can
-- carry several images of different types (original/cutout) that outlive
-- any one wear_events row; a wear-event selfie has no such multiplicity.
alter table public.wear_events
  add column if not exists photo_storage_path text;

-- No RLS policy change needed: wear_events_insert_own/update_own already
-- check auth.uid() = user_id on the whole row (schema.sql), so a user can
-- only ever set photo_storage_path on their own rows, same as any other
-- column on this table.

-- New bucket rather than reusing garment-originals: that bucket's storage
-- paths and downstream code (createGarmentSource, garment_sources,
-- pipeline ingestion) all assume "a photo of a garment on its own", not a
-- selfie of a person wearing several. Keeping wear-event photos in their
-- own bucket keeps that assumption intact and keeps the two photo kinds
-- easy to reason about and clean up independently.
insert into storage.buckets (id, name, public)
values ('wear-event-photos', 'wear-event-photos', false)
on conflict (id) do nothing;

drop policy if exists "wear event photos insert own" on storage.objects;
create policy "wear event photos insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'wear-event-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "wear event photos read own" on storage.objects;
create policy "wear event photos read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'wear-event-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "wear event photos update own" on storage.objects;
create policy "wear event photos update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'wear-event-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "wear event photos delete own" on storage.objects;
create policy "wear event photos delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'wear-event-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
