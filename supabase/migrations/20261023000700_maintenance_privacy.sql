-- =============================================================================
-- Privacy, retention, guest-account merge, storage cleanup, realtime
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Storage cleanup queue (drained by the storage-janitor Edge Function, which
-- deletes objects through the Storage API, then acknowledges them here).
-- ---------------------------------------------------------------------------
create or replace function public.worker_next_storage_deletions(p_limit integer default 100)
returns table (id bigint, bucket_id text, object_path text)
language sql
security definer
set search_path = ''
as $$
  update private.storage_deletion_queue q
     set attempts = q.attempts + 1
   where q.id in (
     select id from private.storage_deletion_queue
     where processed_at is null and attempts < 10
     order by enqueued_at
     limit greatest(1, least(p_limit, 1000))
     for update skip locked)
  returning q.id, q.bucket_id, q.object_path
$$;

create or replace function public.worker_ack_storage_deletions(p_ids bigint[], p_error text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update private.storage_deletion_queue
     set processed_at = case when p_error is null then now() else null end,
         last_error = left(p_error, 1000)
   where id = any(p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention purge (run daily). Deletes:
--   * abandoned draft/failed custom rooms (photos are enqueued for deletion)
--   * inactive anonymous (guest) users and everything they own
--   * processed storage-queue rows older than 30 days
-- ---------------------------------------------------------------------------
create or replace function public.worker_purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rooms  integer;
  v_guests integer;
  v_queue  integer;
begin
  delete from public.rooms r
   where r.kind = 'custom'
     and r.status in ('draft', 'failed')
     and r.current_version_id is null
     and r.last_activity_at < now() - make_interval(days => private.config_int('abandoned_draft_retention_days'));
  get diagnostics v_rooms = row_count;

  delete from auth.users u
   where u.is_anonymous
     and coalesce(u.last_sign_in_at, u.created_at)
         < now() - make_interval(days => private.config_int('anonymous_user_retention_days'));
  get diagnostics v_guests = row_count;

  delete from private.storage_deletion_queue
   where processed_at is not null and processed_at < now() - interval '30 days';
  get diagnostics v_queue = row_count;

  return jsonb_build_object('rooms_deleted', v_rooms, 'guests_deleted', v_guests, 'queue_rows_pruned', v_queue);
end;
$$;

-- ---------------------------------------------------------------------------
-- Guest -> account merge.
-- Normal path needs NO merge: linking an email/Apple/Google identity to an
-- anonymous user keeps the same user id. This handles the edge case where a
-- guest signs in to an EXISTING account instead. The merge-guest Edge
-- Function verifies both JWTs, then calls this and deletes the guest.
-- Guests cannot own custom rooms, so only tutorial progress is carried over.
-- ---------------------------------------------------------------------------
create or replace function public.worker_merge_guest_into_user(p_guest_id uuid, p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest_anon boolean;
  v_moved      integer := 0;
begin
  if p_guest_id = p_target_id then
    raise exception 'guest and target are the same user' using errcode = '22023';
  end if;
  select is_anonymous into v_guest_anon from auth.users where id = p_guest_id;
  if v_guest_anon is distinct from true then
    raise exception 'source user is not an anonymous guest' using errcode = '42501';
  end if;
  perform 1 from auth.users where id = p_target_id;
  if not found then
    raise exception 'target user not found' using errcode = 'P0002';
  end if;

  -- Carry over sessions the target doesn't already have for the same room.
  update public.game_sessions g
     set user_id = p_target_id
   where g.user_id = p_guest_id
     and not exists (
       select 1 from public.game_sessions t
       where t.user_id = p_target_id and t.room_id = g.room_id
         and (t.status = 'completed' or (t.status = 'active' and g.status = 'active')));
  get diagnostics v_moved = row_count;

  update public.profiles t
     set tutorial_completed_at = coalesce(t.tutorial_completed_at, g.tutorial_completed_at)
    from public.profiles g
   where t.id = p_target_id and g.id = p_guest_id;

  return jsonb_build_object('sessions_moved', v_moved);
end;
$$;

revoke all on function public.worker_next_storage_deletions(integer) from public, anon, authenticated;
revoke all on function public.worker_ack_storage_deletions(bigint[], text) from public, anon, authenticated;
revoke all on function public.worker_purge_expired_data() from public, anon, authenticated;
revoke all on function public.worker_merge_guest_into_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.worker_next_storage_deletions(integer) to service_role;
grant execute on function public.worker_ack_storage_deletions(bigint[], text) to service_role;
grant execute on function public.worker_purge_expired_data() to service_role;
grant execute on function public.worker_merge_guest_into_user(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: let the app watch generation progress (RLS still applies).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
      alter publication supabase_realtime add table public.rooms;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'generation_jobs') then
      alter publication supabase_realtime add table public.generation_jobs;
    end if;
  end if;
end;
$$;

-- Belt and braces: make sure nothing in private is executable by clients
-- except the two helpers RLS policies need.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_anonymous() to authenticated;
grant execute on function private.can_upload_room_photo(text) to authenticated;

-- Server-side tooling (cost dashboards, billing audits) may read private
-- tables with the service role over a direct connection. Writes still go
-- through the functions above. The private schema is never exposed via the
-- Data API, so this does not make it reachable over HTTP.
grant select on all tables in schema private to service_role;
