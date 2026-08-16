// lib/agent-recommendations/burnMath.ts
// Labeled burn / AP arithmetic for Ask. Never invent ETH-USD or AP rolls.

import {
  estimateBurnApFromPixels,
  type ApTier,
} from "./normiesKnowledge"

export type BurnPriceKind = "paid" | "floor" | "listing"

export type BurnMathInput = {
  pixelCount: number
  /** ETH amount used for the estimate (user-stated cost, listing, or floor). */
  ethAmount: number
  priceKind: BurnPriceKind
  /** ETH-USD only when already in context. Never invent. */
  ethUsd?: number | null
  tokenId?: number
}

export type BurnMathResult = {
  pixelCount: number
  tokenId?: number
  minAp: number
  midAp: number
  maxAp: number
  tier: ApTier
  ethAmount: number
  priceKind: BurnPriceKind
  ethUsd: number | null
  usd: number | null
  usdPerApMin: number | null
  usdPerApMid: number | null
  usdPerApMax: number | null
  /** Single labeled line for the prompt. */
  line: string
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0
}

function roundMoney(n: number): number {
  if (n >= 10) return Math.round(n)
  return Math.round(n * 100) / 100
}

function formatUsd(n: number): string {
  const r = roundMoney(n)
  if (Number.isInteger(r)) return `$${r}`
  return `$${r.toFixed(r >= 10 ? 1 : 2)}`
}

function formatEth(n: number): string {
  if (n >= 1) return n.toFixed(3).replace(/\.?0+$/, "")
  if (n >= 0.01) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
  return n.toFixed(5).replace(/0+$/, "").replace(/\.$/, "")
}

/**
 * Parse a user-stated ETH cost from free text.
 * Prefers "paid / bought / cost / at" phrasing; falls back to an explicit "X ETH".
 * Ignores token IDs (#7141) and huge numbers.
 */
export function parsePaidEthFromQuery(query: string): number | null {
  const q = (query || "").trim()
  if (!q) return null

  const preferred =
    /(?:paid|bought(?:\s+(?:it\s+)?at)?|cost(?:\s+me)?|at)\s+(\d+(?:\.\d+)?)\s*(?:eth)?\b/i.exec(
      q,
    )
  const fallback = /(\d+(?:\.\d+)?)\s*eth\b/i.exec(q)
  const raw = preferred?.[1] ?? fallback?.[1]
  if (!raw) return null
  const n = Number(raw)
  if (!isPositiveFinite(n) || n >= 1000) return null
  return n
}

export function formatBurnMath(input: BurnMathInput): BurnMathResult | null {
  const { pixelCount, ethAmount, priceKind } = input
  if (!isPositiveFinite(pixelCount) || pixelCount > 1600) return null
  if (!isPositiveFinite(ethAmount) || ethAmount >= 1000) return null

  const { minAp, maxAp, tier } = estimateBurnApFromPixels(pixelCount)
  if (minAp <= 0 && maxAp <= 0) return null
  const midAp = Math.max(1, Math.round((minAp + maxAp) / 2))

  const ethUsd = isPositiveFinite(input.ethUsd) ? input.ethUsd : null
  const usd = ethUsd != null ? ethAmount * ethUsd : null
  const usdPerApMin =
    usd != null && maxAp > 0 ? usd / maxAp : null
  const usdPerApMax =
    usd != null && minAp > 0 ? usd / minAp : null
  const usdPerApMid =
    usd != null && midAp > 0 ? usd / midAp : null

  const idPart = input.tokenId != null ? `#${input.tokenId} · ` : ""
  const priceLabel =
    priceKind === "paid"
      ? "paid"
      : priceKind === "listing"
        ? "listing (planning)"
        : "floor (planning — not cost basis)"

  let line = `${idPart}${pixelCount} px · band ~${minAp}–${maxAp} AP (${tier.label}) · ${priceLabel} ${formatEth(ethAmount)} ETH`

  if (usd != null && ethUsd != null) {
    line += ` · at ${formatUsd(ethUsd)}/ETH ≈ ${formatUsd(usd)}`
    if (usdPerApMin != null && usdPerApMax != null) {
      const lo = Math.min(usdPerApMin, usdPerApMax)
      const hi = Math.max(usdPerApMin, usdPerApMax)
      const loShown = lo >= 10 ? Math.floor(lo) : lo
      const hiShown = hi >= 10 ? Math.ceil(hi) : hi
      line += ` → ~${formatUsd(loShown)}–${formatUsd(hiShown)}/AP depending on roll`
    }
  } else {
    line += " · ETH-USD unavailable — no USD or $/AP (do not invent)"
  }

  line += ". Estimate, not a guarantee. Unlucky roll = low end of band, not broken math."

  return {
    pixelCount,
    tokenId: input.tokenId,
    minAp,
    midAp,
    maxAp,
    tier,
    ethAmount,
    priceKind,
    ethUsd,
    usd: usd != null ? roundMoney(usd) : null,
    usdPerApMin: usdPerApMin != null ? roundMoney(usdPerApMin) : null,
    usdPerApMid: usdPerApMid != null ? roundMoney(usdPerApMid) : null,
    usdPerApMax: usdPerApMax != null ? roundMoney(usdPerApMax) : null,
    line,
  }
}

export function deriveEthUsd(
  floorPriceETH?: number | null,
  floorPriceUsd?: number | null,
): number | null {
  if (!isPositiveFinite(floorPriceETH) || !isPositiveFinite(floorPriceUsd)) {
    return null
  }
  const rate = floorPriceUsd / floorPriceETH
  return isPositiveFinite(rate) && rate < 1_000_000 ? rate : null
}
