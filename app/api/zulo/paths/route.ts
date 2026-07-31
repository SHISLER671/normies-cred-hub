// POST /api/zulo/paths — Path Board ranking (intent → 3–5 Pulse-weighted paths).
// Additive agent-callable surface. Does not enforce payments. Does not break Pulse APIs.

import { NextRequest, NextResponse } from "next/server"

import { rankPaths } from "@/lib/path-ranker"
import { enforceDualRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/middleware/rateLimit"
import {
  formatZodError,
  pathRankBodySchema,
} from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Rank efficient agent/tool paths for a light intent.
 *
 * Body: { intent?, intentTag?, tokenId?, wallet?, limit? }
 * At least one of intent | intentTag required.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const rl = await enforceDualRateLimit(req, "default", {
      body,
      bucketPrefix: "zulo-paths",
    })
    if (!rl.ok) {
      if (rl.response) return rl.response
      return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const parsed = pathRankBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 },
      )
    }

    const { intent, intentTag, tokenId, wallet, limit } = parsed.data

    const result = await rankPaths({
      intent: intent?.trim() || undefined,
      intentTag,
      tokenId,
      wallet,
      limit,
    })

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[api/zulo/paths]", err)
    return NextResponse.json(
      { error: "Path ranking failed" },
      { status: 500 },
    )
  }
}

/**
 * Optional GET for simple agent callers:
 * /api/zulo/paths?intentTag=burn&tokenId=7141&wallet=0x…
 */
export async function GET(req: NextRequest) {
  const rl = await enforceDualRateLimit(req, "default", {
    bucketPrefix: "zulo-paths-get",
  })
  if (!rl.ok) {
    if (rl.response) return rl.response
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
  }

  const url = new URL(req.url)
  const intent = url.searchParams.get("intent") ?? undefined
  const intentTagRaw = url.searchParams.get("intentTag") ?? undefined
  const tokenRaw = url.searchParams.get("tokenId")
  const wallet = url.searchParams.get("wallet") ?? undefined
  const limitRaw = url.searchParams.get("limit")

  const body = {
    intent,
    intentTag: intentTagRaw,
    tokenId:
      tokenRaw != null && tokenRaw !== ""
        ? Number(tokenRaw)
        : undefined,
    wallet: wallet || undefined,
    limit: limitRaw != null && limitRaw !== "" ? Number(limitRaw) : 5,
  }

  const parsed = pathRankBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 },
    )
  }

  try {
    const result = await rankPaths({
      intent: parsed.data.intent?.trim() || undefined,
      intentTag: parsed.data.intentTag,
      tokenId: parsed.data.tokenId,
      wallet: parsed.data.wallet,
      limit: parsed.data.limit,
    })
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    console.error("[api/zulo/paths GET]", err)
    return NextResponse.json(
      { error: "Path ranking failed" },
      { status: 500 },
    )
  }
}
