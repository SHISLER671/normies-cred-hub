// lib/agent-recommendations/gachaRaffle.ts
// Gacha & Raffle Intelligence — EV scoring + AP allocation for Zulo.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import { ECOSYSTEM_LINKS } from "./constants"
import { getLiveCollectionFloor, OPENSEA_COLLECTION_URL } from "./marketData"

/** EV ratio above this counts as positive expected value. */
export const POSITIVE_EV_THRESHOLD = 1.0
/** Edge % ( (EV-1)*100 ) above this is a "high-value" raffle. */
export const HIGH_VALUE_EDGE_PCT = 20

export const GACHA_RAFFLE_DISCLAIMER =
  "Gacha/raffle EV is estimated from published odds and prize valuations (often floor proxies) — not guarantees. Pools can change, RNG is random, and live listings may be empty when Normies gacha/raffle endpoints are not yet public. Never spend AP or ETH you cannot afford to lose. Not financial advice. DYOR."

export interface GachaPrize {
  id?: string
  name: string
  /** 0–1 probability */
  probability: number
  /** Estimated value in AP units (or AP-equivalent) */
  valueAp: number | null
  /** Estimated value in ETH */
  valueEth: number | null
}

export interface PityState {
  counter: number | null
  softPityAt: number | null
  hardPityAt: number | null
  pullsToSoft: number | null
  pullsToHard: number | null
  note: string
}

export interface QualificationGate {
  minAp: number | null
  minNormieCount: number | null
  requiresHolder: boolean | null
  requiresAwakened: boolean | null
  note: string
  qualified: boolean | null
}

export interface GachaPoolAnalysis {
  id: string
  name: string
  status: "active" | "ended" | "unknown"
  costAp: number | null
  costEth: number | null
  prizes: GachaPrize[]
  /** Sum(prob × valueAp) */
  expectedValueAp: number | null
  /** Sum(prob × valueEth) */
  expectedValueEth: number | null
  /** EV / cost in the primary currency (prefer AP) */
  evRatio: number | null
  edgePct: number | null
  isPositiveEv: boolean
  isHighValue: boolean
  pity: PityState | null
  qualification: QualificationGate | null
  source: string
  notes: string
}

export interface RaffleAnalysis {
  id: string
  name: string
  status: "active" | "ended" | "unknown"
  entryCostAp: number | null
  entryCostEth: number | null
  prizeValueAp: number | null
  prizeValueEth: number | null
  totalEntries: number | null
  /** Win probability for one entry (1/totalEntries when known) */
  winProbability: number | null
  /** prize × p(win) */
  expectedValueAp: number | null
  expectedValueEth: number | null
  /** expectedValue / entryCost */
  evRatio: number | null
  edgePct: number | null
  isPositiveEv: boolean
  isHighValue: boolean
  qualification: QualificationGate | null
  endsAt: string | null
  source: string
  notes: string
}

export interface ApAllocationLine {
  opportunityId: string
  opportunityName: string
  kind: "gacha" | "raffle"
  suggestedAp: number
  sharePct: number
  evRatio: number
  reason: string
}

export interface GachaRaffleResult {
  scanned: boolean
  dataStatus: "live" | "partial" | "unavailable"
  gachaPools: GachaPoolAnalysis[]
  raffles: RaffleAnalysis[]
  positiveEv: Array<{
    kind: "gacha" | "raffle"
    id: string
    name: string
    evRatio: number
    edgePct: number
  }>
  highValueRaffles: RaffleAnalysis[]
  apAllocation: {
    budgetAp: number
    lines: ApAllocationLine[]
    unallocatedAp: number
    note: string
  }
  pitySummary: string[]
  qualificationSummary: string[]
  floorETH: number | null
  disclaimer: string
  summary: string
  sources: string[]
}

const QUERY_PHRASES = [
  "gacha odds",
  "raffle value",
  "should i pull",
  "should i pull?",
  "best raffle",
  "expected value",
  "gacha",
  "raffle",
  "pity",
]

