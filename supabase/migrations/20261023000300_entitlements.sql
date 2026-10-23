-- =============================================================================
-- Subscriptions & entitlements
-- =============================================================================
-- The client NEVER writes entitlement state. Rows are written only by
-- server-side code (the RevenueCat webhook Edge Function, admin tooling, or a
-- future direct App Store / Play integration). The provider column keeps the
-- billing integration modular: add a new provider by writing rows with a new
-- provider value; private.has_active_entitlement() does not change.
-- =============================================================================

create table public.entitlements (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  entitlement_key       text not null default 'custom_rooms' check (entitlement_key in ('custom_rooms')),
  provider              text not null check (provider in ('revenuecat', 'app_store', 'play_store', 'manual', 'promo')),
  status                text not null check (status in ('active', 'billing_issue', 'expired', 'revoked')),
  product_id            text,
  store                 text,         -- e.g. APP_STORE, PLAY_STORE (as reported by provider)
  environment           text check (environment is null or environment in ('PRODUCTION', 'SANDBOX')),
  period_type           text,         -- TRIAL, INTRO, NORMAL, PROMOTIONAL, PREPAID
  will_renew            boolean,
  expires_at            timestamptz,  -- null = non-expiring (lifetime / manual grant)
  provider_customer_id  text,         -- e.g. RevenueCat original_app_user_id
  last_event_id         text,
  last_event_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, entitlement_key, provider)
);

create index entitlements_user_idx on public.entitlements (user_id);

create trigger entitlements_updated_at before update on public.entitlements
  for each row execute function private.set_updated_at();

alter table public.entitlements enable row level security;

revoke all on table public.entitlements from anon, authenticated;
grant select on table public.entitlements to authenticated;

create policy "entitlements: read own"
  on public.entitlements for select to authenticated
  using (user_id = (select auth.uid()));

-- Raw provider events, for idempotency, auditing, and replay. Never exposed.
create table private.billing_events (
  id            bigint generated always as identity primary key,
  provider      text not null,
  event_id      text not null,
  event_type    text not null,
  app_user_id   text,
  user_id       uuid,           -- resolved Supabase user (no FK: keep audit trail after account deletion)
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  outcome       text,
  unique (provider, event_id)
);

create index billing_events_user_idx on private.billing_events (user_id, received_at desc);

-- ---------------------------------------------------------------------------
-- Single source of truth for "may this user generate custom rooms?"
-- ---------------------------------------------------------------------------
create or replace function private.has_active_entitlement(p_user_id uuid, p_key text default 'custom_rooms')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = p_user_id
      and e.entitlement_key = p_key
      and e.status in ('active', 'billing_issue')   -- billing_issue = store grace period
      and (e.expires_at is null or e.expires_at > now())
  )
$$;

