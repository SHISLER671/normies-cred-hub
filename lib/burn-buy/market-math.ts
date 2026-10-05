// Pixel Market arithmetic. Pure functions, no I/O. Every figure comes from the live order book (api.normies.art /market/*) plus the
// published score formula; nothing here forecasts a price or says whether a trade is "worth it". Prices are ETH per #PIXEL.

import { ARTICLE_WINDOW } from "./advise"
import { walletScore } from "./score"

export interface DepthLevel {
  priceEth: number
  /** #PIXEL listed at this price. */
  remaining: number
  /** #PIXEL at this price that can be bought in part (a listing that is not partial-fill must be bought whole). */
  partialRemaining: number
}

export interface PixelMarketSnapshot {
  asOf: string
  bestAskEth: number | null
  lastPriceEth: number | null
  volume24hEth: number
  pixels24h: number
  activeListings: number
  pixelsListed: number
  /** The market fee, from the seller (official: 10%), and the share of fees that goes to holders (official: 50%). */
  feeBps: number
  revenueShareBps: number
  paused: boolean
  /** Cheapest first, capped. */
  depth: DepthLevel[]
}

const round = (n: number, d = 5) => Math.round(n * 10 ** d) / 10 ** d

/** Wei string to ETH as a number (prices are around 1e16 wei, so a double is exact enough for display and ratios). */
export function weiToEth(wei: unknown): number | null {
  if (typeof wei !== "string" || !/^\d+$/.test(wei)) return null
  return Number(BigInt(wei)) / 1e18
}

export interface BuyCost {
  /** How many #PIXEL the walk could fill (less than asked when the book is too thin). */
  filled: number
  shortfall: number
  costEth: number
  /** Average price paid per #PIXEL. Null when nothing could be filled. */
  avgEth: number | null
  /** The most expensive level reached. */
  worstEth: number | null
  /**
   * True when the walk crossed a level that includes listings which must be bought whole, so the real cost can be a little higher.
   */
  approx: boolean
}

/** Buy `n` #PIXEL from the cheapest listings up. The price rises as you eat through the book. */
export function buyCost(depth: DepthLevel[], n: number): BuyCost {
  const want = Math.max(0, Math.floor(n))
  let left = want
  let cost = 0
  let worst: number | null = null
  let approx = false
  for (const l of [...depth].sort((a, b) => a.priceEth - b.priceEth)) {
    if (left <= 0) break
    const take = Math.min(left, l.remaining)
    if (take <= 0) continue
    if (l.partialRemaining < l.remaining) approx = true
    cost += take * l.priceEth
    worst = l.priceEth
    left -= take
  }
  const filled = want - left
  return { filled, shortfall: left, costEth: round(cost), avgEth: filled > 0 ? round(cost / filled) : null, worstEth: worst, approx }
}

/** How many #PIXEL are listed at or below a price: the ones that would sell before yours if you listed there. */
export function queueAhead(depth: DepthLevel[], priceEth: number): number {
  return depth.filter((l) => l.priceEth <= priceEth + 1e-12).reduce((s, l) => s + l.remaining, 0)
}

export interface Proceeds {
  grossEth: number
  feeEth: number
  netEth: number
}

/** What a sale pays after the market fee (taken from the seller). */
export function sellProceeds(n: number, priceEth: number, feeBps: number): Proceeds {
  const gross = Math.max(0, n) * priceEth
  const fee = gross * (feeBps / 10_000)
  return { grossEth: round(gross), feeEth: round(fee), netEth: round(gross - fee) }
}

export type VsAsk = "market-cheaper" | "burn-cheaper" | "depends-on-roll"

/**
 * Burning to get #PIXEL versus buying it from the book, per #PIXEL. `low`/`high` are the best and worst roll when a burn is a roll
 * (equal to `mid` at a fixed rate). Neutral labels only: this compares two costs, it is not advice.
 */
export function compareToAsk(burn: { low: number; mid: number; high: number }, askEth: number): VsAsk {
  if (askEth < burn.low) return "market-cheaper"
  if (askEth > burn.high) return "burn-cheaper"
  return "depends-on-roll"
}

/** The most you could pay for a Normie that burns to `pays` #PIXEL before buying the #PIXEL on the book would have been cheaper. */
export function breakEvenNormieEth(pays: number, askEth: number): number {
  return round(pays * askEth, 4)
}

export interface PaybackRow {
  label: string
  /** Monthly pool (ETH) assumed. Illustrative, not a forecast. */
  poolEthPerMonth: number
  monthlyEth: number
  /** Months to earn back `costEth`. Null when there is no gain to earn it back from. */
  months: number | null
}

/**
 * The pool paid to holders is 50% of market fees plus 50% of royalties (official). The monthly total is NOT known yet, so these are three
 * labelled scenarios around the one published pace: the Sep 23 article's pool over its window (OpenSea only, 216 days).
 */