/** True when the user wants gacha / raffle EV intelligence. */
export function isGachaRaffleQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase().trim()
  if (!q) return false
  if (QUERY_PHRASES.some((p) => q.includes(p))) return true

  if (q.includes("gacha") || q.includes("raffle")) return true
  if (q.includes("pull") && (q.includes("should") || q.includes("odds") || q.includes("worth"))) {
    return true
  }
  if (q.includes("odds") && (q.includes("gacha") || q.includes("raffle") || q.includes("pull") || q.includes("prize"))) {
    return true
  }
  if (q === "odds" || q === "ev" || q === "expected value") return true
  if (q.includes("expected value") || q.includes(" ev ") || q.startsWith("ev ") || q.endsWith(" ev")) {
    return true
  }
  if (/\bev\b/.test(q)) return true
  if (q.includes("pity")) return true

  return false
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback
  return String(v)
}

function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>
    for (const key of ["pools", "gacha", "gachaPools", "items", "data", "results", "raffles", "listings"]) {
      if (Array.isArray(o[key])) return o[key] as unknown[]
    }
  }
  return []
}

async function fetchJson(url: string, timeoutMs = 7_000): Promise<unknown | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { Accept: "application/json" } },
      timeoutMs,
    )
    if (!res.ok) return null
    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("json") && !ct.includes("text")) {
      // still try parse
    }
    const text = await res.text()
    if (!text || text.trim().startsWith("<")) return null
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function candidateUrls(
  envKeys: Array<string | undefined>,
  paths: string[],
): string[] {
  const bases = [
    ...envKeys.map((b) => b?.replace(/\/$/, "")),
    NORMIES_API_BASE,
  ].filter(Boolean) as string[]
  const urls: string[] = []
  for (const base of bases) {
    for (const path of paths) urls.push(`${base}${path}`)
  }
  return [...new Set(urls)]
}

async function probeFeed(
  urls: string[],
  emptyKeys: string[],
): Promise<{ rows: unknown[]; sources: string[] }> {
  // Parallel probe with short timeout; first non-null JSON wins (prefer non-empty)
  const results = await Promise.all(
    urls.map(async (url) => {
      const data = await fetchJson(url, 4_000)
      return { url, data }
    }),
  )

  let emptyHit: { url: string; rows: unknown[] } | null = null
  for (const { url, data } of results) {
    if (data == null) continue
    const rows = asArray(data)
    if (rows.length > 0) return { rows, sources: [url] }
    const isEmptyFeed =
      Array.isArray(data) ||
      (data &&
        typeof data === "object" &&
        emptyKeys.some((k) => k in (data as object)))
    if (isEmptyFeed && !emptyHit) emptyHit = { url, rows: [] }
  }
  if (emptyHit) return { rows: [], sources: [emptyHit.url] }
  return { rows: [], sources: [] }
}

/**
 * Probe candidate Normies (and optional override) endpoints for gacha pools.
 * Returns raw rows + source URL when found.
 */
export async function fetchGachaPools(): Promise<{ rows: unknown[]; sources: string[] }> {
  const urls = candidateUrls(
    [process.env.GACHA_RAFFLE_API_BASE, process.env.NORMIES_GACHA_API_BASE],
    [
      "/gacha/pools",
      "/gacha",
      "/gacha/active",
      "/lab/gacha/pools",
      "/events/gacha",
      "/pixel-market/gacha",
    ],
  )
  return probeFeed(urls, ["pools", "gacha", "gachaPools", "items", "data"])
}

export async function fetchRaffleListings(): Promise<{ rows: unknown[]; sources: string[] }> {
  const urls = candidateUrls(
    [process.env.GACHA_RAFFLE_API_BASE, process.env.NORMIES_RAFFLE_API_BASE],
    [
      "/raffles",
      "/raffle",
      "/raffles/active",
      "/raffle/listings",
      "/lab/raffles",
      "/events/raffles",
      "/pixel-market/raffles",
    ],
  )
  return probeFeed(urls, ["raffles", "listings", "items", "data"])
}

