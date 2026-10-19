import { getAgentPulse, parseTokenId } from "@/lib/api/agent-pulse"
import {
  extractCallerWallet,
  recordPulseCall,
  usageCallerKey,
} from "@/lib/instrumentation/pulse-paths"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { scheduleUsageWork } from "@/lib/instrumentation/schedule-usage-work"
import { type NextRequest, NextResponse } from "next/server"

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
}

/**
 * Public Pulse endpoint — agent-readable reputation signal.
 * Calculated on the fly from Normies API + ERC-8004 on-chain reads.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "agent-pulse-get" })
  if (!rl.ok) return rl.response

  const { tokenId: tokenIdStr } = await params
  const tokenId = parseTokenId(tokenIdStr)

  if (tokenId === null) {
    return NextResponse.json({ error: "Invalid token ID (must be 0–9999)" }, { status: 400 })
  }

  const result = await getAgentPulse(tokenId, { chatRatings: true })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } })
  }

  const callerWallet = extractCallerWallet(req)
  scheduleUsageWork(() =>
    recordPulseCall({
      tokenId,
      agentId: result.data.agent_id,
      source: "get",
      callerWallet,
      pulseLevel: result.data.pulse_level,
      callerKey: usageCallerKey(req),
    }),
  )

  return NextResponse.json(result.data, { headers: CACHE_HEADERS })
}