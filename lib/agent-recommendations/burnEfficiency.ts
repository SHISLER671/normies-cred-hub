// lib/agent-recommendations/burnEfficiency.ts
// Burn Efficiency Optimizer — rank buy/burn fodder by expected AP per ETH.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import {
  estimateAPYield,
  fetchLiveBurns,
  tierFromRank,
  type RarityTier,
} from "./burnData"
import { ECOSYSTEM_LINKS } from "./constants"
import { getLiveCollectionFloor, OPENSEA_COLLECTION_URL } from "./marketData"
import {
  estimateBurnApFromPixels,
  type ApTier,
} from "./normiesKnowledge"

export const BURN_EFFICIENCY_DISCLAIMER =
  "These are estimates based on historical burn data and current floor/listing prices — not guarantees. Reveal RNG, pixel count, gas, and listing depth all affect realized AP. Always verify live prices on OpenSea and DYOR before burning. Not financial advice."

export interface BurnEfficiencyCandidate {
  tokenId: number
  floorPriceETH: number
  estimatedAP: number
  efficiencyScore: number
  rarityTier?: RarityTier
  rarityRank?: number | null
  type?: string
  pixelCount?: number
  priceSource: "opensea-listing" | "collection-floor"
  confidence: "low" | "medium" | "high"
  notes?: string
}

export interface BurnEfficiencyResult {
  scanned: boolean
  topCandidates: BurnEfficiencyCandidate[]
  collectionFloorETH: number | null
  collectionFloorSource?: string
  burnSampleSize: number
  historicalApMedian: number | null
  disclaimer: string
  summary: string
  sources: string[]
}

const SCAN_KEYWORDS = [
  "scan burns",
  "scan burn",
  "burn efficiency",
  "burn opportunit",
  "efficient burn",
  "best burn",
  "fodder",
  "buy to burn",
  "buy-to-burn",
  "ap per eth",
  "ap/eth",
  "burn scan",
  "optimize burn",
  "burn optimizer",
  "which to burn",
  "what should i burn",
  "cheap burns",
  "burn candidates market",
]

/** True when the user is asking for market burn-efficiency / scan burns. */
export function isBurnEfficiencyQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase().trim()
  if (!q) return false
  if (SCAN_KEYWORDS.some((k) => q.includes(k))) return true
  // Broader: "burn" + opportunity/efficiency/scan framing
  if (
    q.includes("burn") &&
    (q.includes("opportunit") ||
      q.includes("efficien") ||
      q.includes("scan") ||
      q.includes("rank") ||
      q.includes("top") ||
      q.includes("best") ||
      q.includes("floor"))
  ) {
    return true
  }
  return false
}

type OpenSeaListingRow = {
  order_hash?: string
  price?: {
    current?: {
      currency?: string
      decimals?: number
      value?: string
    }
  }
  protocol_data?: {
    parameters?: {
      offer?: Array<{
        itemType?: number
        token?: string
        identifierOrCriteria?: string
      }>
      consideration?: Array<{
        itemType?: number
        token?: string
        startAmount?: string
        endAmount?: string
      }>
    }
  }
}

type RarityListPayload = {
  items?: Array<{
    id?: number
    rank?: number
    attributes?: Array<{ trait_type?: string; value?: string }>
  }>
  total?: number
  floorPrice?: number | null
}

let efficiencyCache: { at: number; result: BurnEfficiencyResult } | null = null
const EFFICIENCY_CACHE_TTL_MS = 8 * 60 * 1000

function weiSumToEth(
  consideration: Array<{ itemType?: number; token?: string; startAmount?: string }> | undefined,
): number | null {
  if (!consideration?.length) return null
  let wei = BigInt(0)
  for (const c of consideration) {
    // Native ETH (itemType 0) or WETH-like payments to offerer/fees
    if (c.itemType !== 0 && c.itemType !== 1) continue
    const token = (c.token || "").toLowerCase()
    const isEth =
      !token ||
      token === "0x0000000000000000000000000000000000000000" ||
      token === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    if (!isEth) continue
    try {
      wei += BigInt(c.startAmount || "0")
    } catch {
      /* skip */
    }
  }
  if (wei <= BigInt(0)) return null
  return Number(wei) / 1e18
}

