// POST /api/zulo/ask — A2A-oriented entry (payment hooks scaffolded, free today).
// UI continues to use /api/agent-recommendations; this route is marketplace-ready.

import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"

import {
  getZuloRecommendation,
  MAX_SESSION_HISTORY,
  ZULO_IDENTITY,
  type ZuloResponse,
} from "@/lib/agent-recommendations"
import { MAX_USER_QUERY_CHARS } from "@/lib/agent-recommendations/constants"
// Payment helpers ready for marketplace go-live:
// import { getServicePrice, isHolder, verifyAPPayment } from "@/lib/agent-recommendations/verifyPayment"
import { checkRateLimit } from "@/lib/ratelimit"

type SessionTurn = { userMessage: string; zuloResponse: string }

function sanitizeHistory(raw: unknown): SessionTurn[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter(
      (item): item is SessionTurn =>
        !!item &&
        typeof item === "object" &&
        typeof (item as SessionTurn).userMessage === "string" &&
        typeof (item as SessionTurn).zuloResponse === "string",
    )
    .map((item) => ({
      userMessage: item.userMessage.trim().slice(0, MAX_USER_QUERY_CHARS),
      zuloResponse: item.zuloResponse.trim().slice(0, 4000),
    }))
    .filter((item) => item.userMessage.length > 0 && item.zuloResponse.length > 0)
    .slice(-MAX_SESSION_HISTORY)
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, "zulo-ask", 15, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const payload = (body ?? {}) as Record<string, unknown>
    const userQuery =
      typeof payload.userQuery === "string" ? payload.userQuery.trim() : ""

    if (!userQuery) {
      return NextResponse.json({ error: "userQuery is required" }, { status: 400 })
    }

    if (userQuery.length > MAX_USER_QUERY_CHARS) {
      return NextResponse.json(
        { error: `userQuery must be at most ${MAX_USER_QUERY_CHARS} characters` },
        { status: 400 },
      )
    }

    let normieId: number | undefined
    if (payload.normieId !== undefined && payload.normieId !== null) {
      const n = Number(payload.normieId)
      if (!Number.isFinite(n) || n < 0 || n > 9999) {
        return NextResponse.json(
          { error: "normieId must be a number between 0 and 9999" },
          { status: 400 },
        )
      }
      normieId = n
    }

    let userWallet: string | undefined
    if (typeof payload.userWallet === "string" && payload.userWallet.trim()) {
      if (!isAddress(payload.userWallet)) {
        return NextResponse.json({ error: "userWallet is not a valid address" }, { status: 400 })
      }
      userWallet = payload.userWallet
    }

    const userEns =
      typeof payload.userEns === "string" && payload.userEns.trim()
        ? payload.userEns.trim().slice(0, 128)
        : undefined

    const sessionHistory = sanitizeHistory(payload.sessionHistory)

    // Optional future fields (unused until payment rails live):
    // const service = typeof payload.service === "string" ? payload.service : "holder-chat"
    // const txHash = typeof payload.txHash === "string" ? payload.txHash : ""
    //
    // const price = getServicePrice(service)
    // if (price > 0) {
    //   const holder = userWallet ? await isHolder(userWallet) : false
    //   if (!holder) {
    //     const payment = await verifyAPPayment(txHash, price, service)
    //     if (!payment.verified) {
    //       return NextResponse.json(
    //         { error: "Payment required", price, currency: "AP" },
    //         { status: 402 },
    //       )
    //     }
    //   }
    // }

    const result: ZuloResponse = await getZuloRecommendation({
      userQuery,
      normieId: normieId ?? ZULO_IDENTITY.tokenId,
      sessionHistory,
      userWallet,
      userEns,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"

    if (message.includes("XAI_API_KEY")) {
      return NextResponse.json(
        { error: "XAI_API_KEY is not configured on the server" },
        { status: 500 },
      )
    }

    if (message.includes("xAI API error")) {
      return NextResponse.json(
        { error: "Zulo could not reach the recommendation model. Please try again." },
        { status: 502 },
      )
    }

    console.error("[zulo/ask] Uncaught error:", message)
    return NextResponse.json(
      { error: "Internal error generating recommendations" },
      { status: 500 },
    )
  }
}
