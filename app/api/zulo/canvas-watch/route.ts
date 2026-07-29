// GET /api/zulo/canvas-watch — Canvas Watch cron / manual scan (12h cadence).

import { NextRequest, NextResponse } from "next/server"

import {
  getDefaultWatchlist,
  runCanvasWatch,
} from "@/lib/agent-recommendations/canvasEvolution"
import { checkRateLimit } from "@/lib/ratelimit"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured
  const cronSecret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get("authorization") || ""
  const isCron =
    !!cronSecret &&
    (auth === `Bearer ${cronSecret}` ||
      req.headers.get("x-vercel-cron") === "1")

  if (!isCron) {
    const rl = await checkRateLimit(req, "canvas-watch", 10, 60)
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      )
    }
  }

  try {
    const url = new URL(req.url)
    const force = url.searchParams.get("force") === "1" || isCron
    const rawIds = url.searchParams.get("tokens")
    const tokenIds = rawIds
      ? rawIds
          .split(/[,\s]+/)
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 9999)
      : getDefaultWatchlist()

    const result = await runCanvasWatch({ tokenIds, force })
    return NextResponse.json({
      ok: true,
      cron: isCron,
      ...result,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[canvas-watch]", message)
    return NextResponse.json({ error: "Canvas watch failed" }, { status: 500 })
  }
}
