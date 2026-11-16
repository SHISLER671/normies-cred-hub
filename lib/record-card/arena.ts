// Arena sector of the record card. Read-only.
//
// Arena is LIVE (lib/official-status.ts) and its official data is public at api.normies.art/arena/*. This file reads that data
// and turns it into the Arena part of the card. Rules:
//   - Official data only. Anything the API doesn't give is `pending` with a reason, never zero and never guessed.
//   - Being entered is not a record. Until a Normie has played a round the card says it is entered, with no record.
//   - Since the 2026-11-15 contract migration the API gives no line, queue position or needs-funds flag. Those fields are
//     pending ("not in official data"), never inferred from `state` or `inCurrentRound`.
//   - Ranking stays off until the minimum sample is met (ARENA_RANK_MINIMUM), and that needs data the API doesn't publish yet.
//   - No #PIXEL amounts: the API reports pixels won, charged and refunded, but NCH doesn't show or net them (AGENTS.md
//     "Numbers yes, promises never"; nothing about prizes, pools, payouts or winnings).
//   - If Arena's status in lib/official-status.ts is ever not LIVE, nothing is called and every field is pending.
// The API's field names come from live responses: fixtures/arena-normie-7141.json is the 2026-11-17 shape,
// fixtures/arena-normie-7141-v1.json and arena-normie-4242-not-entered.json the launch-weekend shape (now refused).

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { OFFICIAL_STATUS } from "@/lib/official-status"

import type { ArenaEntry, ArenaRecord, ArenaSector, Field } from "./types"

/** Ranking is off until all three hold. Opponent counts aren't in the official API yet, so no Normie is ranked today. */
export const ARENA_RANK_MINIMUM = { rounds: 10, opponents: 5, days: 14 } as const
export const ARENA_RANK_OFF_REASON = `Ranking is off until ${ARENA_RANK_MINIMUM.rounds} rounds, ${ARENA_RANK_MINIMUM.opponents} opponents and ${ARENA_RANK_MINIMUM.days} days of official results`

export const ARENA_NORMIE_REF = (tokenId: number) => `GET /arena/normie/${tokenId}`
const TIMEOUT_MS = 8_000

/** One Normie's Arena state, as the official source reports it. Counts only; no #PIXEL amounts. */
export type ArenaSnapshot = {
  /** Has played a round, or is in the current round. */
  entered: boolean
  /** Not in the official data since the 2026-11-15 migration: always null now. */
  in_line: boolean | null
  /** Not in the official data since the 2026-11-15 migration: always null now. */
  position: number | null
  /** Not in the official data since the 2026-11-15 migration: always null now. */
  needs_funds: boolean | null
  rounds_played: number
  wins: number
  /** Number of the last round played, or null. */
  last_round: number | null
  /** Whether any Arena round has started yet. Null when that couldn't be read. */
  any_round_started: boolean | null
  /** Block the source's answer was indexed at, when given. */
  block: number | null
}

/** Why a source couldn't answer. "not_configured" = the official endpoint isn't there (404); anything else = "unavailable". */
export class ArenaSourceError extends Error {
  constructor(public readonly kind: "not_configured" | "unavailable") {
    super(kind === "not_configured" ? "official Arena data not available" : "Arena source unavailable")
    this.name = "ArenaSourceError"
  }
}

/** An official Arena adapter. `load` returns the Normie's state, or throws ArenaSourceError. Never returns a guess. */
export interface ArenaSource {
  /** Shown as the source ref on every field, e.g. "GET /arena/normie/7141". */
  ref: (tokenId: number) => string
  kind: "onchain" | "official_api"
  load(tokenId: number): Promise<ArenaSnapshot>
}

const wholeNumber = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,15}$/.test(v) ? Number(v) : Number.NaN
  return Number.isInteger(n) && n >= 0 ? n : null
}

/** Reason shown for fields the official data stopped publishing at the 2026-11-15 contract migration. */
export const NOT_IN_OFFICIAL_DATA = "not in official data"

