// GET /api/cron/retention — daily delete of rows past the /privacy retention (Move ratings and Zulo answers, 180 days).
// Cron-only: the bearer CRON_SECRET is required (isAuthorizedCron). No other caller can trigger it.

import { type NextRequest, NextResponse } from "next/server"

import { purgeExpiredRows } from "@/lib/db/retention"
import { runRetentionCron } from "@/lib/db/retention-cron"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const r = await runRetentionCron(req.headers.get("authorization"), process.env.CRON_SECRET, () => purgeExpiredRows())
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } })
}
