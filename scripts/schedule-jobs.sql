-- =============================================================================
-- Schedule Escapd background jobs on a HOSTED project (run once in the SQL
-- editor AFTER deploying the Edge Functions). Not a migration on purpose:
-- it needs project-specific secrets and pg_cron/pg_net, which local test
-- databases don't have.
--
-- 1. Database > Extensions: enable pg_cron and pg_net (Vault is on by default).
-- 2. Replace the two placeholders below, then run this file.
-- =============================================================================

select vault.create_secret('https://<project-ref>.supabase.co', 'escapd_project_url');
select vault.create_secret('<same value as the CRON_SECRET function secret>', 'escapd_cron_secret');

create or replace function private.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'escapd_project_url')
           || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'escapd_cron_secret')),
    body := p_body,
    timeout_milliseconds := 5000)
$$;
revoke all on function private.invoke_edge_function(text, jsonb) from public, anon, authenticated;

-- Generation worker: every minute (exits immediately when the queue is empty).
select cron.schedule('escapd-generation-worker', '* * * * *',
  $$ select private.invoke_edge_function('generation-worker') $$);

-- Storage cleanup: every 15 minutes.
select cron.schedule('escapd-storage-janitor', '*/15 * * * *',
  $$ select private.invoke_edge_function('storage-janitor') $$);

-- Retention purge + cleanup: daily at 08:17 UTC.
select cron.schedule('escapd-daily-purge', '17 8 * * *',
  $$ select private.invoke_edge_function('storage-janitor', '{"purge": true}'::jsonb) $$);

-- Inspect:   select * from cron.job;  select * from cron.job_run_details order by start_time desc limit 20;
-- Unschedule: select cron.unschedule('escapd-generation-worker');
