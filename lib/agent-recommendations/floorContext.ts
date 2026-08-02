// lib/agent-recommendations/floorContext.ts
// Shared live floor + Supabase history snapshot for burn / market / floor replies.
// Prefer Moralis (persists to floor_prices) → OpenSea/Reservoir → history latest.
// Never invent ETH numbers; always frame as point-in-time.

import {
  getFloorTrend,
  isSupabaseConfigured,
  type FloorTrendSummary,
} from "@/lib/db/supabase"

import {
  OPENSEA_COLLECTION_URL,
  resolveLiveCollectionFloor,
} from "./marketData"

/** Age after which a history-only floor is treated as stale (still shown with caveat). */
const STALE_MS = 24 * 60 * 60 * 1000

export const FLOOR_SNAPSHOT_FRAMING =
  "Point-in-time snapshot, not a guarantee. Floors move — re-check OpenSea before acting. Not financial advice."

export interface FloorSnapshot {
  available: boolean
  /** True when we only have old history and no fresh live print */
  stale: boolean
  latestFloorETH: number | null
  avgFloorETH: number | null
  minFloorETH: number | null
  maxFloorETH: number | null
  /** Percent vs recent average (negative = below avg). Null if not computable. */
  pctVsAvg: number | null
  source: string | null
  /** ISO timestamp of the live print or history sample used */
  asOf: string | null
  historySampleSize: number
  historyDays: number
  historyLatestRecordedAt: string | null
  openSeaUrl: string
  /** Single line for strategy summary / model lead-in */
  snapshotLine: string
  framingLines: string[]
  note: string
}

const FLOOR_MARKET_BURN_PHRASES = [
  "scan burns",
  "scan burn",
  "burn efficiency",
  "burn opportunit",
  "market status",
  "what's the floor",
  "whats the floor",
  "what is the floor",
  "current floor",
  "collection floor",
  "floor price",
  "buy to burn",
  "buy-to-burn",
  "ap per eth",
  "ap/eth",
  "whale alert",
  "pixel market",
  "market sentinel",
]

/**
 * True when the user is asking about burns, floor, market, fodder, or efficiency
 * — cases that must open with a real floor snapshot when available.
 */
export function isFloorMarketBurnQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase().trim()
  if (!q) return false

  if (FLOOR_MARKET_BURN_PHRASES.some((p) => q.includes(p))) return true

  // Single-token / short intents
  if (
    q === "floor" ||
    q === "burns" ||
    q === "burn" ||
    q === "market" ||
    q === "fodder" ||
    q === "efficiency"
  ) {
    return true
  }

  // Broader free-text
  if (q.includes("floor")) return true
  if (q.includes("fodder")) return true
  if (q.includes("listing") && (q.includes("burn") || q.includes("cheap") || q.includes("buy"))) {
    return true
  }
  if (
    q.includes("burn") &&
    (q.includes("efficien") ||
      q.includes("scan") ||
      q.includes("cheap") ||
      q.includes("opportunit") ||
      q.includes("rank") ||
      q.includes("best") ||
      q.includes("market") ||
      q.includes("cost") ||
      q.includes("price") ||
      q.includes("eth"))
  ) {
    return true
  }
  if (q.includes("market") && !q.includes("marketplace protocol")) return true
  if (q.includes("whale") || q.includes("sentinel")) return true
  if (
    (q.includes("ap") || q.includes("action point")) &&
    (q.includes("price") || q.includes("cost") || q.includes("eth") || q.includes("floor"))
  ) {
    return true
  }

  return false
}

function emptyTrend(days: number): FloorTrendSummary {
  return {
    points: [],
    sampleSize: 0,
    avgFloorETH: null,
    minFloorETH: null,
    maxFloorETH: null,
    latestFloorETH: null,
    days,
  }
}

function formatEth(n: number): string {
  // Avoid fake precision: 3–4 decimals max depending on magnitude
  if (n >= 1) return n.toFixed(3)
  if (n >= 0.01) return n.toFixed(4)
  return n.toFixed(5)
}

function buildUnavailableSnapshot(
  history: FloorTrendSummary,
  historyLatestRecordedAt: string | null,
): FloorSnapshot {
  const note =
    "Floor fetch unavailable right now. Do not invent ETH prices — use OpenSea + structure (tiers, AP bands, burn process) only."
  return {
    available: false,
    stale: false,
    latestFloorETH: null,
    avgFloorETH: history.avgFloorETH,
    minFloorETH: history.minFloorETH,
    maxFloorETH: history.maxFloorETH,
    pctVsAvg: null,
    source: null,
    asOf: null,
    historySampleSize: history.sampleSize,
    historyDays: history.days,
    historyLatestRecordedAt,
    openSeaUrl: OPENSEA_COLLECTION_URL,
    snapshotLine: `Floor snapshot unavailable — re-check ${OPENSEA_COLLECTION_URL} before any buy/burn. ${FLOOR_SNAPSHOT_FRAMING}`,
    framingLines: [
      "No live or recent floor print in context.",
      FLOOR_SNAPSHOT_FRAMING,
      `Verify live: ${OPENSEA_COLLECTION_URL}`,
      note,
    ],
    note,
  }
}

