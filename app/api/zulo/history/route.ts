// GET /api/zulo/history — floor price trends + burn opportunity history (Supabase).

import { NextRequest, NextResponse } from "next/server"

import {
  getBurnOpportunities,
  getFloorTrend,
  isSupabaseConfigured,
} from "@/lib/db/supabase"
import { checkRateLimit } from "@/lib/ratelimit"

export const dynamic = "force-dynamic"
export const maxDuration = 20

function parseDays(raw: string | null, fallback: number): number {
  if (raw == null || raw === "") return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(90, Math.floor(n)))
}

function parseLimit(raw: string | null, fallback: number): number {
  if (raw == null || raw === "") return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(200, Math.floor(n)))
}

/**
 * Query params:
 * - days: floor lookback window (default 7, max 90)
 * - oppDays: burn opportunity lookback (default 30)
 * - limit: max burn opportunity rows (default 50)
 * - minEfficiency: optional filter on efficiency_score
 */
export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "zulo-history", 30, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase not configured",
        detail:
          "Set SUPABASE_URL and SUPABASE_KEY (shared ThinkOS project) on this deployment.",
        floorTrend: null,
        burnOpportunities: [],
        asOf: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const url = new URL(req.url)
  const days = parseDays(url.searchParams.get("days"), 7)
  const oppDays = parseDays(url.searchParams.get("oppDays"), 30)
  const limit = parseLimit(url.searchParams.get("limit"), 50)
  const minEffRaw = url.searchParams.get("minEfficiency")
  const minEfficiency =
    minEffRaw != null && minEffRaw !== "" && Number.isFinite(Number(minEffRaw))
      ? Number(minEffRaw)
      : undefined

  try {
    const [floorTrend, burnOpportunities] = await Promise.all([
      getFloorTrend(days),
      getBurnOpportunities({ days: oppDays, limit, minEfficiency }),
    ])

    // Light response: cap floor points for payload size (keep full stats)
    const MAX_POINTS = 500
    const points =
      floorTrend.points.length > MAX_POINTS
        ? floorTrend.points.slice(0, MAX_POINTS)
        : floorTrend.points

    // Current vs 7d avg helpers for clients
    const current = floorTrend.latestFloorETH
    const avg = floorTrend.avgFloorETH
    let pctVsAvg: number | null = null
    if (current != null && avg != null && avg > 0) {
      pctVsAvg = Math.round(((current - avg) / avg) * 10_000) / 100
    }

    return NextResponse.json(
      {
        ok: true,
        asOf: new Date().toISOString(),
        schema: {
          tables: ["floor_prices", "burn_opportunities"],
          note: "Shared with ThinkOS Zulo — same Supabase project",
        },
        floorTrend: {
          days: floorTrend.days,
          sampleSize: floorTrend.sampleSize,
          avgFloorETH: floorTrend.avgFloorETH,
          minFloorETH: floorTrend.minFloorETH,
          maxFloorETH: floorTrend.maxFloorETH,
          latestFloorETH: floorTrend.latestFloorETH,
          pctVsAvg,
          points,
        },
        burnOpportunities: burnOpportunities.map((o) => ({
          id: o.id,
          tokenId: o.token_id,
          efficiencyScore: o.efficiency_score,
          floorPriceETH: o.floor_price_eth,
          detectedAt: o.detected_at,
          alerted: o.alerted ?? false,
        })),
        meta: {
          floorLookbackDays: days,
          burnOppLookbackDays: oppDays,
          burnOppLimit: limit,
          minEfficiency: minEfficiency ?? null,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[zulo/history]", message)
    return NextResponse.json(
      { ok: false, error: "Failed to load history", detail: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
