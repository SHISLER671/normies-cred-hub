// lib/db/supabase.ts
// Shared Supabase client for CredHub Zulo — same tables as ThinkOS.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/** Mirrors ThinkOS `floor_prices` table. */
export type FloorPriceRow = {
  id?: number
  floor_eth: number
  floor_usd: number | null
  source?: string | null
  recorded_at?: string
}

/** Mirrors ThinkOS `burn_opportunities` table. */
export type BurnOpportunityRow = {
  id?: number
  token_id: number | null
  efficiency_score: number | null
  floor_price_eth: number | null
  detected_at?: string | null
  alerted?: boolean
}

/** Mirrors ThinkOS `workflow_runs` table. */
export type WorkflowRunRow = {
  id?: number
  workflow_name: string | null
  status: string | null
  result: unknown
  started_at?: string | null
  completed_at?: string | null
}

export type HistoricalFloorPoint = {
  floor_eth: number
  floor_usd?: number | null
  source?: string | null
  recorded_at: string
}

export type FloorTrendSummary = {
  points: HistoricalFloorPoint[]
  sampleSize: number
  avgFloorETH: number | null
  minFloorETH: number | null
  maxFloorETH: number | null
  latestFloorETH: number | null
  days: number
}

let cachedClient: SupabaseClient | null = null

/**
 * Lazy Supabase client from SUPABASE_URL + SUPABASE_KEY.
 * Returns null when env is missing so callers can degrade gracefully.
 */
export function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !key) {
    return null
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  return cachedClient
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() != null
}

/**
 * Persist a floor-price snapshot (ThinkOS-compatible columns).
 */
export async function saveFloorPrice(
  floorETH: number,
  floorUSD: number | null | undefined,
  source?: string | null,
): Promise<FloorPriceRow | null> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn("[supabase] saveFloorPrice skipped — SUPABASE_URL/KEY not set")
    return null
  }

  if (!Number.isFinite(floorETH) || floorETH <= 0) {
    return null
  }

  const row: FloorPriceRow = {
    floor_eth: floorETH,
    floor_usd:
      floorUSD != null && Number.isFinite(floorUSD) ? Number(floorUSD) : null,
    source: source ?? null,
  }

  const { data, error } = await supabase
    .from("floor_prices")
    .insert([row])
    .select()
    .maybeSingle()

  if (error) {
    console.error("[supabase] saveFloorPrice error:", error.message)
    return null
  }

  return (data as FloorPriceRow) ?? null
}

/**
 * Historical floor samples for the last N days (default 7).
 * Ordered newest-first — same shape as ThinkOS `getHistoricalFloor`.
 */
export async function getHistoricalFloor(
  days: number = 7,
): Promise<HistoricalFloorPoint[]> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn(
      "[supabase] getHistoricalFloor skipped — SUPABASE_URL/KEY not set",
    )
    return []
  }

  const lookbackDays = Math.max(1, Math.min(90, Math.floor(days) || 7))
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString()

  const { data, error } = await supabase
    .from("floor_prices")
    .select("floor_eth, floor_usd, source, recorded_at")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(5000)

  if (error) {
    console.error("[supabase] getHistoricalFloor error:", error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  const points: HistoricalFloorPoint[] = []
  for (const r of data) {
    if (
      r == null ||
      typeof r.floor_eth !== "number" ||
      !Number.isFinite(r.floor_eth) ||
      typeof r.recorded_at !== "string"
    ) {
      continue
    }
    points.push({
      floor_eth: r.floor_eth,
      floor_usd: r.floor_usd ?? null,
      source: r.source ?? null,
      recorded_at: r.recorded_at,
    })
  }
  return points
}

/**
 * Aggregate floor trend for history API / burn-efficiency comparisons.
 */
export async function getFloorTrend(
  days: number = 7,
): Promise<FloorTrendSummary> {
  const points = await getHistoricalFloor(days)
  if (points.length === 0) {
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

  const ethValues = points.map((p) => p.floor_eth)
  const sum = ethValues.reduce((a, b) => a + b, 0)
  return {
    points,
    sampleSize: points.length,
    avgFloorETH: Math.round((sum / ethValues.length) * 1e6) / 1e6,
    minFloorETH: Math.min(...ethValues),
    maxFloorETH: Math.max(...ethValues),
    latestFloorETH: points[0]?.floor_eth ?? null,
    days,
  }
}

/**
 * Logged burn opportunities (ThinkOS `burn_opportunities` table).
 */
export async function getBurnOpportunities(options?: {
  days?: number
  limit?: number
  minEfficiency?: number
}): Promise<BurnOpportunityRow[]> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn(
      "[supabase] getBurnOpportunities skipped — SUPABASE_URL/KEY not set",
    )
    return []
  }

  const days = Math.max(1, Math.min(90, options?.days ?? 30))
  const limit = Math.max(1, Math.min(500, options?.limit ?? 50))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  let query = supabase
    .from("burn_opportunities")
    .select(
      "id, token_id, efficiency_score, floor_price_eth, detected_at, alerted",
    )
    .gte("detected_at", since)
    .order("detected_at", { ascending: false })
    .limit(limit)

  if (
    options?.minEfficiency != null &&
    Number.isFinite(options.minEfficiency)
  ) {
    query = query.gte("efficiency_score", options.minEfficiency)
  }

  const { data, error } = await query

  if (error) {
    // Older rows may have null detected_at — fall back without time filter
    if (error.message?.includes("detected_at")) {
      const fallback = await supabase
        .from("burn_opportunities")
        .select(
          "id, token_id, efficiency_score, floor_price_eth, detected_at, alerted",
        )
        .order("id", { ascending: false })
        .limit(limit)
      if (fallback.error) {
        console.error(
          "[supabase] getBurnOpportunities error:",
          fallback.error.message,
        )
        return []
      }
      return (fallback.data as BurnOpportunityRow[]) ?? []
    }
    console.error("[supabase] getBurnOpportunities error:", error.message)
    return []
  }

  return (data as BurnOpportunityRow[]) ?? []
}

/**
 * Persist a burn opportunity row (high-efficiency candidate).
 */
export async function saveBurnOpportunity(input: {
  tokenId: number
  efficiencyScore: number
  floorPriceETH: number
  alerted?: boolean
  detectedAt?: string
}): Promise<BurnOpportunityRow | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const row = {
    token_id: input.tokenId,
    efficiency_score: input.efficiencyScore,
    floor_price_eth: input.floorPriceETH,
    detected_at: input.detectedAt ?? new Date().toISOString(),
    alerted: input.alerted ?? false,
  }

  const { data, error } = await supabase
    .from("burn_opportunities")
    .insert([row])
    .select()
    .maybeSingle()

  if (error) {
    console.error("[supabase] saveBurnOpportunity error:", error.message)
    return null
  }

  return (data as BurnOpportunityRow) ?? null
}

/**
 * Optional workflow run logging (shared ThinkOS table).
 */
export async function logWorkflowRun(input: {
  workflowName: string
  status: string
  result?: unknown
  startedAt?: string
  completedAt?: string
}): Promise<WorkflowRunRow | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const row = {
    workflow_name: input.workflowName,
    status: input.status,
    result: input.result ?? null,
    started_at: input.startedAt ?? null,
    completed_at: input.completedAt ?? new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("workflow_runs")
    .insert([row])
    .select()
    .maybeSingle()

  if (error) {
    console.error("[supabase] logWorkflowRun error:", error.message)
    return null
  }

  return (data as WorkflowRunRow) ?? null
}
