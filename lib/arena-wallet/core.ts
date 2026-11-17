// Arena wallet check (Claude, 2026-11-17): a wallet address or ENS name in, that wallet's Normies in the Arena out.
// Pure functions only; the reads are in ./load.ts.
//
// Rules:
//   - Input is a 0x address or a .eth name, nothing else. Social handles and emails are refused and never looked up.
//   - Official data only: `GET /arena/holder/{address}` (api.normies.art), read through the polite Arena reader.
//   - No amounts. The holder response's `balance` and `pixelsWon`, and each Normie's amount fields, are never read.
//   - Six different answers, never merged: bad input, name not found, couldn't read (ENS or the Arena), no entry (404),
//     empty (no Normies in the Arena) and ok. Only "couldn't read" is uncached.
//   - Input that failed the check is never echoed back, on the page or in the API.
// Field names come from two real responses (read 2026-11-17, addresses replaced with placeholders):
// fixtures/arena-holder-one-normie.json and fixtures/arena-holder-empty.json.

import { normalizeWalletInput } from "@/lib/burn-buy/wallet-input"
import { shortenAddress } from "@/lib/format"
import { ARENA_STATES, ARENA_STATE_TEXT, type ArenaLiveRound, type ArenaState } from "@/lib/record-card/arena"

export const ARENA_WALLET_SOURCE_LABEL = "Official Arena data (api.normies.art)"
export const ARENA_WALLET_REF = "GET /arena/holder/{address}"
export const ARENA_WALLET_EMPTY_TEXT = "No Normies from this wallet in the Arena"
/** Shown when the API's own totals for the wallet differ from the list it gave. The list is still shown. */
export const ARENA_WALLET_COUNTS_NOTE = "The official totals for this wallet don't match the list; showing the list."
/** Shared cache for an answer that was read. "Couldn't read" is never cached. */
export const ARENA_WALLET_CACHE_SECONDS = 60

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const ENS_NAME = /^(?=.{3,255}$)(?:[a-z0-9-]+\.)+eth$/
const MAX_INPUT_LENGTH = 300

export type WalletQuery = { kind: "address"; address: string } | { kind: "ens"; name: string } | { kind: "missing" } | { kind: "bad" }

/**
 * What was typed, as a lower-cased 0x address or a .eth name. Anything else is "bad": an @handle, an email, a name on
 * another domain, a transaction hash, free text. Nothing is ever looked up for a bad input.
 */
export function parseWalletQuery(raw: string | null | undefined): WalletQuery {
  if (raw === null || raw === undefined || raw.trim() === "") return { kind: "missing" }
  if (raw.length > MAX_INPUT_LENGTH) return { kind: "bad" }
  const cleaned = normalizeWalletInput(raw)
  if (ADDRESS.test(cleaned)) return { kind: "address", address: cleaned.toLowerCase() }
  if (ENS_NAME.test(cleaned)) return { kind: "ens", name: cleaned }
  return { kind: "bad" }
}

/** A whole number, or a string of digits only. Anything else is null. */
function wholeNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 ? v : null
  if (typeof v === "string" && /^\d{1,15}$/.test(v)) return Number(v)
  return null
}

/** One Normie from the holder list. Counts and state only. */
export type HolderNormie = {
  tokenId: number
  state: ArenaState
  registered: boolean
  registeredRound: number | null
  roundsPlayed: number
  wins: number
  lastRound: number | null
}

export type ArenaHolder = {
  /** Lower-cased. */
  address: string
  /** The API's own counts for this wallet, as given. */
  counts: { registered: number; active: number; short: number }
  /** Whether those counts match the list (rows registered, rows active, rows short). A mismatch is reported, not refused. */
  countsMatch: boolean
  /** Sorted by Normie number. */
  normies: HolderNormie[]
}

