create or replace function public.accept_garment_draft(
  p_user_id uuid,
  p_draft_id uuid,
  p_title text,
  p_category text,
  p_brand text default null,
  p_material text default null,
  p_description text default null,
  p_retailer text default null,
  p_purchase_price numeric default null,
  p_purchase_currency text default null,
  p_price_source text default null,
  p_colour_family text default null,
  p_embedding jsonb default null,
  p_extraction_metadata jsonb default '{}',
  p_source_id uuid default null,
  p_image_type text default null,
  p_image_path text default null,
  p_image_width integer default null,
  p_image_height integer default null,
  p_draft_payload jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_garment_id uuid;
  v_source_id uuid;
  v_colour_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'not authorised';
  end if;

  select source_id into v_source_id
  from public.garment_drafts
  where id = p_draft_id
    and user_id = p_user_id
    and status = 'pending'
  for update;

  if v_source_id is null then
    raise exception 'draft not found or already reviewed';
  end if;

  if p_source_id is distinct from v_source_id then
    raise exception 'draft source mismatch';
  end if;

  insert into public.garments (
    user_id, title, category, brand, material, description, retailer,
    purchase_price, purchase_currency, price_source, cost_per_wear,
    extraction_metadata_json, embedding
  ) values (
    p_user_id, p_title, p_category, p_brand, p_material, p_description, p_retailer,
    p_purchase_price, p_purchase_currency, p_price_source,
    case when p_purchase_price is null then null else p_purchase_price end,
    coalesce(p_extraction_metadata, '{}'::jsonb),
    case
      when p_embedding is null or jsonb_typeof(p_embedding) <> 'array' then null
      else p_embedding::text::vector
    end
  ) returning id into v_garment_id;

  if p_colour_family is not null then
    select id into v_colour_id
    from public.colours
    where family = p_colour_family
    limit 1;

    if v_colour_id is not null then
      insert into public.garment_colours (garment_id, colour_id, dominance, is_primary)
      values (v_garment_id, v_colour_id, 1, true);
    end if;
  end if;

  update public.garment_sources
  set garment_id = v_garment_id,
      parse_status = 'completed'
  where id = v_source_id and user_id = p_user_id;

  if p_image_path is not null then
    insert into public.garment_images (
      garment_id, image_type, storage_path, width, height
    ) values (
      v_garment_id, p_image_type, p_image_path, p_image_width, p_image_height
    );
  end if;

  update public.garment_drafts
  set status = 'confirmed', draft_payload_json = coalesce(p_draft_payload, '{}'::jsonb)
  where id = p_draft_id and user_id = p_user_id and status = 'pending';

  if not found then
    raise exception 'draft could not be confirmed';
  end if;

  return v_garment_id;
end;
$$;

revoke all on function public.accept_garment_draft(
  uuid, uuid, text, text, text, text, text, text, numeric, text, text,
  text, jsonb, jsonb, uuid, text, text, integer, integer, jsonb
) from public, anon;
grant execute on function public.accept_garment_draft(
  uuid, uuid, text, text, text, text, text, text, numeric, text, text,
  text, jsonb, jsonb, uuid, text, text, integer, integer, jsonb
) to authenticated;
