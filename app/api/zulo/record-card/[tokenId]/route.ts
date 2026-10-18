// GET /api/zulo/record-card/{tokenId}
// The Normie record card as JSON (docs/zulo/record-card-spec.md). Read-only, no wallet, no signing.
// Every value carries its label (verified / pending / unavailable), source and as-of time.
// Separate from the Pulse endpoints so reading a card doesn't count as a Pulse check.

import { type NextRequest, NextResponse } from "next/server"

import { parseTokenId } from "@/lib/api/agent-pulse"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { loadRecordCard } from "@/lib/record-card/load"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "record-card" })
  if (!rl.ok) return rl.response

  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw)
  if (tokenId === null) {
    return NextResponse.json({ error: "Invalid token ID (must be 0–9999)" }, { status: 400 })
  }

  const card = await loadRecordCard(tokenId)
  return NextResponse.json(card, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  })
}