function parseHolderNormie(raw: unknown, address: string): HolderNormie | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const tokenId = wholeNumber(r.tokenId)
  if (tokenId === null || tokenId > 9999) return null
  if (typeof r.state !== "string" || !(ARENA_STATES as readonly string[]).includes(r.state)) return null
  if (typeof r.registered !== "boolean") return null
  if (typeof r.owner !== "string" || r.owner.toLowerCase() !== address) return null
  const roundsPlayed = wholeNumber(r.roundsPlayed)
  const wins = wholeNumber(r.wins)
  if (roundsPlayed === null || wins === null || wins > roundsPlayed) return null
  let lastRound: number | null = null
  if (!(r.lastRound === null && roundsPlayed === 0)) {
    lastRound = wholeNumber(r.lastRound)
    if (lastRound === null) return null
  }
  return { tokenId, state: r.state as ArenaState, registered: r.registered, registeredRound: wholeNumber(r.registeredRound), roundsPlayed, wins, lastRound }
}

/**
 * Parse `GET /arena/holder/{address}`. Strict: `address` must be the wallet asked for; `registered`, `active` and `short`
 * must be whole numbers; `normies` must be a list whose rows each have a Normie number (0-9999), a known state, a
 * boolean `registered`, this wallet as `owner`, and whole-number rounds and wins (wins <= rounds). No Normie may appear
 * twice. Anything else is refused (null). Counts that don't match the list are not refused: the list stands and
 * `countsMatch` is false. `balance`, `pixelsWon` and every other amount field are never read.
 */
export function parseArenaHolder(raw: unknown, address: string): ArenaHolder | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const wanted = address.toLowerCase()
  const r = raw as Record<string, unknown>
  if (typeof r.address !== "string" || r.address.toLowerCase() !== wanted) return null
  const registered = wholeNumber(r.registered)
  const active = wholeNumber(r.active)
  const short = wholeNumber(r.short)
  if (registered === null || active === null || short === null) return null
  if (!Array.isArray(r.normies)) return null
  const normies: HolderNormie[] = []
  const seen = new Set<number>()
  for (const row of r.normies) {
    const n = parseHolderNormie(row, wanted)
    if (!n || seen.has(n.tokenId)) return null
    seen.add(n.tokenId)
    normies.push(n)
  }
  const countsMatch =
    normies.filter((n) => n.registered).length === registered &&
    normies.filter((n) => n.state === "active").length === active &&
    normies.filter((n) => n.state === "short").length === short
  normies.sort((a, b) => a.tokenId - b.tokenId)
  return { address: wanted, counts: { registered, active, short }, countsMatch, normies }
}

/** What `GET /arena/status` said, when it could be read. Both null = unknown. */
export type ArenaRoundContext = { live: ArenaLiveRound | null; anyRoundStarted: boolean | null }

/**
 * The same status line the record card shows for this Normie (lib/record-card/arena.ts, loadArenaSector), built from its
 * holder row. A test pins the two together for #7141. The holder row has no `inCurrentRound`, so a Normie counts as
 * entered when it is registered or has played a round.
 */
export function holderStatusLine(n: HolderNormie, ctx: ArenaRoundContext): string {
  if (!n.registered && n.roundsPlayed === 0) return "Not entered in Arena"
  if (n.roundsPlayed === 0) {
    const rounds = ctx.anyRoundStarted === false ? "No Arena round has started yet, so there's no record" : "It hasn't played a round yet, so there's no record"
    const from = n.registered && n.registeredRound !== null ? ` It plays from Round ${n.registeredRound + 1}.` : ""
    return `${n.registered ? "Registered" : "Entered"}.${from} ${rounds}`
  }
  const roundsText = `${n.roundsPlayed} ${n.roundsPlayed === 1 ? "round" : "rounds"}`
  const playing = ctx.live && ctx.live.open && n.lastRound === ctx.live.current ? ctx.live.current : null
  return playing !== null ? `Playing Round ${playing} now: ${roundsText} counted so far` : `Building a record: ${roundsText} played`
}

export type ArenaWalletRow = { token_id: number; state: ArenaState; state_text: string; status_text: string; record_path: string }

type Wallet = { address: string; ens: string | null }

