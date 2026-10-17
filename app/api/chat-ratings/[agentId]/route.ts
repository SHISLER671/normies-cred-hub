// GET /api/chat-ratings/{agentId}
// Ranked Hive chat ratings for any ERC-8004 agent, straight from the Reputation Registry.
// Read-only: no wallet, no signing. Separate from the Pulse endpoints so the dashboard can show ratings
// without counting as a Pulse check (Pulse checks feed the Luminous usage signal).

import { type NextRequest, NextResponse } from "next/server"

import { getChatRatings, parseAgentId } from "@/lib/chat-ratings/load"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "chat-ratings" })
  if (!rl.ok) return rl.response

  const { agentId: raw } = await params
  const agentId = parseAgentId(raw)
  if (agentId === null) {
    return NextResponse.json({ error: "Invalid agent ID (positive integer)" }, { status: 400 })
  }

  const summary = await getChatRatings(agentId)

  return NextResponse.json(summary, {
    headers: {
      // Short cache when the registry read failed so a blip doesn't stick.
      "Cache-Control": summary.available
        ? "public, s-maxage=300, stale-while-revalidate=600"
        : "public, s-maxage=30",
    },
  })
}
