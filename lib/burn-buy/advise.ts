// Burn / keep / buy advice. Pure functions: everything is computed from the inputs, nothing is fetched.
//
// Doctrine (lib/agent-recommendations/knowledge/dual-evaluation-and-pixel-market.md): never recommend a
// burn on efficiency alone. Weigh scarcity, identity and market signals, and stay calm and DYOR. Burns are
// permanent. Nothing here invents a #PIXEL price: moves are compared by exact SCORE change, and by ETH only
// where a real listing price exists.

import { breakEvenNormieEth, compareToAsk, type VsAsk } from "./market-math"
import {
  BOOST_CLIFFS,
  BRACKET_CLIFFS,
  burnYield,
  cliffStatus,
  type CliffSide,
  type MarketState,
  type YieldMode,
  shareIfAdded,
  walletScore,
} from "./score"

/** Documented heuristics (tunable, labelled as such in every reason string). */
export const TOP_RANK_PERCENT = 5
export const COLLECTIBLE_MAX_PIXELS = 300 // doctrine: "<300 on-pixels ... very small supply"
export const COLLECTIBLE_MAX_SUPPLY = 20 // doctrine: "single-digit or low double-digit"

export interface HeldToken {
  tokenId: number
  /** ORIGINAL mint pixel count: this is what the contract pays burns on. */
  originalPixels: number
  /** Action points (#PIXEL) this token carries. They move to the receiver if it is burned. */
  actionPoints: number
  rank: number | null
  type: string | null
  /** Awakened as an ERC-8004 agent: an identity, not fodder. */
  awakenedAgent: boolean
  /** Living tokens sharing this exact original pixel count (including this one). */
  pixelSupply: number
  /** Value the owner would forgo by burning, in ETH (own fair value, else the floor). Null = unknown (no price data). */
  forgoneValueEth: number | null
  /** The owner has edited this Normie's art (Canvas). Burning it erases that art for good, so it is a KEEP reason. */
  customized?: boolean
}

export interface Listing {
  tokenId: number
  priceEth: number
  actionPoints: number
  originalPixels: number
  rank: number | null
  type: string | null
  awakenedAgent: boolean
  pixelSupply: number
  /** Its art has been edited: never offered as burn fodder. */
  customized?: boolean
  url?: string
}

export type Verdict = "keep" | "burn" | "neutral"

export interface TokenAdvice {
  tokenId: number
  verdict: Verdict
  reasons: string[]
  /** What burning it would award to the receiver (pixel yield + its own AP). */
  yield: { fromPixels: number; transferred: number; total: number; range?: { min: number; max: number } }
}

export interface Context {
  /** "promo" (default) or "normal"; decides how a burn's yield is computed. */
  yieldMode?: YieldMode
  /** Whether Pixel Market is open. Only changes wording; missing means "pending". */
  marketState?: MarketState
  livingSupply: number
  /** Sum of every wallet's score, INCLUDING this wallet's current score if it holds Normies. */
  censusTotal: number
}

/** Why a token should be kept. Empty array = no reason to keep it. */
export function keepReasons(
  t: Pick<HeldToken, "originalPixels" | "rank" | "type" | "awakenedAgent" | "pixelSupply" | "customized">,
  ctx: Pick<Context, "livingSupply">,
): string[] {
  const out: string[] = []
  if (t.awakenedAgent) out.push("awakened agent: an on-chain identity, not fodder")
  // Decided with Ryan 2026-10-04: edited art is a keep reason. 324 of 7,226 living Normies carry hand-made edits, and a burn erases them.
  if (t.customized) out.push("edited art: burning it erases the art that was drawn on it, for good")
  if (t.type && t.type.toLowerCase() !== "human") out.push(`rarer type (${t.type}); Humans are about 97% of living Normies`)
  // Doctrine: the collectible frame is EXTREME LOW pixel + tiny supply. High-pixel tokens are the efficiency frame,
  // and their exact pixel counts are rare by construction (only 17 living tokens exceed 890 px), so a small
  // pixel-count supply on a dense token says nothing about scarcity and must not suppress good fodder.
  if (t.originalPixels < COLLECTIBLE_MAX_PIXELS && t.pixelSupply <= COLLECTIBLE_MAX_SUPPLY) {
    out.push(`possible collectible: ${t.originalPixels} px with only ${t.pixelSupply} like it alive`)
  }
  const topRank = Math.floor((ctx.livingSupply * TOP_RANK_PERCENT) / 100) // strictly within the top 5%
  if (t.rank !== null && t.rank <= topRank) out.push(`top ${TOP_RANK_PERCENT}% by rarity rank (#${t.rank})`)
  return out
}

