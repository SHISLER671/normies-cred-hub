// lib/agent-recommendations/canvasCosts.ts
// Bigger / blank canvas COSTS for one Normie, from the official prices. Facts only: no score, no "ready", no advice.
//
// Sources (read 2026-11-10):
//   - Prices: api.normies.art/canvas/status → pixelMarket.enlargePrices {50: 900, 60: 2000, 70: 3300, 80: 4800} and
//     blankCanvasPrice 200 (read from the chain); the same numbers are the launch prices in normies.art/docs and
//     lib/normies-canon.ts (CANVAS_SIZE_COSTS, BLANK_CANVAS_COST).
//   - Rules: NormiesCanvasV2 0xF14f2852e1fD6A4108156054AF49B3915dc40E2e, verified source (Sourcify), enlargeCanvas /
//     clearBase / _pay / _enforceCeiling:
//       cost = enlargePrice[newSize] − enlargePrice[currentSize]  (an upgrade costs the difference)
//       paid from the owner's wallet (burned) or from the pixels attached to the Normie (debited, then burned);
//       paying from the Normie may dip into the pixels backing the painted overlay ("locked"), but then the contract
//       clears the overlay (it reverts unless the caller agrees to that). Free pixels pay without touching the paint.
//       clearBase (blank canvas) is one-time and not allowed for Zombies.
//   - Per-Normie state: api.normies.art/normie/{id}/canvas/info → actionPoints (= attached), gridSize, baseCleared,
//     lockedPixels, freePixels. Wallet #PIXEL: api.normies.art/pixels/balance/{address} → balance.
// Pure: no I/O, so it is testable without the network.

import { BASE_GRID, BLANK_CANVAS_COST, CANVAS_SIZE_COSTS, levelFor } from "@/lib/normies-canon"

export const CANVAS_COST_SOURCES = {
  docs: "https://www.normies.art/lab/canvas",
  prices: "https://api.normies.art/canvas/status",
  contract: "https://sourcify.dev/#/lookup/0xF14f2852e1fD6A4108156054AF49B3915dc40E2e",
  info: (tokenId: number) => `https://api.normies.art/normie/${tokenId}/canvas/info`,
} as const

export interface CanvasPrices {
  /** TOTAL #PIXEL from 40×40 to reach each size (cumulative, as the contract stores it). */
  enlarge: Record<number, number>
  blank: number
  /** "chain" when read live from api.normies.art/canvas/status; "canon" when the live read failed. */
  from: "chain" | "canon"
}

export const CANON_CANVAS_PRICES: CanvasPrices = {
  enlarge: Object.fromEntries(CANVAS_SIZE_COSTS.map((c) => [c.size, c.total])),
  blank: BLANK_CANVAS_COST,
  from: "canon",
}

export interface PixelsOnNormie {
  /** Pixels attached to the Normie (the API's actionPoints). */
  attached: number
  /** Attached pixels backing the current painted overlay. Null when the API did not say. */
  locked: number | null
  /** Attached pixels not backing paint (withdrawable without a reset). Null when the API did not say. */
  free: number | null
}

export interface CanvasCostLine {
  /** Side length after the service (same as now for the blank canvas). */
  size: number
  kind: "enlarge" | "blank"
  /** #PIXEL this step costs from the Normie's current state. */
  cost: number
  /** Still needed if paid only from free pixels on the Normie (0 = covered). Null when free is unknown. */
  shortUsingFree: number | null
  /** Still needed if paid from every attached pixel, locked ones included (0 = covered). */
  shortUsingAttached: number
  /** Still needed if paid from the wallet (0 = covered). Null when no wallet was given. */
  shortUsingWallet: number | null
  /** Level after paying from the Normie (levelFor(attached − cost)). Null when the Normie cannot cover it. */
  levelAfterPayingFromNormie: number | null
  /** True when paying from the Normie needs locked pixels, so the contract would clear the painted overlay. */
  clearsPaintIfPaidFromNormie: boolean | null
}

