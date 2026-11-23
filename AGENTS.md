# Agent instructions — normies-cred-hub (NCH)

This is the one canonical rules file for every coding agent (Claude, Grok/GrokBot, ZuloNCH Build, ZuloNCH Listen, others). `CLAUDE.md` only points here. Rules live here; moving status does not — see "Where things live" below.

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
- Zulo payments (#WillWork4PIXEL) are **parked, not deleted**: the code stays, `lib/payments/rail-policy.ts` hard-blocks it, and no page, manifest or prompt may tell anyone how to pay Zulo. Only Ryan can unpark it, by changing the no-crypto-as-income rule first.
- Never present agent trading as live, and never present any surface as more live than `lib/official-status.ts` says. Arena is LIVE there since 2026-11-14 (Ryan), entered at arena.normies.art only: NCH never handles opt-in, and being entered and in line is not a record. Copy the status lines, never paraphrase them.
- Never map people to wallets: no username/handle → wallet lookups. Wallet in, public data out. ENS names are the exception because the wallet owner published them on-chain: resolving `name.eth` ↔ address is allowed; social handles (X, Farcaster, Discord, email) never are.
- Public API routes: rate-limit every route that calls an outside service or the chain (`enforceDualRateLimit`), put a timeout on every outbound fetch (`fetchWithTimeout`), allowlist anything that builds an upstream URL from input, and never return upstream error text to callers. Report "couldn't read" separately from "not found" or "empty", and don't cache it.
- Cron/operator routes check only `isAuthorizedCron` (bearer secret, constant time). The `x-vercel-cron` header is not proof.
- Pulse signals must not be buyable: anything counted toward a level counts distinct callers, never raw calls.
- Every `SECURITY DEFINER` function in Supabase's `public` schema needs `revoke execute ... from public, anon, authenticated` in its SQL file.
- **Public on-chain data only.** Show what is public on-chain; an ENS name counts as public and is preferred over an address. Shorten addresses by default (`0x1234…abcd`), never type them out in full in UI copy, and never link a wallet to a social profile (X, Farcaster, Discord) or a real person's name. If a share card ever shows wallet or ENS details, it must let the viewer hide them before the image is generated.
- **No comms.** NCH never messages, emails, DMs or notifies any wallet or person, and never contacts buyers, sellers or holders. No contact forms, outreach, comments or user-to-user messaging; nothing that would need moderating.

## Product rules
- PIXEL comes only from burns (or buying on the Pixel Market). Painting never spends it. Never say customizing earns PIXEL.
- **Chat ratings are not reputation.** Hive chat ratings (`lib/chat-ratings/`) are labelled "Chat rating" and never change `pulse_level`. Ranking weights live in `lib/chat-ratings/config.ts` — tune there, not in the math.
- **Agent trading angle:** Zulo is the smartest Normie by being the reputation layer, not a trader. Rank agents by *verified* proof of profit only (on-chain agent-wallet trades or official records/API). Self-reported P&L, screenshots and chat are labelled "self-reported" with zero weight. Risk-adjusted (trade count, win rate, drawdown, liquidations, time window). A track record, never a tip; DYOR.
- Signal over noise: ship raw counts next to any ranked score so anyone can check the math.
- **Pulse = trust, never skill.** Levels 1–4 are the four trust checks and nothing else (`pulse_scale: "trust-0-4"`). Popularity (distinct callers) never changes the level: it is a separate "Trending on NCH" badge, never a stand-in for a missing check, with the raw counts shown beside it. Skill lives in separate sector ranks (Arena, Trading, Tools/utility), verified data only, each with its own minimum sample, open only to agents that clear the Pulse gate (both "ERC-8004 registered" and "Clean ownership & delegation" in the Pulse breakdown — never a level threshold). No fixed overall rank; if one is ever shown, the viewer picks the weights. See `docs/zulo/strategy.md`.
- UI labels use plain words, not insider abbreviations (e.g. not a bare "AP").
- **Burn/buy views are fenced to `/burn`.** That page is a vibe check, not financial advice: label it "Not financial advice", never predict a price, and say plainly that values can go up or down and no one knows the future. Other surfaces (Ask Zulo, Pulse, Record Card, manifests, share cards) never give their own burn, keep or buy verdict, ranking or price call. Ask Zulo may explain the facts and trade-offs for a named Normie (pixel count and yield band, edited art, trait supply, floor snapshot with source and time), both sides and no verdict, then point to `/burn` for a vibe check (not financial advice). Never show a third-party trust verdict such as Adapterscan's `burnable`.
- **Numbers yes, advice never.** Show official money figures (fees, settled pools, prizes a Normie actually won, a live pool total as reported) with source, as-of time and an official link, and invite readers to check them ("Don't take our word for it"). Never give financial advice, predict an outcome, show a projected per-Normie prize, do returns math, or nudge anyone to pay, enter or top up. Never show wallet-level balances or winnings. Payments and income features stay off (Zulo payments stay parked).

## Code rules
- Do not edit `public/.well-known/ai-tool/*.json`. Their manifest hashes are pinned on-chain (ERC-8257); `lib/erc8257/manifest-hash.test.ts` fails on any change. Add response fields additively in code instead.
- Work in PRs that target `main` — no stacked bases (a PR based on another PR's branch silently misses `main` when merged out of order). One branch per PR.
- Open every PR as a **draft**. It is reviewed in a separate run from the one that wrote it, using `docs/pr-checklist.md`; the author may review its own PR, never in the same session. The author fixes what the review raises, then marks it "Ready for review". Ryan merges only ready PRs. Dependabot PRs are the exception: they arrive ready, and Ryan may merge them once `check` is green.
- Ryan merges. Pull `main` and check merged PRs before assuming anything is unmerged.
- Run `pnpm typecheck` and `pnpm test:all` before opening a PR. New test files go into the `test:all` and `test:unit` scripts.
- Sign your work: put your agent name (Claude, GrokBot, GrokProject, ZuloNCH Build, ZuloNCH Listen) in the commit message and PR title or body.
- **Scope check** (`.github/workflows/scope-check.yml`): every task PR must stay inside `.claude/contract.txt` as it is on `main` (one glob per line; land the contract first). Workflows, `.github/scripts/`, `public/.well-known/`, env files (incl. `.envrc`), key files and lockfiles are always protected. The check runs on `pull_request_target` from main's copy and only reads PR files with git; never add a step there that runs PR code. Only Ryan adds the `contract-override` label to let a PR past either rule.

## Where things live (keep this file rules-only)
- Product status → `lib/official-status.ts`.
- Open tasks, what's applied, what's pending → the PR description and Ryan; do not add dated to-do items here, they go stale within hours.
- Database changes → `supabase/sql/`, applied by hand by Ryan. Each file's first line says DRAFT or APPLIED (with date); whoever confirms an apply updates that line. Never re-run an APPLIED file.
