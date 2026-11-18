// Arena sector of the record card. Read-only.
//
// Arena is LIVE (lib/official-status.ts) and its official data is public at api.normies.art/arena/*. This file reads that data
// and turns it into the Arena part of the card. Rules:
//   - Official data only. Anything the API doesn't give is `pending` with a reason, never zero and never guessed.
//   - Being registered or entered is not a record. Until a Normie has played a round the card says "Registered" (when the
//     official data says so) or "Entered", with no record.
//   - Since the launch-weekend contract migration (block 26421529) the API gives no line, queue position or needs-funds flag. Those fields are
//     pending ("not in official data"), never inferred from `state` or `inCurrentRound`.
//   - Ranking stays off until the minimum sample is met (ARENA_RANK_MINIMUM: rounds played, and days since the first round).
//     The card itself never ranks: ranks are shown on the Arena rank page (lib/arena-rank/), which imports the same minimum.
//   - Money (AGENTS.md "Numbers yes, advice never"): the one amount shown is the current round's pool total, as the
//     official API reports it (GET /arena/status → round.pool, in #PIXEL), with its source, as-of time and link. The API
//     also reports pixels won, charged and refunded per Normie; NCH doesn't show or net them here. Never a projected
//     per-Normie prize, a share, returns math, or a nudge to pay, enter or top up.
//   - If Arena's status in lib/official-status.ts is ever not LIVE, nothing is called and every field is pending.
//   - While the round a Normie last played is still open (GET /arena/status), the card says "Playing Round N now" and wins
//     is labelled "round in progress". /arena/status is read once per card; of its money fields only the current round's
//     `pool` is read (parseArenaRoundPool). `prizes`, `sponsorship`, `fees`, `paid`, `refunds` and `totals` never are.
//   - An entered Normie's round list (GET /arena/normie/{id}/rounds) is read by lib/record-card/arena-rounds.ts: which
//     rounds it played and each round's status and date. No per-round win, and no amounts.
// The API's field names come from live responses: fixtures/arena-normie-7141.json is the 2026-11-17 shape,
// fixtures/arena-normie-7141-v1.json and arena-normie-4242-not-entered.json the launch-weekend shape (now refused).

import { arenaGet } from "@/lib/arena-api"
import { arenaProfileUrl, arenaSkinImageUrl, arenaWatchUrl } from "@/lib/arena-canon"
import { OFFICIAL_STATUS } from "@/lib/official-status"

import { type ArenaRoundsRead, buildArenaRoundHistory, readArenaRounds } from "./arena-rounds"
import { loadArenaLive } from "@/lib/arena-live/load"

import type { ArenaEntry, ArenaLive, ArenaRecord, ArenaRoundHistory, ArenaRoundPool, ArenaSector, Field } from "./types"

/**
 * The one ranking minimum (Ryan, 2026-11-17), used by the record card and the Arena rank page: this many rounds played
 * AND this many days since the Normie's first round. Both come from official data. The old "5 opponents" rule is gone:
 * the official data has no opponent counts. Never define a second minimum anywhere.
 */
export const ARENA_RANK_MINIMUM = { rounds: 10, days: 14 } as const
export const ARENA_RANK_OFF_REASON = `Ranking is off until ${ARENA_RANK_MINIMUM.rounds} rounds and ${ARENA_RANK_MINIMUM.days} days since its first round, from official results`

export const ARENA_NORMIE_REF = (tokenId: number) => `GET /arena/normie/${tokenId}`
const TIMEOUT_MS = 8_000

