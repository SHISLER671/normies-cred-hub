import { type NextRequest, NextResponse } from "next/server"

import { bodyToParams } from "@/lib/ap-check/body"
import { planForBudget, planForPixels } from "@/lib/ap-check/buy-smart"
import { loadBuySmart } from "@/lib/ap-check/buy-smart-load"
import { COMPARE_API_NOTES } from "@/lib/ap-check/compare-api"
import { checkRateLimit } from "@/lib/ratelimit"

/**
 * Market or burn? (moved here from /api/ap-check?calc=, 2026-11-10). Lives under /burn because AGENTS.md fences every
 * buy-vs-burn view to /burn, with "Not financial advice" and "values can go up or down; no one knows the future".
 *
 * GET  /api/burn/ap-check?calc=pixels&amount=500   both routes to 500 pixels: Pixel Market cost, and floor Normies to burn
 * GET  /api/burn/ap-check?calc=eth&amount=0.5      both routes for 0.5 ETH: pixels from the market, pixels from burns
 * POST /api/burn/ap-check {"calc":"eth","amount":0.5} the same.
 *
 * Public data only (api.normies.art order book, OpenSea listings re-read on chain). Nothing here can sign or move anything.
 */
export const maxDuration = 20
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 4_096

export async function GET(req: NextRequest) {
  const limited = await rateLimited(req)
  if (limited) return limited
  return answer(req.nextUrl.searchParams, false)
}

export async function POST(req: NextRequest) {
  const limited = await rateLimited(req)
  if (limited) return limited
  let raw: string
  try {
    raw = await req.text()
  } catch {
    return NextResponse.json({ error: "Could not read the request body.", code: "invalid_body" }, { status: 400 })
  }
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Body too large.", code: "invalid_body" }, { status: 413 })
  let parsed: unknown = {}
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Body must be JSON, e.g. {"calc":"pixels","amount":500}.', code: "invalid_body" }, { status: 400 })
    }
  }
  const params = bodyToParams(parsed)
  if (!params) return NextResponse.json({ error: 'Body must be a JSON object, e.g. {"calc":"pixels","amount":500}.', code: "invalid_body" }, { status: 400 })
  return answer(params, true)
}

async function rateLimited(req: NextRequest): Promise<NextResponse | null> {
  const rl = await checkRateLimit(req, "burn-ap-check", 20, 60)
  if (rl.ok) return null
  return NextResponse.json(
    { error: "Too many requests. Patience compounds.", code: "rate_limit", retryable: true },
    { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
  )
}

async function answer(sp: URLSearchParams, isPost: boolean): Promise<NextResponse> {
  const cache = isPost ? { "Cache-Control": "no-store" } : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" }
  const calc = sp.get("calc")
  if (calc !== "pixels" && calc !== "eth") {
    return NextResponse.json({ error: "pass calc=pixels or calc=eth, with amount", code: "invalid_calc" }, { status: 400 })
  }
  const amount = Number(sp.get("amount"))
  const ok = calc === "pixels" ? Number.isInteger(amount) && amount > 0 && amount <= 1_000_000 : amount > 0 && amount <= 1_000
  if (!ok) return NextResponse.json({ error: "amount must be a positive whole number of pixels (calc=pixels) or ETH up to 1000 (calc=eth)", code: "invalid_amount" }, { status: 400 })
  try {
    const inputs = await loadBuySmart()
    if (!inputs) return NextResponse.json({ error: "listings or the Pixel Market could not be read", code: "unavailable", retryable: true }, { status: 502 })
    const depth = inputs.book && !inputs.book.paused ? inputs.book.depth : null
    const plan = calc === "pixels" ? planForPixels(inputs.picks, depth, amount) : planForBudget(inputs.picks, depth, amount)
    return NextResponse.json(
      { answer: plan, yieldMode: inputs.yieldMode, modeSource: inputs.modeSource, listingsChecked: inputs.listingsChecked, liveConfirmed: inputs.liveConfirmed, asOf: inputs.asOf, ...COMPARE_API_NOTES },
      { headers: cache },
    )
  } catch (err) {
    console.error("[burn ap-check] unexpected failure", err)
    return NextResponse.json({ error: "Something went wrong on our side.", code: "internal", retryable: true }, { status: 500 })
  }
}