export function monthlyPoolScenarios(): Array<{ label: string; poolEthPerMonth: number }> {
  const article = (ARTICLE_WINDOW.poolEth / ARTICLE_WINDOW.days) * 30
  return [
    { label: "quiet (a quarter of the article's pace)", poolEthPerMonth: round(article / 4, 2) },
    { label: "the article's pace", poolEthPerMonth: round(article, 2) },
    { label: "busy (double the article's pace)", poolEthPerMonth: round(article * 2, 2) },
  ]
}

/** What an added score would earn per month in each scenario, and how long the cost takes to earn back. */
export function paybackScenarios(costEth: number, held: number, pixelBefore: number, pixelAfter: number, othersScore: number): PaybackRow[] {
  const before = walletScore(held, pixelBefore)
  const after = walletScore(held, pixelAfter)
  const share = (s: number) => s / Math.max(1e-9, othersScore + s)
  const gainShare = Math.max(0, share(after) - share(before))
  return monthlyPoolScenarios().map((sc) => {
    const monthly = sc.poolEthPerMonth * gainShare
    return { label: sc.label, poolEthPerMonth: sc.poolEthPerMonth, monthlyEth: round(monthly, 5), months: monthly > 0 ? round(costEth / monthly, 1) : null }
  })
}

export interface SellRow {
  label: string
  pixels: number
  priceEth: number
  grossEth: number
  feeEth: number
  netEth: number
  /** #PIXEL listed at or below this price: they sell first. */
  ahead: number
  /** Score and pool share if these #PIXEL are gone (held Normies unchanged). */
  scoreAfter: number
  sharePctAfter: number
}

/**
 * The seller's view at a few reference prices (the best ask, the last fill, and what a burner pays per #PIXEL), for the #PIXEL that can go
 * without dropping a boost, and for all of it. These are reference prices, not a recommendation of where to list.
 */
export function sellRows(opts: {
  held: number
  pixel: number
  spare: number
  prices: Array<{ label: string; priceEth: number }>
  depth: DepthLevel[]
  feeBps: number
  othersScore: number
}): SellRow[] {
  const { held, pixel, spare, prices, depth, feeBps, othersScore } = opts
  const share = (s: number) => (s / Math.max(1e-9, othersScore + s)) * 100
  const out: SellRow[] = []
  const sets: Array<{ name: string; n: number }> = []
  if (spare > 0) sets.push({ name: spare === pixel ? "all of it" : "the cushion (keeps your boost)", n: spare })
  if (pixel > spare) sets.push({ name: "everything", n: pixel })
  for (const set of sets) {
    for (const p of prices) {
      const pr = sellProceeds(set.n, p.priceEth, feeBps)
      const after = walletScore(held, pixel - set.n)
      out.push({
        label: `${set.name} at ${p.label}`,
        pixels: set.n,
        priceEth: p.priceEth,
        ...pr,
        ahead: queueAhead(depth, p.priceEth),
        scoreAfter: round(after, 2),
        sharePctAfter: round(share(after), 4),
      })
    }
  }
  return out
}

export interface CliffCost {
  /** The boost step being priced: how many more #PIXEL, to reach what total, for what boost. */
  needMore: number
  atPixel: number
  boostPct: number
  buy: BuyCost
  scoreBefore: number
  scoreAfter: number
  scoreGain: number
  /** ETH per point of score gained. Null when the book cannot fill the whole step. */
  costPerScorePoint: number | null
  /** Empty when the book cannot fill the whole step (no honest cost to pay back). */
  payback: PaybackRow[]
}

/** What reaching the next boost would cost if every #PIXEL were bought off the book today. Null when there is no next step or no book. */
export function cliffCost(held: number, pixel: number, next: { at: number; needMore: number; value: number } | null, depth: DepthLevel[], othersScore: number): CliffCost | null {
  if (!next || depth.length === 0 || held < 1) return null
  const buy = buyCost(depth, next.needMore)
  if (buy.filled === 0) return null
  const before = walletScore(held, pixel)
  const after = walletScore(held, next.at)
  const gain = after - before
  const full = buy.shortfall === 0
  return {
    needMore: next.needMore,
    atPixel: next.at,
    boostPct: Math.round(next.value * 100),
    buy,
    scoreBefore: round(before, 2),
    scoreAfter: round(after, 2),
    scoreGain: round(gain, 2),
    costPerScorePoint: full && gain > 0 ? round(buy.costEth / gain, 4) : null,
    payback: full && gain > 0 ? paybackScenarios(buy.costEth, held, pixel, next.at, othersScore) : [],
  }
}

export interface PixelMarketView {
  /** Cost to reach the next boost by buying from the book. */
  cliffCost: CliffCost | null
  /** The seller's view at reference prices. Empty when the wallet holds no #PIXEL. */
  sell: SellRow[]
}