/**
 * Parse `GET /arena/normie/{id}` (shape live since the 2026-11-15 migration). Strict: the token id must match, roundsPlayed
 * and wins must be whole numbers with wins <= roundsPlayed, lastRound a whole number (or null before any round), and
 * registered and inCurrentRound booleans. Anything else, including the old launch-weekend shape, is refused (null).
 * Fields NCH doesn't show (level, balance, pixelsWon, pixelsCharged, pixelsRefunded, deposited, withdrawn) are not read.
 */
export function parseArenaNormie(raw: unknown, tokenId: number): Omit<ArenaSnapshot, "any_round_started"> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (wholeNumber(r.tokenId) !== tokenId) return null
  if (typeof r.registered !== "boolean" || typeof r.inCurrentRound !== "boolean") return null
  const rounds = wholeNumber(r.roundsPlayed)
  const wins = wholeNumber(r.wins)
  if (rounds === null || wins === null || wins > rounds) return null
  // lastRound is a whole number once a Normie has played; null is accepted only for one that never has.
  let lastRound: number | null = null
  if (!(r.lastRound === null && rounds === 0)) {
    lastRound = wholeNumber(r.lastRound)
    if (lastRound === null) return null
  }
  return {
    entered: rounds > 0 || r.inCurrentRound,
    in_line: null,
    position: null,
    needs_funds: null,
    rounds_played: rounds,
    wins,
    last_round: lastRound,
    block: r.blockNumber === null || r.blockNumber === undefined ? null : wholeNumber(r.blockNumber),
  }
}

/** From `GET /arena/status`: has any round started? Null when the answer can't be read. */
export function parseAnyRoundStarted(raw: unknown): boolean | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as { currentRound?: unknown; totals?: { roundsStarted?: unknown } }
  const started = wholeNumber(r.totals?.roundsStarted)
  const current = wholeNumber(r.currentRound)
  if (started === null && current === null) return null
  return (started ?? 0) > 0 || (current ?? 0) > 0
}

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  // The path is built from a validated token id or is a fixed string; the host is the official API, never from input.
  const res = await fetchWithTimeout(`${NORMIES_API_BASE}${path}`, { headers: { Accept: "application/json" }, next: { revalidate: 60 } }, TIMEOUT_MS)
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

/** The official API adapter. `get` is injectable for tests. */
export function officialArenaSource(get: (path: string) => Promise<{ status: number; body: unknown }> = getJson): ArenaSource {
  return {
    ref: ARENA_NORMIE_REF,
    kind: "official_api",
    async load(tokenId) {
      if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 9999) throw new ArenaSourceError("unavailable")
      let normie: { status: number; body: unknown }
      try {
        normie = await get(`/arena/normie/${tokenId}`)
      } catch {
        throw new ArenaSourceError("unavailable")
      }
      if (normie.status === 404) throw new ArenaSourceError("not_configured")
      if (normie.status !== 200) throw new ArenaSourceError("unavailable")
      const parsed = parseArenaNormie(normie.body, tokenId)
      if (!parsed) throw new ArenaSourceError("unavailable")
      // Only needed to word "no rounds yet": a failure here leaves it unknown, it doesn't fail the card.
      let anyRoundStarted: boolean | null = null
      if (parsed.rounds_played > 0) anyRoundStarted = true
      else {
        try {
          const status = await get("/arena/status")
          anyRoundStarted = status.status === 200 ? parseAnyRoundStarted(status.body) : null
        } catch {
          anyRoundStarted = null
        }
      }
      return { ...parsed, any_round_started: anyRoundStarted }
    },
  }
}

/** Registered official adapters. The first one is used. */
export const ARENA_SOURCES: ArenaSource[] = [officialArenaSource()]

function pendingField<T>(reason: string, asOf: string, ref = "official Arena data (api.normies.art/arena)"): Field<T> {
  return { value: null, label: "pending", pending_reason: reason, source: { kind: "official_api", ref }, as_of: asOf }
}

export function pendingArenaRecord(reason: string, asOf: string, ref?: string): ArenaRecord {
  return {
    matches: pendingField(reason, asOf, ref),
    wins: pendingField(reason, asOf, ref),
    losses: pendingField(reason, asOf, ref),
    pixels_net: pendingField(reason, asOf, ref),
    last_match_at: pendingField(reason, asOf, ref),
  }
}

