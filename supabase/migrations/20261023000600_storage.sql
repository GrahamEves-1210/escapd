-- =============================================================================
-- Private photo storage
-- =============================================================================
-- Bucket room-photos (PRIVATE). Path: {user_id}/{room_id}/{photo_id}.{ext}
--   * upload : owner only, into their own folder, for a custom room they own
--              that is still editable (draft/failed), full accounts only
--   * read   : owner only (client uses createSignedUrl with a short expiry)
--   * delete : owner only
--   * no UPDATE policy => no overwrite/upsert; re-upload under a new path
-- Bucket system-assets (PRIVATE, read by any signed-in user): tutorial art.
-- The generation worker uses the service role (bypasses RLS) to sign URLs
-- for the AI provider.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('room-photos',   'room-photos',   false, 15728640, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('system-assets', 'system-assets', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Can the current user upload into this room folder? (used by storage RLS)
create or replace function private.can_upload_room_photo(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_parts text[] := storage.foldername(p_object_name);
begin
  if v_uid is null or private.is_anonymous() then
    return false;
  end if;
  if cardinality(v_parts) <> 2
     or v_parts[1] <> v_uid::text
     or v_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.rooms r
    where r.id = v_parts[2]::uuid
      and r.owner_id = v_uid
      and r.kind = 'custom'
      and r.status in ('draft', 'failed')
  );
end;
$$;

revoke all on function private.can_upload_room_photo(text) from public, anon, authenticated;
grant execute on function private.can_upload_room_photo(text) to authenticated;

create policy "room-photos: owner upload to editable room"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'room-photos'
    and private.can_upload_room_photo(name)
  );

create policy "room-photos: owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'room-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "room-photos: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'room-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "system-assets: signed-in read"
  on storage.objects for select to authenticated
  using (bucket_id = 'system-assets');

-- ---------------------------------------------------------------------------
-- Register an uploaded photo. The server checks the object really exists in
-- the caller's folder before creating the row (the client can't register
-- someone else's file or a file that was never uploaded).
-- ---------------------------------------------------------------------------
create or replace function public.register_room_photo(
  p_room_id uuid, p_storage_path text, p_position smallint,
  p_width integer default null, p_height integer default null)
returns public.room_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_permanent_user();
  v_room   public.rooms;
  v_obj    record;
  v_photo  public.room_photos;
  v_count  integer;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.owner_id is distinct from v_uid then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_room.status not in ('draft', 'failed') then
    raise exception 'photos can only be changed while the room is a draft' using errcode = '55000';
  end if;
  if p_storage_path not like v_uid::text || '/' || p_room_id::text || '/%' then
    raise exception 'storage path must be inside {user_id}/{room_id}/' using errcode = '22023';
  end if;

  select o.name, o.metadata into v_obj
  from storage.objects o
  where o.bucket_id = 'room-photos' and o.name = p_storage_path;
  if not found then
    raise exception 'uploaded file not found' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.room_photos where room_id = p_room_id;
  if v_count >= private.config_int('max_photos_per_room') then
    raise exception 'a room can have at most % photos', private.config_int('max_photos_per_room')
      using errcode = '23514', hint = 'too_many_photos';
  end if;

  insert into public.room_photos (room_id, owner_id, storage_path, position, mime_type, byte_size, width, height)
  values (
    p_room_id, v_uid, p_storage_path, p_position,
    coalesce(v_obj.metadata ->> 'mimetype', 'image/jpeg'),
    nullif(v_obj.metadata ->> 'size', '')::integer,
    p_width, p_height)
  returning * into v_photo;

  update public.rooms set last_activity_at = now() where id = p_room_id;
  return v_photo;
end;
$$;

revoke all on function public.register_room_photo(uuid, text, smallint, integer, integer) from public, anon, authenticated;
grant execute on function public.register_room_photo(uuid, text, smallint, integer, integer) to authenticated;
