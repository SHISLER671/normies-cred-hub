-- APPLIED (state verified live 2026-10-19 by Claude, read-only catalog query). Record only: the live database already matches this.
-- Why this file exists: public.job_watchdog (2026-10-06-pixel-approvals.sql) is SECURITY DEFINER. Postgres lets PUBLIC run
-- new functions by default, and Supabase's anon key is public, so without these revokes anyone could call it over
-- /rest/v1/rpc/job_watchdog and spam Ryan's ntfy alerts or rewrite sync_config. The revokes had been made by hand but
-- were not in git; a re-run of the 2026-10-06 file would have re-opened the hole. Idempotent; nothing to run today.
--
-- Verified 2026-10-19: anon and authenticated cannot execute job_watchdog; public.sync_config has RLS on, no policies
-- and no anon SELECT grant; no SECURITY DEFINER function in public is executable by anon.

revoke execute on function public.job_watchdog(boolean) from public, anon, authenticated;

alter table public.sync_config enable row level security;
revoke all on table public.sync_config from anon, authenticated;
