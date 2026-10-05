// What the Normies contract itself says about burn yield, read from the official API (GET https://api.normies.art/canvas/status):
//   { paused, maxBurnPercent, tierThresholds: [490, 890], tierMinPercents: [..] }
// Seen live 2026-10-05: tierMinPercents [4,4,4] with maxBurnPercent 4 = a minimum of 4% in EVERY tier = the fixed 4% promo is active.
// The normal tiers (Sep 23 article: 0-490 px 1-4%, 491-890 px 2-4%, 891+ px 3-4%) would read [1,2,3].
// (That reading of the numbers is an inference from the field names and the announced promo, so everything here fails safe to the clock.)
//
// Why: the clock only GUESSES when the promo ends (announced as 16:00 to 18:00 UTC, relayed, not verified). Showing the normal roll while the
// contract still pays a fixed 4% understates a holder's yield, and a burn is permanent. This lets the page follow the contract exactly.

/**
 * The Pixel Market stack, as /canvas/status reports it once it is configured (seen live 2026-10-05, after the 18:00 UTC launch):
 *   "pixelMarket": { canvasAddress, marketAddress, enlargePrices, blankCanvasPrice, treasury, market: { paused, feeBps, revenueShareBps } }
 * The api.normies.art llms.txt says the object is only added "once the Pixel Market stack is configured", so its presence is the market being open.
 */
export interface PixelMarketStatus {
  marketAddress: string
  paused: boolean
  feeBps: number
  revenueShareBps: number
}

export interface BurnContractStatus {
  paused: boolean
  maxBurnPercent: number
  tierThresholds: number[]
  tierMinPercents: number[]
  /** Present only when the contract status carries a well-formed pixelMarket block. */
  pixelMarket?: PixelMarketStatus
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** Strict: a missing or malformed block is null (so a changed API can never be misread as "market open"). */
export function parsePixelMarket(raw: unknown): PixelMarketStatus | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const m = r.market
  if (typeof r.marketAddress !== "string" || !ADDRESS.test(r.marketAddress)) return null
  if (!m || typeof m !== "object") return null
  const mm = m as Record<string, unknown>
  const bps = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10_000
  if (typeof mm.paused !== "boolean" || !bps(mm.feeBps) || !bps(mm.revenueShareBps)) return null
  return { marketAddress: r.marketAddress, paused: mm.paused, feeBps: mm.feeBps as number, revenueShareBps: mm.revenueShareBps as number }
}

/** fixed: every tier pays exactly the fixed rate this page knows (4%). tiered: a roll inside a range. unknown: cannot tell, use the clock. */
export type ContractRate = "fixed" | "tiered" | "unknown"

export const FIXED_PROMO_PERCENT = 4

const isNumArray = (v: unknown): v is number[] => Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === "number" && Number.isFinite(n))

/** Strict: anything that is not exactly the documented shape is null (so a changed API can never be misread). */
export function parseContractStatus(raw: unknown): BurnContractStatus | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.paused !== "boolean") return null
  if (typeof r.maxBurnPercent !== "number" || !Number.isFinite(r.maxBurnPercent) || r.maxBurnPercent <= 0) return null
  if (!isNumArray(r.tierMinPercents) || !isNumArray(r.tierThresholds)) return null
  if (r.tierMinPercents.length !== r.tierThresholds.length + 1) return null
  if (r.tierMinPercents.some((n) => n < 0 || n > (r.maxBurnPercent as number))) return null
  const pixelMarket = parsePixelMarket(r.pixelMarket)
  return { paused: r.paused, maxBurnPercent: r.maxBurnPercent, tierThresholds: r.tierThresholds, tierMinPercents: r.tierMinPercents, ...(pixelMarket ? { pixelMarket } : {}) }
}

export function contractRate(s: BurnContractStatus | null): ContractRate {
  if (!s) return "unknown"
  const allAtMax = s.tierMinPercents.every((m) => m === s.maxBurnPercent)
  if (allAtMax) return s.maxBurnPercent === FIXED_PROMO_PERCENT ? "fixed" : "unknown" // a fixed rate other than 4% is not something this page can state
  return "tiered"
}

/** Does the contract's normal tier table match what this page's advice assumes (thresholds 490 / 890, minimums 1 / 2 / 3, maximum 4)? */
export function matchesKnownTiers(s: BurnContractStatus): boolean {
  const mins = s.tierMinPercents
  return s.maxBurnPercent === 4 && s.tierThresholds.length === 2 && s.tierThresholds[0] === 490 && s.tierThresholds[1] === 890 && mins.length === 3 && mins[0] === 1 && mins[1] === 2 && mins[2] === 3
}

/** One short, never-throwing read. Null on any problem (timeout, HTTP error, a shape we do not recognise). */
export async function loadBurnContractStatus(fetchImpl: typeof fetch = fetch, timeoutMs = 2_500): Promise<BurnContractStatus | null> {
  try {
    const res = await fetchImpl("https://api.normies.art/canvas/status", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    return parseContractStatus(await res.json())
  } catch {
    return null
  }
}
