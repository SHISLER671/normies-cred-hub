// GET /api/symphony/voice/{tokenId}[?block=N] — everything Pixel Symphony needs to compose one Normie, in one cached
// request. Read-only. Without `block`: the live pixels, plus the current Ethereum block so the player can pin a share link.
// With `block`: the pixels as they were at that block (see lib/symphony/load.ts). Nothing is stored.

import { type NextRequest, NextResponse } from "next/server"

import { parseTokenId } from "@/lib/api/agent-pulse"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { loadVoice, SymphonyUpstreamError } from "@/lib/symphony/load"
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
  const head = await headBlock()
  // A block that hasn't happened yet can't be pinned: it would be cached for a week as if it could never change.
  if (askedBlock !== null && head !== null && askedBlock > head) {
    return NextResponse.json({ error: "That block hasn't happened yet" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  let voice: Awaited<ReturnType<typeof loadVoice>>
  try {
    voice = await loadVoice(tokenId, askedBlock)
  } catch (err) {
    if (!(err instanceof SymphonyUpstreamError)) throw err
    return NextResponse.json(
      { error: "Couldn't read this Normie's history right now. Try again shortly." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    )
  }
  if (!voice) {
    return NextResponse.json({ error: `Couldn't read #${tokenId}'s pixels (it may be burned)` }, { status: 404 })
  }

  return NextResponse.json(
    {
      ...voice,
      block: askedBlock ?? head,
      pinned: askedBlock !== null,
      source: { pixels: "api.normies.art (/normie/{id}/pixels, or /history/normie/{id}/version/{v}/pixels at a block)", traits: `GET /normie/${tokenId}/metadata (attributes; /traits only if /metadata fails)`, awakened: `GET /agents/binding/${tokenId}` },
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
