import { type NextRequest, NextResponse } from "next/server"

import { realDeps } from "@/lib/burn-buy/data"
import { buildBurnBuy, SourceError } from "@/lib/burn-buy/service"
import { checkRateLimit } from "@/lib/ratelimit"

/**
 * GET /api/burn-buy[?wallet=0x...|name.eth]
 *
 * With a wallet: per-token burn/keep verdicts, current Pixel Market score, and ranked moves.
 * Without: just the market (best burn fodder per ETH) and the census. Every response lists which data
 * sources worked and how fresh they are. Public on-chain data only; nothing here can sign or spend.
 */
export const maxDuration = 20
export const dynamic = "force-dynamic"

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS = /^(?=.{3,255}$)(?:[a-z0-9-]+\.)+eth$/i

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "burn-buy", 12, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Patience compounds.", code: "rate_limit", retryable: true },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const raw = req.nextUrl.searchParams.get("wallet")?.trim()
  if (raw && !(ADDRESS.test(raw) || ENS.test(raw))) {
    return NextResponse.json(
      { error: "wallet must be a 0x address or an .eth name", code: "invalid_wallet" },
      { status: 400 },
    )
  }

  try {
    const result = await buildBurnBuy({ wallet: raw || undefined }, realDeps)
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        // Points API clients at the machine-readable description of this endpoint.
        Link: '</openapi/burn-buy.json>; rel="service-desc"; type="application/json"',
      },
    })
  } catch (err) {
    if (err instanceof SourceError) {
      if (err.kind === "invalid-input") {
        return NextResponse.json({ error: err.message, code: "invalid_wallet", source: err.source }, { status: 400 })
      }
      console.error("[burn-buy] upstream failure", err.source, err.message)
      return NextResponse.json(
        { error: err.message, code: "upstream_unavailable", source: err.source, retryable: true },
        { status: 502 },
      )
    }
    console.error("[burn-buy] unexpected failure", err)
    return NextResponse.json({ error: "Something went wrong.", code: "internal" }, { status: 500 })
  }
}