function priceFromListing(row: OpenSeaListingRow): { tokenId: number; eth: number } | null {
  const offer = row.protocol_data?.parameters?.offer?.[0]
  const tokenId = offer?.identifierOrCriteria != null ? Number(offer.identifierOrCriteria) : NaN
  if (!Number.isFinite(tokenId) || tokenId < 0 || tokenId > 9999) return null

  // Prefer explicit price field when present
  const rawVal = row.price?.current?.value
  const decimals = row.price?.current?.decimals ?? 18
  if (rawVal != null) {
    try {
      const n = Number(BigInt(rawVal)) / 10 ** decimals
      if (Number.isFinite(n) && n > 0) return { tokenId, eth: n }
    } catch {
      const n = Number(rawVal)
      if (Number.isFinite(n) && n > 0) {
        // Sometimes value is already human-readable
        return { tokenId, eth: n > 100 ? n / 1e18 : n }
      }
    }
  }

  const eth = weiSumToEth(row.protocol_data?.parameters?.consideration)
  if (eth == null || !Number.isFinite(eth) || eth <= 0) return null
  return { tokenId, eth }
}

/** Cheapest active Normies listings via OpenSea (API key preferred). */
export async function fetchOpenSeaBestListings(limit = 20): Promise<
  Array<{ tokenId: number; priceETH: number }>
> {
  try {
    const res = await fetchWithTimeout(
      `https://api.opensea.io/api/v2/listings/collection/normies/best?limit=${Math.min(limit, 50)}`,
      {
        headers: {
          Accept: "application/json",
          ...(process.env.OPENSEA_API_KEY
            ? { "X-API-KEY": process.env.OPENSEA_API_KEY }
            : {}),
        },
      },
      10_000,
    )
    if (!res.ok) return []
    const data = (await res.json()) as { listings?: OpenSeaListingRow[]; errors?: unknown }
    if (!Array.isArray(data.listings)) return []

    const out: Array<{ tokenId: number; priceETH: number }> = []
    const seen = new Set<number>()
    for (const row of data.listings) {
      const parsed = priceFromListing(row)
      if (!parsed || seen.has(parsed.tokenId)) continue
      seen.add(parsed.tokenId)
      out.push({ tokenId: parsed.tokenId, priceETH: parsed.eth })
    }
    return out.sort((a, b) => a.priceETH - b.priceETH)
  } catch (e) {
    console.warn("[burnEfficiency] OpenSea listings fetch failed:", e)
    return []
  }
}

/** Most common surviving Normies (high rank #) — typical burn fodder. */
async function fetchCommonTokenIds(limit = 15): Promise<
  Array<{ tokenId: number; rank: number; type: string }>
> {
  try {
    const res = await fetchWithTimeout(
      `${ECOSYSTEM_LINKS.rarityApi}/normies?limit=${limit}&sort=rank&order=desc`,
      { headers: { Accept: "application/json" } },
      8_000,
    )
    if (!res.ok) return []
    const data = (await res.json()) as RarityListPayload
    if (!Array.isArray(data.items)) return []
    const out: Array<{ tokenId: number; rank: number; type: string }> = []
    for (const item of data.items) {
      const id = Number(item.id)
      if (!Number.isFinite(id)) continue
      const type =
        item.attributes?.find((a) => a.trait_type === "Type")?.value ?? "Unknown"
      out.push({
        tokenId: id,
        rank: typeof item.rank === "number" ? item.rank : 9999,
        type: String(type),
      })
    }
    return out
  } catch {
    return []
  }
}

