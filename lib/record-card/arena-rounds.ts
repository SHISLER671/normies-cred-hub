// Arena round history for the record card (Claude, 2026-11-17). Read-only.
//
// Reads `GET /arena/normie/{id}/rounds` through the polite Arena reader and turns it into a list of rounds. Rules:
//   - Official data only, and only what it states: the round number, whether the Normie played, the round's status and its
//     date. No per-round win: the API's `payoutOrder`, `prize` and `refund` are never read, and nothing is inferred from
//     them. The total wins figure on the card still comes only from `wins` on `GET /arena/normie/{id}`.
//   - A round with status "open" is "Round in progress". It is never an ending and never a win.
//   - Any status other than the four in ARENA_ROUND_STATUSES means "couldn't read that round".
//   - No #PIXEL amounts: `charged`, `prize`, `refund` and `pool` are never read.
//   - Paging is by `offset` (the documented query key). At most ARENA_ROUNDS_MAX_PAGES pages are read per card.
//   - The list's order is not trusted: rounds are sorted here, newest first.
//   - "Couldn't read" (network error, pause, bad body) is kept apart from "not found" (404) and "empty" (no rounds).
// Field names come from a real response: fixtures/arena-normie-7141-rounds.json (read 2026-11-17, one open round).

import type { ArenaRoundEntry, ArenaRoundHistory, ArenaRoundTotals } from "./types"

/** Most pages of `/arena/normie/{id}/rounds` read for one card. */
export const ARENA_ROUNDS_MAX_PAGES = 2

/** The only round statuses NCH reads. Anything else is "couldn't read that round". */
export const ARENA_ROUND_STATUSES = ["open", "upcoming", "ended", "cancelled"] as const
export type ArenaRoundStatus = (typeof ARENA_ROUND_STATUSES)[number]

/** Shown as the source on the card. */
export const ARENA_ROUNDS_SOURCE_LABEL = "Official Arena data (api.normies.art)"
export const ARENA_ROUNDS_REF = (tokenId: number) => `GET /arena/normie/${tokenId}/rounds`

export const ARENA_ROUND_TEXT = {
  in_progress: "Round in progress",
  played: "Played",
  did_not_play: "Did not play",
  cancelled: "Round cancelled",
  not_started: "Not started yet",
  unreadable: "Couldn't read this round",
} as const

/** A whole number, or a string of digits only. Anything else is null. */
export function wholeNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 ? v : null
  if (typeof v === "string" && /^\d{1,15}$/.test(v)) return Number(v)
  return null
}

/** Unix seconds (whole number or digits) as an ISO-8601 UTC time, or null. */
function isoFromSeconds(v: unknown): string | null {
  const s = wholeNumber(v)
  if (s === null || s === 0 || s > 99_999_999_999) return null
  return new Date(s * 1000).toISOString()
}

/** One row of the official list, in NCH's words. `round` is the only field a row can't do without. */
function parseRound(raw: unknown): ArenaRoundEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const round = wholeNumber(r.round)
  if (round === null) return null
  const date = isoFromSeconds(r.timestamp)
  const status = typeof r.status === "string" && (ARENA_ROUND_STATUSES as readonly string[]).includes(r.status) ? (r.status as ArenaRoundStatus) : null
  if (status === null || typeof r.played !== "boolean") {
    return { round, state: "unreadable", played: null, text: ARENA_ROUND_TEXT.unreadable, date }
  }
  const played = r.played
  if (status === "open") return { round, state: "in_progress", played, text: ARENA_ROUND_TEXT.in_progress, date }
  if (status === "upcoming") return { round, state: "not_started", played, text: ARENA_ROUND_TEXT.not_started, date }
  if (status === "cancelled") return { round, state: "cancelled", played, text: ARENA_ROUND_TEXT.cancelled, date }
  return { round, state: "ended", played, text: played ? ARENA_ROUND_TEXT.played : ARENA_ROUND_TEXT.did_not_play, date }
}

/**
 * Parse one page of `GET /arena/normie/{id}/rounds`. Strict: the token id must match, `rounds` must be a list, `hasMore`
 * a boolean, every row must have a whole-number `round`, and no round may appear twice. Anything else is refused (null).
 * A row whose status or `played` can't be read is kept as "couldn't read this round", never guessed.
 */
