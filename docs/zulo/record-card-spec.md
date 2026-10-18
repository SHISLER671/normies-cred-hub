# Normie record card — data shape (spec, docs only)

Drafted 2026-10-18 (ChST) by GrokBot; score model folded in by Claude the same day (Ryan's note on PR #100). Status: **DRAFT spec, nothing built.** No code, no Pulse changes, no chat-ratings changes.

Read with: `AGENTS.md` (rules), `docs/zulo/strategy.md` (the verified scoreboard; "Phase 1: Arena record card"), `docs/zulo/thesis-lock.md` §5–§7, `lib/official-status.ts`.

Arena status (copied from `lib/official-status.ts`, never paraphrased): **Arena = Coming Soon (official docs; expected mid-November 2026 (per @serc1n, Oct 15 broadcast)); not playable on CredHub.**

So every Arena field below is **pending: Arena not live**. There is no Arena route in `https://api.normies.art/llms.txt` (checked 2026-10-18) and no Arena contract in `lib/official-contracts.ts`. No endpoint in this file is invented. Anything not yet available is marked `pending` or `proposed`.

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
| `arena_not_live` | `OFFICIAL_STATUS.arena.status !== "LIVE"` | "Arena isn't live yet, so there's no record" (identity and context still show) |
| `stale` | The record's `as_of` is past its stale limit (§5) | "Record out of date, refreshing" |
| `unranked` | Arena is live, but the minimum sample (§4) isn't met | "Building a record: X of N verified matches" |
| `ranked` | Arena is live, the sample is met, and every ranked input is `verified` and fresh | "Verified record" |

Today every awakened Normie's card is `arena_not_live`.

## 3. Fields

Types are TypeScript-style. Each value is wrapped as:

```ts
type Field<T> = {
  value: T | null
  label: "verified" | "self-reported" | "chat-rating" | "pending" | "unavailable"
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
| `agent_id` | `number` | official_api: `GET /agents/binding/{tokenId}` → `binding.agentId`; cross-check onchain: ERC-8004 Identity `ownerOf(agentId)` / `agentURI(agentId)` (as `isErc8004Registered` does) | verified | The binding follows the NFT, and there is no unbind |
| `awakened_at` | `string` (ISO) | official_api: `/agents/binding/{tokenId}` → `binding.timestamp`, `blockNumber`, `txHash` | verified | |
| `agent_name` | `string` | official_api: `GET /agents/identity/{tokenId}` → `name` | verified | |
| `mint_type` | `"Human" \| "Cat" \| "Alien" \| "Agent"` | official_api: `/agents/identity/{tokenId}` → `type` (fallback `/normie/{id}/traits` Type) | verified | UI label "Mint type". Mint type "Agent" is **not** the same as awakened (failure mode 6) |
| `is_zombie` | `boolean` | official_api: `GET /normie/{id}/zombie` → `info.isZombie` | verified | Zombies: 21/21 sealed, not Arena, nothing to claim |
| `level` | `number` | official_api: `GET /normie/{id}/canvas/info` → `level` | verified | UI label "Level" |
| `pixels_attached` | `number` | official_api: `/normie/{id}/canvas/info` → `actionPoints` (same as `/canvas/token/{id}/pixels` `attached`) | verified | UI label "Pixels on this Normie (action points)". Never a bare "AP" |
| `pixels_locked` / `pixels_free` | `number` | official_api: `/normie/{id}/canvas/info` → `lockedPixels`, `freePixels` | verified | |
| `image_url` | `string` | official_api: `/normie/{id}/image.svg` | verified | |

### 3.2 Arena record (pending: Arena not live)

Field names are **proposed**. They get renamed to match the official Arena docs on launch day. `docs/zulo/strategy.md` Phase 1 lists "rounds, survival, PIXEL earned, duels won", and the brief for this spec lists wins, losses and pixels stolen. Both sets are kept here until the official vocabulary is known (see open questions).

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

**Chat rating.** Embed `ChatRatingsSummary` from `lib/chat-ratings/load.ts` exactly as it is: `label: "Chat rating"`, `ranked`, `score`, `stars`, `raw.ratings`, `raw.unique_raters`, `raw.average`, `min_unique_raters` (5), `available`. This spec does not change chat-ratings code (Claude owns it this week). The card shows it in its own panel, titled "Chat rating", with the existing note. It never feeds `record`, `rank`, or `pulse_level`.

**Self-reported.** `self_reported: Array<{ claim: string; url: string | null; reported_at: string; by: "owner" | "agent" | "third_party" }>`. Each item is shown under the heading "Self-reported, not verified" with the date. Weight 0. Proposed only: NCH collects no such data today. If it ever does, any table follows the server-only Supabase pattern from the 2026-10-18 feedback lockdown (service role, no anon policies).

**Outside signals** (Ethos, AgentCheck in `lib/api/ethos.ts` and `lib/api/agentcheck.ts`) describe the owner's wallet, not the Normie's record. They stay out of the card in v1.

## 4. Arena sector rank: gate and minimum sample (proposed numbers, tune later)

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

Identity and context are real reads of Zulo (#7141) from api.normies.art on 2026-10-18. The record is `pending` because Arena isn't live. `chat_rating` values are placeholders, not a real read.

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
- **Arena is not live until an official URL plus docs or an API exist** and `lib/official-status.ts` is flipped. Until then, no "enter Arena" step and no Arena numbers, not even from teasers.
- **No Pulse changes in this spec.** Decided (Ryan, 2026-10-18): a *verified* Arena record **may** later move Pulse, but only as proof of real, verified activity (e.g. a "verified Arena activity" signal), never by win count. That change gets its own PR. Self-reported and chat-rating data never move Pulse.
- **No chat-ratings changes** (owned by Claude this week). No edits to `public/.well-known/ai-tool/*.json` (manifest hashes are pinned on-chain). When the card ships, it adds response fields in code only.
- No endpoints are built here. The serving route (proposed `GET /api/zulo/record-card/{tokenId}`, then ERC-8257 and Pulse as optional fields) is decided in the build PR.

## 8. Open questions

1. Official Arena vocabulary: wins/losses/draws vs rounds/survival/duels, and is "pixels stolen" a real mechanic? This spec renames fields to match on launch day.
2. Will Arena results come from an official API, from contract events, or both? Which one wins if they disagree? (Proposed: on-chain.)
3. Do Arena pixel moves show up as new event kinds in `/canvas/token/{id}/activity`? That would give a second verified source for `pixels_won` / `pixels_lost`.
4. Can non-awakened Normies or Zombies fight? If they can, do they get a card? (Thesis lock open question 5.)
5. Does the record reset when the token changes hands? (Proposed: no. Show `owner_since`.)
6. ~~Should a verified Arena record ever move `pulse_level`?~~ Answered (Ryan, 2026-10-18): yes, only as proof of verified activity, never win count (§7).
7. Are 10 matches, 5 opponents and 14 days the right minimums? Revisit after the first two weeks of real Arena data.
8. ~~Pulse gate: trust signals or a level number?~~ Decided (Ryan, 2026-10-18): trust signals (§4 item 0).
9. Tools/utility sector: what is its verified source? ERC-8257 registrations are on-chain, but usage counts are measured by NCH itself. Needs its own spec before any rank.

Signed: GrokBot
