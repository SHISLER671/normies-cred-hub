// GET /api/arena-rank
// Arena skill rank, step 1: Arena agents from the official records with their raw counts (rounds played, wins) and where
// each stands against the ranking minimum. Nobody is ranked yet. Read-only: official Arena data (api.normies.art) through
// the polite Arena reader. No amounts, no wallets, no Pulse checks. A track record, never a tip. DYOR.

import { type NextRequest, NextResponse } from "next/server"

import { arenaRankResponse } from "@/lib/arena-rank/core"
import { loadArenaRank } from "@/lib/arena-rank/load"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"

export const maxDuration = 20

export async function GET(req: NextRequest) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "arena-rank" })
  if (!rl.ok) return rl.response

  const { status, body, cacheControl } = arenaRankResponse(await loadArenaRank())
  return NextResponse.json(body, { status, headers: { "Cache-Control": cacheControl } })
}
