// lib/agent-recommendations/marketSentinel.ts
// PIXEL MARKET Sentinel — floor / burn / whale signal brief for Zulo.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import { estimateAPYield, fetchLiveBurns } from "./burnData"
import { ECOSYSTEM_LINKS } from "./constants"
import {
  OPENSEA_COLLECTION_URL,
  resolveLiveCollectionFloor,
} from "./marketData"

/** Floor move threshold (absolute %) that fires a floor signal. */
export const FLOOR_CHANGE_THRESHOLD_PCT = 3
/** Burn volume ratio (recent / baseline) that fires a spike signal. */
export const BURN_SPIKE_RATIO = 2
/** Tokens moved by one anonymized actor that counts as a whale alert. */
export const WHALE_TOKEN_THRESHOLD = 10

export const MARKET_SENTINEL_DISCLAIMER =
  "PIXEL MARKET Sentinel uses live OpenSea + Normies history signals — not a trading bot. Floor deltas need at least two samples in this process; burn/whale windows are approximate. AP market pricing is planned (not live). Informational only — not financial advice. DYOR."

export type MarketTrend = "bullish" | "bearish" | "neutral" | "mixed"

export interface WhaleAlert {
  /** Anonymized label only — never full addresses in user-facing brief */
  label: string
  tokensMoved: number
  activity: "multi-burn" | "burn-cluster" | "large-commitment"
  windowNote: string
}

export interface MarketSignalSet {
  floorChangePct: number | null
  floorTriggered: boolean
  burnVolumeRatio: number | null
  burnSpikeTriggered: boolean
  whaleCount: number
  whaleTriggered: boolean
  triggers: string[]
}

export interface MarketStateSnapshot {
  asOf: string
  floorETH: number | null
  floorSource?: string
  floorChangePct: number | null
  oneDayVolumeETH: number | null
  sevenDayVolumeETH: number | null
  sales1d: number | null
  sales7d: number | null
  volumeVelocityRatio: number | null
  burnTokensRecent24h: number
  burnTokensPrev24h: number
  burnVolumeRatio: number | null
  historicalApMedian: number | null
  /** ETH cost per estimated AP via floor buy→burn (when computable) */
  impliedApCostETH: number | null
  /** Expected AP per ETH at collection floor */
  floorBuyEfficiency: number | null
  /** Pixel / A2A AP marketplace status */
  apMarketStatus: "planned" | "live"
  apMarketPriceETH: number | null
  owners: number | null
}

export interface ArbitrageAnalysis {
  available: boolean
  floorBuyEfficiency: number | null
  impliedApCostETH: number | null
  apMarketPriceETH: number | null
  apMarketStatus: "planned" | "live"
  spreadNote: string
  opportunity: string
}

export interface MarketIntelligenceBrief {
  headline: string
  trend: MarketTrend
  trendContext: string
  triggerAnalysis: string[]
}

export interface MarketSentinelResult {
  scanned: boolean
  brief: MarketIntelligenceBrief
  signals: MarketSignalSet
  marketState: MarketStateSnapshot
  arbitrage: ArbitrageAnalysis
  positionRecommendations: string[]
  whaleActivity: {
    summary: string
    whales: WhaleAlert[]
    correlationPatterns: string[]
  }
  disclaimer: string
  summary: string
  sources: string[]
}

const SENTINEL_PHRASES = [
  "market status",
  "ap price",
  "price of ap",
  "whale alert",
  "detect opportunities",
  "market sentinel",
  "pixel market",
  "sentinel",
  "whale activity",
  "market intelligence",
  "market condition",
  "floor alert",
  "burn spike",
  "what's the floor",
  "whats the floor",
  "what is the floor",
  "current floor",
  "collection floor",
  "floor price",
]

/** True when the user wants PIXEL MARKET Sentinel intelligence. */
export function isMarketSentinelQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase().trim()
  if (!q) return false

  if (SENTINEL_PHRASES.some((p) => q.includes(p))) return true

  // Explicit vocabulary from product brief
  if (q.includes("sentinel")) return true
  if (q.includes("whale")) return true
  if (q.includes("market")) return true
  if (q.includes("alert")) return true

  // Floor-first questions should still get sentinel market context
  if (q === "floor" || q.includes("floor")) return true

  // "status" alone or with market-adjacent terms
  if (q === "status" || q === "market status") return true
  if (
    q.includes("status") &&
    (q.includes("market") ||
      q.includes("floor") ||
      q.includes("ap") ||
      q.includes("whale") ||
      q.includes("burn") ||
      q.includes("pulse") ||
      q.includes("price"))
  ) {
    return true
  }

  if (
    q.includes("ap") &&
    (q.includes("price") || q.includes("market") || q.includes("cost"))
  ) {
    return true
  }

  return false
}