/** The answer to one wallet check. Each kind is a different answer; only "unavailable" means couldn't read. */
export type ArenaWalletResult =
  | { kind: "missing" }
  | { kind: "bad_input" }
  | { kind: "ens_not_found" }
  | { kind: "unavailable"; what: "ens" | "arena" }
  | { kind: "not_found"; wallet: Wallet; as_of: string }
  | { kind: "empty"; wallet: Wallet; as_of: string; counts_match: boolean }
  | {
      kind: "ok"
      wallet: Wallet
      as_of: string
      normies: ArenaWalletRow[]
      /** `listed` is NCH's count of the rows; the other three are the API's own totals, as given. */
      counts: { listed: number; registered: number; active: number; short: number }
      /** False when the API's totals differ from the list. The list is shown either way. */
      counts_match: boolean
    }

export function arenaWalletRows(holder: ArenaHolder, ctx: ArenaRoundContext): ArenaWalletRow[] {
  return holder.normies.map((n) => ({
    token_id: n.tokenId,
    state: n.state,
    state_text: ARENA_STATE_TEXT[n.state],
    status_text: holderStatusLine(n, ctx),
    record_path: `/record/${n.tokenId}`,
  }))
}

export const ARENA_WALLET_TEXT = {
  missing: "Enter a wallet address (0x…) or an ENS name (name.eth)",
  bad_input: "That isn't a wallet address or an ENS name. Use a 0x address or a name ending in .eth",
  ens_not_found: "That ENS name doesn't point to a wallet",
  unavailable_ens: "Couldn't read ENS right now. Try again, or use the 0x address",
  unavailable_arena: "Couldn't read the Arena right now. Try again in a minute",
  not_found: "The official Arena data has no entry for this wallet",
  empty: ARENA_WALLET_EMPTY_TEXT,
} as const

export function arenaWalletText(result: ArenaWalletResult): string {
  switch (result.kind) {
    case "unavailable":
      return result.what === "ens" ? ARENA_WALLET_TEXT.unavailable_ens : ARENA_WALLET_TEXT.unavailable_arena
    case "ok": {
      const n = result.normies.length
      return `${n} ${n === 1 ? "Normie" : "Normies"} from this wallet in the Arena`
    }
    default:
      return ARENA_WALLET_TEXT[result.kind]
  }
}

/** The wallet as shown in the UI: its ENS name, or 0x1234…abcd. Never the full address. */
export function walletLabel(wallet: Wallet): string {
  return wallet.ens ?? shortenAddress(wallet.address, 4)
}

/** Only an answer that couldn't be read is uncached. */
export function arenaWalletCacheControl(result: ArenaWalletResult): string {
  return result.kind === "unavailable" ? "no-store" : `public, s-maxage=${ARENA_WALLET_CACHE_SECONDS}, stale-while-revalidate=${ARENA_WALLET_CACHE_SECONDS * 2}`
}

const HTTP_STATUS: Record<ArenaWalletResult["kind"], number> = { missing: 400, bad_input: 400, ens_not_found: 404, unavailable: 503, not_found: 404, empty: 200, ok: 200 }

/**
 * The API answer: status, JSON body and cache header. The body is built field by field from the result, so nothing the
 * caller typed and nothing from the upstream response (amounts, error text) can pass through.
 */
export function arenaWalletResponse(result: ArenaWalletResult): { status: number; body: Record<string, unknown>; cacheControl: string } {
  const base = { result: result.kind, text: arenaWalletText(result) }
  const cacheControl = arenaWalletCacheControl(result)
  const status = HTTP_STATUS[result.kind]
  if (result.kind === "missing" || result.kind === "bad_input" || result.kind === "ens_not_found") return { status, body: base, cacheControl }
  if (result.kind === "unavailable") return { status, body: { ...base, could_not_read: result.what }, cacheControl }
  const wallet = { address: result.wallet.address, short: shortenAddress(result.wallet.address, 4), ens: result.wallet.ens }
  const source = { kind: "official_api", label: ARENA_WALLET_SOURCE_LABEL, ref: ARENA_WALLET_REF }
  const note = result.kind !== "not_found" && !result.counts_match ? { counts_match: false, note: ARENA_WALLET_COUNTS_NOTE } : {}
  if (result.kind === "ok") {
    return { status, body: { ...base, wallet, normies: result.normies, counts: result.counts, ...note, source, as_of: result.as_of }, cacheControl }
  }
  return { status, body: { ...base, wallet, normies: [], ...note, source, as_of: result.as_of }, cacheControl }
}
