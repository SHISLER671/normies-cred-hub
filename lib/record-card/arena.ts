// Arena sector — the one plug-in point that waits for an official source.
//
// The rest of the record card is built on data that exists today. Arena is not live, and nobody outside the Normies
// team knows yet whether results will come from an API or from contract events. So this file defines the slot:
//   - while Arena is not LIVE in lib/official-status.ts, every Arena field is `pending: Arena not live`;
//   - once Arena is LIVE but no official source is wired here, fields say `pending: official Arena data not wired yet`;
//   - on launch day, add ONE ArenaSource that reads the official data, register it below, and nothing else changes.
// Never put guessed or self-reported Arena numbers here.

import { OFFICIAL_STATUS } from "@/lib/official-status"

import type { ArenaRecord, ArenaSector, Field } from "./types"

/** What an official Arena adapter must return for one Normie. All counts verified (onchain / official_api). */
export interface ArenaSource {
  /** Short id shown as the source ref, e.g. "GET /arena/normie/{id}" or "ArenaV1 MatchSettled events". */
  ref: string
  kind: "onchain" | "official_api"
  load(tokenId: number): Promise<{
    matches: number
    wins: number
    losses: number
    pixels_net: number | null
    last_match_at: string | null
  } | null>
}

/** Registered official adapters. Empty until Arena ships with a documented source. */
export const ARENA_SOURCES: ArenaSource[] = []

function pendingField<T>(reason: string, asOf: string, ref = "proposed: official Arena source TBD"): Field<T> {
  return { value: null, label: "pending", pending_reason: reason, source: { kind: "official_api", ref }, as_of: asOf }
}

export function pendingArenaRecord(reason: string, asOf: string): ArenaRecord {
  return {
    matches: pendingField(reason, asOf),
    wins: pendingField(reason, asOf),
    losses: pendingField(reason, asOf),
    pixels_net: { ...pendingField<number>(reason, asOf, "pixels_won - pixels_lost"), source: { kind: "nch_computed", ref: "pixels_won - pixels_lost" } },
    last_match_at: pendingField(reason, asOf),
  }
}

export function arenaIsLive(status: string = OFFICIAL_STATUS.arena.status): boolean {
  return status === "LIVE"
}

/**
 * The Arena sector for one Normie. While Arena is not live or no official source is wired, this never calls anything
 * and returns a pending sector. `sources` and `status` are injectable for tests.
 */
export async function loadArenaSector(
  tokenId: number,
  asOf: string,
  opts: { status?: string; sources?: ArenaSource[] } = {},
): Promise<ArenaSector> {
  if (!arenaIsLive(opts.status)) {
    return {
      status: "not_live",
      status_text: "Arena isn't live yet, so there's no record",
      record: pendingArenaRecord("Arena not live", asOf),
      rank: { ranked: false, score: null, reason: "Arena not live" },
    }
  }

  const source = (opts.sources ?? ARENA_SOURCES)[0]
  if (!source) {
    return {
      status: "source_pending",
      status_text: "Arena is live; official Arena data isn't connected here yet",
      record: pendingArenaRecord("official Arena data not wired yet", asOf),
      rank: { ranked: false, score: null, reason: "official Arena data not wired yet" },
    }
  }

  // Launch-day path. Ranking (minimum sample, Wilson bound) lands with the adapter; until then: verified counts, unranked.
  try {
    const r = await source.load(tokenId)
    if (!r) {
      return {
        status: "unranked",
        status_text: "No verified Arena matches yet",
        record: pendingArenaRecord("no matches", asOf),
        rank: { ranked: false, score: null, reason: "no verified matches" },
      }
    }
    const v = <T,>(value: T | null): Field<T> => ({
      value,
      label: value === null ? "unavailable" : "verified",
      source: { kind: source.kind, ref: source.ref },
      as_of: asOf,
    })
    return {
      status: "unranked",
      status_text: `Building a record: ${r.matches} verified matches`,
      record: {
        matches: v(r.matches),
        wins: v(r.wins),
        losses: v(r.losses),
        pixels_net: v(r.pixels_net),
        last_match_at: v(r.last_match_at),
      },
      rank: { ranked: false, score: null, reason: "ranking rules not switched on yet" },
    }
  } catch {
    return {
      status: "source_pending",
      status_text: "Arena data is unavailable right now",
      record: pendingArenaRecord("Arena source unavailable", asOf),
      rank: { ranked: false, score: null, reason: "Arena source unavailable" },
    }
  }
}
