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

/**
 * How a burn pays. "promo" = the fixed 4% (ends Monday Oct 5 per Serc). "normal" = a roll inside a tier range.
 * Flipped by BURN_YIELD_MODE. Independent of whether the marketplace is open (see MarketState).
 */
export type YieldMode = "promo" | "normal"

/** Whether Pixel Market (the #PIXEL exchange) is open. Flipped by PIXEL_MARKET. Independent of the burn yield. */
export type MarketState = "pending" | "live"

/**
 * In normal mode a burn rolls a random rate inside a range set by the burned Normie's ORIGINAL pixel count
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
  /** Normal mode only: the pixel part can land anywhere in this range; `fromPixels` is the middle (a planning figure). */
  range?: { min: number; max: number }
}

export function promoBurnYield(originalPixels: number, burnedTokenAp: number): BurnYield {
  const px = Math.max(0, Math.trunc(originalPixels))
  const transferred = Math.max(0, Math.trunc(burnedTokenAp))
  const fromPixels = Math.trunc((px * PROMO_RATE_PERCENT) / 100)
  return { fromPixels, transferred, total: fromPixels + transferred }
}

/**
 * #PIXEL a burn awards in normal mode: a roll inside the tier range, plus the burned token's ENTIRE AP balance.
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

export function burnYield(mode: YieldMode, originalPixels: number, burnedTokenAp: number): BurnYield {
  return mode === "normal" ? launchedBurnYield(originalPixels, burnedTokenAp) : promoBurnYield(originalPixels, burnedTokenAp)
}

export interface CliffSide {
  /** The count you hold now. */
  have: number
  /** The multiplier (Normies) or boost fraction (#PIXEL) you have now. */
  now: number
  /** The next step up: where it starts, how many more you need, and what it would be. Null at the top. */
  next: { at: number; needMore: number; value: number } | null
  /** The step you are standing on: where it starts, how many you can lose before dropping, and what you would drop to. Null when below the first step. */
  floor: { at: number; spare: number; dropsTo: number } | null
}

/**
 * Where a wallet stands against each cliff, so a seller can see what dropping below one costs and a buyer what the
 * next one needs. Pure arithmetic on the published ladders: no prices.
 */
export function cliffStatus(held: number, pixel: number): { normies: CliffSide; pixel: CliffSide } {
  const h = Number.isFinite(held) && held > 0 ? Math.floor(held) : 0
  const p = Number.isFinite(pixel) && pixel > 0 ? Math.floor(pixel) : 0
  const bracketsAsc = [...BRACKETS].reverse()
  const boostsAsc = [...BOOSTS].reverse()

  const side = (have: number, now: number, steps: ReadonlyArray<{ min: number; value: number }>, base: number): CliffSide => {
    const nextStep = steps.find((s) => s.min > have)
    const idx = steps.reduce((acc, s, i) => (s.min <= have ? i : acc), -1)
    const floorStep = idx >= 0 ? steps[idx] : null
    const below = idx > 0 ? steps[idx - 1].value : base
    return {
      have,
      now,
      next: nextStep ? { at: nextStep.min, needMore: nextStep.min - have, value: nextStep.value } : null,
      floor: floorStep ? { at: floorStep.min, spare: have - floorStep.min, dropsTo: below } : null,
    }
  }

  return {
    normies: side(h, bracketMultiplier(h), bracketsAsc.map((b) => ({ min: b.min, value: b.mult })), 0),
    pixel: side(p, boostFor(p), boostsAsc.map((b) => ({ min: b.min, value: b.boost })), 0),
  }
}
