-- =============================================================================
-- Minimal stand-ins for the Supabase platform, so migrations and tests can run
-- on plain PostgreSQL (CI, or machines without Docker). NOT used on Supabase.
-- Mirrors: roles, auth.users, auth.uid()/jwt()/role(), storage.buckets,
-- storage.objects (RLS on), storage.foldername(), default privileges, and
-- the supabase_realtime publication.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
grant usage on schema auth, storage, public to anon, authenticated, service_role;

create table if not exists auth.users (
  id               uuid primary key default gen_random_uuid(),
  email            text,
  is_anonymous     boolean not null default false,
  created_at       timestamptz not null default now(),
  last_sign_in_at  timestamptz
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null unique,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now()
);

create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets (id),
  name        text not null,
  owner       uuid,
  owner_id    text,
  metadata    jsonb,
  created_at  timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;

grant select on storage.buckets to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
grant execute on all functions in schema storage to anon, authenticated, service_role;

-- Supabase grants these by default on new public objects; replicate so tests
-- prove the migrations' explicit REVOKEs actually work.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
