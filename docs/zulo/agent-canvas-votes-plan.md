# Plan: agent canvas feedback and votes (a possible new CredHub sector)

Drafted 2026-10-19 (ChST) by GrokBot. **Plan only, no code.** Follows `AGENTS.md` and `docs/zulo/strategy.md`. Product status still comes only from `lib/official-status.ts`.

**Trigger:** serc on 2026-10-19 06:36 ChST (https://x.com/serc1n/status/2111919283399717274): "256x256 grid, a Normie agent created this canvas, The Unedited Street … Now, other agents will check this canvas and give feedback, vote." This is a **teaser / early feature**. It is not an official launch, and we have no official data source for it.

## What exists today (read-only check, 2026-10-19)
- `https://api.normies.art/llms.txt` lists **no** feedback, vote, critic, review or rating routes. Its sections are Normie, Canvas, Pixels/Market, history/indexer, Legendary Canvas, ERC-8004 Agents and Rarity.
- `GET /agents/info/{tokenId}` returns `interactions: {"status": "coming_soon"}` and `mcp: {"status": "coming_soon"}`. These are placeholders, and the only official hint that agent-to-agent activity is planned.
- Documented canvases are 40x40 and can be enlarged to 80x80 at most (`/normie/{id}/canvas/info` → `gridSize`). A 256x256 canvas is **not** in the documented API, so it may be a separate surface.
- Canvas data we already read: `/normie/{id}/canvas/info` (level, pixels, customized, delegate) and `/canvas/token/{id}/activity` (pixel-ledger events). Neither carries feedback or votes.
- In the NCH repo, `lib/` has **no** canvas-feedback or vote hooks. Here is what does exist:
  - `lib/record-card/` reads `canvas/info`.
  - `lib/signals.ts` has `buildCanvasSignal`, which is activity only.
  - `lib/chat-ratings/` handles Hive chat stars, with zero weight and one vote per wallet.
  - `recommendation_feedback` is Path Board feedback on Zulo's answers and has nothing to do with this.

## Why
Once agents judge each other's canvases, the next question is **which voters to trust**. That's the reputation layer, and it is NCH's lane. We don't judge the art. We keep a verified record of who votes, how much their votes count, and how their own canvases are received.

## Signals (kept separate, like Pulse, sector ranks and chat ratings)
| Signal | Answers | Built from | Ranks? |
| --- | --- | --- | --- |
| **Critic record** | "Do this agent's votes hold up?" Its votes compared with the final outcome or consensus over time | Verified official vote data only | Not until gated: minimum sample (e.g. ≥ 20 votes over ≥ 5 canvases, tune later), raw counts beside any score |
| **Creator record** | "How are this agent's canvases received?" | Official vote and feedback totals per canvas | Same: minimum sample, raw counts shown |
| Chat or self-reported feedback | "What are people saying?" | Hive chat, posts, screenshots | Never. Shown, labelled, zero weight |

**Rules for voters**
- **Pulse trust gate.** Only votes from agents that pass the Pulse gate ("ERC-8004 registered" + "Clean ownership & delegation") count toward any score. Votes from other agents are shown with **zero weight**. The gate is never a level threshold.
- **One vote per agent per canvas.** No weight for repeat or edited votes beyond the official final one.
- **Sybil notes:**
  - Agents with the same owner count as one voter, and so do agents under one Canvas delegate or ERC-8004 registrant. They also get zero weight on their own owner's canvases.
  - Flag delegate clusters, where many agents share a hot wallet or registrant.
  - Use only the owner and delegate data we already read (`canvas/info`, owner). Never map wallets to people.
- Pulse stays trust, never skill. Critic and Creator records never move Pulse.

## Record card
- Add a **"Canvas feedback"** section that reads `pending`, with a `pending_reason` of "No official canvas feedback or vote data yet". This follows the same pattern as Arena (`sectors.arena`, `card_status` text).
- Once data exists, show critic and creator raw counts (votes cast, canvases judged, votes received) before any score. The source and `as_of` go on every field.
- Fields are additive in code. Don't touch `public/.well-known/ai-tool/*.json`, because those hashes are pinned.

## Data needed before Phase 1
- **Official source:** an `api.normies.art` route listed in `llms.txt`, or on-chain events, or official docs.
- **Fields:**
  - Canvas id and creator agent id or token
  - Voter agent id or token
  - Vote value and any rubric
  - Feedback text (shown, never scored)
  - Timestamp
  - Round or outcome, if one exists
  - Whether a vote can change
- **Gate to start:** the feature is announced as official (@normiesART, @serc1n or normies.art) **and** the data is readable. A teaser post, screenshot or chat log is never the gate.

## Phases
| Phase | Ships | Gate to start |
| --- | --- | --- |
| 0 (now) | Status-only:<br>• a "Canvas feedback: pending" section on the record card<br>• a status entry in `lib/official-status.ts` (teaser / not live, copied lines only)<br>• weekly `llms.txt` diff for vote or feedback routes | none |
| 1 | Critic and creator records with the Pulse gate on voters, one vote per agent, sybil collapse, minimum sample, raw counts | Official vote and feedback data readable (see above) |
| 2 | Records served through Pulse / ERC-8257 first, then the site | Phase 1 has run for a while with clean data |

## Must-nots
- Customizing or painting **never earns PIXEL**. PIXEL comes only from burns or buying on the Pixel Market.
- **No art "quality" scores of our own.** We record official votes. We never grade canvases ourselves.
- Self-reported or scraped chat feedback gets **zero weight**.
- **Read-only.** No voting for or as agents, no signatures beyond plain `signMessage`, no writes.
- **Never front-run official announcements.** Until then, the copy says "teaser" or "pending" only.
- Nothing about profit, and Arena stays "Coming Soon" (copy `ARENA_STATUS_LINE`).

## Open questions (for serc or Claude)
1. Where will votes and feedback live: an `api.normies.art` route, on-chain events, or the Hive only? Will they be public?
2. Is the 256x256 canvas a new surface separate from the 40–80 px Normie canvas, and is it tied to a token id?
3. Who can vote: any registered agent, or only some? Do humans vote too?
4. Is there an outcome (a winner or round result) to measure critic accuracy against, or only consensus?
5. Is there one vote per agent per canvas, and can votes change?
6. Does the official side already handle same-owner or delegate sybils, so we don't double-count?
7. Claude: should "Canvas feedback" be a new `sectors.*` entry or a side block like `chat_rating`?
