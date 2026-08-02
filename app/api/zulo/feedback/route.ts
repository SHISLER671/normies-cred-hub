// POST /api/zulo/feedback — Path Board 👍/👎 (store + dual credit).
// GET  /api/zulo/feedback — Zulo #32626 helpful aggregate (public counts only).
// Additive. Free. No ranker influence. No payment enforcement.

import { NextRequest, NextResponse } from "next/server"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import {
  getZuloHelpfulStats,
  isSupabaseConfigured,
  saveRecommendationFeedback,
} from "@/lib/db/supabase"
import {
  enforceDualRateLimit,
  RATE_LIMIT_MESSAGE,
} from "@/lib/middleware/rateLimit"
import {
  formatZodError,
  pathFeedbackBodySchema,
} from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

/**
 * Record a Path Board rating. Credits recommended publisher + Zulo #32626.
 * Wallet optional. Rate-limited by IP (+ wallet when present).
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Feedback storage unavailable", code: "supabase_required" },
        { status: 503 },
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const rl = await enforceDualRateLimit(req, "default", {
      body,
      bucketPrefix: "zulo-feedback",
    })
    if (!rl.ok) {
      if (rl.response) return rl.response
      return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const parsed = pathFeedbackBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 },
      )
    }

    const d = parsed.data
    const saved = await saveRecommendationFeedback({
      rating: d.rating,
      pathId: d.pathId,
      pathKind: d.pathKind,
      pathTitle: d.pathTitle,
      publisherName: d.publisherName,
      publisherAgentId: d.publisherAgentId,
      publisherTokenId: d.publisherTokenId,
      zuloAgentId: ZULO_IDENTITY.agentId,
      zuloTokenId: ZULO_IDENTITY.tokenId,
      intentTag: d.intentTag,
      intentRaw: d.intentRaw,
      subjectTokenId: d.subjectTokenId,
      wallet: d.wallet?.toLowerCase() ?? null,
      context: d.context ?? "path-board",
    })

    if (!saved) {
      return NextResponse.json(
        {
          error:
            "Could not store feedback. Ensure recommendation_feedback table exists (docs/sql/001_recommendation_feedback.sql).",
          code: "feedback_store_failed",
        },
        { status: 503 },
      )
    }

    const stats = await getZuloHelpfulStats(ZULO_IDENTITY.agentId)

    return NextResponse.json(
      {
        ok: true as const,
        rating: d.rating,
        credited: {
          pathId: d.pathId,
          publisherName: d.publisherName ?? null,
          publisherAgentId: d.publisherAgentId ?? null,
          zuloAgentId: ZULO_IDENTITY.agentId,
        },
        helpful: stats
          ? {
              label: `Helpful ratings · Zulo #${ZULO_IDENTITY.agentId}`,
              count: stats.helpfulCount,
            }
          : null,
        note:
          "Ratings build Zulo’s trackable reputation in CredHub today. On-chain tips and TBA rails activate when serc enables x402 + ERC-6551 for #7141.",
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    console.error("[api/zulo/feedback POST]", err)
    return NextResponse.json(
      { error: "Feedback failed" },
      { status: 500 },
    )
  }
}

/**
 * Public aggregate: helpful (👍) count for Zulo #32626. No wallets.
 */
export async function GET(req: NextRequest) {
  try {
    const rl = await enforceDualRateLimit(req, "default", {
      bucketPrefix: "zulo-feedback-get",
    })
    if (!rl.ok) {
      if (rl.response) return rl.response
      return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Feedback storage unavailable", code: "supabase_required" },
        { status: 503 },
      )
    }

    const stats = await getZuloHelpfulStats(ZULO_IDENTITY.agentId)
    if (!stats) {
      return NextResponse.json(
        {
          error:
            "Could not load stats. Ensure recommendation_feedback table exists.",
          code: "feedback_stats_failed",
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        ok: true as const,
        zuloAgentId: stats.zuloAgentId,
        helpfulCount: stats.helpfulCount,
        label: `Helpful ratings · Zulo #${stats.zuloAgentId}`,
        asOf: stats.asOf,
        note:
          "Ratings build Zulo’s trackable reputation in CredHub today. On-chain tips and TBA rails activate when serc enables x402 + ERC-6551 for #7141.",
        // totalRatings kept server-side only in response meta for ops (not "down" breakdown)
        _meta: { totalRatings: stats.totalRatings },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (err) {
    console.error("[api/zulo/feedback GET]", err)
    return NextResponse.json(
      { error: "Feedback stats failed" },
      { status: 500 },
    )
  }
}