export function adviseToken(t: HeldToken, ctx: Pick<Context, "livingSupply" | "yieldMode">): TokenAdvice {
  const y = burnYield(ctx.yieldMode ?? "promo", t.originalPixels, t.actionPoints)
  const keep = keepReasons(t, ctx)
  if (keep.length) return { tokenId: t.tokenId, verdict: "keep", reasons: keep, yield: y }
  if (y.total < 1) return { tokenId: t.tokenId, verdict: "neutral", reasons: ["burning would award nothing"], yield: y }
  const reasons = y.range
    ? [`burning pays about ${y.fromPixels} #PIXEL (${y.range.min} to ${y.range.max}: it is a roll, based on ${t.originalPixels} original px)`]
    : [`burning pays ${y.fromPixels} #PIXEL (4% of ${t.originalPixels} original px)`]
  if (y.transferred > 0) reasons.push(`plus its ${y.transferred} AP move to the receiver`)
  return { tokenId: t.tokenId, verdict: "burn", reasons, yield: y }
}

export type MoveKind = "burn-own" | "buy-and-burn" | "buy-and-hold"

export interface Move {
  kind: MoveKind
  /** Tokens involved: own tokens burned, or the listing(s) bought. */
  tokenIds: number[]
  /** ETH out of pocket (buys) or forgone sale value (own burns). 0 with costKnown=false means "unknown", not "free". */
  costEth: number
  /** False when the cost could not be priced (own burn with no fair value and no floor). Missing means known. */
  costKnown?: boolean
  heldAfter: number
  pixelAfter: number
  scoreBefore: number
  scoreAfter: number
  scoreGain: number
  gainPerEth: number | null
  shareBeforePct: number
  shareAfterPct: number
  note: string
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d
const pct = (x: number) => round(x * 100, 4)

function makeMove(
  kind: MoveKind,
  tokenIds: number[],
  costEth: number,
  wallet: { held: number; pixel: number; score: number },
  heldAfter: number,
  pixelAfter: number,
  ctx: Context,
  note: string,
  costKnown = true,
): Move {
  const after = walletScore(heldAfter, pixelAfter)
  const others = Math.max(0, ctx.censusTotal - wallet.score)
  return {
    kind,
    tokenIds,
    costEth: costKnown ? round(costEth) : 0,
    costKnown,
    heldAfter,
    pixelAfter,
    scoreBefore: round(wallet.score, 2),
    scoreAfter: round(after, 2),
    scoreGain: round(after - wallet.score, 2),
    gainPerEth: costKnown && costEth > 0 ? round((after - wallet.score) / costEth, 2) : null,
    shareBeforePct: pct(wallet.score / Math.max(1e-9, others + wallet.score)),
    shareAfterPct: pct(after / Math.max(1e-9, others + after)),
    note,
  }
}

/** Every subset of `items` with size 1..maxSize (items must be small: this is exponential). */
function subsets<T>(items: T[], maxSize: number): T[][] {
  const out: T[][] = []
  const walk = (start: number, cur: T[]) => {
    if (cur.length) out.push([...cur])
    if (cur.length === maxSize) return
    for (let i = start; i < items.length; i++) {
      cur.push(items[i])
      walk(i + 1, cur)
      cur.pop()
    }
  }
  walk(0, [])
  return out
}

export interface WalletAdvice {
  held: number
  pixel: number
  score: number
  sharePct: number
  /** Everyone else's combined score (the census minus this wallet), so a share can be checked by hand: score / (othersScore + score). */
  othersScore: number
  tokens: TokenAdvice[]
  nextBracket: { atHeld: number; needMore: number } | null
  nextBoost: { atPixel: number; needMore: number } | null
  /** Where the wallet stands against every cliff: the next step up, and how much it can lose before dropping a step. */
  cliffs: { normies: CliffSide; pixel: CliffSide }
  moves: Move[]
  notes: string[]
}

/**
 * The wallet's current standing plus every sensible move, ranked by exact score gain.
 * `listings` should already exclude the wallet's own tokens.
 */
export function adviseWallet(tokens: HeldToken[], listings: Listing[], ctx: Context, loosePixels = 0): WalletAdvice {
  const held = tokens.length
  // Every #PIXEL counts the same for the score: attached to a Normie, loose in the wallet, or in a market listing.
  const loose = Math.max(0, Number.isFinite(loosePixels) ? Math.trunc(loosePixels) : 0)
  const pixel = tokens.reduce((s, t) => s + t.actionPoints, 0) + loose
  const score = walletScore(held, pixel)
  const others = Math.max(0, ctx.censusTotal - score)
  const advice = tokens.map((t) => adviseToken(t, ctx)).sort((a, b) => b.yield.total - a.yield.total)
  const burnable = advice.filter((a) => a.verdict === "burn").slice(0, 8)
  const byId = new Map(tokens.map((t) => [t.tokenId, t]))
  const wallet = { held, pixel, score }
  const moves: Move[] = []

  // 1) Burn some of your own burnable tokens into one you keep. Needs at least one token left to receive.
  if (held >= 2) {
    for (const set of subsets(burnable, Math.min(4, held - 1))) {
      // AP on the burned tokens already counts in the wallet total and stays in the wallet; only the pixel yield is new.
      const gained = set.reduce((s, a) => s + a.yield.fromPixels, 0)
      const values = set.map((a) => byId.get(a.tokenId)?.forgoneValueEth ?? null)
      const costKnown = values.every((v) => v !== null)
      const cost = values.reduce<number>((s, v) => s + (v ?? 0), 0)
      moves.push(
        makeMove("burn-own", set.map((a) => a.tokenId), cost, wallet, held - set.length, pixel + gained, ctx,
          costKnown ? "permanent; the cost shown is the sale value you would give up" : "permanent; its sale value is unknown right now (no price data)",
          costKnown),
      )
    }
  }

  // 2) Buy a listing and burn it into your own token: held unchanged, you gain its pixel yield AND its AP.
  const fodder = listings
    .filter((l) => l.priceEth > 0 && keepReasons(l, ctx).length === 0)
    .map((l) => ({ l, y: burnYield(ctx.yieldMode ?? "promo", l.originalPixels, l.actionPoints).total }))
    .filter((x) => x.y > 0)
    .sort((a, b) => b.y / b.l.priceEth - a.y / a.l.priceEth)
    .slice(0, 12)
  if (held >= 1) {
    for (const set of subsets(fodder, 2)) {
      const gained = set.reduce((s, x) => s + x.y, 0)
      const cost = set.reduce((s, x) => s + x.l.priceEth, 0)
      moves.push(
        makeMove("buy-and-burn", set.map((x) => x.l.tokenId), cost, wallet, held, pixel + gained, ctx,
          "buy then burn into a Normie you hold; the burned one's AP moves with it"),
      )
    }
  }

  // 3) Buy and keep: +1 Normie (can lift the whole stack a bracket) and it arrives with any AP it carries.
  for (const l of listings.filter((x) => x.priceEth > 0).sort((a, b) => a.priceEth - b.priceEth).slice(0, 12)) {
    moves.push(
      makeMove("buy-and-hold", [l.tokenId], l.priceEth, wallet, held + 1, pixel + l.actionPoints, ctx,
        held === 0 ? "your first Normie is the membership: #PIXEL alone scores zero" : "one more Normie, kept"),
    )
  }

  // Priced moves first, best score per ETH first. A move with no ETH figure (unknown cost) is NEVER ranked above a priced
  // one: before 2026-10-05 a null counted as +Infinity, so an unpriced "burn your own" became the headline when the
  // listings source was down. Unpriced moves follow, by raw score gain.
  const useful = moves.filter((m) => m.scoreGain > 0.005)
  // gainPerEth is null for two different reasons: the cost is genuinely 0 (free: best) or unknown (costKnown=false: last).
  const rankKey = (m: Move) => (m.costKnown === false ? Number.NEGATIVE_INFINITY : (m.gainPerEth ?? Number.POSITIVE_INFINITY))
  useful.sort((a, b) => rankKey(b) - rankKey(a) || b.scoreGain - a.scoreGain)

  const nb = BRACKET_CLIFFS.find((c) => c > held)
  const nx = BOOST_CLIFFS.find((c) => c > pixel)
  const notes: string[] = []
  if (held === 0) notes.push("This wallet holds no Normies, so it scores zero regardless of #PIXEL.")
  if (held === 1 && pixel === 0) {
    notes.push(
      "You hold one Normie and no #PIXEL. Burning it would end your membership, so there is nothing to burn here; " +
        "the moves below all add to it instead.",
    )
  }
  notes.push(
    ctx.marketState === "live"
      ? "Scores use the published formula. This page does not read live #PIXEL prices yet, so moves are compared by score, not value."
      : "Scores use the published formula. #PIXEL has no market price yet, so moves are compared by score, not value.",
  )
  return {
    held,
    pixel,
    score: round(score, 2),
    sharePct: pct(score / Math.max(1e-9, others + score)),
    othersScore: round(others, 1),
    tokens: advice,
    nextBracket: nb ? { atHeld: nb, needMore: nb - held } : null,
    nextBoost: nx ? { atPixel: nx, needMore: nx - pixel } : null,
    cliffs: cliffStatus(held, pixel),
    moves: useful.slice(0, 10),
    notes,
  }
}

export interface FodderPick {
  tokenId: number
  priceEth: number
  actionPoints: number
  originalPixels: number
  yieldTotal: number
  fromPixels: number
  yieldPerEth: number
  /** ETH this listing costs per #PIXEL it pays if burned (price ÷ pays). In normal mode this is the middle of the range. */
  ethPerPixel: number
  /** Normal mode: the cheapest and dearest outcome (price ÷ the most it could pay, price ÷ the least). */
  ethPerPixelLow?: number
  ethPerPixelHigh?: number
  /** Normal mode: the whole range this listing's burn could pay (pixel roll + the AP it carries). */
  yieldMin?: number
  yieldMax?: number
  /** Live market only: burning this for #PIXEL versus buying the same #PIXEL at the best ask, per #PIXEL. */
  vsAsk?: VsAsk
  /** Live market only: the most this Normie could cost before buying #PIXEL at the best ask would have been cheaper (best roll, middle, worst roll). */
  breakEvenNormieEth?: { low: number; mid: number; high: number }
  url?: string
}

/** Per-#PIXEL burn cost against the best ask, and the break-even price of the Normie, when a live ask exists. */
function vsMarket(priceEth: number, y: { total: number; transferred: number; range?: { min: number; max: number } }, askEth: number | null): { vsAsk?: VsAsk; breakEvenNormieEth?: { low: number; mid: number; high: number } } {
  if (askEth === null || askEth <= 0) return {}
  const lowPays = y.range ? y.range.min + y.transferred : y.total
  const highPays = y.range ? y.range.max + y.transferred : y.total
  const burn = { low: priceEth / Math.max(1, highPays), mid: priceEth / Math.max(1, y.total), high: priceEth / Math.max(1, lowPays) }
  return {
    vsAsk: compareToAsk(burn, askEth),
    breakEvenNormieEth: { low: breakEvenNormieEth(lowPays, askEth), mid: breakEvenNormieEth(y.total, askEth), high: breakEvenNormieEth(highPays, askEth) },
  }
}

/**
 * Listings ranked by #PIXEL awarded per ETH if burned (promo rate). Anything the doctrine says to keep
 * (awakened agents, rarer types, collectibles, top-ranked) is excluded: we never present those as fodder.
 * `withAp` picks listings that carry AP (the AP moves to the receiver); otherwise pure pixel fodder.
 */
export function rankFodder(
  listings: Listing[],
  ctx: Pick<Context, "livingSupply" | "yieldMode">,
  opts: { withAp: boolean; limit?: number; /** The live best ask (ETH per #PIXEL). When given, each pick is compared with buying #PIXEL there. */ askEth?: number | null },
): FodderPick[] {
  return listings
    .filter((l) => l.priceEth > 0 && (l.actionPoints > 0) === opts.withAp && keepReasons(l, ctx).length === 0)
    .map((l) => {
      const y = burnYield(ctx.yieldMode ?? "promo", l.originalPixels, l.actionPoints)
      return {
        tokenId: l.tokenId,
        priceEth: l.priceEth,
        actionPoints: l.actionPoints,
        originalPixels: l.originalPixels,
        yieldTotal: y.total,
        fromPixels: y.fromPixels,
        yieldPerEth: round(y.total / l.priceEth, 1),
        ethPerPixel: round(l.priceEth / y.total, 5),
        ...(y.range
          ? {
              yieldMin: y.range.min + y.transferred,
              yieldMax: y.range.max + y.transferred,
              ethPerPixelLow: round(l.priceEth / (y.range.max + y.transferred), 5),
              ethPerPixelHigh: round(l.priceEth / Math.max(1, y.range.min + y.transferred), 5),
            }
          : {}),
        ...vsMarket(l.priceEth, y, opts.askEth ?? null),
        url: l.url,
      }
    })
    .filter((f) => f.yieldTotal > 0)
    .sort((a, b) => b.yieldPerEth - a.yieldPerEth)
    .slice(0, opts.limit ?? 10)
}

/** Historical illustration only: what a share of the pool would have paid in the article's window. */
export const ARTICLE_WINDOW = {
  poolEth: 81.09,
  days: 216,
  source: "@normiesART Sep 23 article: OpenSea-only, Feb 18 to Sep 22, 2026",
} as const

export function historicalPayoutEth(sharePct: number): number {
  return round((sharePct / 100) * ARTICLE_WINDOW.poolEth, 4)
}

export { shareIfAdded }
