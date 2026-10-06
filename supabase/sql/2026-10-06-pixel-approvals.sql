-- Pixel Check: #PIXEL approvals index (2026-10-06).
-- Applied to the NCH Supabase project (rvbbpuulwsatykcredbh). Kept here so the schema is in git.

-- 1. Latest #PIXEL allowance per (owner, spender), from NormiesCanvasStorageV2 Approval events.
--    Public chain data: public read via RLS; writes are service-role only (the approvals-refresh job).
create table if not exists public.pixel_approvals (
  owner text not null,
  spender text not null,
  amount numeric not null,
  block bigint not null,
  log_index integer not null,
  tx_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (owner, spender)
);
create index if not exists pixel_approvals_spender_idx on public.pixel_approvals (spender);
alter table public.pixel_approvals enable row level security;
drop policy if exists "pixel_approvals public read" on public.pixel_approvals;
create policy "pixel_approvals public read" on public.pixel_approvals for select using (true);
comment on table public.pixel_approvals is
  'Latest #PIXEL allowance per owner->spender from NormiesCanvasStorageV2 Approval events (0x96F2…2084). Public read; service-role writes only. Coverage starts at block 26123420 (the first ~1000 blocks after deploy were beyond the free RPC window).';

-- 2. Backfill, read 2026-10-06 ~10:10 UTC: blocks 26123420 to 26132661 held exactly one Approval event.
insert into public.pixel_approvals (owner, spender, amount, block, log_index, tx_hash)
values ('0xab7dbf90b9924dffd235cfafef95f3f534b1ee4e', '0x446d014348a3ef98fd7a91cc1184d4d4a755789f', 3, 26129230, 690,
        '0xa046d322d8134eb05a0a754f495979a9f501873e41a4136f786edfa3754d4473')
on conflict (owner, spender) do nothing;

-- 3. The job's position: it continues from just before the backfill's end (rereading a few blocks changes nothing).
insert into public.census_sync (job, synced_at, ok, summary)
values ('approvals', now(), true, jsonb_build_object('lastBlock', 26132600, 'coveredFrom', 26123420, 'backfill', true))
on conflict (job) do nothing;

-- 4. Watchdog: alert when the approvals index has not advanced for 3 hours (the free RPC only serves recent blocks).
create or replace function public.job_watchdog(send_test boolean default false)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'net'
as $function$
declare
  topic text; prev jsonb; cur text; msg text; sent_at timestamptz; problems text[] := '{}'; r record; age_h numeric; limit_h numeric;
begin
  select value into topic from public.sync_config where key = 'ntfy_topic';
  if topic is null then return 'no topic configured'; end if;

  if send_test then
    perform net.http_post(url := 'https://ntfy.sh', body := jsonb_build_object('topic', topic, 'title', 'NCH watchdog', 'message', 'Test: the NCH job watchdog can reach your phone.', 'priority', 3, 'tags', jsonb_build_array('white_check_mark')), headers := jsonb_build_object('Content-Type', 'application/json'));
    return 'test sent';
  end if;

  for r in select * from (values ('census', 13), ('owners', 13), ('delegates', 3), ('approvals', 3)) as t(job, hours) loop
    limit_h := r.hours;
    select extract(epoch from (now() - synced_at)) / 3600 into age_h from public.census_sync where job = r.job;
    if age_h is null then problems := problems || (r.job || ' has never run');
    elsif age_h > limit_h then problems := problems || (r.job || ' last succeeded ' || round(age_h) || 'h ago');
    end if;
  end loop;

  cur := array_to_string(problems, '; ');
  select coalesce(value::jsonb, '{}'::jsonb) into prev from public.sync_config where key = 'watchdog_state';
  prev := coalesce(prev, '{}'::jsonb);
  sent_at := (prev ->> 'sent_at')::timestamptz;

  if cur <> '' and (cur <> coalesce(prev ->> 'problems', '') or sent_at is null or sent_at < now() - interval '6 hours') then
    msg := 'NCH: ' || cur;
    perform net.http_post(url := 'https://ntfy.sh', body := jsonb_build_object('topic', topic, 'title', 'NCH job alert', 'message', msg, 'priority', 4, 'tags', jsonb_build_array('warning')), headers := jsonb_build_object('Content-Type', 'application/json'));
    insert into public.sync_config (key, value) values ('watchdog_state', jsonb_build_object('problems', cur, 'sent_at', now())::text)
      on conflict (key) do update set value = excluded.value;
    return 'alert sent: ' || cur;
  elsif cur = '' and coalesce(prev ->> 'problems', '') <> '' then
    perform net.http_post(url := 'https://ntfy.sh', body := jsonb_build_object('topic', topic, 'title', 'NCH watchdog', 'message', 'NCH: all refresh jobs are healthy again.', 'priority', 3, 'tags', jsonb_build_array('white_check_mark')), headers := jsonb_build_object('Content-Type', 'application/json'));
    insert into public.sync_config (key, value) values ('watchdog_state', jsonb_build_object('problems', '', 'sent_at', now())::text)
      on conflict (key) do update set value = excluded.value;
    return 'recovered notice sent';
  end if;
  return case when cur = '' then 'healthy' else 'still alerting (not re-sent yet): ' || cur end;
end
$function$;

-- 5. Hourly at :50 (census :00, owners :30, delegates :15, watchdog :45).
select cron.unschedule('approvals-refresh') where exists (select 1 from cron.job where jobname = 'approvals-refresh');
select cron.schedule('approvals-refresh', '50 * * * *', $cron$
  select net.http_post(
    url := 'https://rvbbpuulwsatykcredbh.supabase.co/functions/v1/approvals-refresh',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.sync_config where key='cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
$cron$);
