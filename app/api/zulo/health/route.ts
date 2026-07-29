// GET /api/zulo/health — readiness for A2A + strategy skills (no secrets).

import { NextResponse } from "next/server"

import { getLiveCollectionFloor } from "@/lib/agent-recommendations/marketData"
import { getPaymentRailStatus } from "@/lib/agent-recommendations/verifyPayment"
import { getAllZuloSkills } from "@/lib/agent-recommendations/skillsCatalog"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { NORMIES_API_BASE } from "@/constants/contracts"

export const dynamic = "force-dynamic"
export const maxDuration = 15

export async function GET() {
  const checks: Record<
    string,
    { ok: boolean; detail?: string; latencyMs?: number }
  > = {}

  const t0 = Date.now()
  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}/history/stats`,
      {},
      6_000,
    )
    checks.normiesApi = {
      ok: res.ok,
      detail: res.ok ? "history/stats reachable" : `HTTP ${res.status}`,
      latencyMs: Date.now() - t0,
    }
  } catch (e) {
    checks.normiesApi = {
      ok: false,
      detail: e instanceof Error ? e.message : "unreachable",
      latencyMs: Date.now() - t0,
    }
  }

  const t1 = Date.now()
  try {
    const floor = await getLiveCollectionFloor()
    checks.openseaFloor = {
      ok: floor?.floorPriceETH != null,
      detail:
        floor?.floorPriceETH != null
          ? `~${floor.floorPriceETH} ETH (${floor.source})`
          : "floor unavailable (key optional)",
      latencyMs: Date.now() - t1,
    }
  } catch (e) {
    checks.openseaFloor = {
      ok: false,
      detail: e instanceof Error ? e.message : "error",
      latencyMs: Date.now() - t1,
    }
  }

  checks.xaiConfigured = {
    ok: Boolean(process.env.XAI_API_KEY?.trim()),
    detail: process.env.XAI_API_KEY?.trim()
      ? "XAI_API_KEY set"
      : "missing XAI_API_KEY",
  }

  checks.paymentRail = {
    ok: true,
    detail: getPaymentRailStatus(),
  }

  const skills = getAllZuloSkills().map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
  }))

  const criticalOk = checks.normiesApi.ok && checks.xaiConfigured.ok
  const status = criticalOk ? "ok" : "degraded"

  return NextResponse.json(
    {
      status,
      agent: {
        name: ZULO_IDENTITY.name,
        tokenId: ZULO_IDENTITY.tokenId,
        agentId: ZULO_IDENTITY.agentId,
        ens: ZULO_IDENTITY.ens,
        role: "strategic-architect",
      },
      checks,
      skills,
      endpoints: {
        ask: "/api/zulo/ask",
        manifest: "/api/zulo/manifest",
        canvasWatch: "/api/zulo/canvas-watch",
        pulse: "/api/zulo/pulse/{tokenId}",
      },
      asOf: new Date().toISOString(),
    },
    {
      status: criticalOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}
