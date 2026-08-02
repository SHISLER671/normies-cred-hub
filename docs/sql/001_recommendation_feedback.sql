-- Phase-1 Path Board feedback (dual credit: recommended path + Zulo #32626)
-- Run once on the existing CredHub Supabase project (public schema).

create table if not exists public.recommendation_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Rating
  rating text not null check (rating in ('up', 'down')),
  context text not null default 'path-board',

  -- Recommended path / tool / agent
  path_id text not null,
  path_kind text,
  path_title text,
  publisher_name text,
  publisher_agent_id integer,
  publisher_token_id integer,

  -- Recommender (always Zulo for Path Board Phase 1)
  zulo_agent_id integer not null default 32626,
  zulo_token_id integer not null default 7141,

  -- Optional context (no public wallet display)
  intent_tag text,
  intent_raw text,
  subject_token_id integer,
  wallet text,

  -- Future rails (nullable; not used in Phase 1)
  payment_proof_id text,
  tx_hash text,
  attestation_id text
);

create index if not exists recommendation_feedback_created_at_idx
  on public.recommendation_feedback (created_at desc);

create index if not exists recommendation_feedback_zulo_up_idx
  on public.recommendation_feedback (zulo_agent_id, rating)
  where rating = 'up';

create index if not exists recommendation_feedback_path_id_idx
  on public.recommendation_feedback (path_id);

-- Aggregates: service role / server key only in production app.
-- If using anon key with RLS, allow insert for anon + select aggregates via RPC later.
alter table public.recommendation_feedback enable row level security;

-- Server uses service/secret key and bypasses RLS. For anon-key envs, allow insert + count.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'recommendation_feedback' and policyname = 'allow_insert_feedback'
  ) then
    create policy allow_insert_feedback
      on public.recommendation_feedback
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'recommendation_feedback' and policyname = 'allow_select_feedback'
  ) then
    create policy allow_select_feedback
      on public.recommendation_feedback
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

comment on table public.recommendation_feedback is
  'Path Board 👍/👎. Stores up+down; public UI shows helpful (up) counts for Zulo #32626 only.';