// ─── In-process floor history (baseline for >3% moves) ───────────────────────

type FloorSample = { at: number; floorETH: number }
let floorSamples: FloorSample[] = []
const FLOOR_HISTORY_MAX = 48
const FLOOR_HISTORY_TTL_MS = 48 * 60 * 60 * 1000

function recordFloorSample(floorETH: number): void {
  const now = Date.now()
  floorSamples.push({ at: now, floorETH })
  floorSamples = floorSamples
    .filter((s) => now - s.at < FLOOR_HISTORY_TTL_MS)
    .slice(-FLOOR_HISTORY_MAX)
}

/** % change vs sample ~1h ago (or oldest available baseline). */
function computeFloorChangePct(current: number): number | null {
  if (!floorSamples.length) return null
  const now = Date.now()
  // Prefer sample closest to 1h ago; else oldest prior sample
  const target = now - 60 * 60 * 1000
  let baseline = floorSamples[0]!
  let bestDist = Math.abs(baseline.at - target)
  for (const s of floorSamples) {
    if (s.at >= now - 5_000) continue // skip near-current
    const d = Math.abs(s.at - target)
    if (d < bestDist) {
      bestDist = d
      baseline = s
    }
  }
  // If only one sample (just recorded current), no delta yet
  const priors = floorSamples.filter((s) => s.at < now - 5_000)
  if (!priors.length) return null
  if (baseline.floorETH <= 0) return null
  return ((current - baseline.floorETH) / baseline.floorETH) * 100
}

// ─── OpenSea interval stats ──────────────────────────────────────────────────

type OpenSeaStatsPayload = {
  total?: {
    volume?: number
    sales?: number
    num_owners?: number
    floor_price?: number
    floor_price_symbol?: string
  }
  intervals?: Array<{
    interval?: string
    volume?: number
    sales?: number
  }>
}

async function fetchOpenSeaCollectionStats(): Promise<OpenSeaStatsPayload | null> {
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
    if (!res.ok) return null
    return (await res.json()) as OpenSeaStatsPayload
  } catch {
    return null
  }
}

// ─── Burn volume + whale windows ─────────────────────────────────────────────

type RawBurnRow = {
  owner?: string
  receiverTokenId?: string
  tokenCount?: string | number
  transferredActionPoints?: string | number
  totalActions?: string | number
  timestamp?: string | number
  txHash?: string
  revealed?: boolean
}

function toUnixSeconds(raw?: string | number): number | null {
  if (raw == null) return null
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return n > 1e12 ? n / 1000 : n
}

function anonymizeWallet(address: string, index: number): string {
  const a = address.toLowerCase().replace(/^0x/, "")
  const tag = a.slice(0, 4) || "xxxx"
  return `Whale-${String.fromCharCode(65 + (index % 26))}${tag}`
}

