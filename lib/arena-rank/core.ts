// Arena skill rank, step 1 (Claude, 2026-11-17). Pure functions; the reads are in ./load.ts.
//
// Lists Arena agents from the official `GET /arena/records?sort=rounds` with their raw counts and applies the one ranking
// minimum (ARENA_RANK_MINIMUM in lib/record-card/arena.ts: rounds played AND days since the first round). Rules:
//   - Step 1 ranks nobody. A rank also needs the Pulse trust gate ("ERC-8004 registered" and "Clean ownership &
//     delegation", never a level), and those results come from a cron-filled table in step 2. Until then a Normie that
//     meets the minimum reads "Meets the minimum; trust gate not checked yet". No Pulse check is made on a page view.
//   - Agents only: a row is listed only when the official data gives it an `agentId` that is a whole number above zero.
//   - Raw counts (rounds played, wins) beside every Normie. No overall rank. `pulse_level` is never read or changed.
//   - No amounts: `pixelsWon` is never read. `owner` is never read either: this page shows no wallets.
//   - The list's order is not trusted: rows are sorted here.
//   - "Couldn't read" is kept apart from "not found" and "empty", and is never cached.
// Field names come from a real response: fixtures/arena-records-rounds.json (read 2026-11-17, trimmed to its first 5
// rows, owner addresses replaced). Every row seen so far has 1 round and an agent.

import { ARENA_RANK_MINIMUM } from "@/lib/record-card/arena"

/** Most pages of `/arena/records?sort=rounds` read per cache window. */
export const ARENA_RANK_MAX_PAGES = 2
/** Most first-round date reads (one round history each) per page view, only for Normies that already have enough rounds. */
export const ARENA_RANK_MAX_HISTORY_READS = 10
/** Shared cache for an answer that was read. "Couldn't read" is never cached. */
export const ARENA_RANK_CACHE_SECONDS = 60

export const ARENA_RANK_LABEL = "A track record, never a tip. DYOR."
export const ARENA_RANK_SOURCE_LABEL = "Official Arena data (api.normies.art)"
export const ARENA_RANK_REF = "GET /arena/records?sort=rounds"
export const ARENA_RANK_ORDER_TEXT =
  "Rank order, once ranks are on: win rate (wins ÷ rounds played) for Normies past the minimum and the trust gate; ties go to more rounds played"

/** A whole number, or a string of digits only. Anything else is null. */
function wholeNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 ? v : null
  if (typeof v === "string" && /^\d{1,15}$/.test(v)) return Number(v)
  return null
}

/** One row of the official records list. Counts only. `agentId` null = no agent in the official data. */
export type ArenaRecordRow = { tokenId: number; agentId: number | null; roundsPlayed: number; wins: number; lastRound: number | null }

function parseRow(raw: unknown): ArenaRecordRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const tokenId = wholeNumber(r.tokenId)
  if (tokenId === null || tokenId > 9999) return null
  const roundsPlayed = wholeNumber(r.roundsPlayed)
  const wins = wholeNumber(r.wins)
  if (roundsPlayed === null || wins === null || wins > roundsPlayed) return null
  let lastRound: number | null = null
  if (!(r.lastRound === null && roundsPlayed === 0)) {
    lastRound = wholeNumber(r.lastRound)
    if (lastRound === null) return null
  }
  // No agent has not been seen in real data; anything that isn't a whole number above zero is "no agent".
  const agent = wholeNumber(r.agentId)
  return { tokenId, agentId: agent !== null && agent > 0 ? agent : null, roundsPlayed, wins, lastRound }
}

/**
 * Parse one page of `GET /arena/records?sort=rounds`. Strict: `sort` must be "rounds", `normies` a list, `hasMore` a
 * boolean; every row needs a Normie number (0-9999) and whole-number rounds and wins (wins <= rounds); no Normie may
 * appear twice. Anything else is refused (null). `pixelsWon` and `owner` are never read.
 */
export function parseArenaRecords(raw: unknown): { rows: ArenaRecordRow[]; hasMore: boolean } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.sort !== "rounds" || !Array.isArray(r.normies) || typeof r.hasMore !== "boolean") return null
  const rows: ArenaRecordRow[] = []
  const seen = new Set<number>()
  for (const item of r.normies) {
    const row = parseRow(item)
    if (!row || seen.has(row.tokenId)) return null
    seen.add(row.tokenId)
    rows.push(row)
  }
  if (r.hasMore && rows.length === 0) return null
  return { rows, hasMore: r.hasMore }
}

