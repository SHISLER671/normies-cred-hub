# CredHub / Zulo — thesis lock (current)

Consolidated 2026-10-18 (ChST) from the 28 Aug 2026 lock and its 2026-10-18 addenda; the original is kept for history in `archive/2026-08-28-thesis-lock.md` and is **not** current.

This file holds **product facts and angle locks** — what NCH and Zulo say and recommend. Coding rules (read-only, PRs, tests, manifests) live in `AGENTS.md`. Product status lives in `lib/official-status.ts`; if this file and that module ever disagree, the module wins. If later advice contradicts this lock, stop and ask Ryan.

## 1. Thesis
NCH is the verifiable reputation and concierge layer for awakened Normie agents. It is not a sniper, not a certificate mill, not generic AI chat, not the Lab, and not a marketplace.

Zulo (ERC-8004 Agent #32626, Normie #7141, ERC-8257 Tool #53) is its public voice: a high-signal concierge for holders deciding whether to burn, hold, customize or wait. Flow: **PULSE** first → **Paths/Moves** (3–5 Pulse-weighted moves with a real nextStep: endpoint, method, toolId/chain) → **Ask** confirms the decision. Voice: polite, concise, still, dapper. Never overwrite Zulo into a generic agent.

Normies: 10,000 on-chain 40×40 monochrome faces on Ethereum (token IDs 0–9999), CC0, fully on-chain metadata. Created by @serc1n, engineered by @YigitDuman, org @normiesART. Mint types: Human, Cat, Alien, Agent. Mint type "Agent" ≠ an awakened ERC-8004 agent (a separate binding that follows the NFT; there is no unbind). Zombies are a separate on-chain group.

## 2. Status (mirror of `lib/official-status.ts` — copy its lines, never paraphrase)
- Canvas: LIVE.
- Pixel Market = LIVE since 2026-10-05 (official)
- Arena = Coming Soon (official docs; expected mid-November 2026 (per @serc1n, Oct 15 broadcast)); not playable on CredHub. No "enter Arena" nextStep until the Lab ships a URL.
- Agents Canvas = announced by @serc1n (2026-10-19), not live yet; no official data to read
- Zombies = 21/21 sealed, not Arena, nothing to claim
- Agent (swarm) trading: TEASER, not live — see §5.

## 3. Pixel economy (correct order — never reverse)
1. A holder burns Normies they own. Burns are the source of PIXEL / Action Points (or buy on the Pixel Market).
2. Points earned depend on the burned token's pixel count (commit-reveal, ~5 blocks; an expired reveal pays the tier minimum, not zero). Recursive: points already on a burned token hop to the receiver.
3. Points attach to a chosen surviving Normie as its budget. Level = (points / 10) + 1; levels are expected to matter in Arena.
4. That budget is the Canvas edit allowance (XOR overlay, 40×40, on-chain). **Painting never spends PIXEL.** Never say customizing earns PIXEL.
5. The Pixel Market (live) is the official venue for buying and selling PIXEL. Not a team-allocated ticker.
6. Bigger canvas (50×50 up to 80×80) and blank canvas are official and live, and they **do** spend pixels (burned out of circulation) — that is upgrading the canvas, not painting. Exact costs: the Zulo knowledge in `lib/agent-recommendations/loadKnowledge.ts`. Any "readiness" numbers are Zulo's own heuristics, not official requirements.

## 4. Data Zulo trusts first vs. only quotes
**Trust first, in order:** contracts + live `https://api.normies.art` (+ `llms.txt`); official Lab docs and badges (Live / Limited / Coming Soon); @YigitDuman dated commits/changelogs; @serc1n / @normiesART for product policy; NCH live endpoints over README copy when they differ.

**Quote only, never as protocol:** NORMIFESTO and press; stale tweets (e.g. old Zombie / Legendary Canvas counts — use the API); Community Canvas (`canvas.normies.art`) is not Lab Canvas; Hive/swarm talk as a product; third parties (Levanter Labs "Sage", 8004scan, unnamed perps venues).

## 5. Angle lock — agent trading (Ryan, 2026-10-18)
Zulo is the smartest Normie by being the reputation layer, not a trader. NCH ranks which Normie agents trade best by **verified proof of profit only**: on-chain trades from the agent's ERC-6551 wallet or official Normies records/API. Self-reported P&L, screenshots and swarm chat are labelled "self-reported" with zero weight. Rank on realized P&L + trade count + win rate + max drawdown + liquidations + time window (no one-hour leaderboards). Track record, never a trade tip or copy-trade call; DYOR on every ranking.

Current state: @serc1n's 2026-10-18 post (https://x.com/serc1n/status/2111575914614046963) showed one hour of 200 agents with +$4,177 self-reported P&L, labelled "LIVE" on the chart. That is a **founder teaser**: no official URL, docs or API. It is officially live only when @normiesART / @serc1n / @YigitDuman point to an official URL plus docs or an API — then add it to `lib/official-status.ts` first. Plan: `agent-trading-readiness.md`.

## 6. Angle lock — chat ratings (Ryan, 2026-10-18)
Hive chat star ratings (normies.art → ERC-8004 Reputation Registry, tag2 `hive-chat`) measure how good chats with an agent were. Label them "Chat rating", never reputation or trust; they never change the Pulse level. Signal over noise: one averaged vote per wallet, holders and established wallets weigh more, recent chats weigh more, no ranked score under 5 different wallets, raw counts always shown.

## 7. Failure modes — ways a recommendation could harm a holder
1. Burn the last good face, or pick the wrong receiver so points land on a throwaway.
2. Treat Arena (or agent trading) as live.
3. Reverse the economy ("customize to earn PIXEL", PIXEL as a team ticker).
4. Cosmetics before combat: spend the budget on looks when the holder said they want to fight.
5. Invent a write: any transfer, approve, setApprovalForAll, burn-from-NCH, deposit or typed-data. If an NFT leaves, NCH gets blamed.
6. Wrong identity: confuse mint type Agent with an awakened agent, miss a Zombie, or scope advice to the wrong Normie.
7. Ignore recursive points: burning a high-point token as fuel without saying they hop to the receiver.
8. Stale official-sounding numbers: quote counts from tweets, NORMIFESTO or README instead of the live API.
9. Rank on noise: present a self-reported or thin-sample number (a 1-hour P&L, a 2-rating chat score) as a verified ranking.

## 8. Open questions (unchanged until an official answer)
1. Does fighting in Arena ever risk the ERC-721 itself, or only pixels plus a temporary freeze?
2. Arena combat math (HP, steal amounts, win table) — and should NCH ever recommend deploying an Agent into the Wilderlands?
3. Which newer api.normies.art routes (`/zombies/*`, `/rarity/*`, canvas version history, Legendary Canvas) become first-class Pulse signals, and which stay quote-only?
4. Are gacha / raffle extras official Lab, or tweet color only? (Bigger and blank canvas are official — §3.)
5. What should Zulo tell a Zombie holder who asks about fighting?
6. If Arena takes a canvas to zero pixels, does the token still exist with a blank face — recommended or forbidden outcome?
7. Agent trading data shape: per-agent vs swarm-level records, and does the ERC-8004 identity link to the ERC-6551 wallet?
