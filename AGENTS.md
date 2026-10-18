# Agent instructions — normies-cred-hub (NCH)

This is the one canonical rules file for every coding agent (Claude, Grok/GrokBot, Zulo Desk, others). `CLAUDE.md` only points here. Rules live here; moving status does not — see "Where things live" below.

NCH (NormiesCredHub, always "NCH", never renamed) is the reputation + concierge layer for awakened Normie agents. Zulo = ERC-8004 Agent #32626, awakened from Normie #7141.

## Read first
- `docs/zulo/strategy.md` — what NCH is building and why: the verified scoreboard for Normie agents, phased and gated on official launches.
- `docs/zulo/thesis-lock.md` — current product facts, Pixel economy order, angle locks.
- `docs/zulo/agent-trading-readiness.md` — the agent-trading plan (teaser stage).
- `lib/official-status.ts` — single source of truth for product status; tests fail on drift.
- `lib/erc8257/trust.ts` — reviewed-tool allowlist; everything else is "Third-party · unvetted".

`docs/zulo/archive/` holds older locks for history only. Never treat anything there as current.

## Safety (non-negotiable)
- On-chain is read-only. The only signature allowed is a plain `signMessage`. Never add `writeContract`, `sendTransaction`, `signTypedData`, approvals, transfers, funding or deposit flows. No flow where a signature could move an NFT and NCH gets blamed.
- No payments or crypto-as-income features. Never ask for seed phrases or private keys; never print secrets or commit env values (`.env.example` holds names only).
- Never present Arena or agent trading as live. Status comes from `lib/official-status.ts`; copy its status lines, never paraphrase them.

## Product rules
- PIXEL comes only from burns (or buying on the Pixel Market). Painting never spends it. Never say customizing earns PIXEL.
- **Chat ratings are not reputation.** Hive chat ratings (`lib/chat-ratings/`) are labelled "Chat rating" and never change `pulse_level`. Ranking weights live in `lib/chat-ratings/config.ts` — tune there, not in the math.
- **Agent trading angle:** Zulo is the smartest Normie by being the reputation layer, not a trader. Rank agents by *verified* proof of profit only (on-chain agent-wallet trades or official records/API). Self-reported P&L, screenshots and chat are labelled "self-reported" with zero weight. Risk-adjusted (trade count, win rate, drawdown, liquidations, time window). A track record, never a tip; DYOR.
- Signal over noise: ship raw counts next to any ranked score so anyone can check the math.
- **Pulse = trust, never skill.** Skill lives in separate sector ranks (Arena, Trading, Tools/utility), verified data only, each with its own minimum sample, open only to agents that clear the Pulse gate. No fixed overall rank; if one is ever shown, the viewer picks the weights. See `docs/zulo/strategy.md`.
- UI labels use plain words, not insider abbreviations (e.g. not a bare "AP").

## Code rules
- Do not edit `public/.well-known/ai-tool/*.json`. Their manifest hashes are pinned on-chain (ERC-8257); `lib/erc8257/manifest-hash.test.ts` fails on any change. Add response fields additively in code instead.
- Work in PRs that target `main` — no stacked bases (a PR based on another PR's branch silently misses `main` when merged out of order). One branch per PR.
- Ryan merges. Pull `main` and check merged PRs before assuming anything is unmerged.
- Run `pnpm typecheck` and `pnpm test:all` before opening a PR. New test files go into the `test:all` and `test:unit` scripts.
- Sign your work: put your agent name (Claude, GrokBot, GrokProject, Zulo Desk) in the commit message and PR title or body.

## Where things live (keep this file rules-only)
- Product status → `lib/official-status.ts`.
- Open tasks, what's applied, what's pending → the PR description and Ryan; do not add dated to-do items here, they go stale within hours.
- Database changes → `supabase/sql/`, applied by hand by Ryan. Each file's first line says DRAFT or APPLIED (with date); whoever confirms an apply updates that line. Never re-run an APPLIED file.
