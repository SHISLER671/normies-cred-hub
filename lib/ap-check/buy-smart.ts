// Buy smart: the cheapest way to get #PIXEL, compared two ways. Pure (no I/O); every input is live data passed in.
//
//   Pixel Market: walk the real order book from the cheapest listing up (exact, apart from listings that must be bought whole).
//   Burn floor Normies: buy the cheapest-per-pixel Normie listings and burn them. Each pays a roll of its ORIGINAL pixels (a tier
//                       range, or a fixed 4% during a promo) PLUS every pixel attached to it, read live from the chain, so a stripped
//                       Normie is priced as stripped. The roll makes it a range: worst, typical, best.
//
// Nothing here says what to do. It compares two costs, says how sure each one is, and leaves the gamble to the reader.

import { burnYield, type YieldMode } from "@/lib/burn-buy/score"
import { buyCost, type DepthLevel } from "@/lib/burn-buy/market-math"

export type BuyMode = "pixels" | "eth"

/** A listed Normie, priced and read live. */
export interface BurnCandidate {
  tokenId: number
  priceEth: number
  /** The Normie's original (base) pixel count, which sets the burn roll. */
  originalPixels: number
  /** Pixels attached right now, from the chain. They all move to the receiver on a burn. */
  livePixels: number
  /** Burning erases edited art. */
  customized?: boolean
}

