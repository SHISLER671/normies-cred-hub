// GET /api/zulo/health — readiness + security status (no secrets).

import { NextResponse } from "next/server"

import { NORMIES_API_BASE } from "@/constants/contracts"
import { getLiveCollectionFloor } from "@/lib/agent-recommendations/marketData"
import { getPaymentRailStatus } from "@/lib/agent-recommendations/verifyPayment"
import { getAllZuloSkills } from "@/lib/agent-recommendations/skillsCatalog"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { getCircuitState } from "@/lib/security/circuitBreaker"
import { isSupabaseConfigured } from "@/lib/db/supabase"

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

  checks.upstash = {
    ok: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
    detail:
      process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
        ? "KV configured (rate limit + audit + replay)"
        : "KV missing — in-memory fallbacks active",
  }

  checks.supabase = {
    ok: isSupabaseConfigured(),
    detail: isSupabaseConfigured()
      ? "SUPABASE_URL + SUPABASE_KEY set (shared ThinkOS schema)"
      : "missing SUPABASE_URL / SUPABASE_KEY",
  }

  const circuit = await getCircuitState()
  checks.circuitBreaker = {
    ok: circuit.state === "closed",
    detail: `state=${circuit.state}${circuit.reason ? ` reason=${circuit.reason}` : ""}`,
  }

  const skills = getAllZuloSkills().map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
  }))

  const criticalOk = checks.normiesApi.ok && checks.xaiConfigured.ok
  const status = criticalOk
    ? circuit.paymentsPaused
      ? "degraded"
      : "ok"
    : "degraded"

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
      security: {
        posture: "I assume breach. Every transaction is adversarial.",
        paymentsPaused: circuit.paymentsPaused,
        circuit: circuit.state,
        paymentRail: getPaymentRailStatus(),
        dualRateLimit: true,
        auditLog: true,
        headers: ["HSTS", "X-Content-Type-Options", "X-Frame-Options", "CSP"],
      },
      checks,
      skills,
      endpoints: {
        ask: "/api/zulo/ask",
        manifest: "/api/zulo/manifest",
        canvasWatch: "/api/zulo/canvas-watch",
        pulse: "/api/zulo/pulse/{tokenId}",
        history: "/api/zulo/history",
        currencies: "/api/zulo/currencies",
        health: "/api/zulo/health",
        security: "/api/zulo/security",
        securityReport: "/api/zulo/security/report",
        paymentVerify: "/api/zulo/payments/verify",
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
