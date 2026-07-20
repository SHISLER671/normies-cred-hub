// lib/agent-recommendations/marketData.ts
// Manual floor seeds + acquisition efficiency framing (verify on OpenSea).

import { estimateAPYield, type NormieType } from "./burnData"

export interface FloorPrice {
  type: NormieType
  rarityTier: "common" | "uncommon" | "rare" | "epic" | "legendary"
  floorPriceETH: number
  lastUpdated: string
  source: "opensea" | "blur" | "manual"
}

/**
 * Approximate floors for strategy framing only — NOT a live market feed.
 * Update manually; always tell users to verify on OpenSea / rarity tools.
 */
export const CURRENT_FLOORS: FloorPrice[] = [
  {
    type: "human",
    rarityTier: "common",
    floorPriceETH: 0.008,
    lastUpdated: "2026-07-20",
    source: "manual",
  },
  {
    type: "cat",
    rarityTier: "common",
    floorPriceETH: 0.012,
    lastUpdated: "2026-07-20",
    source: "manual",
  },
  {
    type: "alien",
    rarityTier: "common",
    floorPriceETH: 0.025,
    lastUpdated: "2026-07-20",
    source: "manual",
  },
  {
    type: "agent",
    rarityTier: "common",
    floorPriceETH: 0.15,
    lastUpdated: "2026-07-20",
    source: "manual",
  },
]

export const FLOORS_NOTE =
  "Floor prices are manual estimates for strategy framing only — verify live on OpenSea before buying. Not financial advice."

export interface AcquisitionOption {
  type: string
  cost: number
  expectedAP: number
  efficiency: number
  confidence: "low" | "medium" | "high"
}

export interface AcquisitionAnalysis {
  recommendation: string
  options: AcquisitionOption[]
  floorsNote: string
}

export async function analyzeAcquisitionStrategy(
  targetAP = 20,
  budgetETH = 0.05,
): Promise<AcquisitionAnalysis> {
  const options: AcquisitionOption[] = []

  for (const floor of CURRENT_FLOORS) {
    if (floor.floorPriceETH > budgetETH * 2) continue
    const ap = await estimateAPYield(floor.type, floor.rarityTier, 3)
    options.push({
      type: floor.type,
      cost: floor.floorPriceETH,
      expectedAP: ap.median,
      efficiency: floor.floorPriceETH > 0 ? ap.median / floor.floorPriceETH : 0,
      confidence: ap.confidence,
    })
  }

  options.sort((a, b) => b.efficiency - a.efficiency)

  if (!options.length) {
    return {
      recommendation:
        "No acquisition options within framing budget — raise budget or burn owned commons (with DYOR).",
      options: [],
      floorsNote: FLOORS_NOTE,
    }
  }

  const best = options[0]!
  const label = best.type.charAt(0).toUpperCase() + best.type.slice(1)

  return {
    recommendation: `Most efficient framing: Common ${label} ~${best.cost} ETH → ~${best.expectedAP} AP (${best.efficiency.toFixed(0)} AP/ETH, confidence ${best.confidence}). Target ~${targetAP} AP may need multiple units. ${FLOORS_NOTE}`,
    options,
    floorsNote: FLOORS_NOTE,
  }
}