export interface BurnPick extends BurnCandidate {
  /** What burning it pays, worst roll / typical / best roll (all equal at a fixed rate). */
  low: number
  mid: number
  high: number
  /** ETH per pixel at the typical roll. */
  ethPerPixel: number
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4
const r6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Every candidate priced as a burn, cheapest per pixel first. Candidates that would pay nothing are dropped. */
export function burnPicks(cands: BurnCandidate[], mode: YieldMode): BurnPick[] {
  const out: BurnPick[] = []
  for (const c of cands) {
    if (!(c.priceEth > 0)) continue
    const y = burnYield(mode, c.originalPixels, c.livePixels)
    const low = (y.range ? y.range.min : y.fromPixels) + y.transferred
    const high = (y.range ? y.range.max : y.fromPixels) + y.transferred
    const mid = y.total
    if (mid <= 0) continue
    out.push({ ...c, low, mid, high, ethPerPixel: c.priceEth / mid })
  }
  return out.sort((a, b) => a.ethPerPixel - b.ethPerPixel || a.priceEth - b.priceEth || a.tokenId - b.tokenId)
}

/** Most Normies one plan may use: past this the gas and the clicking stop being realistic. */
export const MAX_BURNS = 25

export interface BurnPlan {
  picks: BurnPick[]
  costEth: number
  low: number
  mid: number
  high: number
  /** False when the cheapest listings could not reach the target (pixels mode) within MAX_BURNS. */
  reached: boolean
}

function sumPlan(picks: BurnPick[], reached: boolean): BurnPlan {
  return {
    picks,
    costEth: r6(picks.reduce((s, p) => s + p.priceEth, 0)),
    low: picks.reduce((s, p) => s + p.low, 0),
    mid: picks.reduce((s, p) => s + p.mid, 0),
    high: picks.reduce((s, p) => s + p.high, 0),
    reached,
  }
}

/** Cheapest-per-pixel burns until `need` is reached, counting each burn as `by` (typical roll, or the worst roll to be sure). */
export function burnForPixels(picks: BurnPick[], need: number, by: "mid" | "low" = "mid"): BurnPlan {
  const chosen: BurnPick[] = []
  let got = 0
  const sorted = by === "mid" ? picks : [...picks].sort((a, b) => a.priceEth / Math.max(1, a.low) - b.priceEth / Math.max(1, b.low))
  for (const p of sorted) {
    if (got >= need || chosen.length >= MAX_BURNS) break
    if (p[by] <= 0) continue
    chosen.push(p)
    got += p[by]
  }
  return sumPlan(chosen, got >= need)
}

/** Cheapest-per-pixel burns that fit inside `budgetEth`, skipping any that would not fit. */
export function burnForBudget(picks: BurnPick[], budgetEth: number): BurnPlan {
  const chosen: BurnPick[] = []
  let spent = 0
  for (const p of picks) {
    if (chosen.length >= MAX_BURNS) break
    if (spent + p.priceEth > budgetEth + 1e-12) continue
    chosen.push(p)
    spent += p.priceEth
  }
  return sumPlan(chosen, true)
}

export interface MarketBuy {
  pixels: number
  costEth: number
  /** True when the walk crossed listings that must be bought whole, so the real figure can differ a little. */
  approx: boolean
  /** Pixels mode only: what the book could not supply. */
  shortfall: number
}

/** How many #PIXEL a budget buys, walking the book from the cheapest level up. */
export function pixelsForBudget(depth: DepthLevel[], budgetEth: number): MarketBuy {
  let left = Math.max(0, budgetEth)
  let pixels = 0
  let cost = 0
  let approx = false
  for (const l of [...depth].sort((a, b) => a.priceEth - b.priceEth)) {
    if (!(l.priceEth > 0) || l.remaining <= 0) continue
    const can = Math.min(l.remaining, Math.floor((left + 1e-12) / l.priceEth))
    if (can <= 0) break
    if (can < l.remaining && l.partialRemaining < l.remaining) approx = true
    pixels += can
    cost += can * l.priceEth
    left -= can * l.priceEth
    if (can < l.remaining) break
  }
  return { pixels, costEth: r6(cost), approx, shortfall: 0 }
}

export function pixelsAtMarket(depth: DepthLevel[], need: number): MarketBuy {
  const b = buyCost(depth, need)
  return { pixels: b.filled, costEth: r6(b.costEth), approx: b.approx, shortfall: b.shortfall }
}

/**
 * burn: burning wins even with the worst rolls.
 * gamble: burning wins with typical rolls, loses with bad ones.
 * market: the Pixel Market wins (or burning cannot even reach the target).
 * unknown: one side could not be priced (no order book, or no usable listings).
 */
export type Verdict = "burn" | "gamble" | "market" | "unknown"

export interface PixelsAnswer {
  mode: "pixels"
  need: number
  market: MarketBuy | null
  /** Burns aimed at the target at typical rolls. */
  burn: BurnPlan | null
  /** Burns that reach the target even if every roll is the worst. */
  burnSure: BurnPlan | null
  verdict: Verdict
  /** ETH saved by the winner, at typical rolls. */
  savingEth: number | null
}

export function planForPixels(picks: BurnPick[], depth: DepthLevel[] | null, need: number): PixelsAnswer {
  const n = Math.max(1, Math.floor(need))
  const market = depth && depth.length ? pixelsAtMarket(depth, n) : null
  const burn = picks.length ? burnForPixels(picks, n, "mid") : null
  const burnSure = picks.length ? burnForPixels(picks, n, "low") : null
  const marketOk = market && market.shortfall === 0
  let verdict: Verdict = "unknown"
  let saving: number | null = null
  if (marketOk && burn) {
    if (!burn.reached) verdict = "market"
    else if (burnSure?.reached && burnSure.costEth < market.costEth) verdict = "burn"
    else if (burn.costEth < market.costEth) verdict = "gamble"
    else verdict = "market"
    if (burn.reached) saving = r4(Math.abs(market.costEth - burn.costEth))
  } else if (marketOk) verdict = "market"
  else if (burn?.reached) verdict = "burn"
  return { mode: "pixels", need: n, market, burn, burnSure, verdict, savingEth: saving }
}

export interface BudgetAnswer {
  mode: "eth"
  budgetEth: number
  market: MarketBuy | null
  burn: BurnPlan | null
  verdict: Verdict
  /** Extra pixels the winner gets for the same money, at typical rolls. */
  extraPixels: number | null
}

export function planForBudget(picks: BurnPick[], depth: DepthLevel[] | null, budgetEth: number): BudgetAnswer {
  const b = Math.max(0, budgetEth)
  const market = depth && depth.length ? pixelsForBudget(depth, b) : null
  const burn = picks.length ? burnForBudget(picks, b) : null
  let verdict: Verdict = "unknown"
  let extra: number | null = null
  if (market && burn && burn.picks.length) {
    if (burn.low > market.pixels) verdict = "burn"
    else if (burn.mid > market.pixels) verdict = "gamble"
    else verdict = "market"
    extra = Math.abs(burn.mid - market.pixels)
  } else if (market && market.pixels > 0) verdict = "market"
  else if (burn && burn.picks.length) verdict = "burn"
  return { mode: "eth", budgetEth: b, market, burn, verdict, extraPixels: extra }
}

/** One Normie through the lens: what its live pixels would pay if burned, and what those pixels cost on the Pixel Market. */
export interface LensValue {
  low: number
  mid: number
  high: number
  /** The burn payout priced at the Pixel Market's best ask (typical roll). Null without a live book. */
  marketValueEth: number | null
  /** listing price ÷ typical payout. */
  ethPerPixel: number | null
}

export function lensValue(originalPixels: number, livePixels: number, mode: YieldMode, priceEth: number | null, bestAskEth: number | null): LensValue | null {
  const [p] = burnPicks([{ tokenId: 0, priceEth: priceEth && priceEth > 0 ? priceEth : 1, originalPixels, livePixels }], mode)
  if (!p) return null
  return {
    low: p.low,
    mid: p.mid,
    high: p.high,
    marketValueEth: bestAskEth && bestAskEth > 0 ? r4(p.mid * bestAskEth) : null,
    ethPerPixel: priceEth && priceEth > 0 ? priceEth / p.mid : null,
  }
}
