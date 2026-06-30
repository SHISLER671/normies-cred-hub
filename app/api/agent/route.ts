import { getAgentPulse, parseTokenId } from "@/lib/api/agent-pulse"
import { type NextRequest, NextResponse } from "next/server"

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
}

/**
 * ERC-8257 tool endpoint — POST with { tokenId } for agent discovery probes.
 */
export async function POST(req: NextRequest) {
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

  const result = await getAgentPulse(tokenId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { headers: CACHE_HEADERS })
}