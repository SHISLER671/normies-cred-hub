// Pixel Market scoring + burn yield. Pure functions, no I/O.
//
// Source of truth: @normiesART, "Pixel Market: The Currency of the Canvas" (Sep 23, 2026),
// https://x.com/normiesART/article/2102443937935864216 . Numbers here are the article's, not guesses:
//   score = (held x bracket + #PIXEL / 5) x (1 + boost)
// Launch is "planned for October 5th, pending the audits closing on schedule" - not guaranteed,
// so callers must not treat the promo end date as fixed.

/** Bracket multiplier applies to the WHOLE stack, by how many Normies a wallet holds. */
export const BRACKETS: ReadonlyArray<{ min: number; mult: number }> = [
  { min: 50, mult: 1.75 },
  { min: 25, mult: 1.6 },
  { min: 10, mult: 1.45 },
  { min: 5, mult: 1.3 },
  { min: 2, mult: 1.15 },
  { min: 1, mult: 1.0 },
]

/** Boost cliffs by #PIXEL held (whole score jumps at each line). */
export const BOOSTS: ReadonlyArray<{ min: number; boost: number }> = [
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

/** "promo" = today (fixed 4%). "launched" = Pixel Market is open and burns roll inside a tier range. Flipped by one env var. */
export type Phase = "promo" | "launched"

/**
 * After launch a burn rolls a random rate inside a range set by the burned Normie's ORIGINAL pixel count
 * (@normiesART article "Pixel Market: The Currency of the Canvas", Sep 23, 2026). Realized average over the first
 * 2,718 burns was 2.74%. These tiers come from that article and are not yet confirmed by a launch-day source.
 */
export const LAUNCH_TIERS: ReadonlyArray<{ maxPixels: number; minPct: number; maxPct: number }> = [
  { maxPixels: 490, minPct: 1, maxPct: 4 },
  { maxPixels: 890, minPct: 2, maxPct: 4 },
  { maxPixels: Number.POSITIVE_INFINITY, minPct: 3, maxPct: 4 },
]

export function launchTier(originalPixels: number) {
  const px = Math.max(0, Math.trunc(originalPixels))
  return LAUNCH_TIERS.find((t) => px <= t.maxPixels) ?? LAUNCH_TIERS[LAUNCH_TIERS.length - 1]
}

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
export interface BurnYield {
  fromPixels: number
  transferred: number
  total: number
  /** Launched phase only: the pixel part can land anywhere in this range; `fromPixels` is the middle (a planning figure). */
  range?: { min: number; max: number }
}

export function promoBurnYield(originalPixels: number, burnedTokenAp: number): BurnYield {
  const px = Math.max(0, Math.trunc(originalPixels))
  const transferred = Math.max(0, Math.trunc(burnedTokenAp))
  const fromPixels = Math.trunc((px * PROMO_RATE_PERCENT) / 100)
  return { fromPixels, transferred, total: fromPixels + transferred }
}

/**
 * #PIXEL a burn awards after launch: a roll inside the tier range, plus the burned token's ENTIRE AP balance.
 * `fromPixels` is the MIDDLE of the range (an assumption: an even roll), used only to rank and compare. The real
 * result can be anywhere in `range`.
 */
export function launchedBurnYield(originalPixels: number, burnedTokenAp: number): BurnYield {
  const px = Math.max(0, Math.trunc(originalPixels))
  const transferred = Math.max(0, Math.trunc(burnedTokenAp))
  const tier = launchTier(px)
  const min = Math.trunc((px * tier.minPct) / 100)
  const max = Math.trunc((px * tier.maxPct) / 100)
  const fromPixels = Math.round((px * (tier.minPct + tier.maxPct)) / 200)
  return { fromPixels, transferred, total: fromPixels + transferred, range: { min, max } }
}

export function burnYield(phase: Phase, originalPixels: number, burnedTokenAp: number): BurnYield {
  return phase === "launched" ? launchedBurnYield(originalPixels, burnedTokenAp) : promoBurnYield(originalPixels, burnedTokenAp)
}
