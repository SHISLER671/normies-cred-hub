-- Zulo answer log — DRAFT 2026-10-18. NOT APPLIED. Ryan applies by hand in the Supabase SQL editor, then sets
-- ZULO_ANSWER_LOG=on in Vercel. Until both happen, nothing is written (the server checks the switch first).
--
-- Purpose: keep Zulo's OWN answers so his hit rate can be graded later ("Zulo said X; did X happen?").
-- Privacy: stores only Zulo's words and the public Normie id(s) he was asked about. It never stores the person's
-- question, wallet, ENS, IP or anything else about them. Server-only: anon/authenticated have no access.

begin;

create table if not exists public.zulo_answer_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Where the answer came from (only 'ask' today).
  surface text not null default 'ask' check (surface in ('ask')),

  -- Public subject: the Normie the answer was scoped to, if any (0–9999).
  normie_id integer check (normie_id is null or (normie_id between 0 and 9999)),

  -- Zulo's own output, truncated server-side.
  recommendation text not null check (char_length(recommendation) <= 2000),
  next_steps text[] not null default '{}',
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  pulse_lead text check (pulse_lead is null or char_length(pulse_lead) <= 500),

  -- Grading, filled in later by Ryan or a reviewer (never by the person asking).
  grade text check (grade is null or grade in ('hit', 'miss', 'unclear', 'not_gradable')),
  graded_at timestamptz,
  grade_note text check (grade_note is null or char_length(grade_note) <= 1000),
  constraint zulo_answer_log_grade_time_chk check ((grade is null) = (graded_at is null))
);

create index if not exists zulo_answer_log_created_at_idx on public.zulo_answer_log (created_at desc);
create index if not exists zulo_answer_log_normie_idx on public.zulo_answer_log (normie_id, created_at desc);

-- Server-only, same as recommendation_feedback after its lockdown: RLS forced, no policies, no public grants.
alter table public.zulo_answer_log enable row level security;
alter table public.zulo_answer_log force row level security;
revoke all on table public.zulo_answer_log from anon, authenticated;
revoke all on sequence public.zulo_answer_log_id_seq from anon, authenticated;

comment on table public.zulo_answer_log is
  'Zulo''s own Ask answers for later grading. No question text, wallet or personal data. Server-only (service role).';

commit;

-- Verification after applying (run as anon; both must fail with permission denied):
--   set role anon;
--   select count(*) from public.zulo_answer_log;
--   insert into public.zulo_answer_log (recommendation) values ('probe');
--   reset role;
-- Retention: the server deletes rows older than 180 days on each write (lib/zulo/answer-log.ts, stated on /privacy).
-- Manual equivalent: delete from public.zulo_answer_log where created_at < now() - interval '180 days';
