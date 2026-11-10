// lib/agent-recommendations/marketData.ts
// Live collection floor when possible — never invent static fake prices.

import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { NORMIES_NFT } from "@/constants/contracts"
import { getFloorMoralis } from "@/lib/pricing/moralis"

export const OPENSEA_COLLECTION_URL = "https://opensea.io/collection/normies"

export interface FloorPrice {
  type: string
  rarityTier: string
  floorPriceETH: number | null
  lastUpdated: string
  source: "opensea" | "reservoir" | "unavailable"
}

export const FLOORS_NOTE =
  "Floor figures are snapshots with their source and time; the live floor is on OpenSea (https://opensea.io/collection/normies). Values can go up or down and no one knows the future. Not financial advice."

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

export type ResolvedLiveFloor = {
  floorPriceETH: number
  source: string
  lastUpdated: string
  floorPriceUsd?: number | null
}

/**
 * Live collection floor with shared preference order:
 * Moralis (persists to Supabase floor_prices) → OpenSea / Reservoir.
 * Used by Ask floor snapshot, burn efficiency, market sentinel, acquisition.
 */
export async function resolveLiveCollectionFloor(): Promise<ResolvedLiveFloor | null> {
  try {
    const moralis = await getFloorMoralis()
    if (moralis?.floorPriceETH != null && moralis.floorPriceETH > 0) {
      return {
        floorPriceETH: moralis.floorPriceETH,
        source: moralis.source,
        lastUpdated: moralis.lastUpdated || new Date().toISOString(),
        floorPriceUsd: moralis.floorPriceUsd ?? null,
      }
    }
  } catch (e) {
    console.warn("[marketData] Moralis floor failed:", e)
  }

  try {
    const live = await getLiveCollectionFloor()
    if (live?.floorPriceETH != null && live.floorPriceETH > 0) {
      return {
        floorPriceETH: live.floorPriceETH,
        source: live.source,
        lastUpdated: live.lastUpdated || new Date().toISOString(),
      }
    }
  } catch (e) {
    console.warn("[marketData] OpenSea/Reservoir floor failed:", e)
  }

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
 * Prefer Moralis → OpenSea/Reservoir (shared floor pipeline). Never invent type floors.
 */
export async function analyzeAcquisitionStrategy(
  targetAP = 20,
  _budgetETH?: number,
): Promise<AcquisitionAnalysis> {
  // Shared resolver: Moralis first (persists history), then OpenSea/Reservoir
  const live = await resolveLiveCollectionFloor()

  if (!live?.floorPriceETH) {
    return {
      recommendation: `Live collection floor unavailable right now (no source answered). The live floor is on OpenSea: ${OPENSEA_COLLECTION_URL}. Do not quote remembered or static ETH figures. ${FLOORS_NOTE}`,
      options: [],
      floorsNote: FLOORS_NOTE,
      liveFloorETH: null,
    }
  }

  const floor = live.floorPriceETH
  // Facts only (AGENTS.md): no "buy N floor Normies and burn them to reach X AP" math outside /burn. The target-AP
  // argument is kept for old callers and ignored.
  void targetAP

  return {
    recommendation: `Live collection floor ~${floor.toFixed(3)} ETH (source: ${live.source}, as of ${live.lastUpdated}); a snapshot, not a guarantee. Buy-vs-burn comparisons live on /burn (vibe check, not financial advice). ${FLOORS_NOTE}`,
    // No buy-to-burn option rows (expected AP, AP per ETH): that comparison is fenced to /burn.
    options: [],
    floorsNote: FLOORS_NOTE,
    liveFloorETH: floor,
    liveFloorSource: live.source,
    liveFloorUpdatedAt: live.lastUpdated,
  }
}

/** @deprecated Use analyzeAcquisitionStrategy */
export const getAcquisitionStrategy = analyzeAcquisitionStrategy
