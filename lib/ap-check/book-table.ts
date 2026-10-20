// The Pixel Market order book as a read-only table for /pixels (Ryan, 2026-10-21: "a table of available pixels, almost
// mimicking the marketplace, not clickable, with a link to the marketplace"). Pure, so it is tested on its own.
//
// Rows are the official book's PRICE LEVELS (api.normies.art /market/depth): pixels listed at each price, cheapest first.
// No listing ids, no sellers, no buy buttons: NCH is look-only, and buying happens on the official Pixel Market.

import type { DepthLevel } from "@/lib/burn-buy/market-math"

/** The official Pixel Market page. Buying happens there, never on NCH. */
export const PIXEL_MARKET_URL = "https://www.normies.art/lab/pixel-market"

export interface BookRow {
  priceEth: number
  /** Pixels listed at this price. */
  pixels: number
  /** Of those, how many must be bought as a whole listing (not partial-fill). */
  wholeOnly: number
  /** Pixels from the cheapest level up to and including this one. */
  runningPixels: number
  /** ETH to buy every pixel from the cheapest level up to and including this one (before gas). */
  runningCostEth: number
  /** This level is needed to reach the amount asked for (when one was given). */
  needed: boolean
}

const round = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d

/**
 * Cheapest first. `want` (pixels) marks the levels you would buy through to get that many; omit it to mark none.
 * Bad levels (non-finite, zero or negative price, no pixels) are skipped rather than shown.
 */
export function bookRows(depth: readonly DepthLevel[] | null | undefined, want?: number | null): BookRow[] {
  if (!depth?.length) return []
  const levels = depth
    .filter((l) => Number.isFinite(l.priceEth) && l.priceEth > 0 && Number.isFinite(l.remaining) && l.remaining > 0)
    .slice()
    .sort((a, b) => a.priceEth - b.priceEth)
  const target = want != null && Number.isFinite(want) && want > 0 ? want : null
  let pixels = 0
  let cost = 0
  return levels.map((l) => {
    const before = pixels
    pixels += l.remaining
    cost += l.priceEth * l.remaining
    const partial = Number.isFinite(l.partialRemaining) ? Math.min(Math.max(l.partialRemaining, 0), l.remaining) : l.remaining
    return {
      priceEth: l.priceEth,
      pixels: l.remaining,
      wholeOnly: l.remaining - partial,
      runningPixels: pixels,
      runningCostEth: round(cost),
      needed: target !== null && before < target,
    }
  })
}
