# NCH strategy — the verified scoreboard for Normie agents

Agreed 2026-10-18 (Ryan). Full research, sources and market map: the "Zulo & NCH: Agent Trading Strategy" doc (Ryan has the link). This file is the short version every agent works from. Product status still comes only from `lib/official-status.ts`.

## The bet
When Normie agents start acting for themselves (Arena first, maybe trading later), the scarce thing is not agents that act. It is a record of how they did that people can trust. Zulo is the smartest Normie because he keeps that record, not because he trades.

## Our lane
Read-only and verified. Everyone else either moves the money or trusts self-reported numbers.
- Count only what is on-chain or official. Self-reported numbers are shown, labelled "self-reported", and weighted zero.
- One vote per wallet, risk-adjusted, minimum sample before any rank, raw counts always beside the score (same rules as `lib/chat-ratings/`).
- Never trade, hold funds, offer a copy button, launch a token, or say "buy a Normie to profit".

## How the scores fit together (Ryan, 2026-10-18)
Three kinds of signal, kept separate so none can be gamed through another:

| Signal | Answers | Built from | Ranks? |
| --- | --- | --- | --- |
| **Pulse** | "Can I trust this agent?" — real, verified identity, owner, clean history | On-chain + official data only | No. A 0–5 trust level, and the gate for any sector rank |
| **Sector ranks** | "How good is it at X?" — Arena, Trading, Tools/utility, each on its own | Verified data only, each with its own minimum sample | Yes, per sector, only for agents that clear the Pulse gate |
| **Chat rating** | "What's the community vibe?" | Hive chat stars (ERC-8004) | Never. Shown beside, zero weight |

- A verified Arena record **may** move Pulse, but only as proof of real, verified activity — never by win count.
- **No fixed Overall rank.** If one is ever shown, the viewer picks the weights. A fixed blend invites gaming.
- **Don't track everything.** Only what is verifiable on-chain or through official sources. Trading rank stays pending until there is a verified source for trade results (not screenshots), same as Arena.

## The big win
The **Normie record card**: one read-only card per awakened Normie with its verified history (Hive chat now, Arena next, trading only if official data exists). Holders, buyers and outside agents check it before they engage. Served through Pulse and ERC-8257 first, the site second.

## Phases (each gated on an official launch, never a teaser)
| Phase | Ships | Gate to start |
| --- | --- | --- |
| Now | Chat ratings in Pulse (done); delegated hot wallets count as holders; log Zulo's answers so his own hit rate can be graded; verified vs self-reported labels everywhere | — |
| 1 | Arena record card: rounds, survival, PIXEL earned, duels won, from official data | Arena opens at an official URL (expected mid-November) |
| 2 | Verified trading record: agent-wallet trades only, risk-adjusted, 30-day minimum window | Official agent-wallet + trading docs or API |
| 3 | Record card as the standard: on listings, called by outside agents, offered to the Normies Lab | 3 months of clean records + Normies team interest |

## How we stay relevant
1. Ship on launch day (Pixel Check worked because it was ready when the market opened).
2. API first: every record lands in Pulse / ERC-8257 before the UI.
3. Grade Zulo too: publish his own hit rate.
4. Stay complementary to the Normies team: official data only, cite it, never front-run announcements.
5. Stay boring on safety: read-only, no token, no custody.

## Who owns what right now
Ownership changes; check open PRs before starting. Claim a task in your PR title before you begin, and don't touch a task someone else has claimed.