async function fetchPixelCount(tokenId: number): Promise<number | undefined> {
  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}/normie/${tokenId}/pixels`,
      {},
      5_000,
    )
    if (!res.ok) return undefined
    const text = (await res.text()).trim()
    if (!text) return undefined
    let on = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "1") on++
    }
    return on
  } catch {
    return undefined
  }
}

function medianOf(sorted: number[]): number {
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
  }
  return sorted[mid]!
}

/**
 * Expected AP for a candidate: prefer pixel-tier midpoint, blend with
 * live history band for the rarity tier when available.
 */
async function estimateCandidateAP(
  pixelCount: number | undefined,
  rarityTier: RarityTier,
  type: string,
): Promise<{ ap: number; confidence: "low" | "medium" | "high"; notes: string; tier?: ApTier }> {
  const history = await estimateAPYield(type, rarityTier, 3)

  if (pixelCount != null && pixelCount > 0) {
    const fromPixels = estimateBurnApFromPixels(pixelCount)
    const mid = Math.round((fromPixels.minAp + fromPixels.maxAp) / 2)
    // Blend lightly toward historical median when sample is decent
    const ap =
      history.sampleSize >= 3
        ? Math.round(mid * 0.7 + history.median * 0.3)
        : mid
    return {
      ap: Math.max(1, ap),
      confidence:
        history.confidence === "high"
          ? "high"
          : history.sampleSize > 0
            ? "medium"
            : "low",
      notes: `Pixel tier ${fromPixels.tier.label} → ${fromPixels.minAp}–${fromPixels.maxAp} AP; history median ~${history.median} (n=${history.sampleSize}).`,
      tier: fromPixels.tier,
    }
  }

  return {
    ap: Math.max(1, history.median || 10),
    confidence: history.confidence,
    notes: history.notes,
  }
}

function scoreEfficiency(estimatedAP: number, priceETH: number): number {
  if (!Number.isFinite(priceETH) || priceETH <= 0) return 0
  if (!Number.isFinite(estimatedAP) || estimatedAP <= 0) return 0
  // AP per ETH, rounded to 2 decimals for readability
  return Math.round((estimatedAP / priceETH) * 100) / 100
}

/**
 * Run Burn Efficiency Optimizer: OpenSea floors/listings + Normies burn history
 * → top 5 candidates by expected AP / price ETH.
 */
export async function scanBurnEfficiency(options?: {
  ownedTokenIds?: number[]
  force?: boolean
}): Promise<BurnEfficiencyResult> {
  const now = Date.now()
  if (
    !options?.force &&
    efficiencyCache &&
    now - efficiencyCache.at < EFFICIENCY_CACHE_TTL_MS
  ) {
    return efficiencyCache.result
  }

  const sources: string[] = [
    OPENSEA_COLLECTION_URL,
    `${NORMIES_API_BASE}/history/burns`,
    ECOSYSTEM_LINKS.rarity,
  ]

  const [floor, burns, listings] = await Promise.all([
    getLiveCollectionFloor(),
    fetchLiveBurns(50),
    fetchOpenSeaBestListings(20),
  ])

  const collectionFloorETH = floor?.floorPriceETH ?? null
  const burnYields = burns.map((b) => b.apYield).filter((y) => y > 0)
  const historicalApMedian =
    burnYields.length > 0 ? medianOf([...burnYields].sort((a, b) => a - b)) : null

  type Seed = {
    tokenId: number
    priceETH: number
    priceSource: BurnEfficiencyCandidate["priceSource"]
    rarityRank?: number | null
    type?: string
  }

  const seeds: Seed[] = []
  const seen = new Set<number>()

  // 1) Prefer real listing prices (most accurate efficiency)
  for (const L of listings) {
    if (seen.has(L.tokenId)) continue
    seen.add(L.tokenId)
    seeds.push({
      tokenId: L.tokenId,
      priceETH: L.priceETH,
      priceSource: "opensea-listing",
    })
  }

  // 2) Fill with common rarity ranks at collection floor (market fodder scan)
  if (seeds.length < 12 && collectionFloorETH != null) {
    const commons = await fetchCommonTokenIds(20)
    for (const c of commons) {
      if (seen.has(c.tokenId)) continue
      seen.add(c.tokenId)
      seeds.push({
        tokenId: c.tokenId,
        priceETH: collectionFloorETH,
        priceSource: "collection-floor",
        rarityRank: c.rank,
        type: c.type,
      })
      if (seeds.length >= 18) break
    }
  }

  // 3) Optional owned tokens at collection floor (wallet burn efficiency)
  if (collectionFloorETH != null && options?.ownedTokenIds?.length) {
    for (const id of options.ownedTokenIds.slice(0, 10)) {
      if (seen.has(id)) continue
      seen.add(id)
      seeds.push({
        tokenId: id,
        priceETH: collectionFloorETH,
        priceSource: "collection-floor",
      })
    }
  }

  // Cap enrichment work
  const toScore = seeds.slice(0, 15)

  const candidates: BurnEfficiencyCandidate[] = []
  await Promise.all(
    toScore.map(async (seed) => {
      try {
        const [pixels, rarity] = await Promise.all([
          fetchPixelCount(seed.tokenId),
          fetchWithTimeout(
            `${ECOSYSTEM_LINKS.rarityApi}/normie/${seed.tokenId}`,
            {},
            5_000,
          )
            .then(async (r) =>
              r.ok
                ? ((await r.json()) as {
                    rank?: number
                    attributes?: Array<{ trait_type?: string; value?: string }>
                  })
                : null,
            )
            .catch(() => null),
        ])

        const rank =
          seed.rarityRank ??
          (typeof rarity?.rank === "number" ? rarity.rank : null)
        const type =
          seed.type ??
          rarity?.attributes?.find((a) => a.trait_type === "Type")?.value ??
          "Human"
        const tier = tierFromRank(rank)
        const est = await estimateCandidateAP(pixels, tier, String(type))
        const efficiencyScore = scoreEfficiency(est.ap, seed.priceETH)

        candidates.push({
          tokenId: seed.tokenId,
          floorPriceETH: Math.round(seed.priceETH * 1e6) / 1e6,
          estimatedAP: est.ap,
          efficiencyScore,
          rarityTier: tier,
          rarityRank: rank,
          type: String(type),
          pixelCount: pixels,
          priceSource: seed.priceSource,
          confidence: est.confidence,
          notes: est.notes,
        })
      } catch {
        /* skip token */
      }
    }),
  )

  candidates.sort((a, b) => b.efficiencyScore - a.efficiencyScore)
  const topCandidates = candidates.slice(0, 5)

  let summary: string
  if (topCandidates.length === 0) {
    summary =
      collectionFloorETH == null
        ? `Burn efficiency scan could not load floor prices or candidates. Check ${OPENSEA_COLLECTION_URL} and burn history manually. ${BURN_EFFICIENCY_DISCLAIMER}`
        : `Collection floor ~${collectionFloorETH.toFixed(4)} ETH but no token candidates could be scored (listings/API temporarily unavailable). Historical burn median AP ~${historicalApMedian ?? "n/a"} (n=${burns.length}). ${BURN_EFFICIENCY_DISCLAIMER}`
  } else {
    const lines = topCandidates.map(
      (c, i) =>
        `${i + 1}. #${c.tokenId} — ${c.floorPriceETH.toFixed(4)} ETH (${c.priceSource}), ~${c.estimatedAP} AP est., efficiency ${c.efficiencyScore} AP/ETH`,
    )
    summary = [
      `Burn Efficiency Optimizer — top ${topCandidates.length} candidates (expected AP / price ETH):`,
      ...lines,
      collectionFloorETH != null
        ? `Collection floor reference: ~${collectionFloorETH.toFixed(4)} ETH${floor?.source ? ` (${floor.source})` : ""}.`
        : "Collection floor unavailable.",
      historicalApMedian != null
        ? `Recent burn sample median ~${historicalApMedian} AP (n=${burns.length}).`
        : "Live burn samples limited.",
      BURN_EFFICIENCY_DISCLAIMER,
    ].join("\n")
  }

  const result: BurnEfficiencyResult = {
    scanned: true,
    topCandidates,
    collectionFloorETH,
    collectionFloorSource: floor?.source,
    burnSampleSize: burns.length,
    historicalApMedian,
    disclaimer: BURN_EFFICIENCY_DISCLAIMER,
    summary,
    sources,
  }

  efficiencyCache = { at: now, result }
  return result
}
