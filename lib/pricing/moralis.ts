// lib/pricing/moralis.ts
// Moralis NFT collection floor price for Normies, with rarity-site fallback.
// After a successful fetch, persists a snapshot to Supabase (ThinkOS schema).

import { NORMIES_NFT } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { ECOSYSTEM_LINKS } from "@/lib/agent-recommendations/constants"
import { saveFloorPrice } from "@/lib/db/supabase"

export type MoralisFloorSource = "moralis" | "rarity-estimate"

export interface MoralisFloorResult {
  floorPriceETH: number
  source: MoralisFloorSource
  currency?: string
  marketplace?: string
  lastUpdated: string
  /** Present when source is moralis */
  floorPriceUsd?: number | null
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MORALIS_FLOOR_URL = `https://deep-index.moralis.io/api/v2.2/nft/${NORMIES_NFT}/floor-price?chain=eth`

type CacheEntry = {
  at: number
  result: MoralisFloorResult | null
}

let floorCache: CacheEntry | null = null

type MoralisFloorPayload = {
  floor_price?: number | string
  floor_price_usd?: number | string
  floor_price_currency?: string
  marketplace?: string
  last_updated?: string
}

type RarityFloorPayload = {
  floorPrice?: number | null
  total?: number
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === "string") {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

/**
 * Collection floor from rarity.normies.art list payload (`floorPrice` field).
 * Used when Moralis is unavailable or fails.
 */
async function getFloorRarityEstimate(): Promise<MoralisFloorResult | null> {
  try {
    const res = await fetchWithTimeout(
      `${ECOSYSTEM_LINKS.rarityApi}/normies?limit=1`,
      { headers: { Accept: "application/json" } },
      8_000,
    )
    if (!res.ok) return null
    const data = (await res.json()) as RarityFloorPayload
    const eth = parsePositiveNumber(data.floorPrice)
    if (eth == null) return null
    return {
      floorPriceETH: eth,
      source: "rarity-estimate",
      lastUpdated: new Date().toISOString(),
    }
  } catch (e) {
    console.warn("[moralis] rarity floor estimate failed:", e)
    return null
  }
}

/**
 * Persist floor snapshot to Supabase (non-blocking for callers).
 * Matches ThinkOS moralis → saveFloorPrice flow.
 */
async function persistFloorSnapshot(
  result: MoralisFloorResult,
): Promise<void> {
  try {
    await saveFloorPrice(
      result.floorPriceETH,
      result.floorPriceUsd ?? null,
      result.source,
    )
  } catch (e) {
    console.warn("[moralis] Supabase floor save failed:", e)
  }
}

/**
 * Live Normies collection floor via Moralis NFT Floor Price API.
 * Uses MORALIS_API_KEY from env. Results are cached for 5 minutes.
 * On Moralis failure / missing key, falls back to rarity.normies.art floorPrice.
 * Fresh fetches (cache miss) are written to Supabase `floor_prices`.
 */
export async function getFloorMoralis(options?: {
  force?: boolean
}): Promise<MoralisFloorResult | null> {
  const now = Date.now()
  if (
    !options?.force &&
    floorCache &&
    now - floorCache.at < CACHE_TTL_MS
  ) {
    return floorCache.result
  }

  const apiKey = process.env.MORALIS_API_KEY?.trim()

  if (apiKey) {
    try {
      const res = await fetchWithTimeout(
        MORALIS_FLOOR_URL,
        {
          headers: {
            Accept: "application/json",
            "X-API-Key": apiKey,
          },
        },
        8_000,
      )

      if (res.ok) {
        const data = (await res.json()) as MoralisFloorPayload
        const eth = parsePositiveNumber(data.floor_price)
        if (eth != null) {
          const result: MoralisFloorResult = {
            floorPriceETH: eth,
            source: "moralis",
            currency: data.floor_price_currency || "ETH",
            marketplace: data.marketplace,
            lastUpdated: data.last_updated || new Date().toISOString(),
            floorPriceUsd: parsePositiveNumber(data.floor_price_usd),
          }
          floorCache = { at: now, result }
          // Same as ThinkOS: save after successful fetch (do not block return)
          void persistFloorSnapshot(result)
          return result
        }
      } else {
        console.warn(
          `[moralis] floor-price HTTP ${res.status}: ${await res.text().catch(() => "")}`,
        )
      }
    } catch (e) {
      console.warn("[moralis] Moralis floor fetch failed:", e)
    }
  } else {
    console.warn("[moralis] MORALIS_API_KEY not set — using rarity estimate")
  }

  // Fallback: rarity site collection floor estimate
  const fallback = await getFloorRarityEstimate()
  floorCache = { at: now, result: fallback }
  if (fallback) {
    void persistFloorSnapshot(fallback)
  }
  return fallback
}

/** Clear in-memory floor cache (tests / forced refresh helpers). */
export function clearMoralisFloorCache(): void {
  floorCache = null
}
