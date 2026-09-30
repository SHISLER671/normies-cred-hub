// Burn / keep / buy advice. Pure functions: everything is computed from the inputs, nothing is fetched.
//
// Doctrine (lib/agent-recommendations/knowledge/dual-evaluation-and-pixel-market.md): never recommend a
// burn on efficiency alone. Weigh scarcity, identity and market signals, and stay calm and DYOR. Burns are
// permanent. Nothing here invents a #PIXEL price: moves are compared by exact SCORE change, and by ETH only
// where a real listing price exists.

import {
  BOOST_CLIFFS,
  BRACKET_CLIFFS,
  promoBurnYield,
  shareIfAdded,
  walletScore,
} from "./score"

/** Documented heuristics (tunable, labelled as such in every reason string). */
export const TOP_RANK_PERCENT = 5
export const COLLECTIBLE_MAX_PIXELS = 300 // doctrine: "<300 on-pixels ... very small supply"
export const COLLECTIBLE_MAX_SUPPLY = 20 // doctrine: "single-digit or low double-digit"
export const VERY_SCARCE_SUPPLY = 5

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
  /** Value the owner would forgo by burning, in ETH (own fair value, else the floor). */
  forgoneValueEth: number
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
  url?: string
}

export type Verdict = "keep" | "burn" | "neutral"

export interface TokenAdvice {
  tokenId: number
  verdict: Verdict
  reasons: string[]
  /** What burning it would award to the receiver (pixel yield + its own AP). */
  yield: { fromPixels: number; transferred: number; total: number }
}

export interface Context {
  livingSupply: number
  /** Sum of every wallet's score, INCLUDING this wallet's current score if it holds Normies. */
  censusTotal: number
}

/** Why a token should be kept. Empty array = no reason to keep it. */
export function keepReasons(
  t: Pick<HeldToken, "originalPixels" | "rank" | "type" | "awakenedAgent" | "pixelSupply">,
  ctx: Pick<Context, "livingSupply">,
): string[] {
  const out: string[] = []
  if (t.awakenedAgent) out.push("awakened agent: an on-chain identity, not fodder")
  if (t.type && t.type.toLowerCase() !== "human") out.push(`rarer type (${t.type}); Humans are about 97% of living Normies`)
  if (t.originalPixels < COLLECTIBLE_MAX_PIXELS && t.pixelSupply <= COLLECTIBLE_MAX_SUPPLY) {
    out.push(`possible collectible: ${t.originalPixels} px with only ${t.pixelSupply} like it alive`)
  } else if (t.pixelSupply <= VERY_SCARCE_SUPPLY) {
    out.push(`very scarce: only ${t.pixelSupply} living Normies share ${t.originalPixels} original pixels`)
  }
  const topRank = Math.floor((ctx.livingSupply * TOP_RANK_PERCENT) / 100) // strictly within the top 5%
  if (t.rank !== null && t.rank <= topRank) out.push(`top ${TOP_RANK_PERCENT}% by rarity rank (#${t.rank})`)
  return out
}

export function adviseToken(t: HeldToken, ctx: Pick<Context, "livingSupply">): TokenAdvice {
  const y = promoBurnYield(t.originalPixels, t.actionPoints)
  const keep = keepReasons(t, ctx)
  if (keep.length) return { tokenId: t.tokenId, verdict: "keep", reasons: keep, yield: y }
  if (y.total < 1) return { tokenId: t.tokenId, verdict: "neutral", reasons: ["burning would award nothing"], yield: y }
  const reasons = [`burning pays ${y.fromPixels} #PIXEL (4% of ${t.originalPixels} original px)`]
  if (y.transferred > 0) reasons.push(`plus its ${y.transferred} AP move to the receiver`)
  return { tokenId: t.tokenId, verdict: "burn", reasons, yield: y }
}

export type MoveKind = "burn-own" | "buy-and-burn" | "buy-and-hold"

export interface Move {
  kind: MoveKind
  /** Tokens involved: own tokens burned, or the listing(s) bought. */
  tokenIds: number[]
  /** ETH out of pocket (buys) or forgone sale value (own burns). */
  costEth: number
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
): Move {
  const after = walletScore(heldAfter, pixelAfter)
  const others = Math.max(0, ctx.censusTotal - wallet.score)
  return {
    kind,
    tokenIds,
    costEth: round(costEth),
    heldAfter,
    pixelAfter,
    scoreBefore: round(wallet.score, 2),
    scoreAfter: round(after, 2),
    scoreGain: round(after - wallet.score, 2),
    gainPerEth: costEth > 0 ? round((after - wallet.score) / costEth, 2) : null,
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
  tokens: TokenAdvice[]
  nextBracket: { atHeld: number; needMore: number } | null
  nextBoost: { atPixel: number; needMore: number } | null
  moves: Move[]
  notes: string[]
}

/**
 * The wallet's current standing plus every sensible move, ranked by exact score gain.
 * `listings` should already exclude the wallet's own tokens.
 */
export function adviseWallet(tokens: HeldToken[], listings: Listing[], ctx: Context): WalletAdvice {
  const held = tokens.length
  const pixel = tokens.reduce((s, t) => s + t.actionPoints, 0)
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
      const cost = set.reduce((s, a) => s + (byId.get(a.tokenId)?.forgoneValueEth ?? 0), 0)
      moves.push(
        makeMove("burn-own", set.map((a) => a.tokenId), cost, wallet, held - set.length, pixel + gained, ctx,
          "permanent; the cost shown is the sale value you would give up"),
      )
    }
  }

  // 2) Buy a listing and burn it into your own token: held unchanged, you gain its pixel yield AND its AP.
  const fodder = listings
    .filter((l) => l.priceEth > 0 && keepReasons(l, ctx).length === 0)
    .map((l) => ({ l, y: promoBurnYield(l.originalPixels, l.actionPoints).total }))
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

  const useful = moves.filter((m) => m.scoreGain > 0.005)
  useful.sort((a, b) =>
    (b.gainPerEth ?? Number.POSITIVE_INFINITY) - (a.gainPerEth ?? Number.POSITIVE_INFINITY) || b.scoreGain - a.scoreGain,
  )

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
  notes.push("Scores use the published formula. #PIXEL has no market price yet, so moves are compared by score, not value.")
  return {
    held,
    pixel,
    score: round(score, 2),
    sharePct: pct(score / Math.max(1e-9, others + score)),
    tokens: advice,
    nextBracket: nb ? { atHeld: nb, needMore: nb - held } : null,
    nextBoost: nx ? { atPixel: nx, needMore: nx - pixel } : null,
    moves: useful.slice(0, 10),
    notes,
  }
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
