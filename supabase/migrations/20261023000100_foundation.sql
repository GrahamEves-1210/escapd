-- =============================================================================
-- Escapd backend foundation: schemas, config, helpers, profiles, settings
-- =============================================================================
-- Conventions used across all migrations:
--   * public  : tables/functions reachable through the Data API. RLS on every table.
--   * private : NOT exposed through the Data API. Secrets, internal queues,
--               config, and helper functions used by RLS policies.
--   * Every SECURITY DEFINER function sets search_path = '' and fully
--     qualifies every object.
--   * Supabase grants broad default privileges to anon/authenticated on new
--     public objects, so every table and function below explicitly revokes
--     and re-grants the minimum it needs.
--   * Functions prefixed worker_ / billing_ are server-only (service_role).
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
-- authenticated needs USAGE only so RLS policies can call the few private helper
-- functions that are explicitly granted. Tables in private have no grants, and
-- the schema is not in the Data API's exposed schemas.
grant usage on schema private to authenticated, service_role;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Turn that off
-- for this schema so every private function is opt-in.
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- App configuration (server-side tunables; never exposed directly)
-- ---------------------------------------------------------------------------
create table private.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into private.app_config (key, value, description) values
  ('min_photos_per_room',          '3',     'Photos required before generation can be requested'),
  ('max_photos_per_room',          '6',     'Maximum photos per room'),
  ('generation_window_days',       '30',    'Rolling window for the generation cap'),
  ('generation_cap_per_window',    '20',    'Max custom room generations per user per window'),
  ('generation_max_attempts',      '3',     'Default max attempts per generation job'),
  ('revenuecat_entitlement_id',    '"pro"', 'RevenueCat entitlement identifier that unlocks custom rooms'),
  ('anonymous_user_retention_days','30',    'Inactive guest accounts are purged after this many days'),
  ('abandoned_draft_retention_days','7',    'Draft/failed rooms (and their photos) are purged after this many days of inactivity');

create or replace function private.config_int(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (value #>> '{}')::integer from private.app_config where key = p_key
$$;

create or replace function private.config_text(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value #>> '{}' from private.app_config where key = p_key
$$;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the current JWT belongs to a Supabase anonymous (guest) user.
create or replace function private.is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- Raises unless the caller is a signed-in user. Returns the user id.
create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Raises unless the caller is a signed-in, non-guest user.
create or replace function private.require_permanent_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if private.is_anonymous() then
    raise exception 'a full account is required for this action'
      using errcode = '42501', hint = 'link an email or Apple/Google sign-in first';
  end if;
  return v_uid;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_anonymous() to authenticated;  -- used inside RLS policies

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  display_name           text check (display_name is null or char_length(display_name) between 1 and 40),
  tutorial_completed_at  timestamptz,           -- set by the server when the tutorial room is escaped
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- User settings / preferences
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  sound_enabled         boolean not null default true,
  music_enabled         boolean not null default true,
  haptics_enabled       boolean not null default true,
  hints_enabled         boolean not null default true,
  reduced_motion        boolean not null default false,
  locale                text    not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  marketing_opt_in      boolean not null default false,
  analytics_opt_in      boolean not null default false,   -- privacy default: off until the user opts in
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function private.set_updated_at();

alter table public.user_settings enable row level security;

revoke all on table public.user_settings from anon, authenticated;
grant select on table public.user_settings to authenticated;
grant update (sound_enabled, music_enabled, haptics_enabled, hints_enabled,
              reduced_motion, locale, marketing_opt_in, analytics_opt_in)
  on table public.user_settings to authenticated;

create policy "user_settings: read own"
  on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "user_settings: update own"
  on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Create profile + settings rows whenever an auth user is created
-- (covers email, OAuth, and anonymous sign-ins).
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();
