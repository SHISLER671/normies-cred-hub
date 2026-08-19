// GET /api/zulo/metrics — operator-facing Pulse + Paths usage counters.
// Auth: Authorization: Bearer ${CRON_SECRET}. Not a public dashboard.

import { NextRequest, NextResponse } from "next/server"

import { getUsageMetrics } from "@/lib/instrumentation/pulse-paths"
import { checkRateLimit } from "@/lib/ratelimit"

export const dynamic = "force-dynamic"

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get("authorization") || ""
  if (secret && auth === `Bearer ${secret}`) return true
  if (secret && req.headers.get("x-vercel-cron") === "1") return true
  return false
}

export async function GET(req: NextRequest) {
  const authorized = isAuthorized(req)
  if (!authorized) {
    const rl = await checkRateLimit(req, "zulo-metrics", 10, 60)
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      )
    }

    const secretConfigured = Boolean(process.env.CRON_SECRET?.trim())
    if (secretConfigured || process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const url = new URL(req.url)
  const includeEvents = url.searchParams.get("events") === "1"

  const metrics = await getUsageMetrics({ includeEvents })
  return NextResponse.json(metrics, {
    headers: { "Cache-Control": "no-store" },
  })
}