export type ArenaRecordsRead = { kind: "ok"; rows: ArenaRecordRow[]; complete: boolean; pages: number } | { kind: "not_found" } | { kind: "unavailable" }

type Get = (path: string) => Promise<{ status: number; body: unknown }>

/**
 * Read the records list: the first page, then more by `offset` while the API says there are more, up to
 * ARENA_RANK_MAX_PAGES. If any page can't be read the whole answer is "unavailable": a part list is never shown as whole.
 */
export async function readArenaRecords(get: Get): Promise<ArenaRecordsRead> {
  const all: ArenaRecordRow[] = []
  const seen = new Set<number>()
  let hasMore = true
  let pages = 0
  for (; pages < ARENA_RANK_MAX_PAGES && hasMore; pages++) {
    const path = pages === 0 ? "/arena/records?sort=rounds" : `/arena/records?sort=rounds&offset=${all.length}`
    let res: { status: number; body: unknown }
    try {
      res = await get(path)
    } catch {
      return { kind: "unavailable" }
    }
    if (res.status === 404 && pages === 0) return { kind: "not_found" }
    if (res.status !== 200) return { kind: "unavailable" }
    const parsed = parseArenaRecords(res.body)
    if (!parsed) return { kind: "unavailable" }
    for (const row of parsed.rows) {
      if (seen.has(row.tokenId)) return { kind: "unavailable" }
      seen.add(row.tokenId)
      all.push(row)
    }
    hasMore = parsed.hasMore
  }
  return { kind: "ok", rows: all, complete: !hasMore, pages }
}

/** Agents only, most rounds played first, then by Normie number. The order below the minimum is not a rank. */
export function arenaAgents(rows: readonly ArenaRecordRow[]): ArenaRecordRow[] {
  return rows.filter((r) => r.agentId !== null).sort((a, b) => b.roundsPlayed - a.roundsPlayed || a.tokenId - b.tokenId)
}

/** A Normie's first-round date. "unknown" = not read yet (over the cap) or couldn't be read. */
export type FirstRound = { kind: "known"; date: string } | { kind: "unknown" }

export type ArenaRankStatus = "not_enough_rounds" | "first_round_unchecked" | "not_enough_days" | "gate_unchecked"

export const ARENA_RANK_STATUS_TEXT: Record<ArenaRankStatus, string> = {
  not_enough_rounds: "Not enough rounds yet",
  first_round_unchecked: "Enough rounds; first-round date not checked yet",
  not_enough_days: "Enough rounds; not enough days since its first round yet",
  gate_unchecked: "Meets the minimum; trust gate not checked yet",
}

const DAY_MS = 86_400_000

/** Whole days between an ISO time and now. Null when the time can't be read or is in the future. */
export function daysSince(iso: string, now: Date): number | null {
  const t = Date.parse(iso)
  if (!Number.isFinite(t) || t > now.getTime()) return null
  return Math.floor((now.getTime() - t) / DAY_MS)
}

/** Where a Normie stands against the one minimum. Never "ranked": step 1 has no trust-gate results. */
export function arenaRankStatus(row: ArenaRecordRow, first: FirstRound, now: Date): ArenaRankStatus {
  if (row.roundsPlayed < ARENA_RANK_MINIMUM.rounds) return "not_enough_rounds"
  if (first.kind === "unknown") return "first_round_unchecked"
  const days = daysSince(first.date, now)
  if (days === null) return "first_round_unchecked"
  return days >= ARENA_RANK_MINIMUM.days ? "gate_unchecked" : "not_enough_days"
}

export type ArenaRankRow = {
  token_id: number
  agent_id: number
  rounds_played: number
  wins: number
  status: ArenaRankStatus
  status_text: string
  /** Always null in step 1: nobody is ranked until the trust gate results exist. */
  rank: null
  /** The first-round date, when it was read (only for Normies with enough rounds). */
  first_round_date: string | null
  record_path: string
}

export type ArenaRankResult =
  | { kind: "unavailable" }
  | { kind: "not_found"; as_of: string }
  | { kind: "empty"; as_of: string }
  | {
      kind: "ok"
      as_of: string
      normies: ArenaRankRow[]
      counts: { listed: number; ranked: 0 } & Record<ArenaRankStatus, number>
      /** How much of the official list was read. `complete` false = the official list has more rows. */
      coverage: { pages_read: number; rows_read: number; agents_listed: number; complete: boolean }
    }