function parsePrizes(raw: unknown, floorETH: number | null): GachaPrize[] {
  if (!Array.isArray(raw)) return []
  const prizes: GachaPrize[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const p = item as Record<string, unknown>
    let probability =
      num(p.probability) ??
      num(p.prob) ??
      num(p.rate) ??
      num(p.weight)
    // weight-only: normalize later
    const name = str(p.name || p.label || p.prize || p.title, "Prize")
    let valueAp =
      num(p.valueAp) ?? num(p.value_ap) ?? num(p.apValue) ?? num(p.ap)
    let valueEth =
      num(p.valueEth) ?? num(p.value_eth) ?? num(p.ethValue) ?? num(p.eth)

    // Floor-proxy for NFT prizes
    if (valueEth == null && (p.kind === "nft" || p.type === "normie" || p.isNormie)) {
      valueEth = floorETH
    }
    if (valueAp == null && valueEth != null && floorETH != null && floorETH > 0) {
      // rough: leave eth-only
    }

    if (probability != null && probability > 1) {
      // percent form
      if (probability <= 100) probability = probability / 100
    }

    prizes.push({
      id: p.id != null ? String(p.id) : undefined,
      name,
      probability: probability ?? 0,
      valueAp,
      valueEth,
    })
  }

  // Normalize weights if they look like relative weights (sum != ~1 and all > 1 or sum >> 1)
  const sum = prizes.reduce((a, p) => a + p.probability, 0)
  if (sum > 1.05 && prizes.every((p) => p.probability >= 0)) {
    for (const p of prizes) {
      p.probability = p.probability / sum
    }
  }

  return prizes
}

function parsePity(raw: unknown): PityState | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>
  const counter = num(p.counter ?? p.current ?? p.pityCounter ?? p.pulls)
  const softPityAt = num(p.softPityAt ?? p.softAt ?? p.soft_pity)
  const hardPityAt = num(p.hardPityAt ?? p.hardAt ?? p.hard_pity ?? p.guaranteeAt)
  const pullsToSoft =
    counter != null && softPityAt != null ? Math.max(0, softPityAt - counter) : null
  const pullsToHard =
    counter != null && hardPityAt != null ? Math.max(0, hardPityAt - counter) : null

  if (counter == null && softPityAt == null && hardPityAt == null) return null

  const bits: string[] = []
  if (counter != null) bits.push(`pity counter ${counter}`)
  if (pullsToSoft != null && softPityAt != null) bits.push(`${pullsToSoft} to soft pity (${softPityAt})`)
  if (pullsToHard != null && hardPityAt != null) bits.push(`${pullsToHard} to hard pity (${hardPityAt})`)

  return {
    counter,
    softPityAt,
    hardPityAt,
    pullsToSoft,
    pullsToHard,
    note: bits.length ? bits.join("; ") : "Pity metadata present but incomplete",
  }
}

function parseQualification(
  raw: unknown,
  ctx?: { userAp?: number; normieCount?: number; isHolder?: boolean; isAwakened?: boolean },
): QualificationGate | null {
  if (!raw || typeof raw !== "object") {
    // also accept flat fields on parent
    return null
  }
  const p = raw as Record<string, unknown>
  const minAp = num(p.minAp ?? p.min_ap ?? p.requiredAp)
  const minNormieCount = num(p.minNormieCount ?? p.minHoldings ?? p.min_normies)
  const requiresHolder =
    typeof p.requiresHolder === "boolean"
      ? p.requiresHolder
      : typeof p.holderOnly === "boolean"
        ? p.holderOnly
        : null
  const requiresAwakened =
    typeof p.requiresAwakened === "boolean"
      ? p.requiresAwakened
      : typeof p.awakenedOnly === "boolean"
        ? p.awakenedOnly
        : null

  if (
    minAp == null &&
    minNormieCount == null &&
    requiresHolder == null &&
    requiresAwakened == null
  ) {
    return null
  }

  let qualified: boolean | null = null
  if (ctx) {
    qualified = true
    if (minAp != null && (ctx.userAp ?? 0) < minAp) qualified = false
    if (minNormieCount != null && (ctx.normieCount ?? 0) < minNormieCount) qualified = false
    if (requiresHolder && !ctx.isHolder) qualified = false
    if (requiresAwakened && !ctx.isAwakened) qualified = false
  }

  const bits: string[] = []
  if (minAp != null) bits.push(`min ${minAp} AP`)
  if (minNormieCount != null) bits.push(`min ${minNormieCount} Normies`)
  if (requiresHolder) bits.push("holder only")
  if (requiresAwakened) bits.push("awakened only")

  return {
    minAp,
    minNormieCount,
    requiresHolder,
    requiresAwakened,
    note: bits.join("; ") || "Qualification rules present",
    qualified,
  }
}