/** One Normie's Arena state, as the official source reports it. Counts only; no #PIXEL amounts. */
export type ArenaSnapshot = {
  /** Registered, has played a round, or is in the current round. */
  entered: boolean
  /** The official data's `registered` flag (the game guide: only registered Normies play a free round). Optional for other sources. */
  registered?: boolean
  /** Not in the official data since the launch-weekend migration (block 26421529): always null now. */
  in_line: boolean | null
  /** Not in the official data since the launch-weekend migration (block 26421529): always null now. */
  position: number | null
  /** Not in the official data since the launch-weekend migration (block 26421529): always null now. */
  needs_funds: boolean | null
  rounds_played: number
  wins: number
  /** Number of the last round played, or null. */
  last_round: number | null
  /** Whether any Arena round has started yet. Null when that couldn't be read. */
  any_round_started: boolean | null
  /** The current round from `GET /arena/status`, when it could be read strictly. Null = unknown. Optional for other sources. */
  live_round?: ArenaLiveRound | null
  /** The current open round's pool total from `GET /arena/status` (whole #PIXEL), when it could be read strictly. Optional for other sources. */
  round_pool?: { round: number; amount: number } | null
  /** Block the source's answer was indexed at, when given. */
  block: number | null
  /** Official `state` (llms.txt): unregistered, active, short or cleared. Null when missing or unknown. Optional for other sources. */
  state?: ArenaState | null
  /** Official `registeredRound`: the latest round started when it registered (0 before round 1); it plays from the next one. */
  registered_round?: number | null
  /** Official `agentId`: the ERC-8004 agent this Normie is linked to in the Arena. */
  agent_id?: number | null
  /** Official `skins`: how many skins it has bought (a count, never an amount). */
  skins?: number | null
}

export const ARENA_STATES = ["unregistered", "active", "short", "cleared"] as const
export type ArenaState = (typeof ARENA_STATES)[number]

/** Plain words for each official Normie state (api.normies.art/llms.txt, "## Arena", read 2026-11-17). No amounts. */
export const ARENA_STATE_TEXT: Record<ArenaState, string> = {
  unregistered: "Not registered",
  active: "Active: plays every free round, and paid rounds while topped up",
  short: "Short: sat out a paid round; plays free rounds until topped up",
  cleared: "Cleared: burned and out of the game",
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
  /** The Normie's round list (lib/record-card/arena-rounds.ts). A failed read is `{ kind: "unavailable" }`. Optional for other sources. */
  loadRounds?(tokenId: number): Promise<ArenaRoundsRead>
  /** The Arena site's live feed for the Normie (lib/arena-live/). Never throws: a failed read is an "unavailable" block. Optional. */
  loadLive?(tokenId: number, asOf: string): Promise<ArenaLive>
}

const wholeNumber = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,15}$/.test(v) ? Number(v) : Number.NaN
  return Number.isInteger(n) && n >= 0 ? n : null
}

/** Reason shown for fields the official data stopped publishing at the launch-weekend contract migration (block 26421529). */
export const NOT_IN_OFFICIAL_DATA = "not in official data"

/**
 * Parse `GET /arena/normie/{id}` (shape live since the launch-weekend migration (block 26421529)). Strict: the token id must match, roundsPlayed
 * and wins must be whole numbers with wins <= roundsPlayed, lastRound a whole number (or null before any round), and
 * registered and inCurrentRound booleans. Anything else, including the old launch-weekend shape, is refused (null).
 * Fields NCH doesn't show (level, balance, pixelsWon, pixelsCharged, pixelsRefunded, deposited, withdrawn) are not read.
 * `state`, `registeredRound`, `agentId` and `skins` are read when they have the documented types; otherwise they're
 * unknown (null) and the rest of the answer still stands.
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
    entered: r.registered || rounds > 0 || r.inCurrentRound,
    registered: r.registered,
    in_line: null,
    position: null,
    needs_funds: null,
    rounds_played: rounds,
    wins,
    last_round: lastRound,
    block: r.blockNumber === null || r.blockNumber === undefined ? null : wholeNumber(r.blockNumber),
    state: typeof r.state === "string" && (ARENA_STATES as readonly string[]).includes(r.state) ? (r.state as ArenaState) : null,
    registered_round: wholeNumber(r.registeredRound),
    agent_id: wholeNumber(r.agentId),
    skins: wholeNumber(r.skins),
  }
}

/** The current round, as `GET /arena/status` reports it. */
export type ArenaLiveRound = {
  /** `currentRound`. */
  current: number
  /** `round.round` equals `currentRound`, `round.started` is true and `round.ended` is false. */
  open: boolean
}

/**
 * From `GET /arena/status`: the current round and whether it is open. Strict: `currentRound` must be a whole number, and
 * `round.round` (whole number), `round.started` and `round.ended` (booleans) and `round.status` (string) must have those
 * types, or the answer is unknown (null). Reads only those fields: the response's prize and pool fields are never read.
 */
