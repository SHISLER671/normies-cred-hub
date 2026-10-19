// GET /api/zulo/metrics — operator-facing Pulse + Paths usage counters.
// Auth: Authorization: Bearer ${CRON_SECRET}. Not a public dashboard.

import { NextRequest, NextResponse } from "next/server"

import { getUsageMetrics } from "@/lib/instrumentation/pulse-paths"
import { checkRateLimit } from "@/lib/ratelimit"
import { isAuthorizedCron } from "@/lib/security/cron-auth"

export const dynamic = "force-dynamic"

// Only the bearer secret counts, compared in constant time. The `x-vercel-cron` header is NOT proof: anyone can send it.
function isAuthorized(req: NextRequest): boolean {
  return isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)
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
