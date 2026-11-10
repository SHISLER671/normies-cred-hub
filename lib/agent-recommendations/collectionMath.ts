// Collection-wide math for Ask: "how much #PIXEL if every Normie burned?", "how many pixels exist?", "how many are burned?".
// Pure: takes the index snapshot (every living Normie's ORIGINAL pixel count, from lib/burn-buy/data.ts) and computes exact
// sums with the same yield rules /burn uses (lib/burn-buy/score.ts). The model gets the finished numbers, so it never guesses.
// Relative imports only, so the tests run without the "@/" path alias.

import { LAUNCH_TIERS, PROMO_RATE_PERCENT, type YieldMode } from "../burn-buy/score"

/** Token ids run 0..9999. */
export const ORIGINAL_SUPPLY = 10_000

export type CollectionMath = {
  /** ISO time the index was last refreshed (the honest as-of), or null when unknown. */
  asOf: string | null
  source: string
  yieldMode: YieldMode
  livingSupply: number
  burnedSoFar: number
  totalOriginalPixels: number
  averagePixels: number
  tiers: Array<{ label: string; minPct: number; maxPct: number; normies: number; pixels: number }>
  /** #PIXEL created from pixels if every living Normie were burned (before the receiver rule below). */
  fromPixels: { min: number; middle: number; max: number }
  /** A burn needs a receiver Normie that survives, so at least one is left: the ceiling minus the best single receiver. */
  allButOne: { keptTokenPixels: number; min: number; middle: number; max: number }
  /** #PIXEL already sitting on living Normies. A burn MOVES it to the receiver; it is not new supply. Null if not indexed. */
  attachedActionPoints: number | null
}

export type CollectionSnapshot = {
  originalPixels: Map<number, number>
  oldestIndexedAt: string | null
  attachedActionPoints?: number
}

function tierFor(px: number) {
  return LAUNCH_TIERS.find((t) => px < t.below) ?? LAUNCH_TIERS[LAUNCH_TIERS.length - 1]
}

function tierLabel(i: number): string {
  if (i === 0) return `under ${LAUNCH_TIERS[0].below} pixels`
  const lo = LAUNCH_TIERS[i - 1].below
  const hi = LAUNCH_TIERS[i].below
  return Number.isFinite(hi) ? `${lo}–${hi - 1} pixels` : `${lo}+ pixels`
}

/** Per-token yield from pixels only, with the same integer math as lib/burn-buy/score.ts. */
function yieldOf(px: number, mode: YieldMode) {
  if (mode === "promo") {
    const v = Math.trunc((px * PROMO_RATE_PERCENT) / 100)
    return { min: v, middle: v, max: v }
  }
  const t = tierFor(px)
  return {
    min: Math.trunc((px * t.minPct) / 100),
    middle: Math.round((px * (t.minPct + t.maxPct)) / 200),
    max: Math.trunc((px * t.maxPct) / 100),
  }
}

export function computeCollectionMath(snap: CollectionSnapshot, mode: YieldMode, source: string): CollectionMath {
  const tiers = LAUNCH_TIERS.map((t, i) => ({ label: tierLabel(i), minPct: t.minPct, maxPct: t.maxPct, normies: 0, pixels: 0 }))
  let total = 0
  const sum = { min: 0, middle: 0, max: 0 }
  let biggest = { px: -1, y: { min: 0, middle: 0, max: 0 } }

  for (const raw of snap.originalPixels.values()) {
    const px = Math.max(0, Math.trunc(raw))
    total += px
    const i = LAUNCH_TIERS.findIndex((t) => px < t.below)
    const tier = tiers[i === -1 ? tiers.length - 1 : i]
    tier.normies++
    tier.pixels += px
    const y = yieldOf(px, mode)
    sum.min += y.min
    sum.middle += y.middle
    sum.max += y.max
    // The receiver that keeps the most #PIXEL possible is the one with the most pixels (it is not burned itself).
    if (px > biggest.px) biggest = { px, y }
  }

  const living = snap.originalPixels.size
  return {
    asOf: snap.oldestIndexedAt,
    source,
    yieldMode: mode,
    livingSupply: living,
    burnedSoFar: Math.max(0, ORIGINAL_SUPPLY - living),
    totalOriginalPixels: total,
    averagePixels: living > 0 ? Math.round(total / living) : 0,
    tiers,
    fromPixels: sum,
    allButOne: {
      keptTokenPixels: Math.max(0, biggest.px),
      min: sum.min - biggest.y.min,
      middle: sum.middle - biggest.y.middle,
      max: sum.max - biggest.y.max,
    },
    attachedActionPoints: typeof snap.attachedActionPoints === "number" ? snap.attachedActionPoints : null,
  }
}

