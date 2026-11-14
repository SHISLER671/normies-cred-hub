// POST /api/cron/owner-since-backfill — one-off operator job: fill normie_index.owner_since from the Normies contract's Transfer
// logs for the last 30 days (lib/ownership-check-backfill.ts). Operator-only: the bearer CRON_SECRET is required (isAuthorizedCron).
// Not on any schedule. Read-only on-chain; the only write is owner_since in NCH's own index (needs SUPABASE_SERVICE_ROLE_KEY).
//
// Run it after supabase/sql/2026-11-14-normie-owner-since.sql is applied. Each call scans a slice and answers with `next`:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://<site>/api/cron/owner-since-backfill"
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://<site>/api/cron/owner-since-backfill?<next>"
// Repeat with each new `next` until "done": true. Add dry=1 to scan and count without writing. A 503 means: repeat the same call.

import { type NextRequest, NextResponse } from "next/server"

import { defaultBackfillDeps, runOwnerSinceBackfill } from "@/lib/ownership-check-backfill"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const r = await runOwnerSinceBackfill(
    req.headers.get("authorization"),
    process.env.CRON_SECRET,
    req.nextUrl.searchParams,
    () => defaultBackfillDeps(),
  )
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } })
}