function pendingEntry(reason: string, asOf: string, ref?: string): ArenaEntry {
  return { entered: pendingField(reason, asOf, ref), in_line: pendingField(reason, asOf, ref), line_position: pendingField(reason, asOf, ref) }
}

export function isArenaOpen(status: string = OFFICIAL_STATUS.arena.status): boolean {
  return status === "LIVE"
}

const NOT_RANKED = { ranked: false, score: null, reason: ARENA_RANK_OFF_REASON } as const

/**
 * The Arena sector for one Normie. Unless the status is LIVE this never calls anything and returns a pending sector.
 * `sources` and `status` are injectable for tests.
 */
export async function loadArenaSector(
  tokenId: number,
  asOf: string,
  opts: { status?: string; sources?: ArenaSource[] } = {},
): Promise<ArenaSector> {
  if (!isArenaOpen(opts.status)) {
    return {
      status: "not_live",
      status_text: "Arena isn't live, so there's no record",
      entry: pendingEntry("Arena not live", asOf),
      record: pendingArenaRecord("Arena not live", asOf),
      rank: { ranked: false, score: null, reason: "Arena not live" },
    }
  }

  const source = (opts.sources ?? ARENA_SOURCES)[0]
  if (!source) {
    return {
      status: "source_pending",
      status_text: "Arena is live; official Arena data isn't connected here yet",
      entry: pendingEntry("official Arena data not wired yet", asOf),
      record: pendingArenaRecord("official Arena data not wired yet", asOf),
      rank: { ranked: false, score: null, reason: "official Arena data not wired yet" },
    }
  }

  const ref = source.ref(tokenId)
  let snap: ArenaSnapshot
  try {
    snap = await source.load(tokenId)
  } catch (err) {
    const notConfigured = err instanceof ArenaSourceError && err.kind === "not_configured"
    const reason = notConfigured ? "official Arena data not available" : "Arena source unavailable"
    return {
      status: "source_pending",
      status_text: notConfigured ? "Arena is live; the official Arena data isn't available here yet" : "Arena data is unavailable right now",
      entry: pendingEntry(reason, asOf, ref),
      record: pendingArenaRecord(reason, asOf, ref),
      rank: { ranked: false, score: null, reason },
    }
  }

  const v = <T,>(value: T, field: string): Field<T> => ({
    value,
    label: "verified",
    source: { kind: source.kind, ref: `${ref} → ${field}` },
    as_of: asOf,
    ...(snap.block !== null ? { source_block: snap.block } : {}),
  })
  const entry: ArenaEntry = {
    entered: v(snap.entered, "roundsPlayed, inCurrentRound"),
    in_line: pendingField(NOT_IN_OFFICIAL_DATA, asOf, ref),
    line_position: pendingField(NOT_IN_OFFICIAL_DATA, asOf, ref),
  }

  if (!snap.entered) {
    return {
      status: "not_entered",
      status_text: "Not entered in Arena",
      entry,
      record: pendingArenaRecord("not entered in Arena", asOf, ref),
      rank: { ranked: false, score: null, reason: "not entered in Arena" },
    }
  }

  if (snap.rounds_played === 0) {
    const rounds =
      snap.any_round_started === false
        ? "No Arena round has started yet, so there's no record"
        : "It hasn't played a round yet, so there's no record"
    return {
      status: "entered",
      status_text: `Entered. ${rounds}`,
      entry,
      record: pendingArenaRecord("no rounds played yet", asOf, ref),
      rank: NOT_RANKED,
    }
  }

  return {
    status: "unranked",
    status_text: `Building a record: ${snap.rounds_played} ${snap.rounds_played === 1 ? "round" : "rounds"} played`,
    entry,
    record: {
      matches: v(snap.rounds_played, "roundsPlayed"),
      wins: v(snap.wins, "wins"),
      losses: pendingField("the official data doesn't publish losses", asOf, ref),
      pixels_net: pendingField("NCH doesn't show Arena #PIXEL amounts", asOf, ref),
      last_match_at: pendingField("the official data gives the last round's number, not its time", asOf, ref),
    },
    rank: NOT_RANKED,
  }
}
