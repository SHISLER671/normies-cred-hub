// GET /api/zulo/canvas-watch — Canvas Watch cron / manual scan (12h cadence).

import { NextRequest, NextResponse } from "next/server"

import {
  getDefaultWatchlist,
  runCanvasWatch,
} from "@/lib/agent-recommendations/canvasEvolution"
import { purgeExpiredRows } from "@/lib/db/retention"
import { checkRateLimit } from "@/lib/ratelimit"
import { isAuthorizedCron } from "@/lib/security/cron-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Most token ids the cron may ask to scan in one call (the default watchlist is capped at 25 too). */
const MAX_CUSTOM_TOKENS = 25

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured. x-vercel-cron alone is spoofable and is ignored.
  const isCron = isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)

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
    // Only the authorized cron may force a full rescan; public callers get the cached / throttled path.
    const force = isCron
    // A custom list is cron-only and capped: a public `?tokens=0,1,…,9999` used to fan out 10,000 × 4 upstream reads.
    const rawIds = isCron ? url.searchParams.get("tokens") : null
    const custom = rawIds
      ? [...new Set(rawIds.split(/[,\s]+/).filter((t) => /^\d{1,4}$/.test(t)).map(Number))].slice(0, MAX_CUSTOM_TOKENS)
      : []
    const tokenIds = custom.length ? custom : getDefaultWatchlist()

    const result = await runCanvasWatch({ tokenIds, force })
    // The cron also enforces the /privacy retention (ratings and Zulo answers, 180 days) when nobody is writing.
    const retention = isCron ? await purgeExpiredRows() : undefined
    return NextResponse.json({
      ok: true,
      cron: isCron,
      ...result,
      ...(retention ? { retention } : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[canvas-watch]", message)
    return NextResponse.json({ error: "Canvas watch failed" }, { status: 500 })
  }
}
