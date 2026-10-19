// GET /api/symphony/voice/{tokenId}[?block=N] — everything Pixel Symphony needs to compose one Normie, in one cached
// request. Read-only. Without `block`: the live pixels, plus the current Ethereum block so the player can pin a share link.
// With `block`: the pixels as they were at that block (see lib/symphony/load.ts). Nothing is stored.

import { type NextRequest, NextResponse } from "next/server"

import { parseTokenId } from "@/lib/api/agent-pulse"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { loadVoice } from "@/lib/symphony/load"
import { parseBlock } from "@/lib/symphony/pin"
import { publicClient } from "@/lib/viem-client"

async function headBlock(): Promise<number | null> {
  try {
    return Number(await publicClient.getBlockNumber())
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tokenId: string }> }) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "symphony" })
  if (!rl.ok) return rl.response

  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw)
  if (tokenId === null) return NextResponse.json({ error: "Invalid token ID (must be 0–9999)" }, { status: 400 })

  const askedBlock = parseBlock(req.nextUrl.searchParams.get("block"))
  const [voice, head] = await Promise.all([loadVoice(tokenId, askedBlock), askedBlock ? Promise.resolve(null) : headBlock()])
  if (!voice) {
    return NextResponse.json({ error: `Couldn't read #${tokenId}'s pixels (it may be burned)` }, { status: 404 })
  }

  return NextResponse.json(
    {
      ...voice,
      block: askedBlock ?? head,
      pinned: askedBlock !== null,
      source: { pixels: "api.normies.art (/normie/{id}/pixels, or /history/normie/{id}/version/{v}/pixels at a block)", traits: `GET /normie/${tokenId}/traits` },
      as_of: new Date().toISOString(),
    },
    {
      headers: {
        // A pinned block never changes, so it can be cached for a long time; live pixels for 5 minutes.
        "Cache-Control": askedBlock ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  )
}
