// lib/agent-recommendations/marketData.ts
// Live collection floor when possible — never invent static fake prices.

import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { NORMIES_NFT } from "@/constants/contracts"

import { estimateAPYield } from "./burnData"

export const OPENSEA_COLLECTION_URL = "https://opensea.io/collection/normies"

export interface FloorPrice {
  type: string
  rarityTier: string
  floorPriceETH: number | null
  lastUpdated: string
  source: "opensea" | "reservoir" | "unavailable"
}

export const FLOORS_NOTE =
  "Always verify live floor on OpenSea before buying: https://opensea.io/collection/normies — prices move fast. Not financial advice. Factor gas for burn commit+reveal."

/** @deprecated Removed stale static table — kept empty so old imports do not quote lies. */
export const CURRENT_FLOORS: FloorPrice[] = []

type LiveFloorCache = {
  at: number
  floor: FloorPrice | null
}

let floorCache: LiveFloorCache | null = null
const FLOOR_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Live Normies collection floor (ETH), primarily via OpenSea stats.
 * Does not invent per-type floors — collection floor only.
 */
export async function getLiveCollectionFloor(): Promise<FloorPrice | null> {
  const now = Date.now()
  if (floorCache && now - floorCache.at < FLOOR_CACHE_TTL_MS) {
    return floorCache.floor
  }

  // 1) OpenSea public collection stats (no key required for many public stats)
  try {
    const res = await fetchWithTimeout(
      "https://api.opensea.io/api/v2/collections/normies/stats",
      {
        headers: {
          Accept: "application/json",
          ...(process.env.OPENSEA_API_KEY
            ? { "X-API-KEY": process.env.OPENSEA_API_KEY }
            : {}),
        },
      },
      8_000,
    )
    if (res.ok) {
      const data = (await res.json()) as {
        total?: { floor_price?: number; floor_price_symbol?: string }
      }
      const eth = data.total?.floor_price
      if (typeof eth === "number" && Number.isFinite(eth) && eth > 0) {
        const floor: FloorPrice = {
          type: "collection",
          rarityTier: "floor",
          floorPriceETH: eth,
          lastUpdated: new Date().toISOString(),
          source: "opensea",
        }
        floorCache = { at: now, floor }
        return floor
      }
    }
  } catch (e) {
    console.warn("[marketData] OpenSea floor fetch failed:", e)
  }

  // 2) Optional Reservoir (if key configured)
  try {
    const key = process.env.RESERVOIR_API_KEY?.trim()
    if (key) {
      const url =
        `https://api.reservoir.tools/collections/v7?id=${NORMIES_NFT.toLowerCase()}`
      const res = await fetchWithTimeout(
        url,
        { headers: { Accept: "application/json", "x-api-key": key } },
        8_000,
      )
      if (res.ok) {
        const data = (await res.json()) as {
          collections?: Array<{ floorAsk?: { price?: { amount?: { native?: number } } } }>
        }
        const native = data.collections?.[0]?.floorAsk?.price?.amount?.native
        if (typeof native === "number" && Number.isFinite(native) && native > 0) {
          const floor: FloorPrice = {
            type: "collection",
            rarityTier: "floor",
            floorPriceETH: native,
            lastUpdated: new Date().toISOString(),
            source: "reservoir",
          }
          floorCache = { at: now, floor }
          return floor
        }
      }
    }
  } catch (e) {
    console.warn("[marketData] Reservoir floor fetch failed:", e)
  }

  floorCache = { at: now, floor: null }
  return null
}

export interface AcquisitionOption {
  type: string
  cost: number | null
  expectedAP: number
  efficiency: number | null
  confidence: "low" | "medium" | "high"
}

export interface AcquisitionAnalysis {
  recommendation: string
  options: AcquisitionOption[]
  floorsNote: string
  liveFloorETH: number | null
  liveFloorSource?: string
  liveFloorUpdatedAt?: string
}

/**
 * Acquisition framing using live collection floor only.
 * Never uses stale hardcoded type floors.
 */
export async function analyzeAcquisitionStrategy(
  targetAP = 20,
  _budgetETH?: number,
): Promise<AcquisitionAnalysis> {
  const live = await getLiveCollectionFloor()
  const commonAp = await estimateAPYield("human", "common", 3)

  if (!live?.floorPriceETH) {
    return {
      recommendation: `I cannot determine current floor prices right now. Before any acquisition, check live floor on OpenSea: ${OPENSEA_COLLECTION_URL}. Do not rely on remembered or static ETH quotes. For ~${targetAP} AP, burn strategy depends on pixel tier and reveal RNG — see burn estimates in strategy snapshot. ${FLOORS_NOTE}`,
      options: [],
      floorsNote: FLOORS_NOTE,
      liveFloorETH: null,
    }
  }

  const floor = live.floorPriceETH
  // Rough framing only: one floor unit may yield ~common median AP if burned as fodder (highly variable)
  const unitsGuess =
    commonAp.median > 0 ? Math.max(1, Math.ceil(targetAP / commonAp.median)) : 2
  const roughCost = floor * unitsGuess

  return {
    recommendation: `Live collection floor ~${floor.toFixed(3)} ETH (${live.source}, as of ${live.lastUpdated}). For ~${targetAP} AP, a rough framing is on the order of ~${unitsGuess} floor unit(s) if burned as fodder (~${roughCost.toFixed(3)} ETH before gas) — this is NOT a guarantee (pixel tier, RNG, and listing depth matter). Always re-check ${OPENSEA_COLLECTION_URL} before buying. Common/Human listings are often near floor but verify. Include gas for commit+reveal. ${FLOORS_NOTE}`,
    options: [
      {
        type: "collection-floor",
        cost: floor,
        expectedAP: commonAp.median,
        efficiency: commonAp.median / floor,
        confidence: commonAp.confidence === "high" ? "medium" : "low",
      },
    ],
    floorsNote: FLOORS_NOTE,
    liveFloorETH: floor,
    liveFloorSource: live.source,
    liveFloorUpdatedAt: live.lastUpdated,
  }
}

/** @deprecated Use analyzeAcquisitionStrategy */
export const getAcquisitionStrategy = analyzeAcquisitionStrategy
