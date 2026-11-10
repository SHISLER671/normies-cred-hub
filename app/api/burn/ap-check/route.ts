import { type NextRequest, NextResponse } from "next/server"

import { bodyToParams } from "@/lib/ap-check/body"
import { compareResponse } from "@/lib/ap-check/compare-answer"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"

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

/** AGENTS.md: every route that calls an outside service uses enforceDualRateLimit (per IP and per wallet). */
async function rateLimited(req: NextRequest): Promise<NextResponse | null> {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "burn-ap-check" })
  return rl.ok ? null : rl.response
}

function answer(sp: URLSearchParams, isPost: boolean): Promise<NextResponse> {
  return compareResponse(sp, isPost)
}
