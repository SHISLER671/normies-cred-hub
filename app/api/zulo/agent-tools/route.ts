import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"

import { parseTokenId } from "@/lib/api/agent-pulse"
import { fetchAgentPulse } from "@/lib/api/pulse-client"
import { buildZuloToolContext } from "@/lib/erc8257/context"
import {
  prepareZuloRegistryTools,
  ZULO_HORIZON_PREVIEW_LIMIT,
} from "@/lib/erc8257/zulo-select"
import type { HorizonAgentToolPreview } from "@/lib/zulo-horizon"
import { checkRateLimit } from "@/lib/ratelimit"

/** Ranked Agent Tools preview for Zulo Horizon insights (ERC-8257 registry). */
export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "zulo-agent-tools", 20, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const { searchParams } = new URL(req.url)
  const tokenId = parseTokenId(searchParams.get("tokenId"))
  const walletParam = searchParams.get("wallet")?.trim()
  const wallet = walletParam && isAddress(walletParam) ? walletParam : undefined
  const agentType = searchParams.get("agentType")?.trim() || undefined
  const isAwakened = searchParams.get("awakened") === "1"

  if (tokenId === null) {
    return NextResponse.json({ error: "Invalid tokenId (must be 0–9999)" }, { status: 400 })
  }

  try {
    const pulseResult = await fetchAgentPulse(tokenId, { req })
    const pulse = pulseResult.ok ? pulseResult.data : null

    const ctx = buildZuloToolContext({
      tokenId,
      agentType,
      isAwakened,
      pulse,
      holderAddress: wallet,
    })

    const selected = await prepareZuloRegistryTools({
      ctx,
      holderAddress: wallet,
      limit: ZULO_HORIZON_PREVIEW_LIMIT,
      maxAccessChecks: wallet ? 25 : 0,
    })

    const tools: HorizonAgentToolPreview[] = selected.map((tool) => ({
      name: tool.name,
      toolId: tool.toolId,
      chain: tool.chain,
      accessNote: tool.access.accessNote,
      accessGranted: tool.access.accessGranted,
    }))

    return NextResponse.json({ tools })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[zulo/agent-tools] failed:", message)
    return NextResponse.json({ error: "Failed to load agent tools" }, { status: 502 })
  }
}