export function buildArenaRank(read: ArenaRecordsRead, firstRounds: ReadonlyMap<number, FirstRound>, now: Date): ArenaRankResult {
  if (read.kind === "unavailable") return { kind: "unavailable" }
  const asOf = now.toISOString()
  if (read.kind === "not_found") return { kind: "not_found", as_of: asOf }
  const agents = arenaAgents(read.rows)
  if (agents.length === 0) return { kind: "empty", as_of: asOf }
  const counts = { listed: agents.length, ranked: 0 as const, not_enough_rounds: 0, first_round_unchecked: 0, not_enough_days: 0, gate_unchecked: 0 }
  const normies = agents.map((row): ArenaRankRow => {
    const first = firstRounds.get(row.tokenId) ?? { kind: "unknown" }
    const status = arenaRankStatus(row, first, now)
    counts[status] += 1
    return {
      token_id: row.tokenId,
      agent_id: row.agentId as number,
      rounds_played: row.roundsPlayed,
      wins: row.wins,
      status,
      status_text: ARENA_RANK_STATUS_TEXT[status],
      rank: null,
      first_round_date: first.kind === "known" ? first.date : null,
      record_path: `/record/${row.tokenId}`,
    }
  })
  return { kind: "ok", as_of: asOf, normies, counts, coverage: { pages_read: read.pages, rows_read: read.rows.length, agents_listed: agents.length, complete: read.complete } }
}

export const ARENA_RANK_MINIMUM_TEXT = `Minimum before any rank: ${ARENA_RANK_MINIMUM.rounds} rounds played and ${ARENA_RANK_MINIMUM.days} days since the Normie's first round, plus the trust gate (ERC-8004 registered, and clean ownership and delegation)`

export function arenaRankText(result: ArenaRankResult): string {
  switch (result.kind) {
    case "unavailable":
      return "Couldn't read the Arena right now. Try again in a minute"
    case "not_found":
      return "The official Arena data has no records list right now"
    case "empty":
      return "No Arena agents in the official records yet"
    case "ok": {
      const n = result.normies.length
      const below = result.counts.not_enough_rounds
      return below === n ? `No agent is ranked yet: all ${n} listed have not enough rounds yet` : `No agent is ranked yet: ${below} of ${n} listed have not enough rounds yet`
    }
  }
}

/** What the list covers, in plain words. */
export function arenaRankCoverageText(c: { rows_read: number; complete: boolean }): string {
  return c.complete
    ? `Covers all ${c.rows_read} Normies in the official records list`
    : `Covers the top ${c.rows_read} by rounds played; the official list has more`
}

export function arenaRankCacheControl(result: ArenaRankResult): string {
  return result.kind === "unavailable" ? "no-store" : `public, s-maxage=${ARENA_RANK_CACHE_SECONDS}, stale-while-revalidate=${ARENA_RANK_CACHE_SECONDS * 2}`
}

/** The API answer, built field by field so nothing from the upstream response (amounts, wallets, error text) passes through. */
export function arenaRankResponse(result: ArenaRankResult): { status: number; body: Record<string, unknown>; cacheControl: string } {
  const cacheControl = arenaRankCacheControl(result)
  const base = { result: result.kind, text: arenaRankText(result), label: ARENA_RANK_LABEL }
  if (result.kind === "unavailable") return { status: 503, body: base, cacheControl }
  const rest = {
    minimum: { rounds: ARENA_RANK_MINIMUM.rounds, days_since_first_round: ARENA_RANK_MINIMUM.days, text: ARENA_RANK_MINIMUM_TEXT },
    rank_order: ARENA_RANK_ORDER_TEXT,
    source: { kind: "official_api", label: ARENA_RANK_SOURCE_LABEL, ref: ARENA_RANK_REF },
    as_of: result.as_of,
  }
  if (result.kind !== "ok") return { status: result.kind === "not_found" ? 404 : 200, body: { ...base, ranked: [], normies: [], ...rest }, cacheControl }
  return {
    status: 200,
    body: { ...base, ranked: [], normies: result.normies, counts: result.counts, coverage: { ...result.coverage, text: arenaRankCoverageText(result.coverage) }, ...rest },
    cacheControl,
  }
}
