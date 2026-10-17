// Chat ratings — pure ranking math (no network). Signal over noise:
//   • each wallet's ratings are averaged into ONE vote (latest chats weigh more inside that average)
//   • a vote counts more when the wallet holds a Normie, less when the wallet is fresh
//   • a wallet that keeps coming back gets a small capped boost; a burst from one wallet can't swing the score
//   • recent votes count more than old ones
//   • below the minimum number of different wallets, there is no ranked score at all
// Raw numbers always ship next to the ranked score so anyone can check the math.

import { CHAT_RATINGS_CONFIG } from "./config"

export type RawChatRating = {
  /** Wallet that sent the rating (the ERC-8004 clientAddress). */
  rater: string
  /** On-chain int128 value. */
  value: number
  /** On-chain valueDecimals. */
  decimals: number
  /** Age in days, or null when the timestamp couldn't be read (counts as fresh). */
  ageDays: number | null
}

export type RaterInfo = {
  /** Holds at least one Normie. undefined = unknown (neutral). */
  holder?: boolean
  /** Sent-transaction count. undefined = unknown (neutral). */
  txCount?: number
}

export type ChatRatingsTuning = {
  maxValue: number
  minUniqueRaters: number
  weights: {
    holder: number
    freshWallet: number
    establishedTxCount: number
    repeatStep: number
    repeatMax: number
  }
  recency: { halfLifeDays: number; minWeight: number }
}

export type ChatRatingsScore = {
  /** True when there are enough different wallets to rank. */
  ranked: boolean
  /** Ranked score 0–100, or null when not ranked / no ratings. */
  score: number | null
  /** Same score in stars (0–5, one decimal), or null. */
  stars: number | null
  raw: {
    /** Every rating counted (after excluding the agent's own owner). */
    ratings: number
    /** Different wallets that rated. */
    unique_raters: number
    /** Plain average of every rating, 0–100, no weighting. Null when there are none. */
    average: number | null
  }
  min_unique_raters: number
  weighting: {
    /** Raters that hold a Normie. */
    holders: number
    /** Raters with fewer transactions than the established threshold. */
    fresh_wallets: number
    /** Raters seen more than once (their ratings were averaged into one vote). */
    repeat_raters: number
    /** Ratings excluded because the agent's own owner sent them. */
    excluded_self: number
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** On-chain value → 0–100, clamped. Returns null for anything that isn't a finite number. */
export function normalizeValue(value: number, decimals: number, maxValue: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(decimals) || decimals < 0 || maxValue <= 0) return null
  const v = value / 10 ** decimals
  const scaled = (v / maxValue) * 100
  if (!Number.isFinite(scaled)) return null
  return Math.min(100, Math.max(0, scaled))
}

/** 1.0 for today, 0.5 at one half-life, never below minWeight. Unknown age counts as fresh. */
export function recencyWeight(ageDays: number | null, tuning: ChatRatingsTuning["recency"]): number {
  if (ageDays == null || !Number.isFinite(ageDays) || ageDays <= 0) return 1
  const w = 0.5 ** (ageDays / tuning.halfLifeDays)
  return Math.max(tuning.minWeight, w)
}

/** How much one wallet's vote counts, before recency. */
export function raterMultiplier(
  info: RaterInfo | undefined,
  ratingCount: number,
  w: ChatRatingsTuning["weights"],
): number {
  let m = 1
  if (info?.holder === true) m *= w.holder
  if (info?.txCount != null && info.txCount < w.establishedTxCount) m *= w.freshWallet
  const repeat = Math.min(w.repeatMax, 1 + Math.max(0, ratingCount - 1) * w.repeatStep)
  return m * repeat
}

export function rankChatRatings(
  ratings: RawChatRating[],
  raterInfo: Map<string, RaterInfo> = new Map(),
  opts: { excludeRaters?: string[]; tuning?: ChatRatingsTuning } = {},
): ChatRatingsScore {
  const tuning: ChatRatingsTuning = opts.tuning ?? CHAT_RATINGS_CONFIG
  const excluded = new Set((opts.excludeRaters ?? []).map((a) => a.toLowerCase()))

  let excludedSelf = 0
  const byWallet = new Map<string, Array<{ v: number; r: number }>>()
  const all: number[] = []

  for (const rating of ratings) {
    const rater = rating.rater.toLowerCase()
    if (excluded.has(rater)) {
      excludedSelf++
      continue
    }
    const v = normalizeValue(rating.value, rating.decimals, tuning.maxValue)
    if (v == null) continue
    all.push(v)
    const list = byWallet.get(rater) ?? []
    list.push({ v, r: recencyWeight(rating.ageDays, tuning.recency) })
    byWallet.set(rater, list)
  }

  const uniqueRaters = byWallet.size
  const ranked = uniqueRaters >= tuning.minUniqueRaters

  let holders = 0
  let fresh = 0
  let repeats = 0
  let num = 0
  let den = 0

  for (const [wallet, list] of byWallet) {
    const info = raterInfo.get(wallet)
    if (info?.holder === true) holders++
    if (info?.txCount != null && info.txCount < tuning.weights.establishedTxCount) fresh++
    if (list.length > 1) repeats++

    // One vote per wallet: recency-weighted average of that wallet's own ratings.
    const rSum = list.reduce((s, x) => s + x.r, 0)
    const walletAvg = list.reduce((s, x) => s + x.v * x.r, 0) / rSum
    // The vote's freshness is its most recent rating.
    const walletRecency = Math.max(...list.map((x) => x.r))

    const weight = walletRecency * raterMultiplier(info, list.length, tuning.weights)
    num += walletAvg * weight
    den += weight
  }

  const score = ranked && den > 0 ? round1(num / den) : null

  return {
    ranked,
    score,
    stars: score == null ? null : round1(score / 20),
    raw: {
      ratings: all.length,
      unique_raters: uniqueRaters,
      average: all.length ? round1(all.reduce((s, v) => s + v, 0) / all.length) : null,
    },
    min_unique_raters: tuning.minUniqueRaters,
    weighting: {
      holders,
      fresh_wallets: fresh,
      repeat_raters: repeats,
      excluded_self: excludedSelf,
    },
  }
}
