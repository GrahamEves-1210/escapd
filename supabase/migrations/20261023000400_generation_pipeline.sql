-- =============================================================================
-- Asynchronous AI generation pipeline
-- =============================================================================
-- Flow:
--   1. Client: rpc('request_room_generation', { p_room_id, p_idempotency_key })
--      -> server checks ownership, full account, entitlement, photo count, cap
--      -> inserts a queued job (idempotent on (owner, key) and one active job per room)
--   2. Worker (generation-worker Edge Function, service_role):
--        worker_claim_generation_job()   -> leases one job (FOR UPDATE SKIP LOCKED)
--        ... calls the AI provider (not implemented yet) ...
--        worker_complete_generation_job() -> validates + publishes a new version
--     or worker_fail_generation_job()     -> retries with backoff or fails the room
--   3. Client watches rooms / generation_jobs via Realtime or polling.
-- AI usage per attempt goes to private.generation_usage (cost is not exposed
-- to clients).
-- =============================================================================

create table public.generation_jobs (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.rooms (id) on delete cascade,
  owner_id           uuid not null references auth.users (id) on delete cascade,
  idempotency_key    uuid not null,
  status             text not null default 'queued'
                       check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempt_count      integer not null default 0 check (attempt_count >= 0),
  max_attempts       integer not null default 3 check (max_attempts between 1 and 10),
  prompt_version     text not null default 'v1',     -- version of the prompt/pipeline used
  output_schema_version smallint not null default 1,  -- puzzle schema the worker must produce
  next_attempt_at    timestamptz not null default now(),
  lease_token        uuid,
  leased_by          text,
  lease_expires_at   timestamptz,
  error_code         text,
  error_message      text check (error_message is null or char_length(error_message) <= 2000),
  result_version_id  uuid references public.puzzle_versions (id) on delete set null,
  started_at         timestamptz,
  finished_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create unique index generation_jobs_one_active_per_room
  on public.generation_jobs (room_id) where status in ('queued', 'running');
create index generation_jobs_claimable_idx
  on public.generation_jobs (next_attempt_at) where status = 'queued';
create index generation_jobs_running_lease_idx
  on public.generation_jobs (lease_expires_at) where status = 'running';
create index generation_jobs_owner_created_idx
  on public.generation_jobs (owner_id, created_at desc);
create index generation_jobs_room_idx on public.generation_jobs (room_id);

create trigger generation_jobs_updated_at before update on public.generation_jobs
  for each row execute function private.set_updated_at();

alter table public.puzzle_versions
  add constraint puzzle_versions_generation_job_fk
  foreign key (generation_job_id) references public.generation_jobs (id) on delete set null;

alter table public.generation_jobs enable row level security;

revoke all on table public.generation_jobs from anon, authenticated;
grant select on table public.generation_jobs to authenticated;

create policy "generation_jobs: read own"
  on public.generation_jobs for select to authenticated
  using (owner_id = (select auth.uid()));

-- Per-attempt AI usage / cost (never exposed to clients)
create table private.generation_usage (
  id              bigint generated always as identity primary key,
  job_id          uuid not null references public.generation_jobs (id) on delete cascade,
  owner_id        uuid,         -- kept without FK so cost history survives account deletion
  attempt         integer not null,
  provider        text,
  model           text,
  input_tokens    bigint  check (input_tokens  is null or input_tokens  >= 0),
  output_tokens   bigint  check (output_tokens is null or output_tokens >= 0),
  image_count     integer check (image_count   is null or image_count   >= 0),
  cost_usd        numeric(12, 6) check (cost_usd is null or cost_usd >= 0),
  duration_ms     integer check (duration_ms   is null or duration_ms   >= 0),
  outcome         text not null check (outcome in ('succeeded', 'failed', 'invalid_output')),
  created_at      timestamptz not null default now()
);

create index generation_usage_job_idx on private.generation_usage (job_id);
create index generation_usage_created_idx on private.generation_usage (created_at);

create or replace function private.record_generation_usage(
  p_job public.generation_jobs, p_usage jsonb, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_usage is null or p_usage = '{}'::jsonb then
    return;
  end if;
  insert into private.generation_usage (
    job_id, owner_id, attempt, provider, model, input_tokens, output_tokens,
    image_count, cost_usd, duration_ms, outcome)
  values (
    p_job.id, p_job.owner_id, p_job.attempt_count,
    p_usage ->> 'provider', p_usage ->> 'model',
    (p_usage ->> 'input_tokens')::bigint, (p_usage ->> 'output_tokens')::bigint,
    (p_usage ->> 'image_count')::integer, (p_usage ->> 'cost_usd')::numeric,
    (p_usage ->> 'duration_ms')::integer, p_outcome);
end;
$$;

-- ---------------------------------------------------------------------------
-- Generations counted against the rolling cap (failed/cancelled don't count)
-- ---------------------------------------------------------------------------
create or replace function private.generations_used(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.generation_jobs j
  where j.owner_id = p_user_id
    and j.status in ('queued', 'running', 'succeeded')
    and j.created_at > now() - make_interval(days => private.config_int('generation_window_days'))
$$;

-- ---------------------------------------------------------------------------
-- Client entry point
-- ---------------------------------------------------------------------------
create or replace function public.request_room_generation(p_room_id uuid, p_idempotency_key uuid)
returns public.generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := private.require_permanent_user();
  v_room        public.rooms;
  v_job         public.generation_jobs;
  v_photo_count integer;
begin
  if p_idempotency_key is null then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  -- Idempotent replay: same key returns the same job, whatever its state.
  select * into v_job from public.generation_jobs
  where owner_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    if v_job.room_id <> p_room_id then
      raise exception 'idempotency key already used for a different room' using errcode = '22023';
    end if;
    return v_job;
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.owner_id is distinct from v_uid then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  -- One active job per room: return it instead of starting another.
  select * into v_job from public.generation_jobs
  where room_id = p_room_id and status in ('queued', 'running');
  if found then
    return v_job;
  end if;

  if v_room.status not in ('draft', 'failed', 'ready') then
    raise exception 'room is not in a state that allows generation (%)', v_room.status using errcode = '55000';
  end if;

  if not private.has_active_entitlement(v_uid) then
    raise exception 'an active subscription is required to generate custom rooms'
      using errcode = '42501', hint = 'entitlement_required';
  end if;

  if private.generations_used(v_uid) >= private.config_int('generation_cap_per_window') then
    raise exception 'generation limit reached for this period'
      using errcode = '54000', hint = 'generation_cap_reached';
  end if;

  select count(*) into v_photo_count from public.room_photos where room_id = p_room_id;
  if v_photo_count < private.config_int('min_photos_per_room') then
    raise exception 'at least % photos are required', private.config_int('min_photos_per_room')
      using errcode = '23514', hint = 'not_enough_photos';
  end if;

  insert into public.generation_jobs (room_id, owner_id, idempotency_key, max_attempts)
  values (p_room_id, v_uid, p_idempotency_key, private.config_int('generation_max_attempts'))
  returning * into v_job;

  update public.rooms set status = 'queued', last_activity_at = now() where id = p_room_id;

  return v_job;
end;
$$;

-- Cancel a queued job (running jobs finish or time out on their own).
create or replace function public.cancel_room_generation(p_job_id uuid)
returns public.generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_job public.generation_jobs;
begin
  update public.generation_jobs
     set status = 'cancelled', finished_at = now(), lease_token = null
   where id = p_job_id and owner_id = v_uid and status = 'queued'
  returning * into v_job;
  if not found then
    raise exception 'job not found or no longer cancellable' using errcode = 'P0002';
  end if;
  update public.rooms
     set status = case when current_version_id is not null then 'ready' else 'draft' end
   where id = v_job.room_id;
  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker functions (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.worker_claim_generation_job(
  p_worker_id text, p_lease_seconds integer default 300)
returns public.generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.generation_jobs;
begin
  -- Reclaim jobs whose worker died mid-run (lease expired).
  update public.generation_jobs
     set status = case when attempt_count >= max_attempts then 'failed' else 'queued' end,
         error_code = coalesce(error_code, 'lease_expired'),
         finished_at = case when attempt_count >= max_attempts then now() end,
         lease_token = null, leased_by = null, lease_expires_at = null
   where status = 'running' and lease_expires_at < now();

  -- Rooms left in queued/generating with no active job: restore a sane status.
  update public.rooms r
     set status = case when r.current_version_id is not null then 'ready' else 'failed' end
   where r.status in ('queued', 'generating')
     and not exists (
       select 1 from public.generation_jobs j
       where j.room_id = r.id and j.status in ('queued', 'running'));

  select * into v_job from public.generation_jobs
  where status = 'queued' and next_attempt_at <= now()
  order by next_attempt_at
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  update public.generation_jobs
     set status = 'running',
         attempt_count = attempt_count + 1,
         lease_token = gen_random_uuid(),
         leased_by = left(p_worker_id, 100),
         lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 3600))),
         started_at = coalesce(started_at, now())
   where id = v_job.id
  returning * into v_job;

  update public.rooms set status = 'generating' where id = v_job.room_id;
  return v_job;
end;
$$;

create or replace function private.lock_leased_job(p_job_id uuid, p_lease_token uuid)
returns public.generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.generation_jobs;
begin
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then
    raise exception 'job % not found', p_job_id using errcode = 'P0002';
  end if;
  if v_job.status <> 'running' or v_job.lease_token is distinct from p_lease_token then
    raise exception 'lease for job % is no longer held', p_job_id using errcode = '55000';
  end if;
  return v_job;
end;
$$;

create or replace function public.worker_fail_generation_job(
  p_job_id uuid, p_lease_token uuid, p_error_code text, p_error_message text,
  p_retryable boolean default true, p_usage jsonb default null)
returns public.generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job   public.generation_jobs := private.lock_leased_job(p_job_id, p_lease_token);
  v_retry boolean;
begin
  perform private.record_generation_usage(v_job, p_usage, 'failed');
  v_retry := p_retryable and v_job.attempt_count < v_job.max_attempts;

  update public.generation_jobs
     set status = case when v_retry then 'queued' else 'failed' end,
         error_code = left(coalesce(p_error_code, 'unknown'), 100),
         error_message = left(p_error_message, 2000),
         -- exponential backoff: 30s, 2m, 8m, ...
         next_attempt_at = case when v_retry then now() + make_interval(secs => 30 * power(4, v_job.attempt_count - 1)) else next_attempt_at end,
         finished_at = case when v_retry then null else now() end,
         lease_token = null, leased_by = null, lease_expires_at = null
   where id = p_job_id
  returning * into v_job;

  update public.rooms
     set status = case
                    when v_retry then 'queued'
                    when current_version_id is not null then 'ready'   -- regeneration failed; keep old version playable
                    else 'failed'
                  end
   where id = v_job.room_id;

  return v_job;
end;
$$;

create or replace function public.worker_complete_generation_job(
  p_job_id uuid, p_lease_token uuid, p_public_definition jsonb, p_solution jsonb,
  p_usage jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job      public.generation_jobs := private.lock_leased_job(p_job_id, p_lease_token);
  v_room     public.rooms;
  v_errors   text[];
  v_version  integer;
  v_pv_id    uuid;
  v_photo_ids text[];
begin
  select * into v_room from public.rooms where id = v_job.room_id for update;

  v_errors := private.validate_puzzle_definition(p_public_definition, p_solution);

  -- Photo references must point at this room's photos.
  select coalesce(array_agg(id::text), '{}') into v_photo_ids from public.room_photos where room_id = v_room.id;
  if cardinality(v_errors) = 0 and exists (
       select 1 from jsonb_array_elements(p_public_definition -> 'photos') ph
       where not (coalesce(ph ->> 'photo_id', '') = any(v_photo_ids))) then
    v_errors := v_errors || 'photos[].photo_id must reference this room''s uploaded photos'::text;
  end if;

  if cardinality(v_errors) > 0 then
    perform private.record_generation_usage(v_job, p_usage, 'invalid_output');
    perform public.worker_fail_generation_job(
      p_job_id, p_lease_token, 'invalid_output',
      left(array_to_string(v_errors, '; '), 2000), true, null);
    return jsonb_build_object('ok', false, 'errors', to_jsonb(v_errors));
  end if;

  perform private.record_generation_usage(v_job, p_usage, 'succeeded');

  select coalesce(max(version), 0) + 1 into v_version from public.puzzle_versions where room_id = v_room.id;

  update public.puzzle_versions set status = 'superseded'
   where room_id = v_room.id and status = 'published';

  insert into public.puzzle_versions (
    room_id, owner_id, version, schema_version, status, public_definition, content_hash, generation_job_id)
  values (
    v_room.id, v_room.owner_id, v_version, 1, 'published', p_public_definition,
    encode(sha256(convert_to(p_public_definition::text || p_solution::text, 'UTF8')), 'hex'),
    v_job.id)
  returning id into v_pv_id;

  insert into private.puzzle_solutions (puzzle_version_id, schema_version, solution)
  values (v_pv_id, 1, p_solution);

  update public.rooms
     set status = 'ready',
         current_version_id = v_pv_id,
         title = case when title = 'Untitled room' and coalesce(btrim(p_public_definition ->> 'title'), '') <> ''
                      then left(btrim(p_public_definition ->> 'title'), 80) else title end,
         last_activity_at = now()
   where id = v_room.id;

  update public.generation_jobs
     set status = 'succeeded', result_version_id = v_pv_id, finished_at = now(),
         error_code = null, error_message = null,
         lease_token = null, leased_by = null, lease_expires_at = null
   where id = v_job.id;

  return jsonb_build_object('ok', true, 'puzzle_version_id', v_pv_id, 'version', v_version);
end;
$$;

-- Lets the worker build signed URLs for the photos of a leased job.
create or replace function public.worker_get_job_photos(p_job_id uuid, p_lease_token uuid)
returns table (photo_id uuid, bucket_id text, storage_path text, photo_position smallint, mime_type text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.generation_jobs := private.lock_leased_job(p_job_id, p_lease_token);
begin
  return query
    select p.id, p.bucket_id, p.storage_path, p.position, p.mime_type
    from public.room_photos p where p.room_id = v_job.room_id order by p.position;
end;
$$;

revoke all on function private.record_generation_usage(public.generation_jobs, jsonb, text) from public, anon, authenticated;
revoke all on function private.generations_used(uuid) from public, anon, authenticated;
revoke all on function private.lock_leased_job(uuid, uuid) from public, anon, authenticated;

revoke all on function public.request_room_generation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_room_generation(uuid, uuid) to authenticated;
revoke all on function public.cancel_room_generation(uuid) from public, anon, authenticated;
grant execute on function public.cancel_room_generation(uuid) to authenticated;

revoke all on function public.worker_claim_generation_job(text, integer) from public, anon, authenticated;
revoke all on function public.worker_fail_generation_job(uuid, uuid, text, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.worker_complete_generation_job(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.worker_get_job_photos(uuid, uuid) from public, anon, authenticated;
grant execute on function public.worker_claim_generation_job(text, integer) to service_role;
grant execute on function public.worker_fail_generation_job(uuid, uuid, text, text, boolean, jsonb) to service_role;
grant execute on function public.worker_complete_generation_job(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.worker_get_job_photos(uuid, uuid) to service_role;