function edgeFromRatio(evRatio: number | null): number | null {
  if (evRatio == null || !Number.isFinite(evRatio)) return null
  return Math.round((evRatio - 1) * 10000) / 100
}

function analyzeGachaPool(
  row: unknown,
  floorETH: number | null,
  source: string,
  ctx?: { userAp?: number; normieCount?: number; isHolder?: boolean; isAwakened?: boolean },
): GachaPoolAnalysis | null {
  if (!row || typeof row !== "object") return null
  const r = row as Record<string, unknown>
  const id = str(r.id ?? r.poolId ?? r.slug, `gacha-${Math.random().toString(36).slice(2, 8)}`)
  const name = str(r.name ?? r.title ?? r.banner, id)
  const costAp = num(r.costAp ?? r.cost_ap ?? r.pullCostAp ?? r.priceAp ?? r.apCost)
  const costEth = num(r.costEth ?? r.cost_eth ?? r.pullCostEth ?? r.priceEth ?? r.ethCost)

  const prizes = parsePrizes(r.prizes ?? r.rewards ?? r.loot, floorETH)
  // single-prize shorthand
  if (!prizes.length && (r.probability != null || r.prizeValueAp != null || r.prizeValueEth != null)) {
    prizes.push({
      name: str(r.prizeName, "Primary prize"),
      probability: num(r.probability) ?? 0,
      valueAp: num(r.prizeValueAp),
      valueEth: num(r.prizeValueEth) ?? floorETH,
    })
  }

  let expectedValueAp: number | null = null
  let expectedValueEth: number | null = null
  if (prizes.length) {
    let ap = 0
    let eth = 0
    let hasAp = false
    let hasEth = false
    for (const p of prizes) {
      if (p.valueAp != null) {
        ap += p.probability * p.valueAp
        hasAp = true
      }
      if (p.valueEth != null) {
        eth += p.probability * p.valueEth
        hasEth = true
      }
    }
    expectedValueAp = hasAp ? Math.round(ap * 1000) / 1000 : null
    expectedValueEth = hasEth ? Math.round(eth * 1e6) / 1e6 : null
  }

  // EV ratio: prefer AP currency
  let evRatio: number | null = null
  if (costAp != null && costAp > 0 && expectedValueAp != null) {
    evRatio = Math.round((expectedValueAp / costAp) * 1000) / 1000
  } else if (costEth != null && costEth > 0 && expectedValueEth != null) {
    evRatio = Math.round((expectedValueEth / costEth) * 1000) / 1000
  }

  const edgePct = edgeFromRatio(evRatio)
  const isPositiveEv = evRatio != null && evRatio > POSITIVE_EV_THRESHOLD
  const isHighValue = edgePct != null && edgePct >= HIGH_VALUE_EDGE_PCT

  const pity = parsePity(r.pity ?? r.pityState ?? r.pity_counter)
  const qualification =
    parseQualification(r.qualification ?? r.requirements ?? r.gates, ctx) ??
    parseQualification(r, ctx)

  const statusRaw = str(r.status ?? r.state, "unknown").toLowerCase()
  const status: GachaPoolAnalysis["status"] =
    statusRaw.includes("end") || statusRaw === "closed"
      ? "ended"
      : statusRaw.includes("active") || statusRaw === "open" || statusRaw === "live"
        ? "active"
        : "unknown"

  return {
    id,
    name,
    status,
    costAp,
    costEth,
    prizes,
    expectedValueAp,
    expectedValueEth,
    evRatio,
    edgePct,
    isPositiveEv,
    isHighValue,
    pity,
    qualification,
    source,
    notes:
      prizes.length === 0
        ? "No prize table in payload — EV incomplete."
        : `EV = Σ(p×value)/cost; ${prizes.length} prize tiers.`,
  }
}

