// GET /api/zulo/history — floor price trends (Supabase).
// AGENTS.md: burn rankings are fenced to /burn, so no burn opportunity list here.

import { NextRequest, NextResponse } from "next/server"

import { getFloorTrend, isSupabaseConfigured } from "@/lib/db/supabase"
import {
  enforceDualRateLimit,
  RATE_LIMIT_MESSAGE,
} from "@/lib/middleware/rateLimit"

export const dynamic = "force-dynamic"
export const maxDuration = 20

function parseDays(raw: string | null, fallback: number): number {
  if (raw == null || raw === "") return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(90, Math.floor(n)))
}

/**
 * Query params:
 * - days: floor lookback window (default 7, max 90)
 */
export async function GET(req: NextRequest) {
  const rl = await enforceDualRateLimit(req, "default", {
    bucketPrefix: "zulo-history",
  })
  if (!rl.ok) {
    if (rl.response) return rl.response
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase not configured",
        detail:
          "Set SUPABASE_URL and SUPABASE_KEY (shared ThinkOS project) on this deployment.",
        floorTrend: null,
        asOf: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const url = new URL(req.url)
  const days = parseDays(url.searchParams.get("days"), 7)
  try {
    const floorTrend = await getFloorTrend(days)

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
          tables: ["floor_prices"],
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
        meta: {
          floorLookbackDays: days,
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