const n = (v: number) => v.toLocaleString("en-US")

/** The block the model reads. Every number is final; the model should quote, not recompute. */
export function formatCollectionMath(m: CollectionMath): string {
  const asOf = m.asOf ? `${m.asOf.slice(0, 16).replace("T", " ")} UTC` : "unknown time"
  const rule =
    m.yieldMode === "promo"
      ? `a flat ${PROMO_RATE_PERCENT}% of each Normie's ORIGINAL pixel count (promo mode)`
      : "a roll of a whole percent between the tier minimum and 4% of each Normie's ORIGINAL pixel count"
  const lines = [
    `Source: ${m.source}, as of ${asOf}. Exact sums over every living Normie, not estimates of the inputs.`,
    `Living Normies: ${n(m.livingSupply)} of ${n(ORIGINAL_SUPPLY)} (${n(m.burnedSoFar)} burned so far).`,
    `Original pixels across all living Normies: ${n(m.totalOriginalPixels)} (average ${n(m.averagePixels)} per Normie).`,
    `Burn rule used: ${rule}.`,
    ...m.tiers.map(
      (t) => `Tier ${t.label}: ${n(t.normies)} Normies, ${n(t.pixels)} pixels, yields ${t.minPct}–${t.maxPct}% each`,
    ),
    m.yieldMode === "promo"
      ? `If EVERY living Normie were burned: ${n(m.fromPixels.max)} new #PIXEL from pixels.`
      : `If EVERY living Normie were burned: ${n(m.fromPixels.min)} (all lowest rolls) to ${n(m.fromPixels.max)} (all 4% rolls) new #PIXEL from pixels; middle of the range ${n(m.fromPixels.middle)}.`,
    `Reality check: every burn needs a receiver Normie that survives, so at least one Normie is left. Keeping the biggest one (${n(m.allButOne.keptTokenPixels)} pixels) as the last receiver: ${n(m.allButOne.min)} to ${n(m.allButOne.max)} (middle ${n(m.allButOne.middle)}).`,
    m.attachedActionPoints !== null
      ? `Already on living Normies today: ${n(m.attachedActionPoints)} #PIXEL. A burn moves that to the receiver; it is not new supply, so it does not add to the totals above.`
      : "Already-attached #PIXEL on living Normies: not available this turn.",
    "Not counted: #PIXEL already loose in wallets or listed on the Pixel Market, and #PIXEL already spent on canvas upgrades (burned out of circulation).",
  ]
  return lines.map((l) => `- ${l}`).join("\n")
}

/**
 * Collection-wide questions: totals, max possible, "if every / all Normies burned", how many burned or left.
 * Deliberately narrow: a question about ONE Normie, a price or the market does not match.
 */
export function isCollectionMathQuery(q: string): boolean {
  const s = q.toLowerCase()
  const allish = /\b(every|all|whole|entire|total|max(imum)?|most possible|in existence|supply)\b/.test(s)
  const subject = /\b(normies?|collection|pixels?|#pixel|burn(s|t|ed|ing)?)\b/.test(s)
  if (allish && subject) return true
  if (/\bhow many\b.*\b(normies?|pixels?)\b.*\b(left|burn(ed|t)?|exist|living|alive|remain(ing)?)\b/.test(s)) return true
  return false
}
