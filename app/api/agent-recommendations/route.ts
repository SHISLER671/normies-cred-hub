// app/api/agent-recommendations/route.ts
// Server wrapper for the standalone Zulo recommendations plugin (xAI).
// Unlisted surface — does not modify existing Venice/Horizon Zulo routes.

import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"

import {
  getZuloRecommendation,
  MAX_SESSION_HISTORY,
  ZULO_IDENTITY,
  type ZuloResponse,
} from "@/lib/agent-recommendations"
import { MAX_USER_QUERY_CHARS } from "@/lib/agent-recommendations/constants"
import { zuloErrorToResponse } from "@/lib/agent-recommendations/generate"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"

export const maxDuration = 60
export const dynamic = "force-dynamic"

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
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const rl = await enforceDualRateLimit(req, "default", {
      body,
      bucketPrefix: "agent-recommendations",
    })
    if (!rl.ok) return rl.response

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

    const result: ZuloResponse = await getZuloRecommendation({
      userQuery,
      normieId: normieId ?? ZULO_IDENTITY.tokenId,
      sessionHistory,
      userWallet,
      userEns,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const mapped = zuloErrorToResponse(err)
    console.error("[agent-recommendations]", mapped.body.code ?? "error", mapped.body.error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}
