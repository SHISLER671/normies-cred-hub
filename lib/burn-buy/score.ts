// Pixel Market scoring + burn yield. Pure functions, no I/O.
//
// Source of truth: @normiesART, "Pixel Market: The Currency of the Canvas" (Sep 23, 2026),
// https://x.com/normiesART/article/2102443937935864216 . Numbers here are the article's, not guesses:
//   score = (held x bracket + #PIXEL / 5) x (1 + boost)
// Launch is "planned for October 5th, pending the audits closing on schedule" - not guaranteed,
// so callers must not treat the promo end date as fixed.

/** Bracket multiplier applies to the WHOLE stack, by how many Normies a wallet holds. */
const BRACKETS: ReadonlyArray<{ min: number; mult: number }> = [
  { min: 50, mult: 1.75 },
  { min: 25, mult: 1.6 },
  { min: 10, mult: 1.45 },
  { min: 5, mult: 1.3 },
  { min: 2, mult: 1.15 },
  { min: 1, mult: 1.0 },
]

/** Boost cliffs by #PIXEL held (whole score jumps at each line). */
const BOOSTS: ReadonlyArray<{ min: number; boost: number }> = [
  { min: 1500, boost: 1.0 },
  { min: 500, boost: 0.6 },
  { min: 100, boost: 0.35 },
  { min: 15, boost: 0.15 },
]

/** Held-count thresholds where the bracket multiplier steps up (2, 5, 10, 25, 50). */
export const BRACKET_CLIFFS = [2, 5, 10, 25, 50] as const
/** #PIXEL thresholds where the boost steps up. */
export const BOOST_CLIFFS = [15, 100, 500, 1500] as const

/** Every #PIXEL is worth 1/5 of a point, flat, no cliff or diminishing rung. */
export const PIXEL_PER_POINT = 5

/** Burn yield promo: fixed 4% of the burned Normie's ORIGINAL pixel count, until Pixel Market launches. */
export const PROMO_RATE_PERCENT = 4

export function bracketMultiplier(held: number): number {
  if (!Number.isFinite(held) || held < 1) return 0
  for (const b of BRACKETS) if (held >= b.min) return b.mult
  return 0
}

export function boostFor(pixel: number): number {
  if (!Number.isFinite(pixel) || pixel < 0) return 0
  for (const b of BOOSTS) if (pixel >= b.min) return b.boost
  return 0
}

/** A wallet with no Normies scores zero: #PIXEL alone earns nothing. */
export function walletScore(held: number, pixel: number): number {
  if (!Number.isFinite(held) || held < 1) return 0
  const px = Math.max(0, Number.isFinite(pixel) ? pixel : 0)
  return (held * bracketMultiplier(held) + px / PIXEL_PER_POINT) * (1 + boostFor(px))
}

/** Share of the pool for a wallet that is ALREADY counted in totalScore. */
export function shareOfPool(score: number, totalScore: number): number {
  return totalScore > 0 ? score / totalScore : 0
}

/** Share for a hypothetical wallet added on top of the census (how the article's table is computed). */
export function shareIfAdded(score: number, censusScore: number): number {
  const denom = censusScore + score
  return denom > 0 ? score / denom : 0
}

/**
 * #PIXEL (action points) a burn awards under the promo:
 * floor(4% of ORIGINAL pixels) + the burned token's ENTIRE AP balance (it moves to the receiver).
 * Integer math on purpose: no float rounding at whole-number boundaries.
 * Verified against on-chain burn records (see tests).
 */
export function promoBurnYield(originalPixels: number, burnedTokenAp: number) {
  const px = Math.max(0, Math.trunc(originalPixels))
  const transferred = Math.max(0, Math.trunc(burnedTokenAp))
  const fromPixels = Math.trunc((px * PROMO_RATE_PERCENT) / 100)
  return { fromPixels, transferred, total: fromPixels + transferred }
}
