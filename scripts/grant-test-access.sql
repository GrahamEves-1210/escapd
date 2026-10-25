-- =============================================================================
-- Give one account custom-room access for testing, without billing.
-- Run in the Supabase SQL editor AFTER that account has confirmed its email in
-- the app (guests can't develop rooms). Replace the email, then run.
--
-- Creates a 'manual' entitlement, the same row a RevenueCat purchase would
-- create, so the app goes through the normal checks. Undo with the
-- statement at the bottom.
-- =============================================================================

insert into public.entitlements (user_id, entitlement_key, provider, status, expires_at)
select id, 'custom_rooms', 'manual', 'active', null
  from auth.users
 where lower(email) = lower('you@example.com')
on conflict (user_id, entitlement_key, provider)
  do update set status = 'active', expires_at = null, updated_at = now();

-- Check: one row, is_anonymous false, status active.
select u.email, u.is_anonymous, e.provider, e.status, e.expires_at
  from auth.users u
  left join public.entitlements e on e.user_id = u.id
 where lower(u.email) = lower('you@example.com');

-- Undo:
-- update public.entitlements e set status = 'revoked', updated_at = now()
--   from auth.users u
--  where e.user_id = u.id and e.provider = 'manual' and lower(u.email) = lower('you@example.com');
