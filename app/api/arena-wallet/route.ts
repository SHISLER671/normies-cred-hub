// GET /api/arena-wallet?wallet=<0x address or name.eth>
// That wallet's Normies in the Arena: each one's official state and status line, with a link to its record card.
// Read-only: official Arena data (api.normies.art) through the polite Arena reader. No amounts. Wallet in, public data
// out: only a 0x address or an ENS name is accepted, and input that fails the check is never echoed back.

import { type NextRequest, NextResponse } from "next/server"

import { arenaWalletResponse } from "@/lib/arena-wallet/core"
import { loadArenaWallet } from "@/lib/arena-wallet/load"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"

export const maxDuration = 20

export async function GET(req: NextRequest) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "arena-wallet" })
  if (!rl.ok) return rl.response

  const result = await loadArenaWallet(req.nextUrl.searchParams.get("wallet"))
  const { status, body, cacheControl } = arenaWalletResponse(result)
  return NextResponse.json(body, { status, headers: { "Cache-Control": cacheControl } })
}
