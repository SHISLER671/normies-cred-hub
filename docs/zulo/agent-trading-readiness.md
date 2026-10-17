# CredHub / Zulo: agent trading launch-readiness (read-only)

> **ANGLE LOCK — Agent trading (2026-10-18, Ryan):** Zulo = the smartest Normie by being the reputation layer, not a trader. CredHub ranks which Normie agents trade best by *verified proof of profit*: on-chain trades from the agent's ERC-6551 wallet or official Normies records/API only. Self-reported P&L, screenshots, swarm chat = labeled "self-reported", zero weight. Rank on realized P&L + trade count + win rate + max drawdown + liquidations + time window (no one-hour leaderboards). Track record, never a trade tip or copy-trade call; DYOR on every ranking. Read-only; plain signMessage only. Agent trading itself stays TEASER until official URL + docs/API.


Drafted 2026-10-18 (ChST). Based on normies-cred-hub main **73f8e75** (PRs #91, #92, #94, #95 merged). Status: **agent swarm trading = TEASER, NOT LIVE** (see `thesis-lock.md` §5). This is a plan only: no code, pushes, deploys, wallets or posts.

## a) What to watch, and what counts as "officially live"
- **Official surfaces:** the normies.art Lab (badges: Live / Limited / Coming Soon), `/docs/lab`, `/docs/agentic`, `https://api.normies.art/llms.txt` (diff it weekly for new `/agents/*`, `/hive/*`, `/swarm/*`, `/trade*` or `/arena/*` routes), and `api.normies.art` OpenAPI/route list.
- **Accounts:** @serc1n, @normiesART, @YigitDuman. Also watch Yigit's dated changelog posts and commits on `ygtdmn/normies`: look for contract/ABI, indexer schema or Lab page changes that mention trade, swarm, hive, sage, 6551 or perps.
- **Third parties (quote only, never trust first):** Levanter Labs ("Sage"), 8004scan, any perps venue that gets named.
- **"Officially live" = all of these:** (1) an official account announces it, (2) it links to an official URL (normies.art / Lab page) that a holder can actually use, and (3) docs or an API endpoint describe it. A teaser chart, a stream demo, a "LIVE" label on a screenshot, or a third-party repost **does not count**.
- **Where status lives:** `lib/official-status.ts` is the single source. When needed, add `agentTrading: { status: "TEASER", firstSeen: "2026-10-18", sources: [serc Oct 18 post] }` with a canonical `AGENT_TRADING_STATUS_LINE`, and extend `lib/official-status.test.ts` so any copy saying agent trading is "live" fails while the status is TEASER. Flip it to LIVE only on the official triple above, in one commit, with Ryan's approval.
- **Sunday scan:** weekly-listen reports teaser to live changes, new llms.txt routes, and Yigit commits under a "Agent trading" ITEMS line.

## b) Safe talk rules (Pulse, Paths, Ask)
1. Informational only. No trade signals, no long/short calls, no "buy/sell", no entry/exit or leverage talk.
2. No "get a Normie to profit" / "better get a Normie" framing. Never treat owning a Normie as an investment return.
3. Always DYOR. Past or teaser P&L is not a promise. Say "self-reported, 1 hour, unaudited" whenever the numbers are quoted.
4. Nothing is "live" before the official URL exists. Use `AGENT_TRADING_STATUS_LINE`; never paraphrase the status.
5. Never invent a write, wallet connect, approval, deposit or transaction flow. CredHub stays read-only, and plain `signMessage` is the only signature allowed. `lib/security/hardening.test.ts` already fails on wallet-write calls, so keep it that way.
6. Nothing frames crypto as income for Ryan (no tips/rails/rev-share pitches; `ZULO_PAYMENT_RAIL_STATUS=live` stays hard-blocked).
7. Paths: no Move may point at a trading endpoint unless it's official or reviewed in `lib/erc8257/trust.ts`. Third-party "agent trading" tools stay labelled *Third-party · unvetted* and non-executable.

**Example Ask answers**
- SAFE: "serc shared a teaser: 200 agents debated long/short for one hour, and he showed +$4,177 self-reported P&L. It isn't live, and there are no docs or API yet. We'll know more when an official page ships. DYOR."
- SAFE: "Can Zulo trade for me? Not today. Agent trading is a teaser, and CredHub is read-only: it never moves funds or asks you to sign a transaction."
- UNSAFE: "Agents beat humans. Grab a Normie before launch to get in on the profits." (shilling plus a profit promise)
- UNSAFE: "The swarm is long ETH right now, so follow it." (trade signal)
- UNSAFE: "Connect your wallet and fund your agent's 6551 wallet to start trading." (invented write flow, and not live)

## c) What to index first when it ships (hypotheses, confirm against the docs)
| Data (if exposed) | Use | Feeds Pulse reputation? |
|---|---|---|
| Per-agent track record: P&L, trade count, win rate, liquidations, max drawdown, period | Pulse "trading record" facet | Yes, but only from an official API and only with the period shown. Weight drawdown and liquidations at least as much as P&L |
| Swarm debate logs / decisions | Ask context ("why it went long") | No, it's explanation, not reputation |
| Agent configuration / training state | Pulse profile and Paths ("train before Arena") | Indirectly: shows effort, not skill |
| Hive membership (and join date) | Pulse badge | Yes, as a fact (member since X) |
| ERC-6551 wallet, read-only (balances, positions, history) | Pulse transparency | Yes, if it's on-chain and verifiable. Read only, never prompt a deposit |
| ERC-8004 identity link to agent/6551 wallet | Pulse identity check | Yes. It's the verification anchor |

**Labelling:** anything not from an official endpoint or verifiable on-chain shows **"Unverified · self-reported"** and gets no Pulse weight. Teaser screenshots are never indexed as data. Show a record next to its time window and a "past ≠ future" note. Cache with a source and fetched-at timestamp. Before the first index, put new API hosts through the manifest-fetch private-URL block. The feedback table's RLS lockdown is already applied (2026-10-18); any new trading table needs the same server-only setup before launch.

## d) Launch-day copy for Zulo Voice (drafts; Ryan pastes manually)
**On official launch (only once the official URL plus docs exist):**
1. "Agent trading is now official. Docs are up. We'll read before we speak. DYOR."
2. "Record, window, drawdown. In that order. We'll index what the API shows, nothing it doesn't."
3. "A record is a record. It is not a promise. Pulse will label what's verified and what isn't."
4. "CredHub stays read-only. We read; we never trade for you."

**Teaser stage (now):**
- "A teaser, not a launch: one hour, two hundred agents, self-reported. We'll wait for the docs. Still."

## e) Risks and unknowns
- The P&L is self-reported for one hour with no audit, and the venue, fees, leverage and sizing aren't disclosed. Reputational risk if Zulo amplifies it.
- Regulatory and "investment advice" exposure if any surface reads like a signal or a pitch, or ties Normie ownership to returns.
- Custody: ERC-6551 wallets that hold funds raise the stakes for phishing ("fund your agent"). CredHub must never link to unofficial funding flows.
- Sage is a closed-beta third-party model. Its availability, terms and data provenance are unknown.
- How it relates to Arena (same Hive? same levels/AP?) is unknown. Don't merge the two in copy.
- Data shape unknown: per-agent vs swarm-level records, and whether ERC-8004 identity links to 6551 wallets.
- Supabase: the feedback lockdown (`supabase/sql/2026-10-18-recommendation-feedback-lockdown.sql`) was applied 2026-10-18 and verified (anon read and insert denied). Any new table for trading records must ship server-only (service-role client, no anon policies) from day one.
- Third-party "agent trading" tools may flood the ERC-8257 registry. The `trust.ts` allowlist keeps them unvetted, but Paths copy must hold the same line.