export function parseArenaNormieRounds(raw: unknown, tokenId: number): { rounds: ArenaRoundEntry[]; hasMore: boolean } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (wholeNumber(r.tokenId) !== tokenId) return null
  if (!Array.isArray(r.rounds) || typeof r.hasMore !== "boolean") return null
  const rounds: ArenaRoundEntry[] = []
  const seen = new Set<number>()
  for (const row of r.rounds) {
    const parsed = parseRound(row)
    if (!parsed || seen.has(parsed.round)) return null
    seen.add(parsed.round)
    rounds.push(parsed)
  }
  // "More to come" after an empty page can't be paged with an offset, so it is refused.
  if (r.hasMore && rounds.length === 0) return null
  return { rounds, hasMore: r.hasMore }
}

/** What a read of the round list came back with. "unavailable" = couldn't read; it is never "empty" or "not found". */
export type ArenaRoundsRead =
  | { kind: "ok"; rounds: ArenaRoundEntry[]; complete: boolean }
  | { kind: "not_found" }
  | { kind: "unavailable" }

type Get = (path: string) => Promise<{ status: number; body: unknown }>

/**
 * Read a Normie's rounds: the first page, then further pages by `offset` while the API says there are more, up to
 * ARENA_ROUNDS_MAX_PAGES. Rounds come back sorted newest first. `complete` is false when the API still had more after
 * the last page read. If any page can't be read, the whole answer is "unavailable": a part list is never shown as whole.
 */
export async function readArenaRounds(tokenId: number, get: Get): Promise<ArenaRoundsRead> {
  if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 9999) return { kind: "unavailable" }
  const all: ArenaRoundEntry[] = []
  const seen = new Set<number>()
  let hasMore = true
  for (let page = 0; page < ARENA_ROUNDS_MAX_PAGES && hasMore; page++) {
    const path = page === 0 ? `/arena/normie/${tokenId}/rounds` : `/arena/normie/${tokenId}/rounds?offset=${all.length}`
    let res: { status: number; body: unknown }
    try {
      res = await get(path)
    } catch {
      return { kind: "unavailable" }
    }
    if (res.status === 404 && page === 0) return { kind: "not_found" }
    if (res.status !== 200) return { kind: "unavailable" }
    const parsed = parseArenaNormieRounds(res.body, tokenId)
    if (!parsed) return { kind: "unavailable" }
    for (const round of parsed.rounds) {
      if (seen.has(round.round)) return { kind: "unavailable" }
      seen.add(round.round)
      all.push(round)
    }
    hasMore = parsed.hasMore
  }
  all.sort((a, b) => b.round - a.round)
  return { kind: "ok", rounds: all, complete: !hasMore }
}

/** Raw counts of the rounds listed. They add up to `listed`. A round in progress is counted only as in progress. */
export function arenaRoundTotals(rounds: readonly ArenaRoundEntry[]): ArenaRoundTotals {
  const totals: ArenaRoundTotals = { listed: rounds.length, played: 0, did_not_play: 0, in_progress: 0, cancelled: 0, not_started: 0, unreadable: 0 }
  for (const r of rounds) {
    if (r.state === "ended") totals[r.played ? "played" : "did_not_play"] += 1
    else totals[r.state] += 1
  }
  return totals
}

/** The card's round-history block for a read. `asOf` is when NCH read it. */
export function buildArenaRoundHistory(tokenId: number, read: ArenaRoundsRead, asOf: string): ArenaRoundHistory {
  const base = {
    source: { kind: "official_api" as const, ref: ARENA_ROUNDS_REF(tokenId), label: ARENA_ROUNDS_SOURCE_LABEL },
    as_of: asOf,
    max_pages: ARENA_ROUNDS_MAX_PAGES,
  }
  if (read.kind === "unavailable") {
    return { ...base, status: "unavailable", status_text: "Couldn't read the round list right now", rounds: [], totals: null, complete: null }
  }
  if (read.kind === "not_found") {
    return { ...base, status: "not_found", status_text: "The official data has no round list for this Normie", rounds: [], totals: null, complete: null }
  }
  if (read.rounds.length === 0) {
    return { ...base, status: "empty", status_text: "No rounds listed yet", rounds: [], totals: arenaRoundTotals([]), complete: read.complete }
  }
  const n = read.rounds.length
  return {
    ...base,
    status: "ok",
    status_text: read.complete
      ? `${n} ${n === 1 ? "round" : "rounds"} listed`
      : `${n} rounds read; the official data lists more, which aren't shown here`,
    rounds: read.rounds,
    totals: arenaRoundTotals(read.rounds),
    complete: read.complete,
  }
}
