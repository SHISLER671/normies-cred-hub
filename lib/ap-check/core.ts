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
