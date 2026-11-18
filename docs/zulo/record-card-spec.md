# Normie record card — data shape (spec, docs only)

Drafted 2026-10-18 (ChST) by GrokBot; score model folded in by Claude the same day (Ryan's note on PR #100). Status: **Built** (2026-10-18/19): `/record/{tokenId}`, `GET /api/zulo/record-card/{tokenId}`, `lib/record-card/*`. Arena and Agents Canvas fields stay pending until official data exists. No Pulse changes, no chat-ratings changes.

Read with: `AGENTS.md` (rules), `docs/zulo/strategy.md` (the verified scoreboard; "Phase 1: Arena record card"), `docs/zulo/thesis-lock.md` §5–§7, `lib/official-status.ts`.

Arena status (copied from `lib/official-status.ts`, never paraphrased): **Arena = LIVE since 2026-11-14 (official: @normiesART, "Normies Arena is live now", https://x.com/normiesART/status/2121679594294030459; opt-in is open at https://arena.normies.art/world/enter; games run in rounds and Game 1 started Mon Nov 16, 20:00 CET); a fully autonomous agent game, entered at https://arena.normies.art, never on CredHub.** Arena Week 1 registration date: Saturday, November 14, 2026 (per @serc1n, https://x.com/serc1n/status/2119787233632719147, as of the 2026-11-09 post); per the same post it is a fully autonomous agent game. Registration opening isn't the Arena launch. CredHub doesn't handle registration.

Arena went live on launch weekend (2026-11-14) and its official data is public: `GET /arena/normie/{id}`, `GET /arena/status` and `GET /arena/rounds` on api.normies.art, backed by the NormiesArenaStorage contract (in `lib/official-contracts.ts`; Normies were migrated to a new storage contract at block 26421529, and the old one is listed as retired). The card reads that data (§3.2). Being entered is not a record: Arena fields stay `pending` until a Normie has played a round, and anything the official data doesn't give stays `pending` with a reason. No endpoint in this file is invented.

---

## 1. What the card is

One read-only card per Normie that has been awakened as an agent, built from data anyone can check. Holders, buyers and outside agents read it before they engage. It has four parts:

1. **Identity**: which Normie this is, plus its ERC-8004 agent and its current canvas state. Live today.
2. **Arena record**: matches and results. Pending until Arena ships at an official URL with docs or an API.
3. **Context**: owner, delegate and canvas version, so a reader knows who controls the Normie and when it changed hands.
4. **Side panels that are never counted**: "Chat rating" (Hive) and "Self-reported" claims. They are shown, and they carry zero weight toward rank or the Pulse level.

The card is a **track record, never a tip.** DYOR appears on every ranked view.

**Scores on the card** (Ryan's score model, 2026-10-18; see `docs/zulo/strategy.md` "How the scores fit together"):

- **Pulse = trust, not skill.** It answers "can I trust this agent?" and is the **gate** for any sector rank.
- **Sector ranks = skill**, one per sector (Arena, Trading, Tools/utility), verified data only, each with its own minimum sample. This spec defines the **Arena** sector; Trading and Tools/utility get their own specs once a verified source exists.
- **Chat rating = community vibe**, shown beside the record, never a rank.
- **No fixed Overall rank.** If one is ever shown, the viewer picks the weights.

## 2. Sources and labels

### 2.1 Source kinds (`source.kind`)

| kind | Meaning | Examples in this repo |
| --- | --- | --- |
| `onchain` | Read straight from an Ethereum contract with a view call or event log | Normies `0x9Eb6…2438`, NormiesCanvasV2 / NormiesCanvasStorageV2, ERC-8004 Identity `0x8004A169…a432` and Reputation `0x8004BAa1…9b63` (`constants/contracts.ts`) |
| `official_api` | An `api.normies.art` route listed in `llms.txt` | `/normie/{id}/canvas/info`, `/agents/binding/{tokenId}` |
| `nch_computed` | Worked out by NCH **only** from `onchain` / `official_api` inputs, with the formula documented here | win rate, streaks, ranked score |
| `self_reported` | Said by the owner, the agent or anyone else: posts, screenshots, swarm chat, a form | serc's 1-hour swarm chart (thesis lock §5) |
| `chat_rating` | Hive chat stars from the ERC-8004 Reputation Registry (tag2 `hive-chat`), loaded by `lib/chat-ratings/load.ts` | `ChatRatingsSummary` |

### 2.2 Field label (`label`)

Every field carries one plain-word label:

- **`verified`**: the source is `onchain` or `official_api`, or it is `nch_computed` where every input is verified. Only verified fields can count toward rank.
  Exception — Arena Canvas rank: verified by Ryan's call, Nov 11, 2026 (the Level is from the official API); rank names per the official Arena entry page (https://arena.normies.art/world/enter), may change.
- **`self-reported`**: the source is `self_reported`. Always shown with the words "Self-reported" and the date. Weight 0.
- **`chat-rating`**: the source is `chat_rating`. Shown only in the "Chat rating" panel. Weight 0 for rank. It **never** changes `pulse_level` (AGENTS.md, thesis lock §6). The data is on-chain, but it measures how good the chats were, not how well the agent performed, so it is never mixed into the record.
- **`pending`**: no official source exists yet. Value is `null`, and `pending_reason` says why (for example `"Arena not live"`).
- **`unavailable`**: the source exists but the read failed or timed out. Value is `null`. Show "unavailable", never 0. This copies `available: false` in chat ratings.

Rule: a value never gets promoted. A self-reported number does not become verified by being repeated, cached, or matched against a screenshot. Third-party indexers (8004scan, Levanto Labs "Sage", unnamed venues) count as `self_reported` until the Normies team names them as official.

### 2.3 Card label (`card_status`)

Exactly one, checked in this order:

| card_status | When | Plain-word UI text |
| --- | --- | --- |
| `not_awakened` | No ERC-8004 binding for the token | "Not an awakened agent, so no record card" |
| `burned` | The token is burned (`/history/burned/{tokenId}` returns a record) | "Burned. Record frozen at burn." |
| `arena_not_live` | `OFFICIAL_STATUS.arena.status !== "LIVE"` (not the case since 2026-11-14; kept so the card fails closed if the status ever changes) | "Arena isn't live, so there's no record" (identity and context still show) |
| `arena_source_pending` | Arena is live but the official Arena data couldn't be read (404, a failed or malformed read) | "Arena data is unavailable right now" |
| `stale` | The record's `as_of` is past its stale limit (§5) | "Record out of date, refreshing" |
| `unranked` | Arena is live, but the minimum sample (§4) isn't met. The text comes from the Arena sector's own status: not entered, registered or entered, or building a record | "Not entered in Arena" / "Registered. It plays from Round N. It hasn't played a round yet, so there's no record" (N = `registeredRound` + 1) / "Building a record: X rounds played" / "Playing Round N now: X rounds counted so far" (while the round it last played is open per `GET /arena/status`; wins is then labelled `round in progress`) |
| `ranked` | Arena is live, the sample is met, and every ranked input is `verified` and fresh | "Verified record" |

Today every awakened Normie's card is `arena_not_live`.

## 3. Fields

Types are TypeScript-style. Each value is wrapped as:

```ts
type Field<T> = {
  value: T | null
  label: "verified" | "self-reported" | "chat-rating" | "pending" | "unavailable" | "round in progress"
  source: { kind: SourceKind; ref: string }   // ref = contract+function, API path, or formula id
  as_of: string                               // ISO-8601 UTC, when NCH read it
  source_block?: number                       // when the source gives a block
  pending_reason?: string
}
```

### 3.1 Identity (live today)

| Field | Type | Source (kind: ref) | Label today | Notes |
| --- | --- | --- | --- | --- |
| `token_id` | `number` (0–9999) | input, validated by `parseTokenId` (`lib/api/agent-pulse.ts`) | verified | |
| `agent_id` | `number` | official_api: `GET /agents/binding/{tokenId}` → `binding.agentId`; cross-check onchain: ERC-8004 Identity `ownerOf(agentId)` / `tokenURI(agentId)` (as `isErc8004Registered` does) | verified | The binding follows the NFT, and there is no unbind |
| `awakened_at` | `string` (ISO) | official_api: `/agents/binding/{tokenId}` → `binding.timestamp`, `blockNumber`, `txHash` | verified | |
| `agent_name` | `string` | official_api: `GET /agents/identity/{tokenId}` → `name` | verified | |
| `mint_type` | `"Human" \| "Cat" \| "Alien" \| "Agent"` | official_api: `/agents/identity/{tokenId}` → `type` (fallback `/normie/{id}/traits` Type; both hold the mint traits) | verified | What it was minted as. Mint type "Agent" is **not** the same as awakened (failure mode 6). A Zombie keeps its mint type here |
| `type` | string, e.g. `"Zombie"` | official_api: `/normie/{id}/metadata` → `Type` attribute (only; a `/traits` fallback is never used as the current type) | verified | What it is now (added 2026-10-20). Differs from `mint_type` for Zombies: #2 is `type` Zombie, `mint_type` Human. UI shows "Type: Zombie (minted Human)" when they differ, plain "Type: Human" when they match |
| `is_zombie` | `boolean` | official_api: `GET /normie/{id}/zombie` → `info.isZombie` | verified | Zombies: 21/21 sealed, not Arena, nothing to claim |
| `level` | `number` | official_api: `GET /normie/{id}/canvas/info` → `level` | verified | UI label "Level" |
| `pixels_attached` | `number` | official_api: `/normie/{id}/canvas/info` → `actionPoints` (same as `/canvas/token/{id}/pixels` `attached`) | verified | UI label "Pixels on this Normie (action points)". Never a bare "AP" |
| `pixels_locked` / `pixels_free` | `number` | official_api: `/normie/{id}/canvas/info` → `lockedPixels`, `freePixels` | verified | |
| `arena_canvas_rank` | `string` + `counts_toward_rank: false`, `from_level`, `source_url`, `source_published`, `note` | nch_computed: Level (`/normie/{id}/canvas/info`) → rank names per the official Arena entry page (`lib/normies-canon.ts`) | verified (unavailable without a Level) | UI label "Arena Canvas rank". Name only; top band shown as "Level 150+ (top Arena rank)". A label, not a score: never counts toward a rank or Pulse. Not on the share image. The next rank's Level is shown on /burn only |
| `image_url` | `string` | official_api: `/normie/{id}/image.svg` | verified | |

### 3.2 Arena record (official data since 2026-11-14)

**Built (PR-4, Claude):** `lib/record-card/arena.ts` reads `GET /arena/normie/{id}` (and `GET /arena/status` to know whether any round has started). Real responses are pinned in `lib/record-card/fixtures/`. What the card shows today:

| Card field | Official field | Label |
| --- | --- | --- |
| `sectors.arena.entry.entered` | `registered`, or `roundsPlayed` > 0, or `inCurrentRound` | verified |
| `sectors.arena.entry.in_line` | none since the launch-weekend migration (block 26421529) | pending ("not in official data") |
| `sectors.arena.entry.line_position` | none since the launch-weekend migration (block 26421529) | pending ("not in official data") |
| `sectors.arena.record.matches` | `roundsPlayed` (rounds, shown as "Rounds played") | pending until a round is played, then verified |
| `sectors.arena.record.wins` | `wins` | pending until a round is played, then verified |
| `sectors.arena.record.losses` | none | pending: the official data doesn't publish losses |
| `sectors.arena.record.pixels_net` | none used | pending: shown once a round has ended and its results are official (per-Normie results wait for an ended round's real shape; until then the API's `pixelsWon`, `pixelsCharged`, `pixelsRefunded`, `balance`, `deposited` and `withdrawn` are not shown or netted) |
| `sectors.arena.record.last_match_at` | `lastRound` is a round number, not a time | pending |

`sectors.arena.entry.state` (official `state` in plain words: active, short, cleared, not registered), `entry.agent_id` (official `agentId`) and `entry.skins` (a count): verified, from `GET /arena/normie/{id}`, when the official data gives them. Every Arena read goes through `lib/arena-api.ts` (allowlisted paths, a shared 60 s cache, backoff on 429/503 and on repeated failures).

`sectors.arena.profile_url`: the Normie's life page on the Arena site (`arena.normies.art/world/normie/<id>`), once entered. `sectors.arena.skin_image_url`: its Arena skin (`arena.normies.art/api/world/skin/png?id=<id>`, the Arena app's own image route, not in the API docs), only when the official API counts at least one skin; the viewer's browser loads it and the page hides it if it fails. The skin's price is never shown.

`sectors.arena.round_history` (optional, added 2026-11-17, Claude; `lib/record-card/arena-rounds.ts`): the Normie's rounds from `GET /arena/normie/{id}/rounds`, read only for an entered Normie whose Arena state was read.

| Field | Meaning |
|---|---|
| `status` | `ok` (rounds listed), `empty` (the official list has no rounds), `not_found` (404: no list for this Normie), `unavailable` (couldn't read it). The four are never merged |
| `status_text` | The same in plain words |
| `rounds[]` | Newest first, sorted by NCH by round number (the list's own order isn't trusted). Each: `round`, `state` (`in_progress`, `ended`, `cancelled`, `not_started`, `unreadable`), `played` (official `played`, null when unreadable), `text`, `date` (official `timestamp` as ISO-8601 UTC, or null) |
| `totals` | Raw counts that add up to `listed`: `played` and `did_not_play` (finished rounds only), `in_progress`, `cancelled`, `not_started`, `unreadable`. Null when the list wasn't read |
| `complete` | False when the official data had more rounds than NCH reads (at most `max_pages` = 2 pages, paged by `offset`) |
| `source`, `as_of` | "Official Arena data (api.normies.art)", the route, and when NCH read it |

Round texts: an open round is "Round in progress" (never an ending, never a win); a finished round is "Played" or "Did not play"; "Round cancelled" and "Not started yet" follow the official status. Any status other than `open`, `upcoming`, `ended` or `cancelled`, or a `played` that isn't true/false, is "Couldn't read this round". There is no per-round win: `payoutOrder`, `prize` and `refund` are never read and nothing is inferred from them; total wins still come only from `wins` on `GET /arena/normie/{id}`. No amounts (`charged`, `prize`, `refund`, `pool`) are read. If any page can't be read the whole block is `unavailable`, and the API route then answers `Cache-Control: no-store`. Seen in real data so far: one round, status `open` (fixture `arena-normie-7141-rounds.json`); `ended`, `cancelled`, `played: false` and a second page are covered by synthetic tests only.

### 3.2a Live Arena feed (built 2026-11-18, Claude: `lib/arena-live/`)

`sectors.arena.live` (optional, additive): what the Arena site itself reports for this Normie right now. It is the Arena's own live standing, shown as reported. It is not an NCH rank, it never counts toward a sector rank or Pulse, and it can change until the round ends. Source: the Arena app's public GET routes on `arena.normies.art` (a different host from the official `api.normies.art`), read by a small loader in `lib/arena-live/` with a 5 s timeout and a 60 s cache. The block carries its source routes and read time. If any of the three reads fails, or any field is missing, renamed or has a different type from the one seen (a string where a number was), the whole block is `status: "unavailable"` ("Live Arena data unavailable"): no part block and never zeros. The reader (`lib/arena-live/api.ts`) follows `lib/arena-api.ts`: three fixed routes, the same 60 s shared cache, User-Agent, byte cap, backoff on 429/503 with Retry-After and a pause after three failures. Known gap: the record card page and its JSON route are themselves cached for up to 5 minutes, so an "unavailable" block can be served for that long (same backlog item as the round list).

| Field | From (seen in a live response, 2026-11-18) | Notes |
|---|---|---|
| `live_rank` | `rank` and `of` | Shown as "#280 of 748". The Arena's rank in the current game |
| `live_score_px` | `px` | Arena PX: the game's own score/currency (official Arena guide). It is not #PIXEL and is never converted |
| `where`, `where_text`, `back_at` | `where`, `back` | `playing` ("On the map") or `resting` ("Resting"), both seen live. A row may also carry `doing` and, for a top row, a `prize` figure for "if it ended now"; neither is read. `back` (a time in milliseconds) is when a resting Normie is due back |
| `kills`, `deaths`, `duels_won` | `stats.kills`, `stats.deaths`, `stats.agentKills` | Counts. `duels_won` = `agentKills` |
| `round.game`, `round.phase`, `round.ends_at`, `round.players` | `game`, `phase`, `end` (milliseconds), `roundPlayers` | `ends_at` is stored as ISO-8601 UTC and shown in the viewer's local time by the browser. `phase` is one lower-case word shown as reported (only `live` has been seen) |
| `status_text`, `note` | written by NCH | "The Arena currently reports #N of M"; "The Arena's own live standing, as reported. Not an NCH rank. It can change until the round ends." |

Routes: `GET /api/world/normie/{id}` is listed in the Arena site's own `llms.txt`. `GET /api/world/standing?ids={id}` and `GET /api/world/arena-week` are public and need no login, but are **not** listed there, so they may change without notice; the loader treats any unexpected shape as unavailable.

**Not included, on purpose:**
- **Per-Normie prizes, for now.** `AGENTS.md` ("Numbers yes, advice never", 2026-11-18) allows prizes a Normie actually won, but they wait until an ended round's real shape has been seen. The current round's pool total is shown: see §3.2b.
- **The live board's and the standing row's `prize` and `share`.** While a game is live (`live: true`, `sealed: false`) `GET /api/world/arena-week/board` and top rows of `standing` carry a `prize` figure. That is a figure for "if it ended now", not a payout, so it is never read or shown.
- `worth`, `passPrice`, `entryFees`, `sponsorship`, `entryPrice` and anything in ETH or USD: never read.
- `level` in the Arena response is the Canvas level; it stays in the identity block and is never presented as an Arena record.
- The `/api/world/live` stream, wallet-signed POST routes and admin routes are never called.

### 3.2b Current round pool (built 2026-11-18, Claude)

`sectors.arena.round_pool` (optional, additive): the current open round's pool total, as the official API reports it. Rule: `AGENTS.md` "Numbers yes, advice never".

| Field | Meaning |
|---|---|
| `round`, `amount`, `unit` | The round number, the pool as a whole number, and `"#PIXEL"`. The official docs (api.normies.art/llms.txt, "## Arena") say "Amounts are #PIXEL as strings" and `pool` = `sponsorship` + `fees` |
| `text` | "Current round pool: N #PIXEL (sponsorship plus entry fees, as reported by api.normies.art, as of <time>; can change until the round ends)" |
| `note` | "The whole round's pool as officially reported, not any one Normie's." |
| `source`, `as_of` | `GET /arena/status → round.pool`, "Official Arena data (api.normies.art)", the link `https://api.normies.art/arena/status`, and when NCH read it |

Source: `GET /arena/status` on the official API, the read the card already makes once, so it costs no extra request; the Arena site's routes are not used for it. Strict (`parseArenaRoundPool`): shown only while `round.round` equals `currentRound`, the round has started and has not ended or been cancelled, and `pool` is a whole number or a string of digits; otherwise there is no block (never zero). It is the only money field read from that response: `prizes`, `sponsorship`, `fees`, `paid`, `refunds` and `totals` are not. Set only for an entered Normie.

Never: calling it a prize or a jackpot, dividing it, a projected per-Normie prize or share, returns math, comparing a fee with it, converting it to ETH or dollars, or any wording that nudges someone to pay, enter or top up. The wallet check page and `/api/arena-wallet` show no pool, prize or winnings at all (they would add up to wallet-level winnings). Settled per-Normie prizes are a later build.

`sectors.arena.watch_url`: the official watch link (`arena.normies.art/world/pixel?follow=<id>`, per the official Arena guide), set once a Normie is entered or has played.

Sector `status` is one of `not_live`, `source_pending`, `not_entered`, `entered` (entered, no round played: not a record), `unranked`, `ranked`. Ranking is off until 10 rounds and 14 days since the Normie's first round (`ARENA_RANK_MINIMUM` in `lib/record-card/arena.ts`, the one minimum, also used by the Arena rank page; changed 2026-11-17, Ryan: the opponents rule was dropped because the official data has no opponent counts). The card itself never ranks; ranks are shown on `/arena/rank`.

The table below is the original pre-launch proposal, kept for the fields not built yet. Field names there are **proposed**. `docs/zulo/strategy.md` Phase 1 lists "rounds, survival, PIXEL earned, duels won", and the brief for this spec lists wins, losses and pixels stolen. Both sets are kept here until the official vocabulary is known (see open questions).

| Field | Type | Planned source | Label today |
| --- | --- | --- | --- |
| `matches` | `number` | proposed: official Arena API or contract events | pending: Arena not live |
| `wins` / `losses` / `draws` | `number` | proposed: official Arena API or contract events | pending: Arena not live |
| `duels_won` | `number` | proposed: official (strategy.md term; may be the same as `wins`) | pending: Arena not live |
| `rounds_played` / `rounds_survived` | `number` | proposed: official | pending: Arena not live |
| `pixels_won` / `pixels_lost` | `number` | proposed: official Arena data; cross-check against `/canvas/token/{id}/activity` ledger events once Arena event kinds appear there | pending: Arena not live |
| `pixels_net` | `number` | nch_computed: `pixels_won − pixels_lost` | pending |
| `win_rate` | `number` (0–1) | nch_computed: `wins / matches` (draws count as not-wins; shown raw beside it) | pending |
| `current_streak` | `{ kind: "win" \| "loss" \| "draw"; length: number }` | nch_computed from the ordered official match list | pending |
| `best_win_streak` | `number` | nch_computed | pending |
| `distinct_opponents` | `number` | nch_computed: unique opponent token IDs whose owners (`/normie/{id}/owner` at match time) differ from this Normie's owner | pending |
| `first_match_at` / `last_match_at` | `string` (ISO) | proposed: official match timestamps / block times | pending |
| `frozen` | `boolean` | proposed: official (thesis lock open question 1 mentions a "temporary freeze") | pending |

No record field may come from `self_reported` or `chat_rating`. If the official source gives a total but not a match list, the streak and opponent fields stay `pending` rather than being guessed.

### 3.3 Context

| Field | Type | Source | Label |
| --- | --- | --- | --- |
| `owner` | `address` | official_api: `GET /normie/{id}/owner` (cross-check onchain Normies `ownerOf`) | verified |
| `owner_since` | `string` (ISO) | proposed: onchain Normies `Transfer` logs (latest transfer to `owner`) | proposed |
| `canvas_delegate` / `canvas_delegate_set_by` | `address \| null` | official_api: `/normie/{id}/canvas/info` → `delegate`, `delegateSetBy` (zero address is shown as `null`). `GET /delegations/{address}` lists only delegations NormiesCanvas still honours | verified |
| `delegate_xyz_vault` | `address \| null` | onchain: delegate.xyz V1/V2 registries via `lib/delegations.ts` | verified |
| `canvas_version` | `number` | official_api: `GET /history/normie/{id}/versions` → latest `version` | verified |
| `grid_size` | `40 \| 50 \| 60 \| 70 \| 80` | official_api: `/normie/{id}/canvas/info` → `gridSize` | verified |
| `base_cleared` / `customized` | `boolean` | official_api: `/normie/{id}/canvas/info` → `baseCleared`, `customized` | verified |
| `token_wallet` (ERC-6551) | `address` | nch_computed: ERC-6551 registry `account()` view, Tokenbound V3 defaults (`lib/erc6551/`) | proposed. A deterministic address, **not** proof that the agent trades from it (thesis lock open question 7). Phase 2 only |

### 3.4 Side panels (zero weight)

**Pulse block.** `pulse` carries `level`, `max_level`, `status`, `breakdown`, `next_signal` (added 2026-10-18; the trust checks still missing; null when all four pass), `popularity` (added 2026-10-19; the raw distinct-caller counts), `agent_card` (added 2026-11-14; the evidence behind "Has active agent card": `checked`, `passed`, `card_hash`, `as_of`, and a `reason` when it didn't pass; it means the card is published and names this agent, not that the agent is online), `trending` (added 2026-11-14; the "Trending on NCH" badge, true when the popularity threshold is met; it never changes `level`, and `max_level` is 4), `gate` and `available`. The Pulse page reads the card for its live meter, so viewing the page never counts as a Pulse check.

**Agents Canvas sector** (added 2026-10-19). `sectors.canvas` follows the Arena pattern: `status` (`announced` | `source_pending` | `unranked` | `ranked`), `status_text`, `record` (`canvases_created`, `pieces_painted`, `pixels_painted`, `votes_received`, `votes_cast`, each a pending `Field` until official data exists) and `rank`. Announced by @serc1n (status in `lib/official-status.ts`). Votes count only from agents past the trust gate, one per agent; written feedback is a zero-weight side block, never scored. Plan: `docs/zulo/agent-canvas-votes-plan.md`.

**Chat rating.** Embed `ChatRatingsSummary` from `lib/chat-ratings/load.ts` exactly as it is: `label: "Chat rating"`, `ranked`, `score`, `stars`, `raw.ratings`, `raw.unique_raters`, `raw.average`, `min_unique_raters` (5), `available`. This spec does not change chat-ratings code (Claude owns it this week). The card shows it in its own panel, titled "Chat rating", with the existing note. It never feeds `record`, `rank`, or `pulse_level`.

**Self-reported.** `self_reported: Array<{ claim: string; url: string | null; reported_at: string; by: "owner" | "agent" | "third_party" }>`. Each item is shown under the heading "Self-reported, not verified" with the date. Weight 0. Proposed only: NCH collects no such data today. If it ever does, any table follows the server-only Supabase pattern from the 2026-10-18 feedback lockdown (service role, no anon policies).

**Outside signals** (Ethos, AgentCheck in `lib/api/ethos.ts` and `lib/api/agentcheck.ts`) describe the owner's wallet, not the Normie's record. They stay out of the card in v1.

## 4. Arena sector rank: gate and minimum sample (proposed numbers, tune later)

**Current rule (Ryan, 2026-11-17), which replaces items 2 to 4 and the score below:** the minimum is **10 rounds played and 14 days since the Normie's first round** (from its round history dates), both in `ARENA_RANK_MINIMUM` (`lib/record-card/arena.ts`), the only minimum in the code. There is no opponents rule: the official data has no opponent counts. Rank order, for Normies past the minimum and the Pulse gate: **win rate (wins ÷ rounds played); ties go to more rounds played**; raw wins and rounds beside every rank. Not total wins first, since that rewards playing more paid rounds. Step 1 (`/arena/rank`, `lib/arena-rank/`) lists agents and applies the minimum but ranks nobody; the gate results come from a cron-filled table in step 2. The older proposal is kept below for history.

A card gets an Arena sector rank only if **all** of these are true:

0. **It clears the Pulse gate.** Decided (Ryan, 2026-10-18): the gate is the two trust signals — "ERC-8004 registered" **and** "Clean ownership & delegation" both present in the Pulse breakdown — not a Pulse level number. The level also counts canvas activity and recent usage, which say nothing about trust, so a level threshold would shut out a trustworthy agent with an untouched canvas.
1. Arena is officially live (`lib/official-status.ts`).
2. **≥ 10 verified matches** in the ranking window.
3. **≥ 5 distinct opponents** owned by wallets other than this Normie's owner (stops someone farming wins against their own Normies; same idea as chat ratings' 5 different wallets).
4. **Window ≥ 14 days** between the first and last counted match. Leaderboards use a rolling 30-day window, with all-time shown beside it. No one-hour or one-day leaderboards (thesis lock §5).
5. Every ranked input is `verified` and fresh (§5).

The proposed ranked score is the lower bound of the Wilson 95% interval on the win rate, so thin records can't top the board. Ties are broken by `pixels_net`, then by `matches`. The score always ships with raw `matches / wins / losses / draws / pixels_net` beside it. On launch these knobs move into a proposed `lib/record-card/config.ts`, the same pattern as `lib/chat-ratings/config.ts`, and tuning happens there, not in the math.

There is no Overall rank across sectors. A Normie can be ranked in Arena and unranked everywhere else; each sector shows its own rank or its own "building a record" line.

**Unranked display:** show raw counts with the line "Building a record: X of 10 verified matches, Y of 5 opponents, Z of 14 days". No rank number and no stars. Unranked cards are left off leaderboards entirely, not sorted to the bottom.

## 5. "As of" timestamps and staleness

- Every field has `as_of` (when NCH read it). The card has `as_of` = the **oldest** `as_of` of its ranked inputs, plus `generated_at`.
- Stale limits are proposed and based on `llms.txt` cache headers:

| Group | Upstream cache | Stale after |
| --- | --- | --- |
| Owner, delegate, pixels | 10–60 s | 15 min |
| Agent binding, identity, zombie | 60–600 s | 24 h |
| Canvas version history | 60–300 s | 1 h |
| Arena record | unknown | 30 min (confirm on launch) |
| Chat rating | NCH cache 5 min (`limits.cacheMs`) | 1 h |

- A stale card shows the `as_of` time and the word "stale", and drops off leaderboards until it is refreshed. A value is never shown without its `as_of`.
- Owner changes: the record stays with the Normie (the agent binding follows the NFT). The card shows "Owner changed on {owner_since}".
- Burned: the card freezes at the burn block and shows `burned`.

## 6. Example card (EXAMPLE DATA)

Identity and context are real reads of Zulo (#7141) from api.normies.art on 2026-10-18. The Arena part of this example predates launch (it shows the fail-closed `arena_not_live` shape); the live shape is in §3.2 and `lib/record-card/fixtures/`. `chat_rating` values are placeholders, not a real read.

```json
{
  "_example": "EXAMPLE DATA. Shape illustration only, not an API response.",
  "spec_version": "0.1-draft",
  "token_id": 7141,
  "card_status": "arena_not_live",
  "card_status_text": "Arena isn't live yet, so there's no record",
  "generated_at": "2026-10-17T23:54:21Z",
  "as_of": "2026-10-17T23:54:21Z",
  "identity": {
    "agent_id":        { "value": 32626, "label": "verified", "source": { "kind": "official_api", "ref": "GET /agents/binding/7141" }, "as_of": "2026-10-17T23:54:21Z", "source_block": 25103790 },
    "awakened_at":     { "value": "2026-05-15T23:17:59Z", "label": "verified", "source": { "kind": "official_api", "ref": "GET /agents/binding/7141" }, "as_of": "2026-10-17T23:54:21Z" },
    "agent_name":      { "value": "Zulo", "label": "verified", "source": { "kind": "official_api", "ref": "GET /agents/identity/7141" }, "as_of": "2026-10-17T23:54:21Z" },
    "mint_type":       { "value": "Human", "label": "verified", "source": { "kind": "official_api", "ref": "GET /agents/identity/7141" }, "as_of": "2026-10-17T23:54:21Z" },
    "is_zombie":       { "value": false, "label": "verified", "source": { "kind": "official_api", "ref": "GET /normie/7141/zombie" }, "as_of": "2026-10-17T23:54:21Z" },
    "level":           { "value": 2, "label": "verified", "source": { "kind": "official_api", "ref": "GET /normie/7141/canvas/info" }, "as_of": "2026-10-17T23:54:21Z" },
    "pixels_attached": { "value": 12, "label": "verified", "source": { "kind": "official_api", "ref": "GET /normie/7141/canvas/info" }, "as_of": "2026-10-17T23:54:21Z" }
  },
  "record": {
    "matches":        { "value": null, "label": "pending", "pending_reason": "Arena not live", "source": { "kind": "official_api", "ref": "proposed: official Arena source TBD" }, "as_of": "2026-10-17T23:54:21Z" },
    "wins":           { "value": null, "label": "pending", "pending_reason": "Arena not live", "source": { "kind": "official_api", "ref": "proposed" }, "as_of": "2026-10-17T23:54:21Z" },
    "losses":         { "value": null, "label": "pending", "pending_reason": "Arena not live", "source": { "kind": "official_api", "ref": "proposed" }, "as_of": "2026-10-17T23:54:21Z" },
    "pixels_net":     { "value": null, "label": "pending", "pending_reason": "Arena not live", "source": { "kind": "nch_computed", "ref": "pixels_won - pixels_lost" }, "as_of": "2026-10-17T23:54:21Z" },
    "last_match_at":  { "value": null, "label": "pending", "pending_reason": "Arena not live", "source": { "kind": "official_api", "ref": "proposed" }, "as_of": "2026-10-17T23:54:21Z" }
  },
  "rank": { "ranked": false, "score": null, "reason": "Arena not live", "sample": { "matches": 0, "min_matches": 10, "distinct_opponents": 0, "min_opponents": 5, "window_days": 0, "min_window_days": 14 } },
  "context": {
    "owner":                  { "value": "0xfafd8fb6b4e43ace0e365553f1b9242384591031", "label": "verified", "source": { "kind": "official_api", "ref": "GET /normie/7141/owner" }, "as_of": "2026-10-17T23:54:21Z" },
    "canvas_delegate":        { "value": "0xb8792e6516b88e73ed0723f8c1c8a92531a98767", "label": "verified", "source": { "kind": "official_api", "ref": "GET /normie/7141/canvas/info" }, "as_of": "2026-10-17T23:54:21Z" },
    "grid_size":              { "value": 40, "label": "verified", "source": { "kind": "official_api", "ref": "GET /normie/7141/canvas/info" }, "as_of": "2026-10-17T23:54:21Z" },
    "customized":             { "value": false, "label": "verified", "source": { "kind": "official_api", "ref": "GET /normie/7141/canvas/info" }, "as_of": "2026-10-17T23:54:21Z" }
  },
  "chat_rating": { "label": "Chat rating", "counts_toward_rank": false, "counts_toward_pulse": false, "ranked": false, "score": null, "raw": { "ratings": 0, "unique_raters": 0, "average": null }, "min_unique_raters": 5, "available": true },
  "self_reported": [],
  "disclaimer": "Track record, not a tip. Read-only. DYOR."
}
```

## 7. Out of scope / non-goals

- **No trading signals, tips, copy buttons or "buy a Normie to profit" framing.** Agent trading is a TEASER (thesis lock §5). A trading record is Phase 2 and needs its own spec once official agent-wallet docs or an API exist.
- **Read-only.** No writes of any kind. The only signature allowed anywhere in NCH is a plain `signMessage` for wallet linkage. No transfers, approvals, deposits or typed-data. The card never links to a funding flow.
- **Arena is live (2026-11-14) and `lib/official-status.ts` says so.** NCH still has no "enter Arena" step: opt-in happens at arena.normies.art only. Arena numbers come from the official data only, never from teasers, and never as prizes, pools, payouts or winnings.
- **No Pulse changes in this spec.** Decided (Ryan, 2026-10-18): a *verified* Arena record **may** later move Pulse, but only as proof of real, verified activity (e.g. a "verified Arena activity" signal), never by win count. That change gets its own PR. Self-reported and chat-rating data never move Pulse.
- **No chat-ratings changes** (owned by Claude this week). No edits to `public/.well-known/ai-tool/*.json` (manifest hashes are pinned on-chain). When the card ships, it adds response fields in code only.
- **Built 2026-10-18 (Claude):** `lib/record-card/` (types, pure `build.ts`, server `load.ts`), `GET /api/zulo/record-card/{tokenId}` (JSON) and the page `/record/{tokenId}`. Identity, context, Pulse trust gate and chat rating are live; the Arena sector is pending. **Launch day:** add one `ArenaSource` adapter for the official data in `lib/record-card/arena.ts` (`ARENA_SOURCES`) and flip `lib/official-status.ts`; nothing else changes. Ranking (minimum sample, Wilson bound) lands with that adapter. ERC-8257 / Pulse fields stay a later step.

## 8. Open questions

1. Official Arena vocabulary: wins/losses/draws vs rounds/survival/duels, and is "pixels stolen" a real mechanic? This spec renames fields to match on launch day.
2. Will Arena results come from an official API, from contract events, or both? Which one wins if they disagree? (Proposed: on-chain.)
3. Do Arena pixel moves show up as new event kinds in `/canvas/token/{id}/activity`? That would give a second verified source for `pixels_won` / `pixels_lost`.
4. Can non-awakened Normies or Zombies fight? If they can, do they get a card? (Thesis lock open question 5.)
5. Does the record reset when the token changes hands? (Proposed: no. Show `owner_since`.)
6. ~~Should a verified Arena record ever move `pulse_level`?~~ Answered (Ryan, 2026-10-18): yes, only as proof of verified activity, never win count (§7).
7. Are 10 matches, 5 opponents and 14 days the right minimums? Revisit after the first two weeks of real Arena data. (Answered 2026-11-17: 10 rounds and 14 days since the first round; no opponents rule. See §4.)
8. ~~Pulse gate: trust signals or a level number?~~ Decided (Ryan, 2026-10-18): trust signals (§4 item 0).
9. Tools/utility sector: what is its verified source? ERC-8257 registrations are on-chain, but usage counts are measured by NCH itself. Needs its own spec before any rank.

Signed: GrokBot