function analyzeRaffle(
  row: unknown,
  floorETH: number | null,
  source: string,
  ctx?: { userAp?: number; normieCount?: number; isHolder?: boolean; isAwakened?: boolean },
): RaffleAnalysis | null {
  if (!row || typeof row !== "object") return null
  const r = row as Record<string, unknown>
  const id = str(r.id ?? r.raffleId ?? r.slug, `raffle-${Math.random().toString(36).slice(2, 8)}`)
  const name = str(r.name ?? r.title ?? r.prizeName, id)

  const entryCostAp = num(r.entryCostAp ?? r.costAp ?? r.ticketAp ?? r.priceAp ?? r.apCost)
  const entryCostEth = num(r.entryCostEth ?? r.costEth ?? r.ticketEth ?? r.priceEth ?? r.ethCost)

  let prizeValueAp = num(r.prizeValueAp ?? r.prizeAp ?? r.valueAp)
  let prizeValueEth =
    num(r.prizeValueEth ?? r.prizeEth ?? r.valueEth ?? r.prizeFloorEth) ??
    (r.prizeType === "normie" || r.kind === "nft" ? floorETH : null)

  // If prize is a token id without value, use collection floor as proxy
  if (prizeValueEth == null && (r.tokenId != null || r.normieId != null)) {
    prizeValueEth = floorETH
  }

  const totalEntries = num(r.totalEntries ?? r.entries ?? r.ticketsSold ?? r.participantCount)
  const winProbability =
    totalEntries != null && totalEntries > 0
      ? 1 / totalEntries
      : num(r.winProbability ?? r.odds ?? r.probability)

  // User formula: raffle EV ratio ≈ prize / (entryCost × odds)
  // Interpreting odds as field size N when totalEntries known: prize/(entry*N) = (prize/N)/entry
  let expectedValueAp: number | null = null
  let expectedValueEth: number | null = null
  let evRatio: number | null = null

  if (winProbability != null && winProbability > 0) {
    if (prizeValueAp != null) {
      expectedValueAp = Math.round(prizeValueAp * winProbability * 1000) / 1000
    }
    if (prizeValueEth != null) {
      expectedValueEth = Math.round(prizeValueEth * winProbability * 1e6) / 1e6
    }
  }

  if (entryCostAp != null && entryCostAp > 0 && prizeValueAp != null && totalEntries != null && totalEntries > 0) {
    // prize / (entry × odds) with odds = N
    evRatio = Math.round((prizeValueAp / (entryCostAp * totalEntries)) * 1000) / 1000
  } else if (entryCostEth != null && entryCostEth > 0 && prizeValueEth != null && totalEntries != null && totalEntries > 0) {
    evRatio = Math.round((prizeValueEth / (entryCostEth * totalEntries)) * 1000) / 1000
  } else if (entryCostAp != null && entryCostAp > 0 && expectedValueAp != null) {
    evRatio = Math.round((expectedValueAp / entryCostAp) * 1000) / 1000
  } else if (entryCostEth != null && entryCostEth > 0 && expectedValueEth != null) {
    evRatio = Math.round((expectedValueEth / entryCostEth) * 1000) / 1000
  }

  const edgePct = edgeFromRatio(evRatio)
  const isPositiveEv = evRatio != null && evRatio > POSITIVE_EV_THRESHOLD
  const isHighValue = edgePct != null && edgePct >= HIGH_VALUE_EDGE_PCT

  const qualification =
    parseQualification(r.qualification ?? r.requirements ?? r.gates, ctx) ??
    parseQualification(r, ctx)

  const statusRaw = str(r.status ?? r.state, "unknown").toLowerCase()
  const status: RaffleAnalysis["status"] =
    statusRaw.includes("end") || statusRaw === "closed" || statusRaw === "drawn"
      ? "ended"
      : statusRaw.includes("active") || statusRaw === "open" || statusRaw === "live"
        ? "active"
        : "unknown"

  const endsAt =
    r.endsAt != null
      ? String(r.endsAt)
      : r.endTime != null
        ? String(r.endTime)
        : r.deadline != null
          ? String(r.deadline)
          : null

  return {
    id,
    name,
    status,
    entryCostAp,
    entryCostEth,
    prizeValueAp,
    prizeValueEth,
    totalEntries,
    winProbability:
      winProbability != null ? Math.round(winProbability * 1e8) / 1e8 : null,
    expectedValueAp,
    expectedValueEth,
    evRatio,
    edgePct,
    isPositiveEv,
    isHighValue,
    qualification,
    endsAt,
    source,
    notes:
      totalEntries == null
        ? "Missing entry count — odds/EV incomplete."
        : `Raffle EV = prize / (entry × ${totalEntries} odds); edge vs fair ticket.`,
  }
}

