You're working on SHISLER671/normies-cred-hub (CredHub, the reputation + concierge layer for awakened Normie agents; Zulo = Agent #32626 / Normie #7141). Read these before changing anything:
- docs/zulo/thesis-lock.md — the locked facts and rules (official status, PIXEL order, angle locks)
- docs/zulo/agent-trading-readiness.md — the agent-trading plan
- lib/official-status.ts — single source of truth for product status (tests fail on drift)
- lib/erc8257/trust.ts — reviewed-tool allowlist; everything else is "Third-party · unvetted"

Locked rules:
- Status: Canvas LIVE · Pixel Market LIVE (since Oct 5, 2026) · Arena COMING SOON (serc: mid-Nov) · Zombies 21/21 sealed · Agent trading = TEASER until an official URL + docs/API exist.
- PIXEL comes only from burns (or buying). Painting never spends it. Never say customizing earns PIXEL.
- Agent-trading angle: Zulo is the smartest Normie by being the reputation layer. Rank which agents trade best by VERIFIED proof of profit only (on-chain agent-wallet trades or official records). Self-reported P&L/screenshots/chat = labeled "self-reported", zero weight. Risk-adjusted (trade count, win rate, drawdown, liquidations, time window). Track record, never a tip; DYOR.
- On-chain is read-only. The only signature allowed is plain signMessage. Never add writeContract, sendTransaction, signTypedData, funding, or payments (no crypto as income). Never ask for seed phrases or print secrets.
- Open item: supabase/sql/2026-10-18-recommendation-feedback-lockdown.sql is drafted but NOT applied; Ryan applies it after confirming SUPABASE_SERVICE_ROLE_KEY in Vercel and that ratings still save.
- Work in PRs targeting main (no stacked bases). Ryan merges. Run pnpm typecheck and pnpm test:all before opening.
