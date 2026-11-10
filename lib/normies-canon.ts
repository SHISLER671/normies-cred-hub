// Normies canon: the official numbers NCH repeats in many places, in ONE file. Pure, client-safe, no I/O.
// Statuses live in lib/official-status.ts; the revenue-share score and burn yield rules live in lib/burn-buy/score.ts
// (verified against the contract). This file holds the rest and re-exports those, so pages, Ask and tools import one place.
// lib/canon-drift.test.ts fails if a known-wrong variant (old tier boundaries, stale Level wording…) comes back anywhere.
//
// Sources: normies.art/docs (Lab, read 2026-10-09), @normiesART "Pixel Market: The Currency of the Canvas" (Sep 23, 2026),
// NormiesCanvasV2 verified source (tier thresholds, 2026-10-06).

import { LAUNCH_TIERS } from "./burn-buy/score"

export { BOOSTS, BRACKETS, LAUNCH_TIERS, PIXEL_PER_POINT, PROMO_RATE_PERCENT, walletScore } from "./burn-buy/score"

/** Token ids run 0..9999. */
export const NORMIES_SUPPLY = 10_000

/** Every Normie starts on a 40×40 canvas. */
export const BASE_GRID = 40

/**
 * Official bigger-canvas prices at launch: TOTAL #PIXEL to reach each size from 40×40, one per pixel added. An upgrade
 * costs the difference. Paid from the wallet or from the Normie, and burned out of circulation.
 */
export const CANVAS_SIZE_COSTS: ReadonlyArray<{ size: 50 | 60 | 70 | 80; total: number }> = [
  { size: 50, total: 900 },
  { size: 60, total: 2_000 },
  { size: 70, total: 3_300 },
  { size: 80, total: 4_800 },
]

/** Blank canvas (drops the base art): 200 #PIXEL, burned out of circulation. */
export const BLANK_CANVAS_COST = 200

/** #PIXEL needed to go from `fromSize` to `toSize` (an upgrade costs the difference). Null for an unknown size. */
export function canvasUpgradeCost(fromSize: number, toSize: number): number | null {
  const total = (s: number) => (s === BASE_GRID ? 0 : CANVAS_SIZE_COSTS.find((c) => c.size === s)?.total ?? null)
  const from = total(fromSize)
  const to = total(toSize)
  if (from === null || to === null || to < from) return null
  return to - from
}

/** Level, as the docs state it: pixels on the Normie ÷ 10, rounded down, + 1. Read live; taking pixels off lowers it. */
export function levelFor(pixelsOn: number): number {
  if (!Number.isFinite(pixelsOn) || pixelsOn < 0) return 1
  return Math.floor(pixelsOn / 10) + 1
}

/** Pixel Market seller fee (also its hard cap), as a percent. Half goes to the team, half to the holder revenue pool. */
export const PIXEL_MARKET_FEE_PERCENT = 10

/** Plain-word tier labels from the contract thresholds: "under 490", "490–889", "890+". */
export function tierLabels(): string[] {
  return LAUNCH_TIERS.map((t, i) => {
    if (i === 0) return `under ${t.below}`
    const lo = LAUNCH_TIERS[i - 1].below
    return Number.isFinite(t.below) ? `${lo}–${t.below - 1}` : `${lo}+`
  })
}

/**
 * Arena Canvas ranks: a name for a Level band, per normiesART's X Article on Arena (posted Oct 22, 2026 17:34 UTC,
 * Oct 23 ChST). Rank names and start Levels only; nothing else from that article is canon here. Arena is Coming Soon
 * and the article says game data may change. The top band is shown with a neutral label so it is never confused with
 * the NormiesLegendaryCanvas award. NCH shows the rank as a label: it never counts toward any NCH rank or Pulse.
 */
export const ARENA_CANVAS_RANKS_SOURCE = {
  url: "https://x.com/normiesART/status/2113323053304238383",
  /** Publication date as Ryan reads it (ChST). */
  published: "2026-10-23",
  publishedText: "Oct 23, 2026",
  checkedAt: "2026-11-10",
} as const

export const ARENA_CANVAS_TOP_LEVEL = 150

export const ARENA_CANVAS_RANKS: ReadonlyArray<{ name: string; fromLevel: number }> = [
  { name: "Blank", fromLevel: 1 },
  { name: "Sketched", fromLevel: 2 },
  { name: "Inked", fromLevel: 10 },
  { name: "Painted", fromLevel: 25 },
  { name: "Gilded", fromLevel: 50 },
  { name: "Masterwork", fromLevel: 100 },
  { name: "Level 150+ (top Arena rank)", fromLevel: ARENA_CANVAS_TOP_LEVEL },
]

const validLevel = (level: number | null | undefined): level is number =>
  typeof level === "number" && Number.isFinite(level) && level >= 1

/** The Arena Canvas rank for a Level, or null for a missing or invalid Level. Levels past 150 stay in the top band. */
export function rankForLevel(level: number | null | undefined): { name: string; fromLevel: number } | null {
  if (!validLevel(level)) return null
  const l = Math.min(Math.floor(level), ARENA_CANVAS_TOP_LEVEL)
  let rank = ARENA_CANVAS_RANKS[0]
  for (const r of ARENA_CANVAS_RANKS) if (l >= r.fromLevel) rank = r
  return rank
}

/** The Level where the next Arena Canvas rank starts, or null at the top band or for an invalid Level. */
export function nextRankLevel(level: number | null | undefined): number | null {
  if (!validLevel(level)) return null
  const l = Math.floor(level)
  return ARENA_CANVAS_RANKS.find((r) => r.fromLevel > l)?.fromLevel ?? null
}

/** The note shown with a rank (record card page and JSON). */
export function arenaCanvasRankNote(level: number): string {
  return `From Level ${Math.floor(level)} (official API). Rank names per normiesART's Arena article (${ARENA_CANVAS_RANKS_SOURCE.publishedText}). Arena is Coming Soon and the article says game data may change. A label, not a score; it does not count toward any rank here.`
}

/** /burn only: a plain fact, e.g. "Next Arena Canvas rank at Level 25". Null at the top band (nothing is shown). */
export function nextArenaCanvasRankText(level: number | null | undefined): string | null {
  const next = nextRankLevel(level)
  return next === null ? null : `Next Arena Canvas rank at Level ${next}`
}