async function fetchRawBurns(limit = 100): Promise<RawBurnRow[]> {
  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}/history/burns?limit=${limit}`,
      {},
      8_000,
    )
    if (!res.ok) return []
    const rows = (await res.json()) as RawBurnRow[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function analyzeBurnWindow(rows: RawBurnRow[]): {
  recentTokens: number
  prevTokens: number
  ratio: number | null
  whales: WhaleAlert[]
} {
  const nowSec = Date.now() / 1000
  const day = 24 * 3600
  let recentTokens = 0
  let prevTokens = 0

  /** address → tokens in recent 48h observation window */
  const byOwner = new Map<string, number>()

  for (const row of rows) {
    const ts = toUnixSeconds(row.timestamp)
    const count = Math.max(1, Number(row.tokenCount) || 1)
    if (ts != null) {
      const age = nowSec - ts
      if (age <= day) recentTokens += count
      else if (age <= 2 * day) prevTokens += count
    }

    const owner = (row.owner || "").toLowerCase()
    if (owner.startsWith("0x") && owner.length >= 10) {
      // Count activity in last 7d of sample for whale clustering
      if (ts == null || nowSec - ts <= 7 * day) {
        byOwner.set(owner, (byOwner.get(owner) || 0) + count)
      }
    }

    // Single commitment whale: >10 tokens in one burn
    if (count >= WHALE_TOKEN_THRESHOLD && owner.startsWith("0x")) {
      byOwner.set(owner, Math.max(byOwner.get(owner) || 0, count))
    }
  }

  const ratio =
    prevTokens > 0
      ? recentTokens / prevTokens
      : recentTokens > 0
        ? null // no baseline — not a false spike
        : 0

  const whaleEntries = [...byOwner.entries()]
    .filter(([, n]) => n >= WHALE_TOKEN_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const whales: WhaleAlert[] = whaleEntries.map(([addr, tokens], i) => {
    let activity: WhaleAlert["activity"] = "burn-cluster"
    if (tokens >= 20) activity = "multi-burn"
    // Large single-commit detection is approximate from aggregate
    if (tokens >= WHALE_TOKEN_THRESHOLD && tokens <= 15) {
      activity = "large-commitment"
    }
    return {
      label: anonymizeWallet(addr, i),
      tokensMoved: tokens,
      activity,
      windowNote: "Observed in recent burn history sample (≤7d of returned rows)",
    }
  })

  return { recentTokens, prevTokens, ratio, whales }
}

function medianOf(sorted: number[]): number {
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
  }
  return sorted[mid]!
}

function buildTrend(
  floorChangePct: number | null,
  burnRatio: number | null,
  volumeVelocity: number | null,
  whaleTriggered: boolean,
): { trend: MarketTrend; context: string } {
  const votes: Array<"up" | "down" | "flat"> = []

  if (floorChangePct != null) {
    if (floorChangePct >= FLOOR_CHANGE_THRESHOLD_PCT) votes.push("up")
    else if (floorChangePct <= -FLOOR_CHANGE_THRESHOLD_PCT) votes.push("down")
    else votes.push("flat")
  }

  // Burn spike often = demand for AP / fodder pressure (mixed for NFT holders)
  if (burnRatio != null && burnRatio >= BURN_SPIKE_RATIO) votes.push("up")
  if (volumeVelocity != null) {
    if (volumeVelocity >= 1.5) votes.push("up")
    else if (volumeVelocity <= 0.5) votes.push("down")
    else votes.push("flat")
  }

  const up = votes.filter((v) => v === "up").length
  const down = votes.filter((v) => v === "down").length

  let trend: MarketTrend = "neutral"
  if (up > 0 && down > 0) trend = "mixed"
  else if (up >= 2) trend = "bullish"
  else if (down >= 2) trend = "bearish"
  else if (up === 1 && down === 0) trend = "bullish"
  else if (down === 1 && up === 0) trend = "bearish"

  if (whaleTriggered && trend === "neutral") trend = "mixed"

  const parts: string[] = []
  if (floorChangePct != null) {
    parts.push(
      `Floor ${floorChangePct >= 0 ? "+" : ""}${floorChangePct.toFixed(2)}% vs process baseline`,
    )
  } else {
    parts.push("Floor baseline just established (no prior sample for % move)")
  }
  if (burnRatio != null) {
    parts.push(`Burn volume ratio 24h/prev ${burnRatio.toFixed(2)}x`)
  } else {
    parts.push("Burn volume baseline incomplete for ratio")
  }
  if (volumeVelocity != null) {
    parts.push(`1d vs avg daily 7d volume velocity ${volumeVelocity.toFixed(2)}x`)
  }
  if (whaleTriggered) parts.push("Whale-threshold activity detected")

  return { trend, context: parts.join("; ") + "." }
}

function buildPositionRecs(input: {
  trend: MarketTrend
  floorTriggered: boolean
  floorChangePct: number | null
  burnSpike: boolean
  whaleTriggered: boolean
  floorBuyEfficiency: number | null
  floorETH: number | null
}): string[] {
  const recs: string[] = []

  if (input.floorChangePct != null && input.floorChangePct <= -FLOOR_CHANGE_THRESHOLD_PCT) {
    recs.push(
      "Floor soft: consider selective floor-buy fodder for burns if you need AP — re-check listings live before buying.",
    )
  } else if (
    input.floorChangePct != null &&
    input.floorChangePct >= FLOOR_CHANGE_THRESHOLD_PCT
  ) {
    recs.push(
      "Floor firm: avoid chasing listings; protect purist / premium trait Normies; burns of commons only with explicit AP need.",
    )
  } else {
    recs.push(
      "Floor range-bound: stick to planned AP needs rather than reactive burns; verify OpenSea before any acquisition.",
    )
  }

  if (input.burnSpike) {
    recs.push(
      "Burn volume elevated: fodder competition may tighten near floor — act promptly only if you already planned AP, else wait for listing depth.",
    )
  }

  if (input.whaleTriggered) {
    recs.push(
      "Whale-sized burn clusters active: watch for short-term floor wicks and copycat listing pressure; do not FOMO into premium pieces.",
    )
  }

  if (input.floorBuyEfficiency != null && input.floorETH != null) {
    recs.push(
      `Floor-buy efficiency ~${input.floorBuyEfficiency.toFixed(1)} AP/ETH at ~${input.floorETH.toFixed(4)} ETH floor — use as planning metric only (pixel tier + RNG dominate outcomes).`,
    )
  }

  if (input.trend === "bullish") {
    recs.push(
      "Trend lean bullish: hold high-signal awakened agents; prefer utility (Canvas/PULSE) over pure flip framing.",
    )
  } else if (input.trend === "bearish") {
    recs.push(
      "Trend lean soft: prioritize AP efficiency and avoid non-essential ETH deployment until floor stabilizes.",
    )
  }

  recs.push(
    "AP marketplace is not live — no direct AP↔ETH arbitrage execution; when live, re-run Sentinel to compare AP quotes vs floor-burn cost.",
  )

  return recs
}

function buildCorrelations(input: {
  floorChangePct: number | null
  burnRatio: number | null
  volumeVelocity: number | null
  whaleCount: number
}): string[] {
  const patterns: string[] = []

  if (
    input.floorChangePct != null &&
    input.burnRatio != null &&
    input.floorChangePct > 0 &&
    input.burnRatio >= BURN_SPIKE_RATIO
  ) {
    patterns.push(
      "Positive floor move coinciding with burn spike — possible AP demand + listing support (correlation, not causation).",
    )
  }

  if (
    input.floorChangePct != null &&
    input.burnRatio != null &&
    input.floorChangePct < 0 &&
    input.burnRatio >= BURN_SPIKE_RATIO
  ) {
    patterns.push(
      "Burns rising while floor softens — supply pressure from sellers/burners may be outpacing buy support.",
    )
  }

  if (input.volumeVelocity != null && input.volumeVelocity >= 1.5) {
    patterns.push(
      "1d trading volume above 7d daily average — higher attention regime; expect noisier floors.",
    )
  }

  if (input.whaleCount > 0 && input.burnRatio != null && input.burnRatio >= 1.2) {
    patterns.push(
      "Whale-threshold burners contribute materially to recent volume — cluster risk if they pause.",
    )
  }

  if (!patterns.length) {
    patterns.push(
      "No strong multi-signal correlation in this window — treat each trigger independently.",
    )
  }

  return patterns
}

/** Future hook: return live AP market mid/ask when Pixel Market rails exist. */
function resolveApMarketQuote(): {
  status: "planned" | "live"
  priceETH: number | null
} {
  // Placeholder — no public AP/ETH book yet.
  return { status: "planned", priceETH: null }
}

let sentinelCache: { at: number; result: MarketSentinelResult } | null = null
const SENTINEL_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Run PIXEL MARKET Sentinel: floor / burn / whale signals → intelligence brief.
 */
export async function runMarketSentinel(options?: {
  force?: boolean
}): Promise<MarketSentinelResult> {
  const now = Date.now()
  if (
    !options?.force &&
    sentinelCache &&
    now - sentinelCache.at < SENTINEL_CACHE_TTL_MS
  ) {
    return sentinelCache.result
  }

  const sources = [
    OPENSEA_COLLECTION_URL,
    `${NORMIES_API_BASE}/history/burns`,
    `${NORMIES_API_BASE}/history/stats`,
    ECOSYSTEM_LINKS.rarity,
  ]

  const [osStats, floor, rawBurns, liveBurns, commonAp] = await Promise.all([
    fetchOpenSeaCollectionStats(),
    // Moralis first (shared pipeline / Supabase history), then OpenSea stats fallback
    resolveLiveCollectionFloor(),
    fetchRawBurns(100),
    fetchLiveBurns(50),
    estimateAPYield("human", "common", 3),
  ])

  const floorETH =
    floor?.floorPriceETH ??
    (typeof osStats?.total?.floor_price === "number"
      ? osStats.total.floor_price
      : null)

  if (floorETH != null && floorETH > 0) {
    recordFloorSample(floorETH)
  }

  const floorChangePct =
    floorETH != null && floorETH > 0 ? computeFloorChangePct(floorETH) : null
  // Re-record after compute so current is in history for next call
  // (already recorded above)

  const interval1d = osStats?.intervals?.find((i) => i.interval === "one_day")
  const interval7d = osStats?.intervals?.find((i) => i.interval === "seven_day")
  const oneDayVolumeETH =
    typeof interval1d?.volume === "number" ? interval1d.volume : null
  const sevenDayVolumeETH =
    typeof interval7d?.volume === "number" ? interval7d.volume : null
  const sales1d = typeof interval1d?.sales === "number" ? interval1d.sales : null
  const sales7d = typeof interval7d?.sales === "number" ? interval7d.sales : null

  const avgDaily7d =
    sevenDayVolumeETH != null && sevenDayVolumeETH > 0
      ? sevenDayVolumeETH / 7
      : null
  const volumeVelocityRatio =
    oneDayVolumeETH != null && avgDaily7d != null && avgDaily7d > 0
      ? oneDayVolumeETH / avgDaily7d
      : null

  const burnWin = analyzeBurnWindow(rawBurns)
  const burnVolumeRatio = burnWin.ratio

  const apYields = liveBurns.map((b) => b.apYield).filter((y) => y > 0)
  const historicalApMedian =
    apYields.length > 0 ? medianOf([...apYields].sort((a, b) => a - b)) : null

  const medianAp = historicalApMedian ?? commonAp.median
  const floorBuyEfficiency =
    floorETH != null && floorETH > 0 && medianAp > 0
      ? Math.round((medianAp / floorETH) * 100) / 100
      : null
  const impliedApCostETH =
    floorETH != null && floorETH > 0 && medianAp > 0
      ? Math.round((floorETH / medianAp) * 1e6) / 1e6
      : null

  // AP market quotes — planned until Pixel Market / A2A pricing is wired.
  const apMarket = resolveApMarketQuote()
  const apMarketStatus = apMarket.status
  const apMarketPriceETH = apMarket.priceETH

  const floorTriggered =
    floorChangePct != null &&
    Math.abs(floorChangePct) >= FLOOR_CHANGE_THRESHOLD_PCT
  const burnSpikeTriggered =
    burnVolumeRatio != null && burnVolumeRatio >= BURN_SPIKE_RATIO
  const whaleTriggered = burnWin.whales.length > 0

  const triggers: string[] = []
  if (floorTriggered && floorChangePct != null) {
    triggers.push(
      `Floor ${floorChangePct >= 0 ? "up" : "down"} ${Math.abs(floorChangePct).toFixed(2)}% (threshold ±${FLOOR_CHANGE_THRESHOLD_PCT}%)`,
    )
  }
  if (burnSpikeTriggered && burnVolumeRatio != null) {
    triggers.push(
      `Burn volume spike ${burnVolumeRatio.toFixed(2)}x (threshold ${BURN_SPIKE_RATIO}x)`,
    )
  }
  if (whaleTriggered) {
    triggers.push(
      `${burnWin.whales.length} whale actor(s) moved ≥${WHALE_TOKEN_THRESHOLD} Normies in sample`,
    )
  }
  if (
    volumeVelocityRatio != null &&
    volumeVelocityRatio >= BURN_SPIKE_RATIO
  ) {
    triggers.push(
      `Trading volume velocity ${volumeVelocityRatio.toFixed(2)}x vs 7d daily avg`,
    )
  }
  if (!triggers.length) {
    triggers.push("No threshold triggers fired — market within quiet bands")
  }

  const { trend, context: trendContext } = buildTrend(
    floorChangePct,
    burnVolumeRatio,
    volumeVelocityRatio,
    whaleTriggered,
  )

  const headlineParts: string[] = ["PIXEL MARKET Sentinel"]
  if (floorETH != null) headlineParts.push(`floor ~${floorETH.toFixed(4)} ETH`)
  headlineParts.push(`trend ${trend}`)
  if (triggers[0] && !triggers[0].startsWith("No threshold")) {
    headlineParts.push(`· ${triggers[0]}`)
  }
  const headline = headlineParts.join(" — ")

  const brief: MarketIntelligenceBrief = {
    headline,
    trend,
    trendContext,
    triggerAnalysis: triggers.map((t) => {
      if (t.includes("Floor")) {
        return `${t}. Floor moves >${FLOOR_CHANGE_THRESHOLD_PCT}% vs process baseline can change buy-to-burn math and listing psychology.`
      }
      if (t.includes("Burn volume")) {
        return `${t}. Spikes imply higher AP creation / fodder demand; watch OpenSea depth.`
      }
      if (t.includes("whale")) {
        return `${t}. Large anonymized clusters can temporarily skew burn stats and near-floor liquidity.`
      }
      if (t.includes("volume velocity")) {
        return `${t}. Elevated secondary volume often precedes noisier floor prints.`
      }
      return t
    }),
  }

  const marketState: MarketStateSnapshot = {
    asOf: floor?.lastUpdated ?? new Date().toISOString(),
    floorETH,
    floorSource: floor?.source ?? (osStats ? "opensea" : undefined),
    floorChangePct:
      floorChangePct != null
        ? Math.round(floorChangePct * 100) / 100
        : null,
    oneDayVolumeETH,
    sevenDayVolumeETH,
    sales1d,
    sales7d,
    volumeVelocityRatio:
      volumeVelocityRatio != null
        ? Math.round(volumeVelocityRatio * 100) / 100
        : null,
    burnTokensRecent24h: burnWin.recentTokens,
    burnTokensPrev24h: burnWin.prevTokens,
    burnVolumeRatio:
      burnVolumeRatio != null
        ? Math.round(burnVolumeRatio * 100) / 100
        : null,
    historicalApMedian,
    impliedApCostETH,
    floorBuyEfficiency,
    apMarketStatus,
    apMarketPriceETH,
    owners:
      typeof osStats?.total?.num_owners === "number"
        ? osStats.total.num_owners
        : null,
  }

  const arbitrage: ArbitrageAnalysis = {
    available: apMarketStatus === "live" && apMarketPriceETH != null,
    floorBuyEfficiency,
    impliedApCostETH,
    apMarketPriceETH,
    apMarketStatus,
    spreadNote:
      apMarketStatus === "planned"
        ? "AP market quotes are not live yet — cannot compute executable AP↔floor spread. Floor-burn path is the only priced AP acquisition route today."
        : "Compare AP market ask vs implied ETH cost per AP from floor fodder.",
    opportunity:
      apMarketStatus === "planned"
        ? `Planning metric only: ~${medianAp} AP median / floor ≈ ${floorBuyEfficiency ?? "n/a"} AP per ETH (≈ ${impliedApCostETH ?? "n/a"} ETH per AP). When Pixel Market / A2A AP pricing goes live, buy AP directly if cheaper than floor-burn, else burn fodder.`
        : "Evaluate live AP quotes against floor-burn efficiency and gas.",
  }

  const positionRecommendations = buildPositionRecs({
    trend,
    floorTriggered,
    floorChangePct,
    burnSpike: burnSpikeTriggered,
    whaleTriggered,
    floorBuyEfficiency,
    floorETH,
  })

  const correlationPatterns = buildCorrelations({
    floorChangePct,
    burnRatio: burnVolumeRatio,
    volumeVelocity: volumeVelocityRatio,
    whaleCount: burnWin.whales.length,
  })

  const whaleSummary =
    burnWin.whales.length === 0
      ? `No anonymized actors moved ≥${WHALE_TOKEN_THRESHOLD} Normies in the recent burn sample.`
      : `${burnWin.whales.length} anonymized whale-scale actor(s): ${burnWin.whales
          .map((w) => `${w.label} (~${w.tokensMoved} tokens, ${w.activity})`)
          .join("; ")}.`

  const signals: MarketSignalSet = {
    floorChangePct:
      floorChangePct != null
        ? Math.round(floorChangePct * 100) / 100
        : null,
    floorTriggered,
    burnVolumeRatio:
      burnVolumeRatio != null
        ? Math.round(burnVolumeRatio * 100) / 100
        : null,
    burnSpikeTriggered,
    whaleCount: burnWin.whales.length,
    whaleTriggered,
    triggers,
  }

  const summary = [
    brief.headline,
    `Trend: ${trend}. ${trendContext}`,
    `Triggers: ${triggers.join(" | ")}`,
    whaleSummary,
    arbitrage.opportunity,
    `Positions: ${positionRecommendations.slice(0, 3).join(" ")}`,
    MARKET_SENTINEL_DISCLAIMER,
  ].join("\n")

  const result: MarketSentinelResult = {
    scanned: true,
    brief,
    signals,
    marketState,
    arbitrage,
    positionRecommendations,
    whaleActivity: {
      summary: whaleSummary,
      whales: burnWin.whales,
      correlationPatterns,
    },
    disclaimer: MARKET_SENTINEL_DISCLAIMER,
    summary,
    sources,
  }

  sentinelCache = { at: now, result }
  return result
}