/**
 * Allocate AP budget across positive-EV opportunities (proportional to edge).
 */
export function recommendApAllocation(
  gacha: GachaPoolAnalysis[],
  raffles: RaffleAnalysis[],
  budgetAp: number,
): GachaRaffleResult["apAllocation"] {
  const budget = Math.max(0, Math.floor(budgetAp))
  type Cand = {
    id: string
    name: string
    kind: "gacha" | "raffle"
    evRatio: number
    costAp: number
    edge: number
  }

  const cands: Cand[] = []
  for (const g of gacha) {
    if (!g.isPositiveEv || g.evRatio == null || g.costAp == null || g.costAp <= 0) continue
    if (g.status === "ended") continue
    cands.push({
      id: g.id,
      name: g.name,
      kind: "gacha",
      evRatio: g.evRatio,
      costAp: g.costAp,
      edge: Math.max(0, g.evRatio - 1),
    })
  }
  for (const r of raffles) {
    if (!r.isPositiveEv || r.evRatio == null || r.entryCostAp == null || r.entryCostAp <= 0) continue
    if (r.status === "ended") continue
    cands.push({
      id: r.id,
      name: r.name,
      kind: "raffle",
      evRatio: r.evRatio,
      costAp: r.entryCostAp,
      edge: Math.max(0, r.evRatio - 1),
    })
  }

  cands.sort((a, b) => b.evRatio - a.evRatio)

  if (!cands.length || budget <= 0) {
    return {
      budgetAp: budget,
      lines: [],
      unallocatedAp: budget,
      note:
        budget <= 0
          ? "No AP budget available on focus Normie — earn/burn for AP before allocating to gacha/raffles."
          : "No positive-EV AP-priced opportunities to allocate into. Hold AP or wait for better pools.",
    }
  }

  const totalEdge = cands.reduce((s, c) => s + Math.max(c.edge, 0.01), 0)
  const lines: ApAllocationLine[] = []
  let remaining = budget

  for (const c of cands) {
    const weight = Math.max(c.edge, 0.01) / totalEdge
    let suggested = Math.floor(budget * weight)
    // Snap down to whole ticket multiples when possible
    if (c.costAp > 0) {
      const tickets = Math.floor(suggested / c.costAp)
      suggested = tickets * c.costAp
    }
    if (suggested > remaining) suggested = remaining - (remaining % c.costAp)
    if (suggested < c.costAp && remaining >= c.costAp && lines.length === 0) {
      // ensure top EV gets at least one pull/ticket if budget allows
      suggested = c.costAp
    }
    if (suggested <= 0) continue
    remaining -= suggested
    lines.push({
      opportunityId: c.id,
      opportunityName: c.name,
      kind: c.kind,
      suggestedAp: suggested,
      sharePct: Math.round(weight * 1000) / 10,
      evRatio: c.evRatio,
      reason: `EV ${c.evRatio.toFixed(2)}× — allocate ~${Math.round(weight * 100)}% of budget by relative edge`,
    })
  }

  // Leftover dust: top line
  if (remaining > 0 && lines.length && cands[0]) {
    const topCost = cands[0].costAp
    const add = remaining - (remaining % topCost)
    if (add > 0) {
      lines[0]!.suggestedAp += add
      remaining -= add
    }
  }

  return {
    budgetAp: budget,
    lines,
    unallocatedAp: remaining,
    note:
      lines.length > 0
        ? `Allocated ${budget - remaining}/${budget} AP across ${lines.length} +EV opportunit${lines.length === 1 ? "y" : "ies"} (proportional to edge; ticket-aligned).`
        : "Could not form ticket-aligned allocation.",
  }
}

