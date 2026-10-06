// AP Check: the pure half (no I/O). How much #PIXEL is attached to a Normie right now, and which item offers sit on Normies
// whose AP is gone.
//
// Why this exists (2026-10-06): holders can strip a Normie's AP (withdraw and sell the #PIXEL) and then sell the empty Normie
// into an item offer that was placed while it still carried AP. The bidder pays for AP that is no longer there. Nothing here can
// stop that; it only lets anyone SEE it: live AP from the chain, next to the offers. Read-only, no wallet, no signatures.
//
// Sources, strongest first:
//   1. the chain: NormiesCanvasStorageV2.attachedOf(tokenId), the truth
//   2. api.normies.art /canvas/token/{id}/pixels: the same number plus the locked / free split (can lag the chain)
//   3. our census (normie_index.action_points, refreshed every 6 h): what the AP was a few hours ago, so a recent drop shows
//   4. OpenSea API v2 offers (item offers only; collection and trait offers are not tied to one Normie)

import { NORMIES_NFT } from "@/constants/contracts"
import { OFFICIAL_CONTRACTS } from "@/lib/official-contracts"

export const MAX_TOKEN_ID = 9999

/** "7141", "#7141", "Normie 7141", or an OpenSea / normies.art link ending in the id. Null when it is not one token id. */
export function parseTokenInput(input: string | null | undefined): number | null {
  if (!input) return null
  let s = input.normalize("NFKC").trim()
  if (/[/?]/.test(s)) {
    // A link: take the last path segment that is only digits (…/normies/7141, …/0x9eb6…/7141, …/normie/7141?x=1).
    const segs = s.split(/[?#]/)[0].split("/").filter(Boolean)
    const last = [...segs].reverse().find((p) => /^\d{1,4}$/.test(p))
    if (!last) return null
    s = last
  }
  s = s.replace(/^(normie\s*)?#?\s*/i, "").replace(/[.,;:!?]+$/, "")
  if (!/^\d{1,4}$/.test(s)) return null
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 && n <= MAX_TOKEN_ID ? n : null
}

/** What the Normies API says about a token's pixels. */
export interface PixelSplit {
  attached: number
  locked: number
  free: number
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0

/** Strict: only the documented shape, for the token we asked about. Anything else is null, never a guessed number. */
export function parsePixelSplit(raw: unknown, tokenId: number): PixelSplit | null {
  if (!isObj(raw)) return null
  if (Number(raw.tokenId) !== tokenId) return null
  if (!isCount(raw.attached) || !isCount(raw.locked) || !isCount(raw.free)) return null
  return { attached: raw.attached, locked: raw.locked, free: raw.free }
}

/** Our census row for a token: AP as of the last 6-hourly refresh. */
export interface CensusAp {
  ap: number | null
  burned: boolean
  /** The Normie's original (base) pixel count, which sets its burn roll. */
  originalPixels?: number | null
  /** When the census last refreshed (ISO), or null if unknown. */
  at: string | null
}

export interface ApReading {
  tokenId: number
  /** attachedOf(tokenId) from the chain. Null when the read failed (never a guess). */
  onchain: number | null
  /** The API's split, when it answered. */
  split: PixelSplit | null
  census: CensusAp | null
}

export type ApVerdict = "has-ap" | "no-ap" | "dropped" | "burned" | "unknown"

export interface ApJudgement {
  verdict: ApVerdict
  /** One plain sentence. */
  line: string
  /** True when an offer on this Normie deserves a second look before anyone relies on it. */
  offerRisk: boolean
}

const utc = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC"

/** Pure: what to tell people about one token. The chain decides; the census only adds "it used to be higher". */
export function judgeAp(r: ApReading): ApJudgement {
  if (r.census?.burned) return { verdict: "burned", line: `Normie #${r.tokenId} has been burned.`, offerRisk: true }
  if (r.onchain === null) return { verdict: "unknown", line: "Could not read the chain just now. Try again in a minute.", offerRisk: false }
  const was = r.census?.ap
  if (was !== null && was !== undefined && was > r.onchain) {
    const when = r.census?.at ? ` (${utc(r.census.at)})` : ""
    return { verdict: "dropped", line: `Pixels went down: ${was} at our last census${when}, ${r.onchain} now.`, offerRisk: true }
  }
  if (r.onchain === 0) return { verdict: "no-ap", line: `Normie #${r.tokenId} has no pixels attached (0 AP).`, offerRisk: true }
  return { verdict: "has-ap", line: `Normie #${r.tokenId} has ${r.onchain} pixels attached (${r.onchain} AP).`, offerRisk: false }
}

/** True when the API's attached count disagrees with the chain (the API is behind). */
export function apiDisagrees(r: ApReading): boolean {
  return r.onchain !== null && r.split !== null && r.split.attached !== r.onchain
}

/** One open item offer on one Normie. */
export interface ItemOffer {
  orderHash: string
  tokenId: number
  maker: string
  /** In ETH units (WETH and ETH both count as 18-decimal ether). */
  price: number
  currency: string
  /** ISO, or null when the offer carries no end time. */
  expiresAt: string | null
}

export interface ParsedOffers {
  offers: ItemOffer[]
  /** Collection, trait or other criteria offers: they are not tied to one Normie, so they cannot be checked against one token's AP. */
  criteria: number
  next: string | null
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const HASH = /^0x[0-9a-fA-F]{64}$/
const ERC721 = 2

function tokenOf(o: Record<string, unknown>, want: string): number | null {
  const asset = o.asset
  if (isObj(asset) && typeof asset.contract === "string" && asset.contract.toLowerCase() === want && typeof asset.identifier === "string") {
    return /^\d{1,4}$/.test(asset.identifier) ? Number(asset.identifier) : null
  }
  // No asset block: an item offer still names the token in what the bidder wants back (an ERC-721 consideration item).
  const params = isObj(o.protocol_data) && isObj(o.protocol_data.parameters) ? o.protocol_data.parameters : null
  const items = params && Array.isArray(params.consideration) ? params.consideration : []
  for (const c of items) {
    if (!isObj(c) || c.itemType !== ERC721) continue
    if (typeof c.token !== "string" || c.token.toLowerCase() !== want) continue
    if (typeof c.identifierOrCriteria === "string" && /^\d{1,4}$/.test(c.identifierOrCriteria)) return Number(c.identifierOrCriteria)
  }
  return null
}

/**
 * Strict parse of an OpenSea v2 OffersResponse ({ offers: Offer[], next }). Keeps only ACTIVE item offers on the Normies
 * contract, priced in ETH or WETH with 18 decimals. Criteria offers are counted, not listed. A body that is not the documented
 * shape is null, so a changed API can never invent an offer.
 */
export function parseItemOffers(raw: unknown, contract: string = NORMIES_NFT): ParsedOffers | null {
  if (!isObj(raw) || !Array.isArray(raw.offers)) return null
  const want = contract.toLowerCase()
  const offers: ItemOffer[] = []
  const seen = new Set<string>()
  let criteria = 0
  for (const o of raw.offers) {
    if (!isObj(o) || o.status !== "ACTIVE") continue
    if (typeof o.remaining_quantity === "number" && o.remaining_quantity <= 0) continue
    const tokenId = tokenOf(o, want)
    if (tokenId === null || tokenId > MAX_TOKEN_ID) {
      if (isObj(o.criteria)) criteria++
      continue
    }
    const price = isObj(o.price) ? o.price : null
    const currency = price?.currency
    const value = price?.value
    if (!price || (currency !== "WETH" && currency !== "ETH") || price.decimals !== 18) continue
    if (typeof value !== "string" || !/^\d+$/.test(value)) continue
    const eth = Number(BigInt(value)) / 1e18
    if (!(eth > 0)) continue
    const params = isObj(o.protocol_data) && isObj(o.protocol_data.parameters) ? o.protocol_data.parameters : null
    const maker = params && typeof params.offerer === "string" && ADDRESS.test(params.offerer) ? params.offerer.toLowerCase() : null
    if (!maker) continue
    const hash = typeof o.order_hash === "string" && HASH.test(o.order_hash) ? o.order_hash.toLowerCase() : null
    if (!hash || seen.has(hash)) continue
    seen.add(hash)
    const end = params && typeof params.endTime === "string" && /^\d{1,12}$/.test(params.endTime) ? Number(params.endTime) : null
    offers.push({ orderHash: hash, tokenId, maker, price: eth, currency, expiresAt: end ? new Date(end * 1000).toISOString() : null })
  }
  offers.sort((a, b) => b.price - a.price || a.tokenId - b.tokenId)
  return { offers, criteria, next: typeof raw.next === "string" && raw.next ? raw.next : null }
}

export const openSeaItemUrl = (tokenId: number) => `https://opensea.io/item/ethereum/${NORMIES_NFT}/${tokenId}`

// ── Listings check ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// The buyer's side of the same problem: OpenSea shows a Normie's traits from its own cached copy of the metadata, including
// "Action Points". A seller can strip the pixels after OpenSea cached them, so a listing can show pixels the Normie no longer
// has. We compare what OpenSea shows against the chain, and against our census, for the cheapest listings.

/** The trait name the Normies metadata uses for attached pixels. */
export const OPENSEA_PIXELS_TRAIT = "Action Points"

/**
 * Strict: what OpenSea currently SHOWS as each Normie's "Action Points", from an NftBatchResponse ({ nfts: [...] }) or an
 * NftResponse ({ nft }). A Normie without that trait maps to null (OpenSea shows none). A body that is not the documented
 * shape is null, so a changed API can never invent a number.
 */
export function parseShownPixels(raw: unknown, contract: string = NORMIES_NFT): Map<number, number | null> | null {
  if (!isObj(raw)) return null
  const list = Array.isArray(raw.nfts) ? raw.nfts : isObj(raw.nft) ? [raw.nft] : null
  if (!list) return null
  const want = contract.toLowerCase()
  const out = new Map<number, number | null>()
  for (const n of list) {
    if (!isObj(n) || typeof n.contract !== "string" || n.contract.toLowerCase() !== want) continue
    if (typeof n.identifier !== "string" || !/^\d{1,4}$/.test(n.identifier)) continue
    if (!Array.isArray(n.traits)) continue
    const t = n.traits.find((x) => isObj(x) && x.trait_type === OPENSEA_PIXELS_TRAIT)
    const v = isObj(t) ? t.value : undefined
    const num = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : null
    out.set(Number(n.identifier), num !== null && Number.isInteger(num) && num >= 0 ? num : null)
  }
  return out
}

export interface ListingInput {
  tokenId: number
  priceEth: number
  /** attachedOf from the chain; null = read failed. */
  live: number | null
  /** What OpenSea shows as "Action Points"; null = OpenSea shows none or could not be asked. */
  shown: number | null
  census: CensusAp | null
}

export interface ListingFlag extends ListingInput {
  /** stale: OpenSea shows more than the chain. dropped: the census had more than the chain. both: both are true. */
  kind: "stale" | "dropped" | "both"
  line: string
}

/** Pure: a flag when a listed Normie has fewer pixels than OpenSea shows or than it had at our census; null when it looks right. */
export function judgeListing(l: ListingInput): ListingFlag | null {
  if (l.live === null || l.census?.burned) return null
  const stale = l.shown !== null && l.shown > l.live
  const was = l.census?.ap
  const dropped = was !== null && was !== undefined && was > l.live
  if (!stale && !dropped) return null
  const kind = stale && dropped ? "both" : stale ? "stale" : "dropped"
  const line = stale
    ? `OpenSea still shows ${l.shown} pixels; it has ${l.live} now.`
    : `Had ${was} pixels at our last census; ${l.live} now.`
  return { ...l, kind, line }
}

// ── Pixel approvals ────────────────────────────────────────────────────────────────────────────────────────────────────────
// Who a wallet has approved to spend its #PIXEL. An approval is custody of that amount, from the wallet or from any Normie the
// wallet owns, so an approval to anything that is not an official Normies contract deserves a hard look.

/** Labels for approved spenders come from the one official list (normies.art/docs), so the Safety tab and the checker agree. */
const officialLabel = (address: string): string | null => {
  const c = OFFICIAL_CONTRACTS.get(address.toLowerCase())
  return c ? `${c.name} (official)` : null
}

export interface ApprovalRow {
  spender: string
  /** Live allowance from the chain (decimal string); null = the read failed. */
  live: string | null
  /** The allowance as last indexed from events (decimal string). */
  indexed: string
  label: string | null
  official: boolean
  /** Very large approvals ("unlimited") are shown as such. */
  unlimited: boolean
}

/** 2^255 or more is how apps write "unlimited". */
const UNLIMITED = BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")

/** Pure: one row per spender ever approved, with the live amount when known; active (live > 0) unofficial ones first. */
export function buildApprovalRows(stored: Array<{ spender: string; amount: string }>, live: Map<string, string | null>): ApprovalRow[] {
  const rows = stored.map((s) => {
    const spender = s.spender.toLowerCase()
    const l = live.has(spender) ? live.get(spender) ?? null : null
    const amount = BigInt(l ?? s.amount)
    const label = officialLabel(spender)
    return { spender, live: l, indexed: s.amount, label, official: label !== null, unlimited: amount >= UNLIMITED }
  })
  const rank = (r: ApprovalRow) => (r.live === null ? 1 : BigInt(r.live) > BigInt(0) ? (r.official ? 2 : 0) : 3)
  return rows.sort((a, b) => rank(a) - rank(b) || a.spender.localeCompare(b.spender))
}

/** True when a row is an approval that is still live (or could not be read but was live when indexed). */
export function isActiveApproval(r: ApprovalRow): boolean {
  return BigInt(r.live ?? r.indexed) > BigInt(0)
}

// ── Pixel history ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// api.normies.art /canvas/token/{id}/activity: every change to the pixels attached to one Normie, newest first. This is the
// strongest evidence that a Normie was stripped: the exact time and amount pixels were taken off, not a 6-hourly census guess.
// Seen live 2026-10-06: #4632 carried 101 pixels (migration, Oct 5) and had all 101 withdrawn on Oct 6 12:26 UTC.

export interface PixelEvent {
  /** deposit (put on), withdraw (taken off), migration (copied from the old canvas), and whatever else the API adds. */
  reason: string
  amount: number
  /** Pixels on the Normie right after this event. */
  after: number
  at: string
  tx: string | null
}

/** Strict: only "attached" events with whole amounts. Anything else is skipped, never guessed. */
export function parsePixelEvents(raw: unknown): PixelEvent[] | null {
  if (!isObj(raw) || !Array.isArray(raw.events)) return null
  const out: PixelEvent[] = []
  for (const e of raw.events) {
    if (!isObj(e) || e.kind !== "attached" || typeof e.reason !== "string") continue
    const amount = typeof e.amount === "string" && /^\d+$/.test(e.amount) ? Number(e.amount) : null
    const after = typeof e.newAttached === "string" && /^\d+$/.test(e.newAttached) ? Number(e.newAttached) : null
    const ts = typeof e.timestamp === "string" && /^\d+$/.test(e.timestamp) ? Number(e.timestamp) : null
    if (amount === null || after === null || ts === null) continue
    const tx = typeof e.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(e.txHash) ? e.txHash.toLowerCase() : null
    out.push({ reason: e.reason, amount, after, at: new Date(ts * 1000).toISOString(), tx })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

const REASON_TEXT: Record<string, string> = {
  deposit: "put on",
  withdraw: "taken off",
  migration: "carried over to the new canvas",
  burn: "added by a burn",
  enlarge: "spent on a bigger canvas",
  clearBase: "spent on a blank canvas",
}
export const reasonText = (r: string) => REASON_TEXT[r] ?? r

/** How long ago, in plain words. */
export function ago(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 90) return "just now"
  const m = Math.round(s / 60)
  if (m < 90) return `${m} minutes ago`
  const h = Math.round(m / 60)
  if (h < 36) return `${h} hours ago`
  return `${Math.round(h / 24)} days ago`
}

/** Pixels taken off within the window, and the most recent withdrawal. */
export function recentWithdrawals(events: PixelEvent[], windowHours = 72, now: number = Date.now()) {
  const since = now - windowHours * 3_600_000
  const recent = events.filter((e) => e.reason === "withdraw" && Date.parse(e.at) >= since)
  return { takenOff: recent.reduce((s, e) => s + e.amount, 0), last: recent[0] ?? null }
}

/**
 * Fold the pixel history into the judgement: a recent withdrawal is the clearest stripped signal there is, so it wins over the
 * census comparison. Burned and unknown readings are left alone.
 */
export function judgeWithHistory(base: ApJudgement, r: ApReading, history: PixelEvent[] | null, now: number = Date.now()): ApJudgement {
  if (!history || r.onchain === null || base.verdict === "burned" || base.verdict === "unknown") return base
  const { takenOff, last } = recentWithdrawals(history, 72, now)
  if (!last || takenOff <= 0) return base
  return {
    verdict: "dropped",
    line: `${takenOff} ${takenOff === 1 ? "pixel was" : "pixels were"} taken off this Normie in the last 3 days (latest ${ago(last.at, now)}); it has ${r.onchain} now.`,
    offerRisk: true,
  }
}