/**
 * Fetch current floor context for Ask composition.
 * Prefer live Moralis/OpenSea; enrich with Supabase 7d trend (same source as GET /api/zulo/history).
 */
export async function fetchFloorSnapshot(options?: {
  historyDays?: number
}): Promise<FloorSnapshot> {
  const days = Math.max(1, Math.min(90, options?.historyDays ?? 7))
  const asOfNow = new Date().toISOString()

  const [live, history] = await Promise.all([
    resolveLiveCollectionFloor(),
    isSupabaseConfigured()
      ? getFloorTrend(days).catch((e) => {
          console.warn("[floorContext] getFloorTrend failed:", e)
          return emptyTrend(days)
        })
      : Promise.resolve(emptyTrend(days)),
  ])

  const historyLatestRecordedAt = history.points[0]?.recorded_at ?? null

  // Prefer live; fall back to Supabase latest print (history pipeline)
  let latestFloorETH: number | null = live?.floorPriceETH ?? null
  let source: string | null = live?.source ?? null
  let asOf: string | null = live?.lastUpdated ?? null
  let stale = false

  if (latestFloorETH == null && history.latestFloorETH != null) {
    latestFloorETH = history.latestFloorETH
    source = history.points[0]?.source
      ? `supabase:${history.points[0].source}`
      : "supabase:floor_prices"
    asOf = historyLatestRecordedAt
    if (historyLatestRecordedAt) {
      const age = Date.now() - Date.parse(historyLatestRecordedAt)
      if (Number.isFinite(age) && age > STALE_MS) stale = true
    } else {
      stale = true
    }
  }

  if (latestFloorETH == null || !Number.isFinite(latestFloorETH) || latestFloorETH <= 0) {
    return buildUnavailableSnapshot(history, historyLatestRecordedAt)
  }

  const avgFloorETH = history.avgFloorETH
  let pctVsAvg: number | null = null
  if (avgFloorETH != null && avgFloorETH > 0) {
    pctVsAvg = Math.round(((latestFloorETH - avgFloorETH) / avgFloorETH) * 10_000) / 100
  }

  const ethStr = formatEth(latestFloorETH)
  const sourceLabel = source ?? "unknown"
  const asOfLabel = asOf ?? asOfNow

  let vsAvgPart = ""
  if (pctVsAvg != null && avgFloorETH != null) {
    const dir = pctVsAvg < 0 ? "below" : pctVsAvg > 0 ? "above" : "near"
    vsAvgPart = ` · ~${Math.abs(pctVsAvg).toFixed(1)}% ${dir} ${days}d avg (~${formatEth(avgFloorETH)} ETH, n=${history.sampleSize})`
  } else if (history.sampleSize === 0) {
    vsAvgPart = " · 7d history: no Supabase samples yet"
  }

  const staleTag = stale ? " [STALE — history only; live fetch failed]" : ""
  const snapshotLine = `Floor snapshot: latest ~${ethStr} ETH (${sourceLabel}, as of ${asOfLabel})${vsAvgPart}${staleTag}. ${FLOOR_SNAPSHOT_FRAMING}`

  const framingLines = [
    `Latest floor ~${ethStr} ETH (source: ${sourceLabel}, as-of: ${asOfLabel})${staleTag}`,
    avgFloorETH != null && history.sampleSize > 0
      ? `${days}d avg ~${formatEth(avgFloorETH)} ETH (min ${history.minFloorETH != null ? formatEth(history.minFloorETH) : "n/a"}, max ${history.maxFloorETH != null ? formatEth(history.maxFloorETH) : "n/a"}, n=${history.sampleSize})${pctVsAvg != null ? `; current ${pctVsAvg >= 0 ? "+" : ""}${pctVsAvg.toFixed(1)}% vs avg` : ""}`
      : `${days}d floor history unavailable or empty`,
    FLOOR_SNAPSHOT_FRAMING,
    `Re-check before acting: ${OPENSEA_COLLECTION_URL}`,
    stale
      ? "Live floor providers failed — this number is from stored history and may be outdated."
      : "No fake precision: treat as approximate collection floor, not type-specific listing depth.",
  ]

  return {
    available: true,
    stale,
    latestFloorETH,
    avgFloorETH,
    minFloorETH: history.minFloorETH,
    maxFloorETH: history.maxFloorETH,
    pctVsAvg,
    source,
    asOf: asOfLabel,
    historySampleSize: history.sampleSize,
    historyDays: days,
    historyLatestRecordedAt,
    openSeaUrl: OPENSEA_COLLECTION_URL,
    snapshotLine,
    framingLines,
    note: stale
      ? "Stale history-only floor — say so plainly; still help with non-price structure."
      : FLOOR_SNAPSHOT_FRAMING,
  }
}
