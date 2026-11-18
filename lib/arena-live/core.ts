// Live Arena feed: strict parsers and the card block (Claude, 2026-11-18). Pure functions; the reads are in ./load.ts.
//
// What the Arena site itself reports for one Normie right now: its live standing, score and counts, and the current
// round. Rules:
//   - It is the Arena's own live standing, shown as reported. It is not an NCH rank, never counts toward a sector rank
//     or Pulse, and can change until the round ends. Nothing is predicted.
//   - Strict: each of the three responses must have exactly the fields below with the types seen in a live response.
//     A missing or renamed field, or a string where a number was seen, makes the WHOLE block "live Arena data
//     unavailable". No part block, no zeros, no guesses.
//   - No amounts: `pool`, `sponsorship`, `entryFees`, `entryPrice`, `passPrice`, `worth` and anything in ETH or USD are
//     never read. The board route (prizes) is never called. The pool total on the card comes from the official API
//     (lib/record-card/arena.ts), never from these routes.
//   - `px` is Arena PX, the game's own score and currency (official Arena guide). It is not #PIXEL and is never converted.
//   - `level` in the Arena response is the Canvas level. It is not read here and is never an Arena record.
//   - No outside text is passed through: names, titles, stories and `where` prose in the Normie route are never read.
// Field names and types come from live responses read 2026-11-18 (fixtures/): standing-7141.json, normie-7141.json,
// arena-week.json, and standing-8831-playing.json for a Normie that is on the map. Both `where` values have been seen
// live ("resting" and "playing"); only `phase: "live"` has. A standing row may also carry `doing` (a word for what the
// Normie is doing) and, for a top row, a `prize` figure for "if it ended now": neither is ever read.

import type { ArenaLive } from "@/lib/record-card/types"

export const ARENA_LIVE_SOURCE_LABEL = "Arena site live data (arena.normies.art)"
export const ARENA_LIVE_UNAVAILABLE_TEXT = "Live Arena data unavailable"
export const ARENA_LIVE_NOTE = "The Arena's own live standing, as reported. Not an NCH rank. It can change until the round ends."
export const ARENA_LIVE_REFS = (tokenId: number) => [`GET /api/world/standing?ids=${tokenId}`, `GET /api/world/normie/${tokenId}`, "GET /api/world/arena-week"]

/** A whole number that is a real JSON number. A digit string is a changed shape here, so it is refused. */
function int(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER ? v : null
}