let gachaCache: { at: number; result: GachaRaffleResult } | null = null
const GACHA_CACHE_TTL_MS = 5 * 60 * 1000

export async function analyzeGachaRaffle(options?: {
  force?: boolean
  /** Focus Normie Canvas AP for allocation budget */
  budgetAp?: number
  userAp?: number
  normieCount?: number
  isHolder?: boolean
  isAwakened?: boolean
}): Promise<GachaRaffleResult> {
  const now = Date.now()
  if (
    !options?.force &&
    gachaCache &&
    now - gachaCache.at < GACHA_CACHE_TTL_MS
  ) {
    return gachaCache.result
  }

  const ctx = {
    userAp: options?.userAp ?? options?.budgetAp,
    normieCount: options?.normieCount,
    isHolder: options?.isHolder,
    isAwakened: options?.isAwakened,
  }

  const [floor, gachaFetch, raffleFetch] = await Promise.all([
    getLiveCollectionFloor(),
    fetchGachaPools(),
    fetchRaffleListings(),
  ])

  const floorETH = floor?.floorPriceETH ?? null
  const sources = [
    ...gachaFetch.sources,
    ...raffleFetch.sources,
    OPENSEA_COLLECTION_URL,
    NORMIES_API_BASE,
  ]

  const gachaPools: GachaPoolAnalysis[] = []
  for (const row of gachaFetch.rows) {
    const a = analyzeGachaPool(row, floorETH, gachaFetch.sources[0] || "unknown", ctx)
    if (a) gachaPools.push(a)
  }

  const raffles: RaffleAnalysis[] = []
  for (const row of raffleFetch.rows) {
    const a = analyzeRaffle(row, floorETH, raffleFetch.sources[0] || "unknown", ctx)
    if (a) raffles.push(a)
  }

  // Sort by EV desc
  gachaPools.sort((a, b) => (b.evRatio ?? -1) - (a.evRatio ?? -1))
  raffles.sort((a, b) => (b.evRatio ?? -1) - (a.evRatio ?? -1))

  const positiveEv: GachaRaffleResult["positiveEv"] = []
  for (const g of gachaPools) {
    if (g.isPositiveEv && g.evRatio != null) {
      positiveEv.push({
        kind: "gacha",
        id: g.id,
        name: g.name,
        evRatio: g.evRatio,
        edgePct: g.edgePct ?? (g.evRatio - 1) * 100,
      })
    }
  }
  for (const r of raffles) {
    if (r.isPositiveEv && r.evRatio != null) {
      positiveEv.push({
        kind: "raffle",
        id: r.id,
        name: r.name,
        evRatio: r.evRatio,
        edgePct: r.edgePct ?? (r.evRatio - 1) * 100,
      })
    }
  }
  positiveEv.sort((a, b) => b.evRatio - a.evRatio)

  const highValueRaffles = raffles.filter((r) => r.isHighValue)

  const budgetAp = Math.max(0, Math.floor(options?.budgetAp ?? options?.userAp ?? 0))
  const apAllocation = recommendApAllocation(gachaPools, raffles, budgetAp)

  const pitySummary: string[] = []
  for (const g of gachaPools) {
    if (g.pity) pitySummary.push(`${g.name}: ${g.pity.note}`)
  }
  if (!pitySummary.length) {
    pitySummary.push(
      gachaPools.length
        ? "No pity counters published on active pools."
        : "Pity tracking unavailable — no live gacha pools loaded.",
    )
  }

  const qualificationSummary: string[] = []
  for (const g of gachaPools) {
    if (g.qualification) {
      qualificationSummary.push(
        `Gacha ${g.name}: ${g.qualification.note}${g.qualification.qualified == null ? "" : g.qualification.qualified ? " ✓ qualified" : " ✗ not qualified"}`,
      )
    }
  }
  for (const r of raffles) {
    if (r.qualification) {
      qualificationSummary.push(
        `Raffle ${r.name}: ${r.qualification.note}${r.qualification.qualified == null ? "" : r.qualification.qualified ? " ✓ qualified" : " ✗ not qualified"}`,
      )
    }
  }
  if (!qualificationSummary.length) {
    qualificationSummary.push("No qualification thresholds published on loaded opportunities.")
  }

  let dataStatus: GachaRaffleResult["dataStatus"] = "unavailable"
  if (gachaFetch.sources.length || raffleFetch.sources.length) {
    dataStatus =
      gachaPools.length || raffles.length ? "live" : "partial"
  } else if (gachaPools.length || raffles.length) {
    dataStatus = "live"
  }

  const summaryParts: string[] = ["Gacha & Raffle Intelligence"]
  if (dataStatus === "unavailable") {
    summaryParts.push(
      "Live Normies gacha/raffle endpoints are not publicly available yet (probed /gacha, /raffles, lab & pixel-market paths).",
      "When pools go live, EV = Σ(p×prize)/cost for gacha and prize/(entry×field size) for raffles; +EV if ratio > 1.0; high-value raffles if edge ≥ 20%.",
      `Collection floor reference: ${floorETH != null ? `~${floorETH.toFixed(4)} ETH` : "n/a"} (for NFT prize proxies).`,
      "Hold AP for Canvas utility until published odds exist — or set GACHA_RAFFLE_API_BASE when a feed is ready.",
    )
  } else {
    summaryParts.push(
      `Loaded ${gachaPools.length} gacha pool(s), ${raffles.length} raffle(s) (${dataStatus}).`,
      `Positive EV: ${positiveEv.length}; high-value raffles (≥${HIGH_VALUE_EDGE_PCT}% edge): ${highValueRaffles.length}.`,
    )
    if (positiveEv.length) {
      summaryParts.push(
        `Top +EV: ${positiveEv
          .slice(0, 5)
          .map((p) => `${p.kind} ${p.name} ${p.evRatio.toFixed(2)}×`)
          .join(" · ")}`,
      )
    }
    if (apAllocation.lines.length) {
      summaryParts.push(
        `AP allocation (${budgetAp} AP budget): ${apAllocation.lines
          .map((l) => `${l.opportunityName} ${l.suggestedAp} AP`)
          .join("; ")}`,
      )
    } else {
      summaryParts.push(apAllocation.note)
    }
    if (pitySummary[0]) summaryParts.push(`Pity: ${pitySummary[0]}`)
  }
  summaryParts.push(GACHA_RAFFLE_DISCLAIMER)

  const result: GachaRaffleResult = {
    scanned: true,
    dataStatus,
    gachaPools,
    raffles,
    positiveEv,
    highValueRaffles,
    apAllocation,
    pitySummary,
    qualificationSummary,
    floorETH,
    disclaimer: GACHA_RAFFLE_DISCLAIMER,
    summary: summaryParts.join("\n"),
    sources: [...new Set(sources)],
  }

  gachaCache = { at: now, result }
  return result
}