export function parseArenaLiveRound(raw: unknown): ArenaLiveRound | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as { currentRound?: unknown; round?: unknown }
  const current = wholeNumber(r.currentRound)
  if (current === null) return null
  if (!r.round || typeof r.round !== "object" || Array.isArray(r.round)) return null
  const round = r.round as { round?: unknown; started?: unknown; ended?: unknown; status?: unknown }
  const number = wholeNumber(round.round)
  if (number === null || typeof round.started !== "boolean" || typeof round.ended !== "boolean" || typeof round.status !== "string") return null
  return { current, open: number === current && round.started && !round.ended }
}

export const ARENA_STATUS_URL = "https://api.normies.art/arena/status"
export const ARENA_POOL_SOURCE_LABEL = "Official Arena data (api.normies.art)"
export const ARENA_POOL_NOTE = "The whole round's pool as officially reported, not any one Normie's."

/**
 * From `GET /arena/status`: the current round's pool total, only while that round is open. The official docs
 * (api.normies.art/llms.txt, "## Arena") say "Amounts are #PIXEL as strings" and `pool` = `sponsorship` + `fees`.
 * Strict: `currentRound` and `round.round` must be the same whole number, `round.started` true, `round.ended` false,
 * `round.cancelled` not true, and `round.pool` a whole number or a string of digits. Anything else is null: no pool is
 * shown. This is the only money field read from the response.
 */
export function parseArenaRoundPool(raw: unknown): { round: number; amount: number } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as { currentRound?: unknown; round?: unknown }
  const current = wholeNumber(r.currentRound)
  if (current === null || !r.round || typeof r.round !== "object" || Array.isArray(r.round)) return null
  const round = r.round as { round?: unknown; started?: unknown; ended?: unknown; cancelled?: unknown; pool?: unknown }
  if (wholeNumber(round.round) !== current || round.started !== true || round.ended !== false || round.cancelled === true) return null
  const amount = wholeNumber(round.pool)
  return amount === null ? null : { round: current, amount }
}

/** The card's pool block. The text follows Ryan's wording (2026-11-18); it is never called a prize or a jackpot. */
export function buildArenaRoundPool(pool: { round: number; amount: number }, asOf: string): ArenaRoundPool {
  const when = new Date(asOf).toUTCString().replace(" GMT", " UTC")
  return {
    round: pool.round,
    amount: pool.amount,
    unit: "#PIXEL",
    text: `Current round pool: ${pool.amount} #PIXEL (sponsorship plus entry fees, as reported by api.normies.art, as of ${when}; can change until the round ends)`,
    note: ARENA_POOL_NOTE,
    source: { kind: "official_api", ref: "GET /arena/status → round.pool", label: ARENA_POOL_SOURCE_LABEL, url: ARENA_STATUS_URL },
    as_of: asOf,
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

/**
 * Reads through the polite Arena client (lib/arena-api.ts): allowlisted path, shared 60 s cache, time limit, size cap and
 * backoff. A network error, a pause or a bad body throws, which the adapter reports as "couldn't read".
 */
async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const r = await arenaGet(path)
  if (r.ok) return { status: r.status, body: r.data }
  if (r.reason === "http") return { status: r.status, body: null }
  throw new Error(`arena api ${r.reason}`)
}

/**
 * The official API adapter. `get` is injectable for tests. `loadLive` adds the Arena site's live feed; it is off unless
 * passed, so tests that stub `get` make no live read.
 */
export function officialArenaSource(
  get: (path: string) => Promise<{ status: number; body: unknown }> = getJson,
  loadLive?: (tokenId: number, asOf: string) => Promise<ArenaLive>,
): ArenaSource {
  return {
    ...(loadLive ? { loadLive } : {}),
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
      // One /arena/status read per card, for the "no rounds yet" wording and the open round. A failure leaves both
      // unknown; it never fails the card.
      let statusBody: unknown = null
      try {
        const status = await get("/arena/status")
        statusBody = status.status === 200 ? status.body : null
      } catch {
        statusBody = null
      }
      const anyRoundStarted = parsed.rounds_played > 0 ? true : parseAnyRoundStarted(statusBody)
      return { ...parsed, any_round_started: anyRoundStarted, live_round: parseArenaLiveRound(statusBody), round_pool: parseArenaRoundPool(statusBody) }
    },
    loadRounds: (tokenId) => readArenaRounds(tokenId, get),
  }
}

