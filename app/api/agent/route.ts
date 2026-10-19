import { getAgentPulse, parseTokenId } from "@/lib/api/agent-pulse"
import {
  extractCallerWallet,
  recordPulseCall,
  usageCallerKey,
} from "@/lib/instrumentation/pulse-paths"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { scheduleUsageWork } from "@/lib/instrumentation/schedule-usage-work"
import { type NextRequest, NextResponse } from "next/server"

// Every check must reach this function to be counted toward popularity (see the GET route), so nothing is cached.
const CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
}

/**
 * ERC-8257 tool endpoint — POST with { tokenId } for agent discovery probes.
 */
export async function POST(req: NextRequest) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "agent-pulse-post" })
  if (!rl.ok) return rl.response

  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const tokenId = parseTokenId(
    body && typeof body === "object" ? (body as { tokenId?: unknown }).tokenId : undefined,
  )

  if (tokenId === null) {
    return NextResponse.json({ error: "Invalid token ID (must be 0–9999)" }, { status: 400 })
  }

  const result = await getAgentPulse(tokenId, { chatRatings: true })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } })
  }

  const callerWallet = extractCallerWallet(req, body)
  scheduleUsageWork(() =>
    recordPulseCall({
      tokenId,
      agentId: result.data.agent_id,
      source: "tool",
      callerWallet,
      pulseLevel: result.data.pulse_level,
      callerKey: usageCallerKey(req),
    }),
  )

  return NextResponse.json(result.data, { headers: CACHE_HEADERS })
}