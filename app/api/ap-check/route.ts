import { type NextRequest, NextResponse } from "next/server"

import { parseTokenInput } from "@/lib/ap-check/core"
import { checkListings, checkToken, checkWallet } from "@/lib/ap-check/load"
import { normalizeWalletInput } from "@/lib/burn-buy/wallet-input"
import { checkRateLimit } from "@/lib/ratelimit"

/**
 * GET /api/ap-check?token=7141   live AP attached to one Normie (from the chain), the locked / free split, our last census
 *                                 value, and the open item offers on it.
 * GET /api/ap-check?wallet=0x…   every open Normies item offer that wallet has made, each next to its Normie's live AP, with
 *                                 the risky ones (AP gone or down) first.
 * GET /api/ap-check?listings=1   the cheapest listings whose live pixels are below what OpenSea shows, or below our census.
 *
 * Public data only. Nothing here can sign, approve or move anything.
 */
export const maxDuration = 20
export const dynamic = "force-dynamic"

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS = /^(?=.{3,255}$)(?:[a-z0-9-]+\.)+eth$/i
const HEADERS = { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" }

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "ap-check", 20, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Patience compounds.", code: "rate_limit", retryable: true },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const sp = req.nextUrl.searchParams
  const tokenRaw = sp.get("token")
  const walletRaw = sp.get("wallet")

  try {
    if (sp.get("listings") === "1") {
      const result = await checkListings()
      if (result.kind === "error") return NextResponse.json({ error: result.message, code: "unavailable", retryable: true }, { status: 502 })
      return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } })
    }
    if (tokenRaw !== null) {
      const tokenId = parseTokenInput(tokenRaw)
      if (tokenId === null) return NextResponse.json({ error: "token must be a Normie id from 0 to 9999", code: "invalid_token" }, { status: 400 })
      return NextResponse.json(await checkToken(tokenId), { headers: HEADERS })
    }
    if (walletRaw !== null) {
      const wallet = normalizeWalletInput(walletRaw)
      if (!(ADDRESS.test(wallet) || ENS.test(wallet))) {
        return NextResponse.json({ error: "wallet must be a 0x address or an .eth name", code: "invalid_wallet" }, { status: 400 })
      }
      const result = await checkWallet(wallet)
      if (result.kind === "error") return NextResponse.json({ error: result.message, code: "unavailable", retryable: true }, { status: 502 })
      return NextResponse.json(result, { headers: HEADERS })
    }
    return NextResponse.json({ error: "pass ?token=<id>, ?wallet=<0x address or .eth name>, or ?listings=1", code: "missing_input" }, { status: 400 })
  } catch (err) {
    console.error("[ap-check] unexpected failure", err)
    return NextResponse.json({ error: "Something went wrong.", code: "internal" }, { status: 500 })
  }
}
