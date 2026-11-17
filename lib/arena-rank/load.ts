// Arena skill rank, step 1: the reads (Claude, 2026-11-17). Read-only.
//
// One page view reads at most ARENA_RANK_MAX_PAGES pages of `/arena/records?sort=rounds`, plus one round history for
// each Normie that already has enough rounds (at most ARENA_RANK_MAX_HISTORY_READS), all through the polite Arena
// reader (shared 60 s cache, backoff). It makes no Pulse check and no chain read.

import { arenaGet } from "@/lib/arena-api"
import { ARENA_RANK_MINIMUM } from "@/lib/record-card/arena"
import { readArenaRounds, type ArenaRoundsRead } from "@/lib/record-card/arena-rounds"

import { ARENA_RANK_MAX_HISTORY_READS, arenaAgents, buildArenaRank, readArenaRecords, type ArenaRankResult, type FirstRound } from "./core"

type Get = (path: string) => Promise<{ status: number; body: unknown }>

async function getArena(path: string): Promise<{ status: number; body: unknown }> {
  const r = await arenaGet(path)
  if (r.ok) return { status: r.status, body: r.data }
  if (r.reason === "http") return { status: r.status, body: null }
  throw new Error("arena read failed")
}

/**
 * The date of the first round a Normie played, from its round history. Unknown when the history couldn't be read, has
 * no dated round it played, or is longer than the pages read and so may be missing its earliest rounds.
 */
export function firstRoundFrom(read: ArenaRoundsRead): FirstRound {
  if (read.kind !== "ok" || !read.complete) return { kind: "unknown" }
  const dates = read.rounds.filter((r) => r.played === true && r.date !== null).map((r) => r.date as string)
  if (dates.length === 0) return { kind: "unknown" }
  return { kind: "known", date: dates.reduce((a, b) => (a < b ? a : b)) }
}

export type ArenaRankDeps = { get: Get; now?: () => Date }

/** The rank page's answer. Never throws. */
export async function loadArenaRank(deps: ArenaRankDeps = { get: getArena }): Promise<ArenaRankResult> {
  const now = (deps.now ?? (() => new Date()))()
  const records = await readArenaRecords(deps.get)
  const firstRounds = new Map<number, FirstRound>()
  if (records.kind === "ok") {
    // Only Normies that already have enough rounds need their first-round date; the rest are "not enough rounds yet".
    const due = arenaAgents(records.rows).filter((r) => r.roundsPlayed >= ARENA_RANK_MINIMUM.rounds).slice(0, ARENA_RANK_MAX_HISTORY_READS)
    await Promise.all(
      due.map(async (row) => {
        const history = await readArenaRounds(row.tokenId, deps.get).catch((): ArenaRoundsRead => ({ kind: "unavailable" }))
        firstRounds.set(row.tokenId, firstRoundFrom(history))
      }),
    )
  }
  return buildArenaRank(records, firstRounds, now)
}
