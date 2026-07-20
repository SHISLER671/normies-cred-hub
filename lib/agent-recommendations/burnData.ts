// lib/agent-recommendations/burnData.ts
// Burn / AP yield estimates from live Normies history + tier fallbacks.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

export type NormieType = "human" | "cat" | "alien" | "agent" | "unknown"
export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary"

export interface BurnRecord {
  tokenId?: number
  type: NormieType
  rarityTier?: RarityTier
  traits?: string[]
  pixelCount?: number
  apYield: number
  timestamp: string
  txHash?: string
  source: "live" | "seed"
}

export interface APYieldEstimate {
  min: number
  max: number
  median: number
  confidence: "low" | "medium" | "high"
  sampleSize: number
  notes: string
}

export interface OwnedNormieSnapshot {
  tokenId: number
  type: string
  rarityTier: RarityTier
  rarityRank: number
  traits?: string[]
  isPremiumCombo?: boolean
}

type LiveBurnRow = {
  receiverTokenId?: string
  transferredActionPoints?: string | number
  pixelCounts?: string
  timestamp?: string | number
  txHash?: string
  tokenCount?: string | number
}

const TIER_FALLBACK: Record<RarityTier, { min: number; max: number; median: number }> = {
  common: { min: 5, max: 15, median: 10 },
  uncommon: { min: 10, max: 22, median: 15 },
  rare: { min: 15, max: 30, median: 22 },
  epic: { min: 30, max: 50, median: 40 },
  legendary: { min: 50, max: 100, median: 75 },
}

/** Heuristic: map raw AP yield to a pseudo tier when type is unknown. */
function tierFromApYield(ap: number): RarityTier {
  if (ap >= 50) return "legendary"
  if (ap >= 30) return "epic"
  if (ap >= 15) return "rare"
  if (ap >= 10) return "uncommon"
  return "common"
}