/** Unix milliseconds in a sane range (2020 to 2100) as ISO-8601 UTC, or null. */
function isoFromMs(v: unknown): string | null {
  const ms = int(v)
  if (ms === null || ms < 1_577_836_800_000 || ms > 4_102_444_800_000) return null
  return new Date(ms).toISOString()
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** The `where` values NCH reads, both seen in live responses (2026-11-18). Anything else makes the block unavailable. */
export const ARENA_LIVE_WHERE = ["playing", "resting"] as const
export type ArenaLiveWhere = (typeof ARENA_LIVE_WHERE)[number]
export const ARENA_LIVE_WHERE_TEXT: Record<ArenaLiveWhere, string> = { playing: "On the map", resting: "Resting" }

export type LiveStanding = { game: number; rank: number; of: number; px: number; where: ArenaLiveWhere; backAt: string | null }

/**
 * Parse `GET /api/world/standing?ids={id}`. Needs `ok: true`, whole-number `game` and `of`, and under `normies[id]`:
 * `where` ("playing" or "resting"), whole-number `rank` (1..of) and `px`. `back` is read only when present: a time in
 * milliseconds, or null. Anything else is refused (null).
 */
export function parseLiveStanding(raw: unknown, tokenId: number): LiveStanding | null {
  const r = obj(raw)
  if (!r || r.ok !== true) return null
  const game = int(r.game)
  const of = int(r.of)
  const row = obj(obj(r.normies)?.[String(tokenId)])
  if (game === null || game < 1 || of === null || of < 1 || !row) return null
  const rank = int(row.rank)
  const px = int(row.px)
  if (rank === null || rank < 1 || rank > of || px === null) return null
  if (typeof row.where !== "string" || !(ARENA_LIVE_WHERE as readonly string[]).includes(row.where)) return null
  let backAt: string | null = null
  if (row.back !== undefined && row.back !== null) {
    backAt = isoFromMs(row.back)
    if (backAt === null) return null
  }
  return { game, rank, of, px, where: row.where as ArenaLiveWhere, backAt }
}

export type LiveCounts = { kills: number; deaths: number; duelsWon: number }

/**
 * Parse `GET /api/world/normie/{id}` for its counts. Needs `ok: true`, `life.id` equal to the Normie asked for, and
 * whole-number `life.stats.kills`, `deaths` and `agentKills` (shown as "duels won"). Nothing else is read.
 */
export function parseLiveCounts(raw: unknown, tokenId: number): LiveCounts | null {
  const r = obj(raw)
  if (!r || r.ok !== true) return null
  const life = obj(r.life)
  if (!life || int(life.id) !== tokenId) return null
  const stats = obj(life.stats)
  if (!stats) return null
  const kills = int(stats.kills)
  const deaths = int(stats.deaths)
  const duelsWon = int(stats.agentKills)
  if (kills === null || deaths === null || duelsWon === null) return null
  return { kills, deaths, duelsWon }
}

export type LiveRound = { game: number; phase: string; endsAt: string; players: number }

/**
 * Parse `GET /api/world/arena-week` for the current round. Needs `ok: true`, whole-number `game` and `roundPlayers`,
 * `end` as a time in milliseconds, and `phase` as one short lower-case word (shown as reported). The money fields in
 * this response are never read.
 */
export function parseLiveRound(raw: unknown): LiveRound | null {
  const r = obj(raw)
  if (!r || r.ok !== true) return null
  const game = int(r.game)
  const players = int(r.roundPlayers)
  const endsAt = isoFromMs(r.end)
  if (game === null || game < 1 || players === null || endsAt === null) return null
  if (typeof r.phase !== "string" || !/^[a-z]{1,20}$/.test(r.phase)) return null
  return { game, phase: r.phase, endsAt, players }
}

export function arenaLiveUnavailable(tokenId: number, asOf: string): ArenaLive {
  return { status: "unavailable", status_text: ARENA_LIVE_UNAVAILABLE_TEXT, source: { label: ARENA_LIVE_SOURCE_LABEL, refs: ARENA_LIVE_REFS(tokenId) }, as_of: asOf }
}

/**
 * The card block from the three raw responses. All three must parse, and the standing and the round must be for the
 * same game; otherwise the whole block is unavailable.
 */
export function buildArenaLive(tokenId: number, raw: { standing: unknown; normie: unknown; week: unknown }, asOf: string): ArenaLive {
  const standing = parseLiveStanding(raw.standing, tokenId)
  const counts = parseLiveCounts(raw.normie, tokenId)
  const round = parseLiveRound(raw.week)
  if (!standing || !counts || !round || standing.game !== round.game) return arenaLiveUnavailable(tokenId, asOf)
  return {
    status: "ok",
    status_text: `The Arena currently reports #${standing.rank} of ${standing.of}`,
    live_rank: { rank: standing.rank, of: standing.of, text: `#${standing.rank} of ${standing.of}` },
    live_score_px: standing.px,
    where: standing.where,
    where_text: ARENA_LIVE_WHERE_TEXT[standing.where],
    back_at: standing.backAt,
    kills: counts.kills,
    deaths: counts.deaths,
    duels_won: counts.duelsWon,
    round: { game: round.game, phase: round.phase, ends_at: round.endsAt, players: round.players },
    note: ARENA_LIVE_NOTE,
    source: { label: ARENA_LIVE_SOURCE_LABEL, refs: ARENA_LIVE_REFS(tokenId) },
    as_of: asOf,
  }
}
