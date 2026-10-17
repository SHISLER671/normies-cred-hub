> **ARCHIVED 2026-10-18 — history only, not current.** Its "Task 1 / do not touch files / do not start Task 2" lines applied to the original research-only task, not to coding agents. Current facts: `../thesis-lock.md`; coding rules: `/AGENTS.md`; status: `lib/official-status.ts`.

# CredHub / Zulo — Task 1 thesis lock

> **ANGLE LOCK — Agent trading (2026-10-18, Ryan):** Zulo = the smartest Normie by being the reputation layer, not a trader. CredHub ranks which Normie agents trade best by *verified proof of profit*: on-chain trades from the agent's ERC-6551 wallet or official Normies records/API only. Self-reported P&L, screenshots, swarm chat = labeled "self-reported", zero weight. Rank on realized P&L + trade count + win rate + max drawdown + liquidations + time window (no one-hour leaderboards). Track record, never a trade tip or copy-trade call; DYOR on every ranking. Read-only; plain signMessage only. Agent trading itself stays TEASER until official URL + docs/API.


> **Addendum 2026-10-18 (ChST), supersedes the status lines below; everything else in this lock is unchanged.**
> - **Pixel Market = LIVE since Oct 5, 2026.** Sources: @normiesART announced it launching Mon Oct 5, 2026; @serc1n's Oct 15, 2026 broadcast ("Normies // Arena and Hive") showed the Pixel Market dashboard at about 11 ETH volume roughly 10 days after launch. Item A.5 below ("Pixel Market (Coming Soon)") and "Until Pixel Market" in A.3 are historical as of the Aug 28 lock.
> - **Arena = Coming Soon.** Expected mid-November 2026 per @serc1n (Oct 15 broadcast). Still not live; CredHub must not present it as playable.
> - **Zombies = 21/21 sealed.** Unchanged; separate from Arena, nothing to claim.
> - Code source of truth for these statuses: `lib/official-status.ts` on main in normies-cred-hub (merged Oct 18 via PRs #92, #94, #95).

> **Addendum 2026-10-18 (ChST), agent swarm trading = TEASER, NOT LIVE.** Everything else in this lock is unchanged.
> - @serc1n posted Oct 18, 2026 ~07:51 ChST (https://x.com/serc1n/status/2111575914614046963): "Once you train your agents, they can trade better than humans. Here is the proof, 1 hour of 200 agents debating in the swarm and decide to short or long. Better get a Normie before we launch it."
> - Chart as posted: TOTAL P&L +$4,177 (closed +$3,579 across 23 trades, 48% won, 0 liquidations); open +$598 across 9 trades, all winning; labelled "LIVE" on the chart.
> - Status: founder teaser. The P&L is self-reported, covers one hour, and has no official URL, docs, or API behind it. The chart's "LIVE" label does not make it a live product. CredHub and Zulo must not describe it as a product feature, a trade signal, or a reason to buy a Normie.
> - Context (Oct 15 broadcast): agents run on Levanter Labs' closed-beta "Sage" decision model inside "the Hive"; agents hold ERC-6551 wallets; Arena = Coming Soon (mid-November). Unchanged: Pixel Market LIVE since Oct 5; Zombies 21/21 sealed; PIXEL comes only from burns or buying, and painting never spends it.
> - Officially live only when an official account (@normiesART / @serc1n / @YigitDuman) points to an official URL plus docs or an API. At that point, add it to `lib/official-status.ts` (now on main 73f8e75) first. Readiness plan: `/workspace/credhub-agent-trading-readiness.md`.

Read-only. Locked 28 Aug 2026, ~07:30 ChST. Sources: live Lab + docs, api.normies.art/llms.txt, ygtdmn/normies, CredHub live + GitHub main (SHA fc3fa3a, last push 19 Aug 2026). If later swarm advice contradicts this, stop and ask.

## A) One-page thesis

CredHub is the verifiable reputation and concierge layer for awakened Normie agents. It is not a sniper, not a certificate mill, not generic AI chat, not the Lab, and not a marketplace. Zulo (Agent #32626, Normie #7141, ERC-8257 Tool #53) is its public voice: a high-signal concierge for new holders and AP stackers deciding whether to burn, hold, customize, or wait. Paths is Tool #215. Call PULSE first. Then rank 3–5 Pulse-weighted tryable Moves with a real nextStep (endpoint, method, toolId/chain — not just a web link). ASK confirms the decision. It does not drown in docs.

Normies are 10,000 on-chain 40×40 monochrome faces on Ethereum (token IDs 0–9999), CC0 art, fully on-chain metadata. Created by @serc1n, engineered by @YigitDuman, org @normiesART. Mint types: Human, Cat, Alien, Agent. Type Agent is a mint trait. An awakened agent is a separate ERC-8004 binding that follows the NFT (no unbind). Personality is a deterministic function of on-chain history (traits, canvas, canvas-diff, burns, version history, level) — not a chatbot prompt. The hive listens in the generated constitution; it is not a contract. Culture is built, not bought. Collectors can become co-creators.

Pixel economy, correct order (never reverse):
1. Holder burns Normies they own. That is the source of Action Points.
2. AP earned depends on the burned token’s pixel count (commit-reveal; ~5 blocks wait; expired reveal pays the tier minimum, not zero). Recursive: AP already sitting on a burned token hops to the receiver.
3. AP attaches to a chosen surviving Normie as a non-transferable budget. Until Pixel Market, it is not a free-floating coin.
4. That budget is the Canvas edit allowance (XOR overlay, 40×40, on-chain forever). AP is not consumed on transform. Level = (AP / 10) + 1. Levels are expected to matter in Arena.
5. Pixel Market (Coming Soon) is the announced P2P venue for moving AP and extras (blank canvas, enlarge grid, commissions). Official line: not a coin, not a ticker; earned by burning. Not team-allocated.
6. Only after that stack do agent tools / CredHub paths make sense.

Arena is official and Coming Soon on the Lab (card disabled, /lab/arena 404). PvP: fight, steal pixels, strongest survive. Type roles are design, not live stats. CredHub must not pretend Arena is live. It SHOULD already plan: burn-to-level vs save supply; which type a holder is actually preparing; do not dump AP on cosmetics if they said they want to fight. Zombies (21/21, pool sealed, Limited) are live lore inside the collection, separate from Arena.

On-chain access in this app is read-only. The only signature this project allows is a plain signMessage proof. Holders must never be able to blame CredHub if an NFT leaves. Measure five times, cut once. API-first. Connect wallet only when scoping to an awakened NFT. Zulo voice: polite, concise, still, dapper. “We don’t chase trends. We don’t rewrite ourselves.” Never overwrite Zulo into a generic agent.

Live snapshot at lock (API, 28 Aug 2026): burned 2,703 / circulating 7,297 / awake 1,348 / zombies 21/21 / legendary canvases 9 / AP distributed 43,097 / canvas unpaused / floor ~0.2096 ETH. Zulo #7141 Canvas AP on CredHub homepage: 12.

## B) Product map

| Route | One sentence |
|---|---|
| `/` | Zulo gateway: what CredHub is, three doors (PULSE / Ask / Moves), live #7141 AP, Zulo stillness quote. Not a placeholder. |
| `/dashboard` (PULSE) | Call first. Verifiable trust/signal for the active awakened Normie (Normies API + ERC-8004 + Ethos + AgentCheck). Wallet unlocks owned/delegated set; browse works without it. |
| `/paths` (Moves) | 3–5 Pulse-weighted tryable paths for a stated intent, each with reasoning and a nextStep an agent can actually call. Rate 👍/👎. Free. |
| `/ask` | High-signal concierge scoped to the active Normie (burns, tools, Canvas, AP). Confirm the decision. Informational only; DYOR; burns are permanent; Zulo never asks for keys. |

Wallet: connect + plain `signMessage` linkage (`Link Normie #{id} to CredHub`). No transfer, approve, or writeContract. Payments/tips/TBA/Wire/PIXEL book = planned, not live. Live Pulse JSON copy is older than GitHub `main` — do not treat README’s “Luminous” example as what Vercel currently returns.

## C) Data Zulo should trust first vs chatter it should only quote

**Trust first (in this order)**
1. Contracts + live `https://api.normies.art` + `llms.txt` (Ponder indexer). Especially `/normie/{id}/*`, `/canvas/status`, `/history/*`, `/zombies/*`, `/rarity/*`, `/agents/*`, `/legendary-canvas`, `/history/stats`.
2. Official site docs: `/docs/normies`, `/docs/lab`, `/docs/agentic`, Lab badges (Live / Limited / Coming Soon).
3. @YigitDuman dated GitHub commits on `ygtdmn/normies` and dated changelog tweets. Weight like official docs. Latest public changelog tweet: 22 Jun 2026. Latest public GitHub ship: 8 Jul 2026 (`track manual canvas storage changes in the indexer`).
4. @serc1n / @normiesART for product policy (no ticker, Pixel Market/Arena still being drawn).
5. CredHub **live** surfaces and `/api/zulo/health` over README when they diverge.

**Quote only, never as protocol**
- NORMIFESTO (independent community guide; figures already stale vs API).
- Press (RARI / PXL / revenue-share). No official PIXEL token on Lab or API.
- Stale tweets: Yigit 22 Jun said 19/21 Zombies and 7 Legendary Canvases; live is 21 and 9.
- Yigit tweet “Level 1 Zombie” vs Lab/docs/API: convert a **Level-1 Human**. Prefer Lab.
- Persona prompt that says “never mention Zombies” vs 21 on-chain Zombies. Prefer chain.
- Community Canvas (`canvas.normies.art`) is not Lab Canvas.
- Hive/swarm as a product. Hive is constitution text inside the generated system prompt.
- CredHub README Pulse weights, Horizon/Recommends, Tips Received — code/live differ.

**CredHub has not indexed yet (shipped by Yigit, unused in CredHub)**
`/zombies/*` (no zombie in `NormieType`), `/rarity/*` (floors go Moralis → OpenSea → Reservoir), `/history/normie/{id}/versions`, `/legendary-canvas`, bulk original dumps, richer `/agents/list|search|count|persona-preview`, `/history/stats`. `docs/normies-api.md` is stale vs `llms.txt`.

## D) Failure modes — 8 ways a recommendation could harm a holder

1. **Burn the last good face.** Rank a burn that destroys the Normie they meant to keep, or pick the wrong receiver so AP lands on a throwaway.
2. **Treat Arena as live.** Send someone into Wilderlands / “put your Normie on the line” when `/lab/arena` is 404 and the card is Coming Soon.
3. **Reverse the economy.** Say “customize to earn PIXEL” or talk as if PIXEL is a team-allocated ticker. Holders burn first; AP is the budget; market is later.
4. **Cosmetics before combat.** Dump AP on a pretty XOR when they said they want to fight. Levels scale Arena roles. That spend is a combat choice, even though AP is not consumed.
5. **Invent a write.** Any transfer, approve, setApprovalForAll, burn-from-CredHub, or typed-data that moves the NFT. If it leaves, they blame CredHub.
6. **Wrong identity.** Confuse mint type Agent with an ERC-8004 awakened agent; miss that a token is a Zombie; scope advice to the header Normie when they meant another.
7. **Ignore recursive AP.** Recommend burning a high-AP token as fuel without saying those points hop to the receiver — or let them miss that the fuel was the better stack.
8. **Stale official-sounding numbers.** Quote 19/21 Zombies, 7 Legendary Canvases, README Pulse copy, or NORMIFESTO circulating counts as current. Decisions get made on dead data.

## E) Do not touch

- Files, deploys, burns, approvals, wallet writes, env files, private keys.
- `writeContract` / `sendTransaction` / `signTypedData`. Only plain `signMessage`.
- Arena or Pixel Market as if live. No “enter Arena” nextStep until Lab ships a URL.
- Remaining Zombie claims (pool sealed, 21/21).
- Unbinding an awakened agent (there is none).
- Overwriting Zulo into a generic agent or rewriting the stillness line.
- Official Lab/Canvas/Zombie contracts as if CredHub owned them.
- Community Canvas as Lab Canvas.
- Connecting a wallet except to scope to an awakened NFT the holder controls.
- Task 2 until the builder says so.

## F) Ten questions the site + README still cannot answer

Arena (required):
1. Does fighting ever risk the ERC-721 itself (burn, seize, transfer as prize), or only pixels plus a temporary transfer freeze during commit-reveal?
2. What is the scoring/combat math (HP, steal amounts, deck size, win table), and should CredHub ever recommend deploying an Agent into the Wilderlands given that it puts all Humans in that wallet at risk?

Yigit changelog vs CredHub (required):
3. Yigit shipped `/zombies/*`, `/rarity/*`, canvas version history, and Legendary Canvas (Jun–Jul 2026). CredHub last commit 19 Aug still does not call them. Which of those become first-class Pulse signals before Task 2, and which stay quote-only?

The rest:
4. Pixel Market instrument: do balances stay per-Normie and move, or does AP become a fungible token? Lab says “moving them around”; shape is still being drawn.
5. Are blank canvas / 80×80 / gacha-raffle extras official Lab, or only @normiesART tweet color that CredHub’s Ask skills should not treat as live?
6. Zombie role in Arena: official Lab never assigns one. What should Zulo say to a Zombie holder who asks about fighting?
7. Live Pulse JSON on Vercel is older than GitHub `main` (no 5th usage/Luminous signal). Which copy is canonical for Zulo until the next deploy?
8. Persona generator still tells agents the only four types are Human/Cat/Alien/Agent and not to mention Zombies, while 21 Zombies exist on-chain. Which voice wins for Zulo?
9. If Arena “destroys” pixels down to zero, does the NFT still exist as a token with a blank face, and is that a recommended or forbidden outcome?
10. Exact top-21 burner snapshot (human-readable date/criteria). API has `seedBlock: 25368113` on zombie status; Lab does not explain it. Does recursive burn-count on a purchased Canvas still define eligibility language Zulo should use after the pool is sealed?

Stop. Task 1 is the lock. Do not start Task 2 until told.