function parsePixelCount(raw?: string): number | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && typeof parsed[0] === "number") return parsed[0]
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return Number(parsed[0])
  } catch {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function toIsoTimestamp(raw?: string | number): string {
  if (raw == null) return new Date().toISOString()
  const n = typeof raw === "number" ? raw : Number(raw)
  if (Number.isFinite(n)) {
    // seconds vs ms
    const ms = n < 1e12 ? n * 1000 : n
    return new Date(ms).toISOString()
  }
  return String(raw)
}

let burnCache: { at: number; records: BurnRecord[] } | null = null
const BURN_CACHE_TTL_MS = 12 * 60 * 1000

export async function fetchLiveBurns(limit = 50): Promise<BurnRecord[]> {
  const now = Date.now()
  if (burnCache && now - burnCache.at < BURN_CACHE_TTL_MS) {
    return burnCache.records
  }

  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}/history/burns?limit=${limit}`,
      {},
      8_000,
    )
    if (!res.ok) return burnCache?.records ?? []

    const rows = (await res.json()) as LiveBurnRow[]
    if (!Array.isArray(rows)) return burnCache?.records ?? []

    const records: BurnRecord[] = []
    for (const row of rows) {
      const ap = Number(row.transferredActionPoints)
      if (!Number.isFinite(ap) || ap <= 0) continue
      const tokenId = row.receiverTokenId != null ? Number(row.receiverTokenId) : undefined
      records.push({
        tokenId: Number.isFinite(tokenId) ? tokenId : undefined,
        type: "unknown",
        rarityTier: tierFromApYield(ap),
        pixelCount: parsePixelCount(row.pixelCounts),
        apYield: ap,
        timestamp: toIsoTimestamp(row.timestamp),
        txHash: row.txHash,
        source: "live",
      })
    }

    burnCache = { at: now, records }
    return records
  } catch {
    return burnCache?.records ?? []
  }
}

export function normalizeType(type: string | undefined | null): NormieType {
  const t = String(type || "").toLowerCase()
  if (t === "human" || t === "cat" || t === "alien" || t === "agent") return t
  return "unknown"
}

export function tierFromRank(rank: number | null | undefined): RarityTier {
  if (rank == null || !Number.isFinite(rank)) return "common"
  if (rank <= 100) return "legendary"
  if (rank <= 500) return "epic"
  if (rank <= 1500) return "rare"
  if (rank <= 4000) return "uncommon"
  return "common"
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
 * Estimate AP yield for a burn profile.
 * Prefer live history samples (by AP tier band); fall back to static tier table.
 */
export async function estimateAPYield(
  type: string,
  rarityTier: string,
  _traitCount = 0,
): Promise<APYieldEstimate> {
  const tier = (["common", "uncommon", "rare", "epic", "legendary"].includes(
    String(rarityTier).toLowerCase(),
  )
    ? String(rarityTier).toLowerCase()
    : "common") as RarityTier

  const live = await fetchLiveBurns(50)
  // Live API rarely includes type — match by yield band ≈ tier
  const band = TIER_FALLBACK[tier]
  const matches = live.filter(
    (b) => b.apYield >= band.min * 0.6 && b.apYield <= band.max * 1.4,
  )

  if (matches.length === 0) {
    const fb = TIER_FALLBACK[tier]
    return {
      ...fb,
      confidence: "low",
      sampleSize: 0,
      notes: `No matching live burn samples for ${normalizeType(type)}/${tier}; using tier heuristic only. DYOR.`,
    }
  }

  const yields = matches.map((m) => m.apYield).sort((a, b) => a - b)
  return {
    min: yields[0]!,
    max: yields[yields.length - 1]!,
    median: medianOf(yields),
    confidence: matches.length > 8 ? "high" : matches.length > 3 ? "medium" : "low",
    sampleSize: matches.length,
    notes: `Based on ${matches.length} recent on-chain burn samples (AP band for ${tier}). Type-level data limited; treat as estimate.`,
  }
}

export function findBurnCandidates(
  ownedNormies: OwnedNormieSnapshot[],
): {
  burnCandidates: OwnedNormieSnapshot[]
  keepCandidates: OwnedNormieSnapshot[]
  reasoning: string
} {
  if (!ownedNormies.length) {
    return {
      burnCandidates: [],
      keepCandidates: [],
      reasoning: "No owned Normies in context — connect wallet or share holdings for burn analysis.",
    }
  }

  if (ownedNormies.length === 1) {
    const only = ownedNormies[0]!
    return {
      burnCandidates: [],
      keepCandidates: [only],
      reasoning: `Only one Normie (#${only.tokenId}) in view — default keep unless user explicitly wants to burn. ${
        only.isPremiumCombo ? "Premium trait combo: do not burn." : ""
      }`.trim(),
    }
  }

  // Higher rarityRank # = more common → better burn candidate first
  const sorted = [...ownedNormies].sort((a, b) => b.rarityRank - a.rarityRank)

  // Never put premium combos in burn list
  const premium = sorted.filter((n) => n.isPremiumCombo)
  const nonPremium = sorted.filter((n) => !n.isPremiumCombo)

  const burnCutoff = Math.max(1, Math.floor(nonPremium.length * 0.3))
  const burnCandidates = nonPremium.slice(0, burnCutoff)
  const keepCandidates = [...nonPremium.slice(burnCutoff), ...premium]

  const worstRank = burnCandidates[burnCandidates.length - 1]?.rarityRank

  return {
    burnCandidates,
    keepCandidates,
    reasoning: `Identified ${burnCandidates.length} common-er Normies${
      worstRank != null ? ` (around rank #${worstRank}+)` : ""
    } as burn candidates; keeping ${keepCandidates.length} (including ${premium.length} premium-combo protected). Burns are permanent — confirm before acting.`,
  }
}

export async function getBurnMarketNotes(): Promise<string> {
  const live = await fetchLiveBurns(50)
  if (!live.length) {
    return "Live burn history temporarily unavailable; AP estimates use low-confidence tier heuristics."
  }
  const yields = live.map((b) => b.apYield)
  const min = Math.min(...yields)
  const max = Math.max(...yields)
  const med = medianOf([...yields].sort((a, b) => a - b))
  return `Recent ${live.length} burns: AP per commitment roughly min ${min}, median ${med}, max ${max} (from api.normies.art/history/burns).`
}
