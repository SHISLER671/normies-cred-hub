// GET /api/zulo/pulse/[tokenId]
// Live UI snapshot: CredHub PULSE + canvas + rarity + opportunities (no mocks).

import { NextRequest, NextResponse } from "next/server"

import { buildZuloContext } from "@/lib/agent-recommendations/buildContext"
import type { ZuloPulseApiResponse, ZuloPulseView } from "@/lib/agent-recommendations/types"
import { parseTokenId } from "@/lib/api/agent-pulse"

function rarityTier(rank: number | null | undefined): string {
  if (rank == null || !Number.isFinite(rank)) return "unknown"
  if (rank <= 100) return "legendary"
  if (rank <= 500) return "epic"
  if (rank <= 1500) return "rare"
  if (rank <= 4000) return "uncommon"
  return "common"
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId: tokenIdStr } = await params
  const tokenId = parseTokenId(tokenIdStr)

  if (tokenId === null) {
    return NextResponse.json(
      { pulse: null, zuloAP: 0, error: "Invalid token ID (must be 0–9999)" } satisfies ZuloPulseApiResponse,
      { status: 400 },
    )
  }

  try {
    const ctx = await buildZuloContext({ normieId: tokenId })
    const typeRaw = ctx.normie.traits.Type ?? ctx.normie.agent.type ?? "Unknown"
    const type = String(typeRaw)

    const customized = !!ctx.normie.canvas?.customized
    const actionPoints = ctx.normie.canvas?.actionPoints ?? 0
    const level = ctx.normie.canvas?.level ?? 0

    const rank = ctx.platformContext?.rarityRank ?? ctx.normie.rarity?.rank ?? null
    const score = ctx.platformContext?.rarityScore ?? ctx.normie.rarity?.score ?? null

    const pulse: ZuloPulseView = {
      tokenId,
      type,
      status: ctx.normie.agent.status,
      canvas: {
        edited: customized,
        actionPoints,
        level,
      },
      rarity: {
        rank,
        score,
        tier: rarityTier(rank),
      },
      agent: {
        id: ctx.normie.agent.id,
        name: ctx.normie.agent.name,
        reputation: ctx.normie.agent.reputation,
        services: ["recommendations", "pulse-analysis", "strategy"],
      },
      credHub: ctx.platformContext?.pulse,
      pulseSummary: ctx.platformContext?.pulseSummary,
      recommendations: ctx.platformContext?.earningOpportunities ?? [],
      lastUpdated: ctx.platformContext?.currentTime ?? new Date().toISOString(),
    }

    const zuloAP =
      ctx.platformContext?.zuloAPBalance ??
      ctx.platformContext?.zuloCanvasAPBalance ??
      0

    const body: ZuloPulseApiResponse = { pulse, zuloAP }

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    })
  } catch (err) {
    console.error("[zulo/pulse] failed:", err)
    return NextResponse.json(
      {
        pulse: null,
        zuloAP: 0,
        error: "Failed to load PULSE",
      } satisfies ZuloPulseApiResponse,
      { status: 502 },
    )
  }
}