/** Registered official adapters. The first one is used. */
export const ARENA_SOURCES: ArenaSource[] = [officialArenaSource(getJson, loadArenaLive)]

/** Profile link for an entered Normie, and its skin image when the official API counts at least one skin. */
function arenaLinks(tokenId: number, snap: ArenaSnapshot): { profile_url: string; skin_image_url?: string } {
  const hasSkin = typeof snap.skins === "number" && snap.skins > 0
  return hasSkin ? { profile_url: arenaProfileUrl(tokenId), skin_image_url: arenaSkinImageUrl(tokenId) } : { profile_url: arenaProfileUrl(tokenId) }
}

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
    entered: v(snap.entered, "registered, roundsPlayed, inCurrentRound"),
    in_line: pendingField(NOT_IN_OFFICIAL_DATA, asOf, ref),
    line_position: pendingField(NOT_IN_OFFICIAL_DATA, asOf, ref),
    ...(snap.state !== undefined ? { state: snap.state ? v(ARENA_STATE_TEXT[snap.state], "state") : pendingField<string>("the official data gave no known state", asOf, ref) } : {}),
    ...(snap.agent_id !== undefined && snap.agent_id !== null ? { agent_id: v(snap.agent_id, "agentId") } : {}),
    ...(snap.skins !== undefined && snap.skins !== null ? { skins: v(snap.skins, "skins") } : {}),
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

  // One read of its round list, only for an entered Normie. A failed read is reported in the block itself; it never
  // fails the sector, and it is never shown as an empty list.
  // The Arena site's live feed is read alongside, also only for an entered Normie. It never fails the sector either.
  const [roundsRead, liveFeed] = await Promise.all([
    source.loadRounds ? source.loadRounds(tokenId).catch((): ArenaRoundsRead => ({ kind: "unavailable" })) : null,
    source.loadLive ? source.loadLive(tokenId, asOf).catch(() => null) : null,
  ])
  const roundHistory: { round_history?: ArenaRoundHistory; live?: ArenaLive; round_pool?: ArenaRoundPool } = {
    ...(snap.round_pool ? { round_pool: buildArenaRoundPool(snap.round_pool, asOf) } : {}),
    ...(roundsRead ? { round_history: buildArenaRoundHistory(tokenId, roundsRead, asOf) } : {}),
    ...(liveFeed ? { live: liveFeed } : {}),
  }

  if (snap.rounds_played === 0) {
    const rounds =
      snap.any_round_started === false
        ? "No Arena round has started yet, so there's no record"
        : "It hasn't played a round yet, so there's no record"
    // llms.txt: registeredRound is the latest round started when it registered; it plays from the next one.
    const from = snap.registered && snap.registered_round !== undefined && snap.registered_round !== null ? ` It plays from Round ${snap.registered_round + 1}.` : ""
    return {
      status: "entered",
      status_text: `${snap.registered ? "Registered" : "Entered"}.${from} ${rounds}`,
      entry,
      record: pendingArenaRecord("no rounds played yet", asOf, ref),
      rank: NOT_RANKED,
      watch_url: arenaWatchUrl(tokenId),
      ...arenaLinks(tokenId, snap),
      ...roundHistory,
    }
  }

  // The round this Normie last played is the current round and it hasn't ended: its counts can still change.
  const live = snap.live_round ?? null
  const playingRound = live && live.open && snap.last_round === live.current ? live.current : null
  const roundsText = `${snap.rounds_played} ${snap.rounds_played === 1 ? "round" : "rounds"}`
  const wins = v(snap.wins, "wins")
  return {
    status: "unranked",
    status_text: playingRound !== null ? `Playing Round ${playingRound} now: ${roundsText} counted so far` : `Building a record: ${roundsText} played`,
    entry,
    record: {
      matches: v(snap.rounds_played, "roundsPlayed"),
      wins: playingRound !== null ? { ...wins, label: "round in progress" as const } : wins,
      losses: pendingField("the official data doesn't publish losses", asOf, ref),
      pixels_net: pendingField("shown once a round has ended and its results are official", asOf, ref),
      last_match_at: pendingField("the official data gives the last round's number, not its time", asOf, ref),
    },
    rank: NOT_RANKED,
    watch_url: arenaWatchUrl(tokenId),
    ...arenaLinks(tokenId, snap),
    ...roundHistory,
  }
}