revoke all on function private.has_active_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function private.has_active_entitlement(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- RevenueCat webhook processing (called by the revenuecat-webhook Edge
-- Function AFTER it has verified the Authorization header / HMAC signature).
-- Convention: the app calls Purchases.logIn(<supabase user id>), so
-- app_user_id (or one of its aliases) is the Supabase auth user id.
-- Idempotent on event id; ignores stale (out-of-order) events.
-- ---------------------------------------------------------------------------
create or replace function private.resolve_revenuecat_user(p_event jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate text;
  v_uid     uuid;
begin
  for candidate in
    select x from (
      select p_event ->> 'app_user_id' as x, 1 as ord
      union all select p_event ->> 'original_app_user_id', 2
      union all select jsonb_array_elements_text(coalesce(p_event -> 'aliases', '[]')), 3
    ) c
    where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    order by ord
  loop
    select id into v_uid from auth.users where id = candidate::uuid;
    if v_uid is not null then
      return v_uid;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.billing_apply_revenuecat_event(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event        jsonb := coalesce(p_payload -> 'event', p_payload);
  v_event_id     text  := v_event ->> 'id';
  v_type         text  := v_event ->> 'type';
  v_event_at     timestamptz := to_timestamp(nullif(v_event ->> 'event_timestamp_ms', '')::bigint / 1000.0);
  v_expires_at   timestamptz := to_timestamp(nullif(v_event ->> 'expiration_at_ms', '')::bigint / 1000.0);
  v_rc_ent       text  := private.config_text('revenuecat_entitlement_id');
  v_uid          uuid;
  v_inserted     bigint;
  v_status       text;
  v_outcome      text;
  v_existing     public.entitlements;
  v_from         text;
begin
  if v_event_id is null or v_type is null then
    raise exception 'invalid RevenueCat payload: missing event id or type' using errcode = '22023';
  end if;

  insert into private.billing_events (provider, event_id, event_type, app_user_id, payload)
  values ('revenuecat', v_event_id, v_type, v_event ->> 'app_user_id', p_payload)
  on conflict (provider, event_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return jsonb_build_object('outcome', 'duplicate', 'event_id', v_event_id);
  end if;

  -- Events that never change entitlement state
  if v_type in ('TEST', 'SUBSCRIPTION_PAUSED', 'SUBSCRIBER_ALIAS', 'EXPERIMENT_ENROLLMENT',
                'INVOICE_ISSUANCE', 'VIRTUAL_CURRENCY_TRANSACTION',
                'PRICE_INCREASE_CONSENT_REQUIRED', 'PRICE_INCREASE_CONSENT_APPROVED') then
    v_outcome := 'ignored_type';

  -- Only react to events for the entitlement that unlocks custom rooms
  elsif v_type <> 'TRANSFER'
        and not coalesce(v_event -> 'entitlement_ids' ? v_rc_ent, false)
        and coalesce(v_event ->> 'entitlement_id', '') <> v_rc_ent then
    v_outcome := 'ignored_entitlement';

  elsif v_type = 'TRANSFER' then
    -- Move the RevenueCat entitlement row to the destination user.
    select private.resolve_revenuecat_user(
             jsonb_build_object('app_user_id', v_event -> 'transferred_to' ->> 0,
                                'aliases', coalesce(v_event -> 'transferred_to', '[]')))
      into v_uid;
    if v_uid is null then
      v_outcome := 'unknown_user';
    else
      for v_from in select jsonb_array_elements_text(coalesce(v_event -> 'transferred_from', '[]')) loop
        if v_from ~* '^[0-9a-f-]{36}$' and v_from::uuid <> v_uid then
          delete from public.entitlements
          where user_id = v_from::uuid and provider = 'revenuecat' and entitlement_key = 'custom_rooms'
          returning * into v_existing;
          if v_existing.id is not null then
            insert into public.entitlements as e (
              user_id, entitlement_key, provider, status, product_id, store, environment,
              period_type, will_renew, expires_at, provider_customer_id, last_event_id, last_event_at)
            values (v_uid, 'custom_rooms', 'revenuecat', v_existing.status, v_existing.product_id,
                    v_existing.store, v_existing.environment, v_existing.period_type,
                    v_existing.will_renew, v_existing.expires_at, v_existing.provider_customer_id,
                    v_event_id, v_event_at)
            on conflict (user_id, entitlement_key, provider) do update
              set status = excluded.status, expires_at = excluded.expires_at,
                  last_event_id = excluded.last_event_id, last_event_at = excluded.last_event_at;
          end if;
        end if;
      end loop;
      v_outcome := 'transferred';
    end if;

  else
    v_uid := private.resolve_revenuecat_user(v_event);
    if v_uid is null then
      v_outcome := 'unknown_user';
    else
      select * into v_existing from public.entitlements
      where user_id = v_uid and provider = 'revenuecat' and entitlement_key = 'custom_rooms'
      for update;

      if v_existing.id is not null and v_existing.last_event_at is not null
         and v_event_at is not null and v_event_at < v_existing.last_event_at then
        v_outcome := 'stale';
      else
        v_status := case
          when v_type = 'EXPIRATION' then 'expired'
          when v_type = 'BILLING_ISSUE' then 'billing_issue'
          when v_expires_at is not null and v_expires_at <= now() then 'expired'
          else 'active'
        end;

        insert into public.entitlements (
          user_id, entitlement_key, provider, status, product_id, store, environment,
          period_type, will_renew, expires_at, provider_customer_id, last_event_id, last_event_at)
        values (
          v_uid, 'custom_rooms', 'revenuecat', v_status,
          v_event ->> 'product_id', v_event ->> 'store',
          case when v_event ->> 'environment' in ('PRODUCTION', 'SANDBOX') then v_event ->> 'environment' end,
          v_event ->> 'period_type',
          case when v_type in ('CANCELLATION', 'EXPIRATION') then false
               when v_type in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE') then true
               else null end,
          v_expires_at, v_event ->> 'original_app_user_id', v_event_id, v_event_at)
        on conflict (user_id, entitlement_key, provider) do update set
          status               = excluded.status,
          product_id           = coalesce(excluded.product_id, public.entitlements.product_id),
          store                = coalesce(excluded.store, public.entitlements.store),
          environment          = coalesce(excluded.environment, public.entitlements.environment),
          period_type          = coalesce(excluded.period_type, public.entitlements.period_type),
          will_renew           = coalesce(excluded.will_renew, public.entitlements.will_renew),
          expires_at           = coalesce(excluded.expires_at, public.entitlements.expires_at),
          provider_customer_id = coalesce(excluded.provider_customer_id, public.entitlements.provider_customer_id),
          last_event_id        = excluded.last_event_id,
          last_event_at        = excluded.last_event_at;
        v_outcome := 'applied:' || v_status;
      end if;
    end if;
  end if;

  update private.billing_events
     set processed_at = now(), outcome = v_outcome, user_id = v_uid
   where id = v_inserted;

  return jsonb_build_object('outcome', v_outcome, 'event_id', v_event_id, 'user_id', v_uid);
end;
$$;

revoke all on function private.resolve_revenuecat_user(jsonb) from public, anon, authenticated;
revoke all on function public.billing_apply_revenuecat_event(jsonb) from public, anon, authenticated;
grant execute on function public.billing_apply_revenuecat_event(jsonb) to service_role;