export interface CanvasCostTable {
  gridSize: number
  baseCleared: boolean
  pixels: PixelsOnNormie
  walletPixels: number | null
  level: number
  enlarge: CanvasCostLine[]
  /** Null when the base is already cleared or the Normie is a Zombie (contract: one-time, not for Zombies). */
  blank: CanvasCostLine | null
  blankUnavailableReason: string | null
  prices: CanvasPrices
}

const SIZES = [50, 60, 70, 80] as const

function totalAt(size: number, prices: CanvasPrices): number | null {
  if (size === BASE_GRID) return 0
  const v = prices.enlarge[size]
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function line(size: number, kind: CanvasCostLine["kind"], cost: number, pixels: PixelsOnNormie, walletPixels: number | null): CanvasCostLine {
  const attached = Math.max(0, pixels.attached)
  const free = pixels.free
  return {
    size,
    kind,
    cost,
    shortUsingFree: free == null ? null : Math.max(0, cost - free),
    shortUsingAttached: Math.max(0, cost - attached),
    shortUsingWallet: walletPixels == null ? null : Math.max(0, cost - walletPixels),
    levelAfterPayingFromNormie: attached >= cost ? levelFor(attached - cost) : null,
    clearsPaintIfPaidFromNormie: free == null ? null : attached >= cost ? cost > free : null,
  }
}

/** Every official step from where the Normie is now. Unknown sizes are skipped, never guessed. */
export function buildCanvasCostTable(input: {
  gridSize?: number | null
  baseCleared?: boolean | null
  isZombie?: boolean
  pixels: PixelsOnNormie
  walletPixels?: number | null
  prices?: CanvasPrices
}): CanvasCostTable {
  const prices = input.prices ?? CANON_CANVAS_PRICES
  const gridSize = input.gridSize && Number.isFinite(input.gridSize) ? input.gridSize : BASE_GRID
  const baseCleared = !!input.baseCleared
  const walletPixels = typeof input.walletPixels === "number" && Number.isFinite(input.walletPixels) ? Math.max(0, input.walletPixels) : null
  const from = totalAt(gridSize, prices)
  const enlarge: CanvasCostLine[] = []
  if (from !== null) {
    for (const size of SIZES) {
      if (size <= gridSize) continue
      const to = totalAt(size, prices)
      if (to === null || to < from) continue
      enlarge.push(line(size, "enlarge", to - from, input.pixels, walletPixels))
    }
  }
  const blankUnavailableReason = baseCleared
    ? "The base art is already cleared; a blank canvas is one-time."
    : input.isZombie
      ? "Zombies cannot blank their canvas (contract rule)."
      : null
  return {
    gridSize,
    baseCleared,
    pixels: input.pixels,
    walletPixels,
    level: levelFor(input.pixels.attached),
    enlarge,
    blank: blankUnavailableReason ? null : line(gridSize, "blank", prices.blank, input.pixels, walletPixels),
    blankUnavailableReason,
    prices,
  }
}

const n = (v: number) => v.toLocaleString("en-US")

function payLine(l: CanvasCostLine, t: CanvasCostTable): string {
  const parts: string[] = []
  if (l.shortUsingFree != null) {
    parts.push(l.shortUsingFree === 0 ? "the free pixels on this Normie cover it" : `${n(l.shortUsingFree)} more than its free pixels`)
  }
  if (l.shortUsingFree == null || l.shortUsingFree > 0) {
    parts.push(l.shortUsingAttached === 0 ? "all its attached pixels cover it" : `${n(l.shortUsingAttached)} more than all its attached pixels`)
  }
  if (l.shortUsingWallet != null) {
    parts.push(l.shortUsingWallet === 0 ? "the wallet's #PIXEL covers it" : `${n(l.shortUsingWallet)} more than the wallet holds`)
  }
  let s = parts.join("; ")
  if (l.levelAfterPayingFromNormie != null) {
    s += `. Paid from the Normie, its Level goes from ${t.level} to ${l.levelAfterPayingFromNormie}`
    if (l.clearsPaintIfPaidFromNormie) s += " and the painted overlay is cleared (it needs locked pixels)"
  }
  return s
}

/** Plain-fact lines for Ask and tools. Each number comes from the table; no score, no verdict. */
export function describeCanvasCosts(t: CanvasCostTable, tokenId: number, asOf: string): string[] {
  const priceList = SIZES.map((s) => `${s}×${s} = ${n(t.prices.enlarge[s] ?? NaN)}`).join(", ")
  const lines: string[] = [
    `#${tokenId} canvas now: ${t.gridSize}×${t.gridSize}${t.baseCleared ? ", base art cleared" : ""}. Pixels on it: ${n(t.pixels.attached)} attached${t.pixels.free != null && t.pixels.locked != null ? ` (${n(t.pixels.free)} free, ${n(t.pixels.locked)} locked under paint)` : " (free/locked split not reported)"}, Level ${t.level}. Source: api.normies.art canvas/info, as of ${asOf}.`,
    `Official prices (${t.prices.from === "chain" ? "read from the chain via api.normies.art/canvas/status" : "normies.art/docs launch prices"}): total #PIXEL from 40×40 is ${priceList}; a step costs the difference. Blank canvas: ${n(t.prices.blank)}. Paid from the wallet or from the Normie; the pixels are burned.`,
  ]
  if (!t.enlarge.length) lines.push(`Already at ${t.gridSize}×${t.gridSize}, the largest official size.`)
  for (const l of t.enlarge) lines.push(`To ${l.size}×${l.size}: ${n(l.cost)} #PIXEL. ${payLine(l, t)}.`)
  if (t.blank) lines.push(`Blank canvas (drops the base art, one-time): ${n(t.blank.cost)} #PIXEL. ${payLine(t.blank, t)}.`)
  else if (t.blankUnavailableReason) lines.push(`Blank canvas: ${t.blankUnavailableReason}`)
  lines.push(
    "Free pixels pay without touching the paint. Locked pixels can pay too, but then the contract clears the painted overlay (NormiesCanvasV2). Both services are permanent.",
  )
  if (t.walletPixels == null) lines.push("Wallet #PIXEL not read here (no wallet given); it can also pay.")
  return lines
}

/** Cost of the next size up from `gridSize`, or null at 80×80. Used by Canvas Watch. */
export function nextEnlargeCost(gridSize: number | null | undefined, prices: CanvasPrices = CANON_CANVAS_PRICES): { size: number; cost: number } | null {
  const g = gridSize && Number.isFinite(gridSize) ? gridSize : BASE_GRID
  const from = totalAt(g, prices)
  if (from === null) return null
  for (const size of SIZES) {
    if (size <= g) continue
    const to = totalAt(size, prices)
    if (to !== null && to >= from) return { size, cost: to - from }
  }
  return null
}

/**
 * Canvas Watch: the next official size, when the attached pixels first cover it (they did not at the previous scan).
 * Null otherwise. 900 from 40×40.
 */
export function enlargeCoveredNow(
  actionPoints: number,
  gridSize: number | null | undefined,
  prevActionPoints: number | null | undefined,
  prices: CanvasPrices = CANON_CANVAS_PRICES,
): { size: number; cost: number } | null {
  const next = nextEnlargeCost(gridSize, prices)
  if (!next || actionPoints < next.cost) return null
  if (typeof prevActionPoints === "number" && prevActionPoints >= next.cost) return null
  return next
}

/** Parse api.normies.art/canvas/status into prices; null if the shape is not what the docs describe. */
export function pricesFromStatus(raw: unknown): CanvasPrices | null {
  const pm = (raw as { pixelMarket?: { enlargePrices?: Record<string, unknown>; blankCanvasPrice?: unknown } } | null)?.pixelMarket
  if (!pm || !pm.enlargePrices || typeof pm.blankCanvasPrice !== "number") return null
  const enlarge: Record<number, number> = {}
  for (const s of SIZES) {
    const v = pm.enlargePrices[String(s)]
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null
    enlarge[s] = v
  }
  return { enlarge, blank: pm.blankCanvasPrice, from: "chain" }
}
