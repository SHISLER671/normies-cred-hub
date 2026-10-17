-- Recommendation feedback lockdown (DRAFT, 2026-10-18). NOT APPLIED. Ryan applies this by hand after the code change that
-- moves feedback reads/writes to the service-role client is deployed and verified (otherwise ratings stop saving).
--
-- Problem: docs/sql/001_recommendation_feedback.sql created `allow_insert_feedback` and `allow_select_feedback` for anon and
-- authenticated with `true`. The anon key ships to every browser, so anyone could insert arbitrary rows and read every row,
-- including wallet addresses and free-text intents.
--
-- After this migration: anon/authenticated can do nothing on the table; only the server (service role, which bypasses RLS)
-- reads and writes it through /api/zulo/feedback. Wallets are stored as UNVERIFIED unless the server checked a plain
-- signMessage proof (no such proof exists today, so every row is unverified).

begin;

-- 1. Remove the permissive policies.
drop policy if exists allow_insert_feedback on public.recommendation_feedback;
drop policy if exists allow_select_feedback on public.recommendation_feedback;

-- 2. RLS on and forced (also applies to the table owner role; service_role still bypasses).
alter table public.recommendation_feedback enable row level security;
alter table public.recommendation_feedback force row level security;

-- 3. Explicit deny for the public roles (no policy = deny, plus no table privileges at all).
revoke all on table public.recommendation_feedback from anon, authenticated;
revoke all on sequence public.recommendation_feedback_id_seq from anon, authenticated;

-- 4. Wallet provenance. Existing rows become unverified.
alter table public.recommendation_feedback
  add column if not exists wallet_verified boolean not null default false,
  add column if not exists wallet_proof_checked_at timestamptz;

-- A row can only claim a verified wallet if it has a wallet and a proof time.
alter table public.recommendation_feedback
  drop constraint if exists recommendation_feedback_wallet_verified_chk;
alter table public.recommendation_feedback
  add constraint recommendation_feedback_wallet_verified_chk
  check (not wallet_verified or (wallet is not null and wallet_proof_checked_at is not null));

comment on column public.recommendation_feedback.wallet is
  'Self-reported wallet from the Path Board. UNVERIFIED unless wallet_verified = true. Never shown publicly.';
comment on column public.recommendation_feedback.wallet_verified is
  'True only when the server verified a plain signMessage proof for this wallet (no transactions, no typed data).';
comment on table public.recommendation_feedback is
  'Path Board up/down ratings. Server-only (service role) reads and writes via /api/zulo/feedback; anon has no access.';

commit;

-- Verification (run as anon, e.g. with the public key; both must fail with permission denied / 0 rows):
--   select count(*) from public.recommendation_feedback;
--   insert into public.recommendation_feedback (rating, path_id) values ('up', 'probe');
-- Rollback (re-opens the hole; only if the deploy must be reverted before the code fix is live):
--   grant select, insert on public.recommendation_feedback to anon, authenticated;
--   create policy allow_insert_feedback on public.recommendation_feedback for insert to anon, authenticated with check (true);
--   create policy allow_select_feedback on public.recommendation_feedback for select to anon, authenticated using (true);
