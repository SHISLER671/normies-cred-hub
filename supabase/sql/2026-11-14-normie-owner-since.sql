-- DRAFT (not applied). Pulse level 4 "Clean ownership & delegation": when the current owner took each Normie.
-- Spec: docs/zulo/pulse-trust-fixes-spec.md, PR-1 (1.2). Apply by hand, then change this line to APPLIED with the date.
--
-- Order matters. Until step 1 is applied AND the backfill has run, every Normie reads "tenure_unknown" and none gets level 4:
--   1. Apply this file.
--   2. Deploy the owners-refresh function (it now writes owner_since when an owner changes).
--   3. Run the one-off backfill (POST /api/cron/owner-since-backfill, see that route's header) until it answers "done": true.
--   4. Only then deploy the app change that reads owner_since.

-- 1. The column. Null means "not known yet", which Pulse reports as tenure_unknown and never treats as long-held.
alter table public.normie_index add column if not exists owner_since timestamptz null;
comment on column public.normie_index.owner_since is
  'When the current owner took this Normie, as far as NCH knows: the time owners-refresh first saw the owner change (up to one run late, never early), or from the one-off Transfer-log backfill (the latest transfer in the 30 days before it ran, else the start of that window). Null = unknown.';

-- 2. Backstop (not in the spec; delete this section if unwanted). scripts/refresh-owners.ts and any hand edit also write `owner`
--    but don't know about owner_since. Without this, an owner changed by one of them would keep the previous owner's date and a
--    fresh flip would read as long-held. With it, any owner change that doesn't set owner_since itself gets now().
--    Runs with the caller's rights (invoker). A trigger function can't be called directly; the revoke keeps the house rule anyway.
create or replace function public.normie_index_touch_owner_since() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(new.owner) is distinct from lower(old.owner) and new.owner_since is not distinct from old.owner_since then
    new.owner_since := now();
  end if;
  return new;
end
$$;
revoke execute on function public.normie_index_touch_owner_since() from public, anon, authenticated;

drop trigger if exists normie_index_touch_owner_since on public.normie_index;
create trigger normie_index_touch_owner_since
  before update of owner on public.normie_index
  for each row execute function public.normie_index_touch_owner_since();
